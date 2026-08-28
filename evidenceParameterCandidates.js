import { generateCalibrationCandidates } from "./calibrationCandidates.js";
import { assessEvidenceRecord } from "./evidenceQuality.js";

const AMD_RULES = Object.freeze([
  {
    parameter: "alternativeMultiplier",
    terms: ["AMD", "age-related macular degeneration", "C3", "CFB", "CFH", "Factor H", "Factor B", "Factor D"],
    prior: { min: 1.05, median: 1.2, max: 1.45 },
    rationale: "Explicit AMD/alternative-pathway terms suggest reviewing the chronic amplification prior; this is a rule-derived hypothesis, not a measured estimate."
  },
  {
    parameter: "factorHRegulationMultiplier",
    terms: ["AMD", "age-related macular degeneration", "CFH", "Factor H"],
    prior: { min: 0.65, median: 0.8, max: 0.95 },
    rationale: "Explicit CFH/Factor H or AMD terms suggest reviewing local regulation strength; this is a rule-derived hypothesis, not a measured estimate."
  },
  {
    parameter: "retinalTissueSensitivityMultiplier",
    terms: ["AMD", "age-related macular degeneration", "retina", "macula", "RPE", "choroid", "drusen"],
    prior: { min: 1.2, median: 1.45, max: 1.75 },
    rationale: "Explicit retina-centered terms suggest reviewing tissue sensitivity; this is a research proxy and not a clinical tissue measurement."
  },
  {
    parameter: "macFormationLocalRiskMultiplier",
    terms: ["AMD", "retina", "RPE", "choroid", "MAC", "sC5b-9", "C5b-9"],
    prior: { min: 1.0, median: 1.15, max: 1.35 },
    rationale: "Explicit terminal-complement or ocular terms suggest reviewing local MAC stress; this does not imply systemic organ damage."
  },
  {
    parameter: "drusenProxyWeight",
    terms: ["AMD", "retina", "macula", "RPE", "drusen"],
    prior: { min: 0.75, median: 1.0, max: 1.25 },
    rationale: "Explicit drusen/AMD terms suggest reviewing the drusen proxy weight; this is an imaging-related hypothesis without image validation."
  }
]);

export function generateEvidenceParameterCandidates({
  diseaseContext,
  currentParameters = {},
  evidenceRecords = []
} = {}) {
  if (diseaseContext !== "AMD") return [];
  const candidates = [];
  for (const record of evidenceRecords) {
    if (assessEvidenceRecord(record).status !== "accepted_metadata") continue;
    const text = `${record?.title ?? ""} ${record?.extractedClaim ?? ""} ${record?.metadata?.abstract ?? ""}`;
    for (const rule of AMD_RULES) {
      if (!rule.terms.some((term) => containsExplicitTerm(text, term))) continue;
      const [candidate] = generateCalibrationCandidates({
        diseaseContext,
        currentParameters,
        evidenceRecords: [{
          ...record,
          evidenceLevel: "hypothesis",
          uncertainty: "high",
          extractedClaim: rule.rationale,
          parameterPriors: { [rule.parameter]: rule.prior }
        }]
      });
      if (candidate) candidates.push(candidate);
    }
  }
  return candidates;
}

function containsExplicitTerm(text, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-z0-9])${escaped}(?=$|[^A-Za-z0-9])`, "i").test(text);
}
