const EVIDENCE_UNCERTAINTY = Object.freeze({
  clinical: "moderate",
  genetic: "moderate",
  qsp_model: "high",
  review: "high"
});

export function buildSimulationEvidenceSummary(diseaseContext, publications = []) {
  const linked = publications.filter((publication) => {
    if (diseaseContext === "normal") {
      return publication.evidence_type === "qsp_model" || publication.evidenceLevel === "mechanistic";
    }
    const linkedEntities = publication.linkedEntities ?? publication.linked_entities ?? [];
    return linkedEntities.includes(diseaseContext);
  });
  const types = [...new Set(linked.map((publication) => publication.evidence_type ?? publication.evidenceLevel))].sort();
  const uncertainty = types.length
    ? types.some((type) => EVIDENCE_UNCERTAINTY[type] === "moderate") ? "moderate" : "high"
    : "unknown";

  return {
    count: linked.length,
    types,
    publicationIds: linked.map((publication) => publication.id),
    uncertainty,
    label: linked.length ? "Seed evidence linked to this context" : "No linked seed evidence"
  };
}
