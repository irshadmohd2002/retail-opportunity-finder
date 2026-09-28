import { supabase } from "./supabase";

export const PAGE_SIZE = 1000; // PostgREST's default max rows per request

/**
 * Reads a whole table page by page -- a single select silently stops at 1000
 * rows. Pages use .range() with an explicit order on `orderBy` (the key
 * column(s)); without an order, Postgres may return rows in a different order
 * per request, so pages can skip or duplicate rows.
 */
export async function fetchAllRows<T = Record<string, unknown>>(
  table: string,
  columns: string,
  orderBy: string[]
): Promise<T[]> {
  if (orderBy.length === 0) throw new Error(`fetchAllRows(${table}) needs at least one order column`);
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase.from(table).select(columns);
    for (const col of orderBy) query = query.order(col);
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Could not read existing ${table} rows: ${error.message}`);
    const page = (data ?? []) as unknown as T[];
    all.push(...page);
    if (page.length < PAGE_SIZE) return all;
  }
}
