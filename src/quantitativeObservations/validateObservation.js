const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;
const CONTROLLED_FIELDS = [
  ["source.accessType", ["open_full_text", "open_abstract", "licensed_upload", "metadata_only"]],
  ["locator.sourceKind", ["text", "table", "figure", "supplement"]],
  ["biologicalContext.spatialScope", ["local_tissue", "systemic", "mixed", "unknown"]],
  ["biologicalContext.experimentalSetting", ["in_vivo", "ex_vivo", "in_vitro", "clinical", "unknown"]],
  ["experiment.groupRole", ["case", "healthy_control", "vehicle_control", "treated", "untreated", "reference", "other", "unknown"]],
  ["experiment.pairedDesign", ["paired", "unpaired", "mixed", "not_reported"]],
  ["experiment.baselineOrFollowup", ["baseline", "followup", "single_timepoint", "not_applicable"]],
  ["experiment.timepointAnchor", ["dose", "stimulation", "diagnosis", "enrollment", "collection", "baseline", "other", "unknown"]],
  ["measurement.valueQualifier", ["exact", "approximate", "less_than", "less_than_or_equal", "greater_than", "greater_than_or_equal", "not_reported"]],
  ["measurement.variabilityType", ["SD", "SEM", "CI", "IQR", "range", "none_reported", "not_applicable"]],
  ["measurement.axisScale", ["linear", "log10", "ln", "categorical"]],
  ["measurement.extractionOrigin", ["text", "table_cell", "author_data", "figure_digitization"]],
  ["provenance.reviewResult", ["supported", "partially_supported", "unsupported", "conflicted", "not_reviewed"]],
  ["provenance.ruleValidationResult", ["passed", "warning", "failed"]],
  ["governance.uncertainty", ["low", "moderate", "high", "unknown"]]
];

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function pushIssue(issues, code, fieldPath) {
  if (!issues.some((issue) => issue.code === code)) issues.push({ code, fieldPath });
}

function hasPreciseLocator(locator = {}) {
  return [
    locator.section,
    locator.page,
    locator.tableId,
    locator.figureId,
    locator.rowLabel,
    locator.columnLabel,
    locator.supportingExcerpt
  ].some(hasText) || locator.boundingBox !== null && locator.boundingBox !== undefined;
}

function hasNotApplicableReason(observation, fieldPath) {
  return (observation.governance?.notApplicableReasons ?? [])
    .some((reason) => reason.fieldPath === fieldPath && hasText(reason.ruleId) && hasText(reason.reason));
}

