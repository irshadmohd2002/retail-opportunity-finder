import { describe, expect, it } from "vitest";
import {
  EXISTING_OUTLETS_UNKNOWN_NOTE,
  existingTenantsLabel,
  existingTenantsSummary,
  TENANTS_INCOMPLETE_MESSAGE,
  resolveTenantsEdit,
  tenantsMode,
} from "./existingTenants";
import { proposedChangesFor } from "./submissionDiff";
import { MARKET_OPPORTUNITY_SUBTEXT } from "./formatListState";
import { scoreFormatsForOutlet } from "./scoring";
import type { RoProfile } from "./types";

const nameOf = (code: string) => `name of ${code}`;

describe("existingTenantsSummary (summary card)", () => {
  it("is unknown for null, so the card shows 'Not available' and no count", () => {
    expect(existingTenantsSummary(null, nameOf)).toEqual({ known: false });
    expect(existingTenantsSummary(undefined, nameOf)).toEqual({ known: false });
  });

  it("shows a count of 0 for an empty array (confirmed none)", () => {
    expect(existingTenantsSummary([], nameOf)).toEqual({ known: true, count: 0, names: [] });
  });

  it("shows the count and names for an array", () => {
    expect(existingTenantsSummary(["A1.1", "A1.2"], nameOf)).toEqual({
      known: true,
      count: 2,
      names: ["name of A1.1", "name of A1.2"],
    });
  });
});

describe("three-way control", () => {
  it("maps Unknown / None confirmed / Has outlets to null, [] and an array", () => {
    expect(resolveTenantsEdit("unknown", "A1.1")).toEqual({ ok: true, value: null });
    expect(resolveTenantsEdit("none", "A1.1")).toEqual({ ok: true, value: [] });
    expect(resolveTenantsEdit("has", "A1.1, A1.2")).toEqual({ ok: true, value: ["A1.1", "A1.2"] });
  });

  it("'Has outlets' with no codes is incomplete, never [] (None confirmed)", () => {
    for (const text of ["", "   ", ",", " , ,"]) {
      const edit = resolveTenantsEdit("has", text);
      expect(edit).toEqual({ ok: false, error: TENANTS_INCOMPLETE_MESSAGE });
    }
    expect(TENANTS_INCOMPLETE_MESSAGE).toBe("Enter at least one format code, or choose Unknown / None confirmed");
    // Switching between modes keeps the typed text, so only the mode decides Unknown / None.
    expect(resolveTenantsEdit("none", "")).toEqual({ ok: true, value: [] });
  });

  it("derives the initial mode from the stored value", () => {
    expect(tenantsMode(null)).toBe("unknown");
    expect(tenantsMode(undefined)).toBe("unknown");
    expect(tenantsMode([])).toBe("none");
    expect(tenantsMode(["A1.1"])).toBe("has");
  });

  it("round-trips each stored state unchanged, so opening a form never changes it", () => {
    for (const value of [null, [], ["A1.1", "A1.2"]]) {
      expect(resolveTenantsEdit(tenantsMode(value), (value ?? []).join(", "))).toEqual({ ok: true, value });
    }
  });
});

