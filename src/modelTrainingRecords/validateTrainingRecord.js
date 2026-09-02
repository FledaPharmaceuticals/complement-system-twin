import { sha256Canonical } from "./canonicalHash.js";

const HASH = /^sha256:[0-9a-f]{64}$/;
const GIT_OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const DOI = /^10\.\d{4,9}\/[^\s"'<>]+$/i;
const STATEMENT_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const MAX_COUNT = 2_147_483_647;
const MAX_TEXT_BYTES = 2_000;
const MAX_ITEMS = 200;

const CATEGORIES = new Set([
  "method_label", "rejection_reason", "knowledge", "modeling_constraint",
  "missing_mechanism", "architecture_implication", "uncertainty", "limitation"
]);
const RUN_TYPES = new Set([
  "evidence_constrained_candidate_fit", "independent_evidence_compatibility_check",
  "mechanism_scenario_candidate_evaluation", "regression_and_invariance_validation"
]);
const STATUSES = new Set(["rejected", "candidate_only", "supported_exploratory", "formally_approved"]);
const STATUS_MESSAGES = Object.freeze({
  rejected: "Candidate did not pass; model knowledge and falsification results were retained.",
  candidate_only: "Candidate record retained; not approved for exploratory or formal model use.",
  supported_exploratory: "Supported for research exploration; not formally approved or clinically validated.",
  formally_approved: "Formally approved model record."
});
const FINDING_TYPES = new Set([
  "confirmed_measurement", "cross_study_consistency", "drug_specific_constraint",
  "invalid_parameter_transfer", "failed_model_assumption", "missing_mechanism",
  "compartment_separation_required", "assay_separation_required", "future_model_requirement"
]);
const DRUGS = new Set(["Cp40", "Cp60", "scrambled_peptide_control", "none"]);
const MECHANISMS = new Set([
  "c3_binding", "classical_pathway_inhibition", "terminal_pathway_activity",
  "cp40_concentration_response", "rpe_c3b_response", "rpe_c5b9_response",
  "affinity_potency_relationship", "compartment_transfer", "assay_transfer"
]);
const COMPARTMENTS = new Set([
  "purified_human_c3", "human_serum_systemic", "human_plasma_systemic",
  "retina_rpe_local", "not_applicable"
]);
const CONFIDENCE = new Set(["candidate_observation", "cross_study_supported", "conflicted", "not_qualified"]);
const CALIBRATION = new Set(["context_only", "candidate_calibration", "rejected_for_calibration", "not_applicable"]);
const BLOCKING_SCOPES = new Set(["candidate_support", "formal_activation", "both"]);
const UNCERTAINTY_LEVELS = new Set(["low", "moderate", "high", "unknown"]);

const DETAIL_FIELDS = [
  "schemaName", "schemaVersion", "recordId", "trainingDate", "trainingRunType",
  "candidateStatus", "publicationCount", "observationCount", "publications", "method",
  "validationSummary", "rejectionReasons", "knowledgeAcquired", "modelingConstraints",
  "missingMechanisms", "architectureImplications", "uncertaintySummary", "limitations",
  "formalModelChanged", "supersedesRecordId", "projectionHash"
];
const SUMMARY_FIELDS = [
  "recordId", "trainingDate", "trainingRunType", "candidateStatus", "publicationCount",
  "observationCount", "methodLabel", "formalModelChanged", "supersedesRecordId", "statusMessage"
];

const FORBIDDEN_KEY_FRAGMENTS = [
  "aiprompt", "aireview", "humanreview", "reviewrecord", "coefficient", "equation", "formula",
  "fullparameterset", "candidateparametervalue", "rawobservation", "rawpayload", "originalpayload",
  "evidencepayload", "sourcecoordinate", "sourcepath", "filesystempath", "privatepath", "databaseid",
  "internalid", "internalreport", "auditrecord", "evidencesnapshot", "privatedataset", "sourcecommit",
  "generatorcommit", "methodversion", "observationpackagehash", "artifacthash", "reporthash",
  "rebuildmanifest", "candidateid", "candidateversion", "modelversionbefore", "modelversionafter",
  "internalprovenance", "privateprovenance", "provenancerecord", "apikey", "apitoken", "secretkey",
  "clientsecret", "accesstoken", "privateurl", "internalurl", "privateendpoint", "internaluri"
];

function fail(path, message) {
  throw new TypeError(`${path}: ${message}`);
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function object(value, path) {
  if (!isPlainObject(value)) fail(path, "must be an object");
  return value;
}

function exactKeys(value, fields, path) {
  object(value, path);
  const expected = new Set(fields);
  for (const field of fields) if (!Object.hasOwn(value, field)) fail(`${path}.${field}`, "missing field");
  for (const field of Object.keys(value)) if (!expected.has(field)) fail(`${path}.${field}`, "unknown field");
}

function validUnicode(value, path) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) fail(path, "contains a lone Unicode surrogate");
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) fail(path, "contains a lone Unicode surrogate");
  }
}

