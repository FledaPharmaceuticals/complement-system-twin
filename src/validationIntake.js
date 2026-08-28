const REQUIRED_SOURCE_FIELDS = [
  "sourceType",
  "title",
  "sourceLocator",
  "retrievedAt"
];

const REQUIRED_CONTEXT_FIELDS = ["assay", "timeScale", "units", "conditions"];

const SENSITIVE_FIELD_PATTERN = /(patient|subject|mrn|medicalrecord|dateofbirth|dob|email|phone|address|productionbatch|customer)/i;

export function preflightValidationIntake(payload = {}) {
  const missingFields = [];
  const privacyFindings = findSensitiveFields(payload);
  const source = payload.source;
  const experimentalContext = payload.experimentalContext;

  if (!payload.datasetId) missingFields.push("datasetId");
  if (!payload.diseaseContext) missingFields.push("diseaseContext");
  if (!Array.isArray(payload.observations) || payload.observations.length === 0) {
    missingFields.push("observations");
  }
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    missingFields.push("source");
  } else {
    REQUIRED_SOURCE_FIELDS.forEach((field) => {
      if (!hasValue(source[field])) missingFields.push(`source.${field}`);
    });
  }
  if (!experimentalContext || typeof experimentalContext !== "object" || Array.isArray(experimentalContext)) {
    missingFields.push("experimentalContext");
  } else {
    REQUIRED_CONTEXT_FIELDS.forEach((field) => {
      if (!hasValue(experimentalContext[field])) missingFields.push(`experimentalContext.${field}`);
    });
  }
  if (payload.measurementScale !== "normalized_0_100_proxy") {
    missingFields.push("measurementScale:normalized_0_100_proxy");
  }
  if (payload.containsPatientData !== false) missingFields.push("containsPatientData:false");
  if (payload.containsProductionData !== false) missingFields.push("containsProductionData:false");

  const reasons = [
    ...missingFields.map((field) => `Missing or invalid ${field}`),
    ...privacyFindings.map((field) => `Sensitive field detected: ${field}`)
  ];

  return {
    recordType: "fleda_validation_intake_preflight",
    intakeVersion: "1.0",
    status: reasons.length ? "blocked" : "eligible_for_review",
    missingFields,
    privacyFindings,
    reasons,
    boundary: {
      containsPatientData: false,
      containsProductionData: false,
      formalModelChanged: false
    }
  };
}

function hasValue(value) {
  return typeof value === "string" ? value.trim().length > 0 : value !== null && value !== undefined;
}

function findSensitiveFields(value, path = "", findings = []) {
  if (!value || typeof value !== "object") return findings;
  Object.entries(value).forEach(([key, child]) => {
    const childPath = path ? `${path}.${key}` : key;
    const isBoundaryDeclaration = key === "containsPatientData" || key === "containsProductionData";
    if (!isBoundaryDeclaration && SENSITIVE_FIELD_PATTERN.test(key)) findings.push(childPath);
    if (child && typeof child === "object") findSensitiveFields(child, childPath, findings);
  });
  return findings;
}
