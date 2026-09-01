import { createJcsResultId } from "./jcsResultHash.js";
import { FORBIDDEN_PUBLIC_FIELDS } from "./serverSimulationContract.js";

const TOP_LEVEL_FIELDS = [
  "schemaName", "schemaVersion", "recordId", "candidateId", "candidateVersion",
  "trainingDate", "method", "publications", "parameterCategories", "capabilities",
  "observationCounts", "applicability", "uncertainty", "conclusion", "warnings"
];

const ALLOWED_FIELDS = Object.freeze({
  method: ["label", "machineLearning", "formalModelChange"],
  publication: ["title", "doi", "doiUrl", "publicationYear", "license"],
  parameterCategory: ["label", "status"],
  capability: ["label", "validationStatus"],
  observationCounts: ["train", "holdout", "contextOnly"],
  applicability: ["status", "summary"],
  uncertainty: ["level", "summary"]
});

const FORBIDDEN_FIELD_FRAGMENTS = new Set([
  ...FORBIDDEN_PUBLIC_FIELDS,
  "ai_prompt", "ai_review", "candidate_calibration_payload", "coefficient",
  "equation", "evidence_payload", "filesystem_path", "formula", "full_parameter_set",
  "human_review", "internal_payload", "private_path", "raw_payload", "review_record",
  "source_coordinate", "source_path"
].map(normalizeKey));

const PUBLIC_TRAINING_RECORD_VALUE = {
  applicability: {
    status: "pipeline_feasibility_only",
    summary: "Same-publication holdouts only; systemic ex-vivo and local RPE in-vitro evidence remain separate."
  },
  candidateId: "amd-cp40-two-paper-test-v0",
  candidateVersion: "sha256:334a5679ffbdd31e7ef715afc3ce803db2b833c0cc4f69e1ee3a44c96adc60d1",
  capabilities: [
    { label: "Cp40 dose-response estimation", validationStatus: "tested_not_qualified" },
    { label: "local RPE C3b response estimation", validationStatus: "tested_not_qualified" },
    { label: "local RPE C5b-9 response estimation", validationStatus: "tested_not_qualified" },
    { label: "held-out direction checking", validationStatus: "tested_not_qualified" }
  ],
  conclusion: "rejected",
  method: {
    formalModelChange: false,
    label: "evidence-constrained candidate fitting",
    machineLearning: false
  },
  observationCounts: { contextOnly: 8, holdout: 49, train: 13 },
  parameterCategories: [
    { label: "Cp40 concentration-response shape", status: "candidate_only" },
    { label: "local RPE response coupling", status: "candidate_only" }
  ],
  publications: [
    {
      doi: "10.1002/sctm.20-0211",
      doiUrl: "https://doi.org/10.1002/sctm.20-0211",
      license: "CC BY 4.0",
      publicationYear: 2020,
      title: "Complement modulation reverses pathology in Y402H-retinal pigment epithelium cell model of age-related macular degeneration by restoring lysosomal function"
    },
    {
      doi: "10.1038/s41467-022-33003-7",
      doiUrl: "https://doi.org/10.1038/s41467-022-33003-7",
      license: "CC BY 4.0",
      publicationYear: 2022,
      title: "Insight into mode-of-action and structural determinants of the compstatin family of clinical complement inhibitors"
    }
  ],
  recordId: "sha256:88c547f9d3d014b87a1a7d3d3a5aef21f3107d0b971916c87629510edbb195bf",
  schemaName: "FledaPublicTrainingRecord",
  schemaVersion: "1.0.0",
  trainingDate: "2026-08-31",
  uncertainty: {
    level: "high",
    summary: "Candidate failed the deterministic weighted-fit gate; no cross-study or clinical uncertainty claim is supported."
  },
  warnings: [
    "Research and education only; no clinical validity.",
    "The active model was not changed.",
    "This was evidence-constrained fitting, not machine learning."
  ]
};

export const PUBLIC_TRAINING_RECORD = deepFreeze(PUBLIC_TRAINING_RECORD_VALUE);