function text(value, path) {
  if (typeof value !== "string" || !value || value !== value.trim()) fail(path, "must be non-empty and trimmed");
  validUnicode(value, path);
  if (new TextEncoder().encode(value).byteLength > MAX_TEXT_BYTES) fail(path, "exceeds 2000 UTF-8 bytes");
  return value;
}

function ascii(value, path, maxLength = 120) {
  text(value, path);
  if (value.length > maxLength || !/^[\x00-\x7f]+$/.test(value)) fail(path, "must be bounded ASCII");
}

function hash(value, path) {
  if (typeof value !== "string" || !HASH.test(value)) fail(path, "must be a SHA-256 hash");
}

function nullableHash(value, path) {
  if (value !== null) hash(value, path);
}

function count(value, path) {
  if (!Number.isInteger(value) || value < 0 || value > MAX_COUNT) fail(path, "must be a non-negative integer count");
}

function bool(value, path) {
  if (typeof value !== "boolean") fail(path, "must be a boolean");
}

function choice(value, allowed, path) {
  if (typeof value !== "string" || !allowed.has(value)) fail(path, "has an invalid controlled value");
}

function date(value, path) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(path, "must be an ISO calendar date");
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    fail(path, "must be an exact ISO calendar date");
  }
}

function array(value, path, { min = 0, max = MAX_ITEMS } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > max) fail(path, `must contain ${min}-${max} items`);
}

function unique(values, path) {
  if (new Set(values).size !== values.length) fail(path, "must contain unique values");
}

function stringArray(value, allowed, path, options) {
  array(value, path, options);
  value.forEach((item, index) => choice(item, allowed, `${path}[${index}]`));
  unique(value, path);
}

function hashArray(value, path) {
  array(value, path);
  value.forEach((item, index) => hash(item, `${path}[${index}]`));
  unique(value, path);
}

function doi(value, path) {
  text(value, path);
  if (!DOI.test(value)) fail(path, "is not a valid DOI");
}

function doiArray(value, path, { min = 0 } = {}) {
  array(value, path, { min, max: 50 });
  value.forEach((item, index) => doi(item, `${path}[${index}]`));
  unique(value, path);
}

function validatePublication(value, path) {
  exactKeys(value, ["title", "doi", "doiUrl", "publicationYear", "accessStatement"], path);
  text(value.title, `${path}.title`);
  doi(value.doi, `${path}.doi`);
  text(value.doiUrl, `${path}.doiUrl`);
  if (value.doiUrl !== `https://doi.org/${value.doi}`) fail(`${path}.doiUrl`, "must be reconstructed from the DOI");
  if (!Number.isInteger(value.publicationYear) || value.publicationYear < 1600 || value.publicationYear > MAX_COUNT) fail(`${path}.publicationYear`, "is invalid");
  text(value.accessStatement, `${path}.accessStatement`);
}

function validateMethod(value, path) {
  exactKeys(value, ["label", "machineLearning", "aiExtractionUsed", "formalModelChanged"], path);
  text(value.label, `${path}.label`);
  bool(value.machineLearning, `${path}.machineLearning`);
  bool(value.aiExtractionUsed, `${path}.aiExtractionUsed`);
  bool(value.formalModelChanged, `${path}.formalModelChanged`);
}

