import { createEvidenceRecord } from "./modelContract.js";
import { attachEvidenceQuality } from "./evidenceQuality.js";

const EVIDENCE_LEVEL_BY_TYPE = Object.freeze({
  clinical: "clinical",
  genetic: "curated",
  qsp_model: "mechanistic",
  review: "curated"
});

const UNCERTAINTY_BY_TYPE = Object.freeze({
  clinical: "moderate",
  genetic: "moderate",
  qsp_model: "high",
  review: "high"
});

export function buildEvidenceCatalog({ publications = [], externalRecords = [] } = {}) {
  const seedRecords = publications
    .filter((publication) => publication?.id && publication?.title && publication?.key_findings)
    .map((publication) => {
      const sourceLocator = publication.url?.trim() || `seed://publication/${publication.id}`;
      const evidenceType = publication.evidence_type || "review";
      return createEvidenceRecord({
        id: publication.id,
        title: publication.title,
        sourceType: publication.url ? "publication" : "seed_publication",
        sourceLocator,
        evidenceLevel: EVIDENCE_LEVEL_BY_TYPE[evidenceType] || "hypothesis",
        extractedClaim: publication.key_findings,
        uncertainty: UNCERTAINTY_BY_TYPE[evidenceType] || "unknown",
        linkedEntities: publication.linked_entities || [],
        extractionMethod: publication.url ? "source_record" : "curated_seed"
      });
    });
  return [...seedRecords, ...externalRecords.map(attachEvidenceQuality)];
}

export function findEvidenceForEntity(catalog, entityId) {
  return catalog.filter((record) => record.linkedEntities.includes(entityId));
}