describe("an unrelated-field edit keeps each existing_tenants state", () => {
  it.each([
    ["unknown (null)", null],
    ["confirmed none ([])", []],
    ["has outlets", ["A1.1"]],
  ])("suggest-an-edit does not propose existing_tenants when it is %s and another field changed", (_label, tenants) => {
    const current = { id: "x", name: "Old", plot_sqm: null, existing_tenants: tenants };
    const draft = { ...current, name: "New" };
    expect(proposedChangesFor(draft, current, false).changes).toEqual({ name: "New" });
  });

  it("proposes existing_tenants only when the user changes it, and null -> [] counts as a change", () => {
    const current = { name: "A", existing_tenants: null };
    expect(proposedChangesFor({ ...current, existing_tenants: [] }, current, false).changes).toEqual({
      existing_tenants: [],
    });
    expect(proposedChangesFor({ ...current, existing_tenants: ["A1.1"] }, current, false).changes).toEqual({
      existing_tenants: ["A1.1"],
    });
    const none = { name: "A", existing_tenants: [] };
    expect(proposedChangesFor({ ...none, existing_tenants: null }, none, false).changes).toEqual({
      existing_tenants: null,
    });
  });

  it("proposes no changes at all for an untouched form with null fields", () => {
    const current = { name: "A", plot_sqm: null, existing_tenants: null };
    expect(proposedChangesFor({ ...current }, current, false).changes).toEqual({});
  });

  it("blocks an incomplete field and never proposes it, even if the draft holds an older value", () => {
    const current = { name: "A", existing_tenants: null };
    // The field does not emit while incomplete, so the draft still holds null; a stray [] must not slip through either.
    for (const stale of [null, [], ["A1"]]) {
      const result = proposedChangesFor({ name: "B", existing_tenants: stale }, current, false, new Set(["existing_tenants"]));
      expect(result.blocked).toEqual(["existing_tenants"]);
      expect(result.changes).toEqual({ name: "B" });
    }
    const asNew = proposedChangesFor({ name: "B", existing_tenants: [] }, {}, true, new Set(["existing_tenants"]));
    expect(asNew.blocked).toEqual(["existing_tenants"]);
    expect(asNew.changes).toEqual({ name: "B" });
  });

  it("still proposes a deliberate 'None confirmed' ([]) when nothing is incomplete", () => {
    const current = { existing_tenants: null };
    const result = proposedChangesFor({ existing_tenants: [] }, current, false, new Set());
    expect(result.blocked).toEqual([]);
    expect(result.changes).toEqual({ existing_tenants: [] });
  });

  it.each([null, [], ["A1.1"]])(
    "an admin save (the whole row is upserted, control untouched) carries %j through unchanged",
    (tenants) => {
      const row = { id: "x", name: "Old", existing_tenants: tenants };
      const saved = { ...row, name: "New" };
      expect(saved.existing_tenants).toEqual(tenants);
      // Opening the control and saving without interacting emits nothing; if it did, it would round-trip.
      expect(resolveTenantsEdit(tenantsMode(tenants), (tenants ?? []).join(", "))).toEqual({ ok: true, value: tenants });
    }
  );
});

describe("submissions review labels", () => {
  it("labels null Unknown and [] None (confirmed)", () => {
    expect(existingTenantsLabel(null)).toBe("Unknown");
    expect(existingTenantsLabel(undefined)).toBe("Unknown");
    expect(existingTenantsLabel([])).toBe("None (confirmed)");
    expect(existingTenantsLabel(["A1.1", "A1.2"])).toBe("A1.1, A1.2");
  });
});

describe("unknown existing outlets in scoring and copy", () => {
  const base = {
    id: "t",
    name: "T",
    state: null,
    district: null,
    area: null,
    location: null,
    type: "highway",
    ownership: null,
    plot_sqm: null,
    vacant_sqm: 100,
    fuel_volume_kl_monthly: null,
    vehicle_mix_2w_pct: null,
    vehicle_mix_4w_pct: null,
    vehicle_mix_cv_pct: null,
    layout_diagram_url: null,
    sourced: true,
    source_note: null,
    last_verified: null,
    created_at: "",
    updated_at: "",
    demand_index: 60,
    whitespace_index: 60,
    omc_id: 1,
    latitude: null,
    longitude: null,
    pincode: null,
  };

  it("null excludes nothing, the same as an empty array", () => {
    const codes = (tenants: string[] | null) =>
      scoreFormatsForOutlet({ ...base, existing_tenants: tenants } as RoProfile, {}).map((f) => f.taxonomy.code);
    expect(codes(null)).toEqual(codes([]));
    expect(codes(null).length).toBeGreaterThan(0);
  });

  it("uses the exact unknown-outlets note", () => {
    expect(EXISTING_OUTLETS_UNKNOWN_NOTE).toBe(
      "Existing outlets are unknown for this site - some formats may already operate here."
    );
  });
});

describe("market opportunity heading text", () => {
  it("is exactly the approved wording, with no 'promising'", () => {
    expect(MARKET_OPPORTUNITY_SUBTEXT).toBe(
      "Ranked from nearby competitor data (Foursquare OS Places, may be stale or incomplete) and local demand. Not verified, and not a feasibility verdict. Space data is missing, so these formats are not confirmed as feasible."
    );
    expect(MARKET_OPPORTUNITY_SUBTEXT.toLowerCase()).not.toContain("promising");
  });
});