function validateSummaryBlock(value, path) {
  exactKeys(value, ["gateCounts", "failedGateCodes", "deterministic", "sixBaselinesUnchanged", "publicApiOutputsUnchanged", "activeModelUnchanged"], path);
  exactKeys(value.gateCounts, ["passed", "failed", "warning"], `${path}.gateCounts`);
  for (const field of ["passed", "failed", "warning"]) count(value.gateCounts[field], `${path}.gateCounts.${field}`);
  array(value.failedGateCodes, `${path}.failedGateCodes`);
  value.failedGateCodes.forEach((item, index) => ascii(item, `${path}.failedGateCodes[${index}]`));
  if (value.gateCounts.failed !== value.failedGateCodes.length) fail(path, "failed gate count must equal failedGateCodes length");
  for (const field of ["deterministic", "sixBaselinesUnchanged", "publicApiOutputsUnchanged", "activeModelUnchanged"]) bool(value[field], `${path}.${field}`);
}

function validateRejection(value, path) {
  exactKeys(value, ["code", "statement", "blockingScope", "evidenceDois"], path);
  ascii(value.code, `${path}.code`);
  text(value.statement, `${path}.statement`);
  choice(value.blockingScope, BLOCKING_SCOPES, `${path}.blockingScope`);
  doiArray(value.evidenceDois, `${path}.evidenceDois`);
}

function validateFinding(value, path) {
  exactKeys(value, ["findingId", "findingType", "statement", "applicableDrugs", "mechanisms", "compartments", "evidenceDois", "confidenceStatus", "supportingObservationCount", "calibrationStatus"], path);
  hash(value.findingId, `${path}.findingId`);
  choice(value.findingType, FINDING_TYPES, `${path}.findingType`);
  text(value.statement, `${path}.statement`);
  stringArray(value.applicableDrugs, DRUGS, `${path}.applicableDrugs`);
  stringArray(value.mechanisms, MECHANISMS, `${path}.mechanisms`);
  stringArray(value.compartments, COMPARTMENTS, `${path}.compartments`);
  doiArray(value.evidenceDois, `${path}.evidenceDois`, { min: 1 });
  choice(value.confidenceStatus, CONFIDENCE, `${path}.confidenceStatus`);
  count(value.supportingObservationCount, `${path}.supportingObservationCount`);
  choice(value.calibrationStatus, CALIBRATION, `${path}.calibrationStatus`);
}

function validateLinkedStatement(value, path) {
  exactKeys(value, ["statement", "linkedFindingIds", "evidenceDois"], path);
  text(value.statement, `${path}.statement`);
  hashArray(value.linkedFindingIds, `${path}.linkedFindingIds`);
  doiArray(value.evidenceDois, `${path}.evidenceDois`);
}

function validateDetailShape(value, path = "$") {
  exactKeys(value, DETAIL_FIELDS, path);
  if (value.schemaName !== "FledaPublicModelTrainingRecord") fail(`${path}.schemaName`, "has the wrong literal");
  if (value.schemaVersion !== "1.1.0") fail(`${path}.schemaVersion`, "has the wrong literal");
  hash(value.recordId, `${path}.recordId`);
  date(value.trainingDate, `${path}.trainingDate`);
  choice(value.trainingRunType, RUN_TYPES, `${path}.trainingRunType`);
  choice(value.candidateStatus, STATUSES, `${path}.candidateStatus`);
  count(value.publicationCount, `${path}.publicationCount`);
  count(value.observationCount, `${path}.observationCount`);
  array(value.publications, `${path}.publications`);
  value.publications.forEach((item, index) => validatePublication(item, `${path}.publications[${index}]`));
  if (value.publicationCount !== value.publications.length) fail(`${path}.publicationCount`, "must equal publications length");
  validateMethod(value.method, `${path}.method`);
  validateSummaryBlock(value.validationSummary, `${path}.validationSummary`);
  array(value.rejectionReasons, `${path}.rejectionReasons`);
  value.rejectionReasons.forEach((item, index) => validateRejection(item, `${path}.rejectionReasons[${index}]`));
  for (const field of ["knowledgeAcquired", "modelingConstraints"]) {
    array(value[field], `${path}.${field}`);
    value[field].forEach((item, index) => validateFinding(item, `${path}.${field}[${index}]`));
  }
  for (const field of ["missingMechanisms", "architectureImplications"]) {
    array(value[field], `${path}.${field}`);
    value[field].forEach((item, index) => validateLinkedStatement(item, `${path}.${field}[${index}]`));
  }
  exactKeys(value.uncertaintySummary, ["level", "summary"], `${path}.uncertaintySummary`);
  choice(value.uncertaintySummary.level, UNCERTAINTY_LEVELS, `${path}.uncertaintySummary.level`);
  text(value.uncertaintySummary.summary, `${path}.uncertaintySummary.summary`);
  array(value.limitations, `${path}.limitations`, { min: 1 });
  value.limitations.forEach((item, index) => text(item, `${path}.limitations[${index}]`));
  bool(value.formalModelChanged, `${path}.formalModelChanged`);
  nullableHash(value.supersedesRecordId, `${path}.supersedesRecordId`);
  hash(value.projectionHash, `${path}.projectionHash`);
}

