import { describe, expect, it, vi } from "vitest";

/**
 * A fake PostgREST client whose stored rows are in shuffled order. An ordered
 * query returns a stable, sorted view (like Postgres with ORDER BY); an
 * unordered query returns a differently shuffled view on every request, which
 * is how unordered pages skip and duplicate rows.
 */
const fake = vi.hoisted(() => {
  const tables: Record<string, Record<string, unknown>[]> = {};
  const calls: { table: string; orderBy: string[]; from: number; to: number }[] = [];
  let seed = 12345;
  const shuffled = <T,>(items: T[]): T[] => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const j = seed % (i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  class Query {
    private orderBy: string[] = [];
    constructor(private table: string) {}
    select() {
      return this;
    }
    order(column: string) {
      this.orderBy.push(column);
      return this;
    }
    range(from: number, to: number) {
      calls.push({ table: this.table, orderBy: [...this.orderBy], from, to });
      const rows = tables[this.table] ?? [];
      const view =
        this.orderBy.length > 0
          ? [...rows].sort((a, b) => {
              for (const col of this.orderBy) {
                const x = String(a[col]);
                const y = String(b[col]);
                if (x !== y) return x < y ? -1 : 1;
              }
              return 0;
            })
          : shuffled(rows);
      return Promise.resolve({ data: view.slice(from, to + 1), error: null });
    }
  }
  return { tables, calls, shuffled, supabase: { from: (table: string) => new Query(table) } };
});

vi.mock("./supabase", () => ({ supabase: fake.supabase }));

import { validateImport } from "./csvImport";
import { fetchAllRows } from "./fetchAllRows";
import { RO_PROFILES_SCHEMA, fetchRoProfilesDbContext } from "./csvSchemas";

const ID_COUNT = 2500; // three pages of up to 1000

function loadProfiles() {
  const ids = Array.from({ length: ID_COUNT }, (_, i) => `ro-${String(i).padStart(4, "0")}`);
  fake.tables.ro_profiles = fake.shuffled(
    ids.map((id, i) => ({
      id,
      name: `Pump ${i}`,
      state: "Delhi",
      district: "Delhi",
      latitude: null,
      longitude: null,
      pincode: null,
      plot_sqm: 300,
      vacant_sqm: 100,
    }))
  );
  fake.tables.format_economics = [{ code: "A1.3" }, { code: "A1.1" }];
  fake.tables.omcs = [{ id: 1, name: "Indian Oil Corporation" }];
  return ids;
}

describe("fetchAllRows: paged reads", () => {
  it("pages with .range() and an explicit order, returning every row exactly once from shuffled storage", async () => {
    const ids = loadProfiles();
    fake.calls.length = 0;

    const rows = await fetchAllRows<{ id: string }>("ro_profiles", "id", ["id"]);

    expect(rows).toHaveLength(ID_COUNT);
    expect(new Set(rows.map((r) => r.id)).size).toBe(ID_COUNT);
    expect(rows.map((r) => r.id)).toEqual(ids); // stable order across pages
    expect(fake.calls.map((c) => [c.from, c.to])).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
    expect(fake.calls.every((c) => c.orderBy.join() === "id")).toBe(true);
  });

  it("orders by every key column, in order", async () => {
    fake.tables.brand_partnerships = fake.shuffled([
      { brand_name: "B", format_code: "A1.1" },
      { brand_name: "A", format_code: "A1.2" },
      { brand_name: "A", format_code: "A1.1" },
    ]);
    fake.calls.length = 0;
    const rows = await fetchAllRows<{ brand_name: string; format_code: string }>(
      "brand_partnerships",
      "brand_name, format_code",
      ["brand_name", "format_code"]
    );
    expect(fake.calls[0].orderBy).toEqual(["brand_name", "format_code"]);
    expect(rows.map((r) => `${r.brand_name}/${r.format_code}`)).toEqual(["A/A1.1", "A/A1.2", "B/A1.1"]);
  });

  it("refuses to page without an order column (unordered pages can skip or duplicate rows)", async () => {
    await expect(fetchAllRows("ro_profiles", "id", [])).rejects.toThrow(/order column/);
  });
});

describe("fetchRoProfilesDbContext: classification past the first 1000 rows", () => {
  it("classifies rows on every page as updates even though the pages arrive from shuffled storage", async () => {
    loadProfiles();
    const ctx = await fetchRoProfilesDbContext();
    expect(ctx.existingKeys.size).toBe(ID_COUNT);

    const csvRow = (id: string) => ({
      "ID (slug, unique)": id,
      Name: `Pump ${id}`,
      Type: "urban",
      OMC: "Indian Oil Corporation",
      "Vacant area (sqm)": "400", // stored plot is 300, so this must fail the merged vacant <= plot check
    });
    const ids = ["ro-0000", "ro-0999", "ro-1000", "ro-1999", "ro-2000", "ro-2499"];
    const rows = validateImport(RO_PROFILES_SCHEMA, ids.map(csvRow), ctx).rows;

    // Every row (including those beyond the first 1000) is recognised as existing, so its stored plot is used.
    for (const r of rows) {
      expect(r.errors).toHaveLength(1);
      expect(r.errors[0]).toContain("using stored Plot area (sqm) = 300");
    }

    const fine = validateImport(RO_PROFILES_SCHEMA, [{ ...csvRow("ro-2200"), "Vacant area (sqm)": "50" }], ctx).rows[0];
    expect(fine.action).toBe("update");
    const brandNew = validateImport(RO_PROFILES_SCHEMA, [csvRow("ro-9999")], ctx).rows[0];
    expect(brandNew.action).toBe("insert");
  });
});
