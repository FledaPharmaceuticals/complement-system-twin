// Conservative linkage: only explicit terms in the imported record are linked.
export function linkEvidenceRecords(records = [], vocabulary = []) {
  const entries = vocabulary
    .map((entry) => ({
      id: String(entry?.id ?? "").trim(),
      terms: (entry?.terms ?? []).map((term) => String(term).trim()).filter((term) => term.length >= 2)
    }))
    .filter((entry) => entry.id && entry.terms.length);

  return records.map((record) => {
    const text = `${record?.title ?? ""} ${record?.extractedClaim ?? ""} ${record?.metadata?.abstract ?? ""}`;
    const matches = entries.flatMap((entry) => entry.terms
      .filter((term) => containsExplicitTerm(text, term))
      .map((term) => ({ entityId: entry.id, term })));
    const linkedEntities = [...new Set([
      ...(Array.isArray(record?.linkedEntities) ? record.linkedEntities : []),
      ...matches.map((match) => match.entityId)
    ])];
    return {
      ...record,
      linkedEntities,
      metadata: {
        ...(record.metadata ?? {}),
        linkageMethod: "explicit_term_match",
        explicitTermLinks: matches
      }
    };
  });
}

function containsExplicitTerm(text, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-z0-9])${escaped}(?=$|[^A-Za-z0-9])`, "i").test(text);
}
