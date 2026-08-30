const STATUSES = new Set(["candidate", "testing", "active", "rejected", "rolled_back"]);
const DISCLOSURES = new Set(["public_exact", "public_normalized", "public_summary"]);
const PROTECTED_KEYS = new Set([
  "parameterSnapshot",
  "previousParameters",
  "solverConfiguration",
  "privateNotes",
  "credentials",
  "localPath",
  "proprietaryPrior"
]);
const ALLOWED_KEYS = {
  root: new Set(["recordType", "recordVersion", "entryId", "status", "version", "baseVersion", "releasedAt", "context", "parameter", "rationale", "limitations", "evidence", "validation", "policy", "rollback", "comments", "formalModelChanged", "synthetic"]),
  context: new Set(["disease", "tissue", "pathway"]),
  parameter: new Set(["parameterId", "label", "disclosureLevel", "direction", "oldValue", "newValue", "unit", "normalizedDeltaPercent", "lowerBound", "upperBound"]),
  evidence: new Set(["publicationCount", "independentGroupCount", "publications"]),
  publication: new Set(["publicationId", "pmid", "pmcid", "doi", "sourceLocation", "context", "assay", "sampleSize", "unit", "endpoint", "reviewStatus"]),
  publicationContext: new Set(["disease", "tissue", "species", "spatialScope", "experimentalSetting", "timepoint", "timeUnit"]),
  validation: new Set(["trainingImprovementPercent", "holdoutImprovementPercent", "sentinelDegradationMaximumPercent", "uncertainty"]),
  policy: new Set(["policyId", "version", "releaseRoute"]),
  rollback: new Set(["version", "status"]),
  comments: new Set(["count", "submissionEnabled"])
};

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function percent(value) {
  return Math.round(value * 10000) / 100;
}

function direction(oldValue, newValue) {
  if (newValue > oldValue) return "increase";
  if (newValue < oldValue) return "decrease";
  return "unchanged";
}

function projectPublication(publication = {}) {
  const projected = {};
  for (const key of ["publicationId", "pmid", "pmcid", "doi", "sourceLocation", "assay", "sampleSize", "unit", "endpoint", "reviewStatus"]) {
    if (publication[key] !== undefined && publication[key] !== null) projected[key] = publication[key];
  }
  if (publication.context && typeof publication.context === "object" && !Array.isArray(publication.context)) {
    projected.context = {};
    for (const key of ALLOWED_KEYS.publicationContext) {
      if (publication.context[key] !== undefined && publication.context[key] !== null) projected.context[key] = publication.context[key];
    }
  }
  return projected;
}

export function createPublicLedgerEntry({ releaseDecision = {}, parameterPolicy = {}, parameterChange = {}, evidenceSummary = {}, validationSummary = {} } = {}) {
  const metadata = releaseDecision.publicMetadata ?? {};
  const disclosureLevel = parameterPolicy.disclosureLevel;
  if (!DISCLOSURES.has(disclosureLevel)) throw new Error("A valid public disclosure level is required");
  if (!Number.isFinite(parameterChange.oldValue) || !Number.isFinite(parameterChange.newValue) || !Number.isFinite(parameterChange.relativeChange) || parameterChange.oldValue === 0) {
    throw new Error("Finite parameter change values are required for ledger projection");
  }
  const derivedRelativeChange = (parameterChange.newValue - parameterChange.oldValue) / Math.abs(parameterChange.oldValue);
  if (Math.abs(derivedRelativeChange - parameterChange.relativeChange) > 1e-12) throw new Error("Relative change must match the supplied old and new values");
  if (typeof metadata.synthetic !== "boolean") throw new Error("Explicit synthetic provenance is required");
  if (releaseDecision.parameterId && releaseDecision.parameterId !== parameterPolicy.parameterId) throw new Error("Release and parameter policy IDs must match");

  const parameter = {
    parameterId: parameterPolicy.parameterId,
    label: parameterPolicy.publicLabel ?? parameterPolicy.parameterId,
    disclosureLevel,
    direction: direction(parameterChange.oldValue, parameterChange.newValue)
  };
  if (disclosureLevel === "public_exact") {
    parameter.oldValue = parameterChange.oldValue;
    parameter.newValue = parameterChange.newValue;
    parameter.unit = parameterPolicy.unit;
    parameter.normalizedDeltaPercent = percent(parameterChange.relativeChange);
  } else if (disclosureLevel === "public_normalized") {
    parameter.normalizedDeltaPercent = percent(parameterChange.relativeChange);
  }

  const entry = {
    recordType: "fleda_public_model_change_ledger_entry",
    recordVersion: "1.0.0",
    entryId: metadata.entryId,
    status: metadata.status,
    version: releaseDecision.proposedVersion,
    baseVersion: releaseDecision.baseVersion,
    releasedAt: metadata.releasedAt ?? null,
    context: {
      disease: metadata.disease,
      tissue: metadata.tissue,
      pathway: metadata.pathway
    },
    parameter,
    rationale: metadata.rationale,
    limitations: structuredClone(metadata.limitations ?? []),
    evidence: {
      publicationCount: evidenceSummary.publicationCount,
      independentGroupCount: evidenceSummary.independentGroupCount,
      publications: (evidenceSummary.publications ?? []).map(projectPublication)
    },
    validation: {
      trainingImprovementPercent: percent(validationSummary.trainingImprovement),
      holdoutImprovementPercent: percent(validationSummary.holdoutImprovement),
      sentinelDegradationMaximumPercent: percent(validationSummary.sentinelDegradationMaximum),
      uncertainty: validationSummary.uncertainty
    },
    policy: {
      policyId: releaseDecision.policyId,
      version: releaseDecision.policyVersion,
      releaseRoute: metadata.releaseRoute
    },
    rollback: {
      version: releaseDecision.rollbackVersion,
      status: metadata.rollbackStatus ?? "available"
    },
    comments: { count: metadata.commentCount ?? 0, submissionEnabled: false },
    formalModelChanged: releaseDecision.formalModelChanged === true,
    synthetic: metadata.synthetic
  };

  const validation = validatePublicLedgerEntry(entry);
  if (!validation.valid) throw new Error(`Invalid public ledger entry: ${validation.errors.join("; ")}`);
  return deepFreeze(entry);
}

