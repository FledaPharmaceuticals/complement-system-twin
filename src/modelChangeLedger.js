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

export function createPublicLedgerEntry({ releaseDecision = {}, parameterPolicy = {}, parameterChange = {}, evidenceSummary = {}, validationSummary = {} } = {}) {
  const metadata = releaseDecision.publicMetadata ?? {};
  const disclosureLevel = parameterPolicy.disclosureLevel;
  if (!DISCLOSURES.has(disclosureLevel)) throw new Error("A valid public disclosure level is required");
  if (!Number.isFinite(parameterChange.oldValue) || !Number.isFinite(parameterChange.newValue) || !Number.isFinite(parameterChange.relativeChange)) {
    throw new Error("Finite parameter change values are required for ledger projection");
  }

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
      publications: structuredClone(evidenceSummary.publications ?? [])
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
    synthetic: metadata.synthetic === true
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

export function validatePublicLedgerEntry(entry = {}) {
  const errors = [];
  scanProtected(entry, "", errors);
  if (entry.recordType !== "fleda_public_model_change_ledger_entry") errors.push("invalid ledger record type");
  if (!entry.entryId || !entry.version || !entry.baseVersion) errors.push("entry, current, and base version IDs are required");
  if (!STATUSES.has(entry.status)) errors.push("invalid ledger status");
  if (!entry.context?.disease || !entry.context?.pathway) errors.push("disease and pathway context are required");
  if (!DISCLOSURES.has(entry.parameter?.disclosureLevel)) errors.push("invalid parameter disclosure level");
  if (!entry.rationale || !Array.isArray(entry.limitations) || !entry.limitations.length) errors.push("rationale and limitations are required");
  if (!Number.isInteger(entry.evidence?.publicationCount) || entry.evidence.publicationCount < 0) errors.push("publication count is required");
  if (!entry.policy?.policyId || !entry.policy?.version || !entry.policy?.releaseRoute) errors.push("policy provenance is required");
  if (!entry.rollback?.version || !entry.rollback?.status) errors.push("rollback metadata is required");
  if (!entry.validation?.uncertainty) errors.push("validation uncertainty is required");
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
    && matches(entry.version, filters.version)
    && matches(entry.status, filters.status)
    && matches(entry.releasedAt, filters.date)
  ));
}