export function validateQuantitativeObservation(observation) {
  const issues = [];
  const source = observation?.source ?? {};
  const locator = observation?.locator ?? {};
  const biology = observation?.biologicalContext ?? {};
  const experiment = observation?.experiment ?? {};
  const measurement = observation?.measurement ?? {};
  const provenance = observation?.provenance ?? {};
  const governance = observation?.governance ?? {};

  for (const [path, allowed] of CONTROLLED_FIELDS) {
    const value = path.split(".").reduce((current, key) => current?.[key], observation);
    if (!allowed.includes(value)) pushIssue(issues, "CONTROLLED_VOCABULARY_INVALID", path);
  }

  if (observation?.schemaName !== "FledaQuantitativeObservation" || observation?.schemaVersion !== "1.0.0") {
    pushIssue(issues, "SCHEMA_IDENTITY_INVALID", "schemaName");
  }
  if (governance.formalModelChange !== false) pushIssue(issues, "FORMAL_MODEL_CHANGE_FORBIDDEN", "governance.formalModelChange");

  const stableId = [source.pmid, source.pmcid, source.doi].some(hasText);
  const sourceComplete = stableId
    && hasText(source.sourceUrl)
    && HASH_PATTERN.test(source.contentHash ?? "")
    && hasText(source.retrievedAt)
    && hasText(source.accessType)
    && hasText(source.license)
    && source.license !== "unknown";
  if (!sourceComplete) pushIssue(issues, "SOURCE_IDENTITY_INCOMPLETE", "source");
  if (["metadata_only", "open_abstract"].includes(source.accessType)) {
    pushIssue(issues, "FULL_QUANTITATIVE_SOURCE_REQUIRED", "source.accessType");
  }

  if (!hasPreciseLocator(locator)) pushIssue(issues, "PRECISE_LOCATOR_REQUIRED", "locator");
  if (locator.sourceKind === "figure" && (!locator.axis || !HASH_PATTERN.test(provenance.sourceImageHash ?? ""))) {
    pushIssue(issues, "FIGURE_PROVENANCE_INCOMPLETE", "locator.axis");
  }

  const biologyComplete = hasText(biology.analyte)
    && hasText(biology.species)
    && hasText(biology.disease)
    && (hasText(biology.matrix) || hasText(biology.tissue))
    && ["local_tissue", "systemic", "mixed"].includes(biology.spatialScope)
    && ["in_vivo", "ex_vivo", "in_vitro", "clinical"].includes(biology.experimentalSetting);
  if (!biologyComplete) pushIssue(issues, "BIOLOGICAL_CONTEXT_INCOMPLETE", "biologicalContext");

  const experimentComplete = hasText(experiment.studyDesign)
    && experiment.studyDesign !== "not reported"
    && hasText(experiment.experimentalModel)
    && experiment.experimentalModel !== "not reported"
    && hasText(experiment.assay)
    && experiment.assay !== "not reported"
    && Number.isInteger(experiment.sampleSize) && experiment.sampleSize > 0
    && Number.isInteger(experiment.analysisSampleSize) && experiment.analysisSampleSize > 0
    && hasText(experiment.groupId)
    && hasText(experiment.groupLabel)
    && experiment.groupRole !== "unknown"
    && Number.isFinite(experiment.timepoint)
    && hasText(experiment.timeUnit)
    && experiment.timepointAnchor !== "unknown";
  if (!experimentComplete) pushIssue(issues, "EXPERIMENT_CONTEXT_INCOMPLETE", "experiment");

  for (const field of ["intervention", "dose", "route"]) {
    if (experiment[field] === null && !hasNotApplicableReason(observation, `experiment.${field}`)) {
      pushIssue(issues, "NOT_APPLICABLE_REASON_REQUIRED", `experiment.${field}`);
    }
  }

  const measurementComplete = hasText(measurement.endpoint)
    && hasText(measurement.reportedStatistic)
    && measurement.reportedStatistic !== "not reported"
    && Number.isFinite(measurement.value)
    && !Object.is(measurement.value, -0)
    && hasText(measurement.reportedValueText)
    && hasText(measurement.reportedUnit)
    && measurement.reportedUnit !== "unknown"
    && hasText(measurement.unitCode)
    && measurement.unitCode !== "unknown"
    && measurement.valueQualifier !== "not_reported";
  if (!measurementComplete) pushIssue(issues, "MEASUREMENT_INCOMPLETE", "measurement");
  if (measurement.censored === true && !Number.isFinite(measurement.detectionLimit)) {
    pushIssue(issues, "CENSORING_METADATA_INCOMPLETE", "measurement.detectionLimit");
  }

  if (observation.normalization && !["not_required", "validated"].includes(observation.normalization.conversionStatus)) {
    pushIssue(issues, "NORMALIZATION_NOT_VALIDATED", "normalization.conversionStatus");
  }
  if (provenance.ruleValidationResult !== "passed") pushIssue(issues, "RULE_VALIDATION_NOT_PASSED", "provenance.ruleValidationResult");
  if (provenance.reviewResult !== "supported") pushIssue(issues, "REVIEW_NOT_SUPPORTED", "provenance.reviewResult");
  if (governance.workflowState === "conflicted" || provenance.reviewResult === "conflicted") {
    pushIssue(issues, "UNRESOLVED_CONFLICT", "governance.workflowState");
  }

  return {
    valid: issues.length === 0,
    issues,
    calibrationEligible: issues.length === 0,
    eligibilityReasons: issues.length === 0
      ? ["ALL_DETERMINISTIC_GATES_PASSED"]
      : issues.map((issue) => issue.code)
  };
}
