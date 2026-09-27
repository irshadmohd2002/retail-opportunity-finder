import { distance } from "fastest-levenshtein";

/** Comparison-only normalization: trim + collapse whitespace + lowercase. Never mutates stored data. */
function normalizeForComparison(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Normalized similarity in [0, 1]: 1 - editDistance / max(length). Strings
 * shorter than 3 characters (after normalization) are never compared -- too
 * noisy at that length to mean anything.
 */
export function similarity(a: string, b: string): number {
  const normA = normalizeForComparison(a);
  const normB = normalizeForComparison(b);
  if (normA.length < 3 || normB.length < 3) return 0;
  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1;
  return 1 - distance(normA, normB) / maxLen;
}

/** Flag threshold for "possible duplicate" -- <=15% of characters differ after normalization. */
export const DUPLICATE_SIMILARITY_THRESHOLD = 0.85;

export function isPossibleDuplicate(a: string, b: string): boolean {
  return similarity(a, b) >= DUPLICATE_SIMILARITY_THRESHOLD;
}
