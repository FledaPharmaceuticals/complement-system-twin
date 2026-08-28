import { createEvidenceRecord } from "./modelContract.js";

export function normalizePubMedRecord(raw, { entityVocabulary = [] } = {}) {
  const pmid = String(raw?.uid ?? raw?.pmid ?? "").trim();
  const title = String(raw?.title ?? "").trim();
  if (!pmid || !title) return null;

  const publicationTypes = (raw.publicationTypes ?? raw.publication_types ?? [])
    .map((type) => String(type).toLowerCase());
  const evidenceLevel = publicationTypes.some((type) => type.includes("clinical"))
    ? "clinical"
    : publicationTypes.some((type) => type.includes("review")) ? "curated" : "mechanistic";
  const searchableText = `${title} ${raw.abstractText ?? raw.abstract ?? ""}`;
  const linkedEntities = entityVocabulary.filter((entity) => searchableText.toLowerCase().includes(String(entity).toLowerCase()));
  const doi = (raw.articleIds ?? raw.article_ids ?? []).find((item) => String(item.idType ?? item.idtype).toLowerCase() === "doi")?.value ?? null;

  return {
    ...createEvidenceRecord({
      id: `pmid:${pmid}`,
      title,
      sourceType: "publication",
      sourceLocator: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      evidenceLevel,
      extractedClaim: String(raw.abstractText ?? raw.abstract ?? "Abstract not provided.").trim(),
      uncertainty: "unknown",
      linkedEntities,
      extractionMethod: "public_database_metadata"
    }),
    metadata: {
      pmid,
      doi,
      journal: raw.fullJournalName ?? raw.journal ?? null,
      publicationDate: raw.pubdate ?? raw.publicationDate ?? null,
      publicationTypes
    }
  };
}

export function normalizePubMedRecords(records, options) {
  return records.map((record) => normalizePubMedRecord(record, options)).filter(Boolean);
}