export async function validatePublicTrainingRecord(value) {
  try {
    if (!isPlainObject(value)) return failure("invalid_schema");
    const forbiddenPath = findForbiddenTrainingRecordField(value);
    if (forbiddenPath) return failure("forbidden_public_field", forbiddenPath);
    if (!hasExactKeys(value, TOP_LEVEL_FIELDS)
        || value.schemaName !== "FledaPublicTrainingRecord"
        || value.schemaVersion !== "1.0.0"
        || value.candidateId !== "amd-cp40-two-paper-test-v0"
        || !isSha256Id(value.recordId)
        || !isSha256Id(value.candidateVersion)
        || !isIsoCalendarDate(value.trainingDate)) {
      return failure("invalid_schema");
    }
    if (!validateMethod(value.method)
        || !validatePublications(value.publications)
        || !validateParameterCategories(value.parameterCategories)
        || !validateCapabilities(value.capabilities)
        || !validateObservationCounts(value.observationCounts)
        || !validateApplicability(value.applicability)
        || !validateUncertainty(value.uncertainty)
        || !["supported_exploratory", "rejected"].includes(value.conclusion)
        || !isNonEmptyStringArray(value.warnings)) {
      return failure("invalid_schema");
    }

    const hashPayload = structuredClone(value);
    delete hashPayload.recordId;
    if (await createJcsResultId(hashPayload) !== value.recordId) {
      return failure("invalid_record_hash");
    }
    return { ok: true, value: structuredClone(value) };
  } catch (error) {
    return failure("invalid_schema", error instanceof Error ? error.message : String(error));
  }
}

export function findForbiddenTrainingRecordField(value, path = []) {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findForbiddenTrainingRecordField(value[index], [...path, String(index)]);
      if (found) return found;
    }
    return null;
  }
  if (!isPlainObject(value)) return null;
  for (const [key, child] of Object.entries(value)) {
    const childPath = [...path, key];
    const normalized = normalizeKey(key);
    if ([...FORBIDDEN_FIELD_FRAGMENTS].some((fragment) => normalized.includes(fragment))) {
      return childPath.join(".");
    }
    const found = findForbiddenTrainingRecordField(child, childPath);
    if (found) return found;
  }
  return null;
}

function validateMethod(value) {
  return isExactObject(value, ALLOWED_FIELDS.method)
    && value.label === "evidence-constrained candidate fitting"
    && value.machineLearning === false
    && value.formalModelChange === false;
}

function validatePublications(value) {
  return Array.isArray(value) && value.length === 2 && value.every((publication) => (
    isExactObject(publication, ALLOWED_FIELDS.publication)
    && isNonEmptyString(publication.title)
    && isNonEmptyString(publication.doi)
    && publication.doiUrl === `https://doi.org/${publication.doi}`
    && Number.isInteger(publication.publicationYear)
    && publication.publicationYear >= 1600
    && isNonEmptyString(publication.license)
  ));
}

function validateParameterCategories(value) {
  return Array.isArray(value) && value.length > 0 && value.every((category) => (
    isExactObject(category, ALLOWED_FIELDS.parameterCategory)
    && isNonEmptyString(category.label)
    && category.status === "candidate_only"
  ));
}

function validateCapabilities(value) {
  return Array.isArray(value) && value.length > 0 && value.every((capability) => (
    isExactObject(capability, ALLOWED_FIELDS.capability)
    && isNonEmptyString(capability.label)
    && ["tested_not_qualified", "supported_exploratory"].includes(capability.validationStatus)
  ));
}

function validateObservationCounts(value) {
  return isExactObject(value, ALLOWED_FIELDS.observationCounts)
    && ALLOWED_FIELDS.observationCounts.every((field) => (
      Number.isInteger(value[field]) && Number.isFinite(value[field]) && value[field] >= 0
    ));
}

function validateApplicability(value) {
  return isExactObject(value, ALLOWED_FIELDS.applicability)
    && value.status === "pipeline_feasibility_only"
    && isNonEmptyString(value.summary);
}

function validateUncertainty(value) {
  return isExactObject(value, ALLOWED_FIELDS.uncertainty)
    && value.level === "high"
    && isNonEmptyString(value.summary);
}

function isIsoCalendarDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function isSha256Id(value) {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonEmptyStringArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
}

function isExactObject(value, fields) {
  return isPlainObject(value) && hasExactKeys(value, fields);
}

function hasExactKeys(value, expectedFields) {
  const actual = Object.keys(value).sort();
  const expected = [...expectedFields].sort();
  return actual.length === expected.length
    && actual.every((field, index) => field === expected[index]);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function failure(reason, detail = null) {
  return { ok: false, reason, detail };
}