function scanProtected(value, path, errors) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const nextPath = path ? `${path}.${key}` : key;
    if (PROTECTED_KEYS.has(key)) errors.push(`protected field is forbidden: ${nextPath}`);
    scanProtected(child, nextPath, errors);
  }
}

function rejectUnknownKeys(value, allowed, path, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`unexpected public field is forbidden: ${path}.${key}`);
  }
}

export function validatePublicLedgerEntry(entry = {}) {
  const errors = [];
  scanProtected(entry, "", errors);
  rejectUnknownKeys(entry, ALLOWED_KEYS.root, "entry", errors);
  rejectUnknownKeys(entry.context, ALLOWED_KEYS.context, "entry.context", errors);
  rejectUnknownKeys(entry.parameter, ALLOWED_KEYS.parameter, "entry.parameter", errors);
  rejectUnknownKeys(entry.evidence, ALLOWED_KEYS.evidence, "entry.evidence", errors);
  for (const [index, publication] of (entry.evidence?.publications ?? []).entries()) {
    rejectUnknownKeys(publication, ALLOWED_KEYS.publication, `entry.evidence.publications.${index}`, errors);
    rejectUnknownKeys(publication.context, ALLOWED_KEYS.publicationContext, `entry.evidence.publications.${index}.context`, errors);
  }
  rejectUnknownKeys(entry.validation, ALLOWED_KEYS.validation, "entry.validation", errors);
  rejectUnknownKeys(entry.policy, ALLOWED_KEYS.policy, "entry.policy", errors);
  rejectUnknownKeys(entry.rollback, ALLOWED_KEYS.rollback, "entry.rollback", errors);
  rejectUnknownKeys(entry.comments, ALLOWED_KEYS.comments, "entry.comments", errors);
  if (entry.recordType !== "fleda_public_model_change_ledger_entry") errors.push("invalid ledger record type");
  if (!entry.entryId || !entry.version || !entry.baseVersion) errors.push("entry, current, and base version IDs are required");
  if (!STATUSES.has(entry.status)) errors.push("invalid ledger status");
  if (!entry.context?.disease || !entry.context?.pathway) errors.push("disease and pathway context are required");
  if (!DISCLOSURES.has(entry.parameter?.disclosureLevel)) errors.push("invalid parameter disclosure level");
  if (entry.parameter?.disclosureLevel === "public_exact") {
    if (!Number.isFinite(entry.parameter.oldValue) || !Number.isFinite(entry.parameter.newValue) || !entry.parameter.unit) errors.push("public_exact requires old value, new value, and unit");
  } else if (["oldValue", "newValue", "unit"].some((key) => key in (entry.parameter ?? {}))) {
    errors.push("non-exact disclosures cannot expose old value, new value, or unit");
  }
  if (entry.parameter?.disclosureLevel === "public_summary" && ["normalizedDeltaPercent", "lowerBound", "upperBound"].some((key) => key in (entry.parameter ?? {}))) {
    errors.push("public_summary cannot expose normalized change or bounds");
  }
  if (!entry.rationale || !Array.isArray(entry.limitations) || !entry.limitations.length) errors.push("rationale and limitations are required");
  if (!Number.isInteger(entry.evidence?.publicationCount) || entry.evidence.publicationCount < 0) errors.push("publication count is required");
  if (!entry.policy?.policyId || !entry.policy?.version || !entry.policy?.releaseRoute) errors.push("policy provenance is required");
  if (!entry.rollback?.version || !entry.rollback?.status) errors.push("rollback metadata is required");
  if (!entry.validation?.uncertainty) errors.push("validation uncertainty is required");
  if (typeof entry.synthetic !== "boolean") errors.push("explicit synthetic provenance is required");
  return { valid: errors.length === 0, errors };
}

function matches(value, filter) {
  if (!filter) return true;
  return String(value ?? "").toLowerCase().includes(String(filter).toLowerCase());
}

export function filterLedgerEntries(entries = [], filters = {}) {
  return entries.filter((entry) => (
    matches(entry.context?.disease, filters.disease)
    && matches(entry.context?.pathway, filters.pathway)
    && (matches(entry.parameter?.label, filters.parameter) || matches(entry.parameter?.parameterId, filters.parameter))
    && matches(entry.version, filters.version)
    && matches(entry.status, filters.status)
    && matches(entry.releasedAt, filters.date)
  ));
}