function validateSummaryShape(value, path = "$") {
  exactKeys(value, SUMMARY_FIELDS, path);
  hash(value.recordId, `${path}.recordId`);
  date(value.trainingDate, `${path}.trainingDate`);
  choice(value.trainingRunType, RUN_TYPES, `${path}.trainingRunType`);
  choice(value.candidateStatus, STATUSES, `${path}.candidateStatus`);
  count(value.publicationCount, `${path}.publicationCount`);
  count(value.observationCount, `${path}.observationCount`);
  text(value.methodLabel, `${path}.methodLabel`);
  bool(value.formalModelChanged, `${path}.formalModelChanged`);
  nullableHash(value.supersedesRecordId, `${path}.supersedesRecordId`);
  text(value.statusMessage, `${path}.statusMessage`);
  if (value.statusMessage !== STATUS_MESSAGES[value.candidateStatus]) fail(`${path}.statusMessage`, "must exactly match candidateStatus");
}

function decodeHtml(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (match, entity) => {
    const lowered = entity.toLowerCase();
    if (lowered === "lt") return "<";
    if (lowered === "gt") return ">";
    if (lowered === "amp") return "&";
    if (lowered === "quot") return "\"";
    if (lowered === "apos") return "'";
    const code = lowered.startsWith("#x") ? Number.parseInt(lowered.slice(2), 16) : Number.parseInt(lowered.slice(1), 10);
    try { return String.fromCodePoint(code); } catch { return match; }
  });
}

function decodeForInspection(value, path) {
  if (/%(?![0-9a-f]{2})/i.test(value)) fail(path, "contains malformed percent encoding");
  let decoded = value.normalize("NFKC");
  for (let pass = 0; pass < 3; pass += 1) {
    let expanded;
    try { expanded = decodeURIComponent(decodeHtml(decoded)); } catch { fail(path, "contains malformed encoding"); }
    if (expanded === decoded) break;
    decoded = expanded;
  }
  return decoded.toLowerCase();
}

