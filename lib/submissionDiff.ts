function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    // null (unknown) and [] (confirmed none) are different values, so an array only equals an array.
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return (a ?? "") === (b ?? "");
}

export interface ProposedChanges {
  changes: Record<string, unknown>;
  /**
   * Fields the user left incomplete (e.g. "Has outlets" with no codes). They are
   * never included in `changes`, and a submission with any blocked field must not
   * be sent: an empty selection must not turn into a real value such as [].
   */
  blocked: string[];
}

/**
 * The fields a suggest-an-edit submission proposes. For an existing record only
 * fields the user actually changed are included, so an untouched null (e.g.
 * unknown existing_tenants) is never sent and can't be turned into [].
 */
export function proposedChangesFor(
  draft: Record<string, unknown>,
  currentValues: Record<string, unknown>,
  isNewRecord: boolean,
  incompleteFields: ReadonlySet<string> = new Set()
): ProposedChanges {
  // A field is blocked whether or not the draft still holds an older value for it.
  const blocked = [...incompleteFields];
  const complete = Object.entries(draft).filter(([key]) => !incompleteFields.has(key));
  const changes = Object.fromEntries(
    isNewRecord ? complete : complete.filter(([key, value]) => !sameValue(value, currentValues[key]))
  );
  return { changes, blocked };
}
