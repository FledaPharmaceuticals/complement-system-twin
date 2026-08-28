// Shared, provider-neutral records for the C3 and Complement System twins.
// V1 keeps these records in memory so the platform stays read-only and standalone.

export const MODEL_VERSION = "complement-twin-v1.1-contract";

export const EVIDENCE_LEVELS = Object.freeze([
  "hypothesis",
  "mechanistic",
  "in_vitro",
  "in_vivo",
  "biomarker",
  "clinical",
  "curated"
]);

export const UNCERTAINTY_LEVELS = Object.freeze(["low", "moderate", "high", "unknown"]);

export const COMPLEMENT_SIGNAL_KEYS = Object.freeze([
  "c3Activation",
  "c3bDeposition",
  "c5aSignal",
  "macActivity",
  "inflammatorySignal",
  "regulatoryWeakness"
]);

export const DISEASE_CONTEXTS = Object.freeze({
  normal: {
    id: "normal",
    label: "Normal reference",
    timeScale: "baseline",
    primaryTissues: ["systemic reference"],
    interpretation: "balanced complement reference state"
  },
  AMD: {
    id: "AMD",
    label: "Age-related Macular Degeneration",
    timeScale: "chronic_months",
    primaryTissues: ["retina", "macula", "RPE", "choroid"],
    interpretation: "retina-centered complement-mediated disease state"
  },
  PNH: {
    id: "PNH",
    label: "PNH",
    timeScale: "acute_minutes_to_hours",
    primaryTissues: ["blood", "bone marrow", "kidney"],
    interpretation: "complement-mediated hemolysis risk state"
  },
  aHUS: {
    id: "aHUS",
    label: "aHUS",
    timeScale: "acute_hours_to_days",
    primaryTissues: ["kidney", "endothelium", "brain"],
    interpretation: "alternative-pathway endothelial risk state"
  },
  C3G: {
    id: "C3G",
    label: "C3 glomerulopathy",
    timeScale: "chronic_days_to_months",
    primaryTissues: ["kidney", "glomerulus"],
    interpretation: "alternative-pathway glomerular dysregulation state"
  },
  "IgA nephropathy": {
    id: "IgA nephropathy",
    label: "IgA nephropathy",
    timeScale: "chronic_days_to_months",
    primaryTissues: ["kidney", "glomerulus"],
    interpretation: "immune-complex and lectin-associated renal state"
  },
  "lupus nephritis": {
    id: "lupus nephritis",
    label: "Lupus nephritis",
    timeScale: "chronic_days_to_months",
    primaryTissues: ["kidney", "glomerulus"],
    interpretation: "classical-pathway immune-complex renal state"
  },
  sepsis: {
    id: "sepsis",
    label: "Sepsis",
    timeScale: "acute_hours",
    primaryTissues: ["vessels", "lung", "kidney", "liver"],
    interpretation: "systemic inflammatory complement activation state"
  },
  "cancer microenvironment": {
    id: "cancer microenvironment",
    label: "Cancer microenvironment",
    timeScale: "context_dependent",
    primaryTissues: ["tumor microenvironment", "vessels", "immune system"],
    interpretation: "context-dependent complement signaling state"
  }
});

export function createSimulationContext({
  diseaseContext = "normal",
  complementDynamics = {},
  intervention = null,
  evidenceIds = []
} = {}) {
  const dynamics = Object.fromEntries(
    Object.entries(complementDynamics).filter(([key]) => COMPLEMENT_SIGNAL_KEYS.includes(key))
  );

  return {
    diseaseContext,
    complementDynamics: dynamics,
    intervention,
    evidenceIds: [...evidenceIds]
  };
}

export function createEvidenceRecord({
  id,
  title,
  sourceType = "publication",
  sourceLocator = "",
  evidenceLevel = "hypothesis",
  extractedClaim = "",
  uncertainty = "unknown",
  linkedEntities = [],
  parameterPriors = {},
  extractionMethod = "manual_or_rule_based"
} = {}) {
  return {
    id,
    title,
    sourceType,
    sourceLocator,
    evidenceLevel,
    extractedClaim,
    uncertainty,
    linkedEntities: [...linkedEntities],
    parameterPriors,
    extractionMethod,
    modelVersion: MODEL_VERSION
  };
}

export function validateEvidenceRecord(record) {
  return Boolean(
    record &&
      typeof record.id === "string" &&
      record.id.trim() &&
      typeof record.title === "string" &&
      record.title.trim() &&
      typeof record.sourceLocator === "string" &&
      record.sourceLocator.trim() &&
      EVIDENCE_LEVELS.includes(record.evidenceLevel) &&
      UNCERTAINTY_LEVELS.includes(record.uncertainty) &&
      typeof record.extractedClaim === "string" &&
      Array.isArray(record.linkedEntities) &&
      typeof record.parameterPriors === "object" &&
      record.parameterPriors !== null
  );
}

export function createSimulationRun({
  context = createSimulationContext(),
  outputs = {},
  status = "research_proxy"
} = {}) {
  return {
    modelVersion: MODEL_VERSION,
    context,
    outputs,
    status,
    isClinicalPrediction: false
  };
}