function normalizedKey(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function forbiddenString(value, path) {
  const inspected = decodeForInspection(value, path);
  const compact = normalizedKey(inspected);
  const delimiter = inspected.search(/[:=]/);
  const privateLabel = delimiter >= 0 && inspected.slice(delimiter + 1).trim()
    && FORBIDDEN_KEY_FRAGMENTS.some((fragment) => normalizedKey(inspected.slice(0, delimiter)).includes(fragment));
  if (
    /<(?:\/?[a-z][a-z0-9:-]*(?:[\s/]+[^<>]*)?|!--[^<>]*--|!doctype\s+[^<>]+|\?[^<>]+)>/i.test(inspected)
    || /\b(?:java|vb)script\s*:|\bdata\s*:\s*text\/html/i.test(inspected)
    || /\bon[a-z]+\s*=/i.test(inspected)
    || inspected.includes("/private/") || inspected.includes("/users/") || inspected.includes("\\users\\")
    || /\b(?:postgres(?:ql)?|mysql|mariadb|mssql|oracle|cockroachdb|mongodb(?:\+srv)?|redis|rediss|sqlite)(?:\+[a-z0-9_.-]+)?:\/\//i.test(inspected)
    || /\bbearer\s+\S+/i.test(inspected)
    || /\bgit@[^\s:/]+:[^\s]+|\bssh:\/\/git@[^\s]+|\bhttps?:\/\/[^\s/@]+@[^\s]+\.git\b|\b(?:https?|git):\/\/[^\s]+\.git\b/i.test(inspected)
    || /sourcecommit[0-9a-f]{40}/.test(compact)
    || /(?:observationpackagehash|packagehash|artifacthash|reporthash)sha256[0-9a-f]{64}/.test(compact)
    || privateLabel
  ) fail(path, "contains a forbidden public value");
}

function rejectForbidden(value, path = "$") {
  if (Array.isArray(value)) return value.forEach((item, index) => rejectForbidden(item, `${path}[${index}]`));
  if (isPlainObject(value)) {
    for (const key of Object.keys(value).sort()) {
      const child = `${path}.${key}`;
      const normalized = normalizedKey(key);
      if (FORBIDDEN_KEY_FRAGMENTS.some((fragment) => normalized.includes(fragment))) fail(child, "uses a forbidden public field");
      rejectForbidden(value[key], child);
    }
  } else if (typeof value === "string") forbiddenString(value, path);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}

function publicClone(value) {
  return structuredClone(value);
}

function without(value, field) {
  const copy = { ...value };
  delete copy[field];
  return copy;
}

class PinnedPublicStatementRegistry {
  #lookup;

  constructor(registry, releasePin, lookup) {
    this.registry = deepFreeze(registry);
    this.releasePin = deepFreeze(releasePin);
    this.#lookup = lookup;
    Object.freeze(this);
  }

  find(category, statementText) {
    return this.#lookup.get(`${category}\u0000${statementText}`);
  }
}

function requirePinned(registry) {
  if (!(registry instanceof PinnedPublicStatementRegistry)) throw new TypeError("registry must be a PinnedPublicStatementRegistry");
  return registry;
}

export async function validatePublicStatementRegistry(payload, releasePin) {
  exactKeys(releasePin, ["expectedSchemaVersion", "expectedRegistryHash", "expectedReleaseCommit"], "$.releasePin");
  text(releasePin.expectedSchemaVersion, "$.releasePin.expectedSchemaVersion");
  hash(releasePin.expectedRegistryHash, "$.releasePin.expectedRegistryHash");
  if (typeof releasePin.expectedReleaseCommit !== "string" || !GIT_OBJECT_ID.test(releasePin.expectedReleaseCommit)) {
    fail("$.releasePin.expectedReleaseCommit", "release commit must be a Git object ID");
  }
  exactKeys(payload, ["schemaName", "schemaVersion", "statements", "registryHash"], "$.registry");
  if (payload.schemaName !== "FledaPublicStatementRegistry") fail("$.registry.schemaName", "has the wrong literal");
  if (payload.schemaVersion !== "1.0.0") fail("$.registry.schemaVersion", "has the wrong literal");
  if (payload.schemaVersion !== releasePin.expectedSchemaVersion) fail("$.registry.schemaVersion", "schemaVersion does not match release pin");
  hash(payload.registryHash, "$.registry.registryHash");
  array(payload.statements, "$.registry.statements", { max: MAX_COUNT });
  const ids = [];
  const hashes = [];
  for (const [index, entry] of payload.statements.entries()) {
    const path = `$.registry.statements[${index}]`;
    exactKeys(entry, ["statementId", "category", "text", "statementHash", "approvalStatus"], path);
    if (typeof entry.statementId !== "string" || !STATEMENT_ID.test(entry.statementId)) fail(`${path}.statementId`, "is malformed");
    choice(entry.category, CATEGORIES, `${path}.category`);
    text(entry.text, `${path}.text`);
    hash(entry.statementHash, `${path}.statementHash`);
    if (entry.approvalStatus !== "approved_for_public_release") fail(`${path}.approvalStatus`, "must be approved_for_public_release");
    const expected = await sha256Canonical({ category: entry.category, text: entry.text });
    if (entry.statementHash !== expected) fail(`${path}.statementHash`, "does not match category and text");
    ids.push(entry.statementId);
    hashes.push(entry.statementHash);
  }
  if (new Set(ids).size !== ids.length) fail("$.registry.statements", "statementId values must be unique");
  if (new Set(hashes).size !== hashes.length) fail("$.registry.statements", "statementHash values must be unique");
  if (ids.some((id, index) => index > 0 && ids[index - 1] >= id)) fail("$.registry.statements", "must use lexicographic unsigned ASCII byte order");
  rejectForbidden(payload, "$.registry");
  const expectedRegistryHash = await sha256Canonical(without(payload, "registryHash"));
  if (payload.registryHash !== expectedRegistryHash) fail("$.registry.registryHash", "does not match canonical registry");
  if (payload.registryHash !== releasePin.expectedRegistryHash) fail("$.registry.registryHash", "registryHash does not match release pin");
  const registry = publicClone(payload);
  const pin = publicClone(releasePin);
  const lookup = new Map(registry.statements.map((entry) => [`${entry.category}\u0000${entry.text}`, entry]));
  return new PinnedPublicStatementRegistry(registry, pin, lookup);
}

export function requirePublicStatement(registry, category, statementText) {
  const pinned = requirePinned(registry);
  choice(category, CATEGORIES, "$.category");
  text(statementText, "$.text");
  const entry = pinned.find(category, statementText);
  if (!entry) throw new TypeError(`statement is not approved for category ${category}`);
  return entry;
}

function validateDetailMembership(value, registry) {
  requirePublicStatement(registry, "method_label", value.method.label);
  for (const [field, category] of [
    ["rejectionReasons", "rejection_reason"], ["knowledgeAcquired", "knowledge"],
    ["modelingConstraints", "modeling_constraint"], ["missingMechanisms", "missing_mechanism"],
    ["architectureImplications", "architecture_implication"]
  ]) value[field].forEach((item) => requirePublicStatement(registry, category, item.statement));
  requirePublicStatement(registry, "uncertainty", value.uncertaintySummary.summary);
  value.limitations.forEach((item) => requirePublicStatement(registry, "limitation", item));
}

async function validateDetail(value, registry, path) {
  validateDetailShape(value, path);
  validateDetailMembership(value, registry);
  rejectForbidden(value, path);
  if (await sha256Canonical(without(value, "projectionHash")) !== value.projectionHash) fail(`${path}.projectionHash`, "does not match canonical public record");
}

export async function validateTrainingRecordDetail(payload, registry) {
  requirePinned(registry);
  const value = publicClone(payload);
  await validateDetail(value, registry, "$");
  return deepFreeze(value);
}

export async function validateTrainingRecordSummary(payload, registry) {
  requirePinned(registry);
  const value = publicClone(payload);
  validateSummaryShape(value, "$");
  requirePublicStatement(registry, "method_label", value.methodLabel);
  rejectForbidden(value);
  return deepFreeze(value);
}

export async function validateTrainingRecordCollection(payload, registry) {
  requirePinned(registry);
  const value = publicClone(payload);
  exactKeys(value, ["schemaName", "schemaVersion", "items", "nextCursor", "collectionHash"], "$");
  if (value.schemaName !== "FledaPublicModelTrainingRecordCollection") fail("$.schemaName", "has the wrong literal");
  if (value.schemaVersion !== "1.1.0") fail("$.schemaVersion", "has the wrong literal");
  array(value.items, "$.items");
  value.items.forEach((item, index) => {
    validateSummaryShape(item, `$.items[${index}]`);
    requirePublicStatement(registry, "method_label", item.methodLabel);
  });
  if (value.nextCursor !== null && (typeof value.nextCursor !== "string" || value.nextCursor.length > 512)) fail("$.nextCursor", "is invalid");
  hash(value.collectionHash, "$.collectionHash");
  rejectForbidden(value);
  if (await sha256Canonical(without(value, "collectionHash")) !== value.collectionHash) fail("$.collectionHash", "does not match canonical collection");
  return deepFreeze(value);
}

export async function validateTrainingRecordSnapshot(payload, registry) {
  requirePinned(registry);
  const value = publicClone(payload);
  exactKeys(value, ["schemaName", "schemaVersion", "records", "generatedFromCommit", "snapshotHash"], "$");
  if (value.schemaName !== "FledaPublicModelTrainingRecordSnapshot") fail("$.schemaName", "has the wrong literal");
  if (value.schemaVersion !== "1.1.0") fail("$.schemaVersion", "has the wrong literal");
  array(value.records, "$.records", { max: MAX_COUNT });
  for (const [index, record] of value.records.entries()) await validateDetail(record, registry, `$.records[${index}]`);
  if (typeof value.generatedFromCommit !== "string" || !/^[0-9a-f]{40}$/.test(value.generatedFromCommit)) fail("$.generatedFromCommit", "must be a Git SHA-1 commit");
  hash(value.snapshotHash, "$.snapshotHash");
  rejectForbidden(value);
  if (await sha256Canonical(without(value, "snapshotHash")) !== value.snapshotHash) fail("$.snapshotHash", "does not match canonical snapshot");
  return deepFreeze(value);
}
