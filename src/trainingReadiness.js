const QUANTITATIVE_FIELDS = Object.freeze([
  "endpoint",
  "value",
  "unit",
  "timepoint",
  "timeUnit",
  "assay",
  "species",
  "sampleSize",
  "variability"
]);

function hasValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function observationMissingFields(observation = {}) {
  return QUANTITATIVE_FIELDS.filter((field) => {
    if (field === "value" || field === "timepoint") return !Number.isFinite(observation[field]);
    if (field === "sampleSize") return !Number.isFinite(observation[field]) || observation[field] <= 0;
    if (field === "variability") {
      return !observation.variability ||
        !hasValue(observation.variability.type) ||
        !Number.isFinite(observation.variability.value);
    }
    return !hasValue(observation[field]);
  });
}

export function assessLiteratureRecordReadiness(record = {}) {
  const observations = Array.isArray(record.quantitativeObservations)
    ? record.quantitativeObservations
    : [];
  const observationAssessments = observations.map((observation) => ({
    observation,
    missingFields: observationMissingFields(observation)
  }));
  const validObservations = observationAssessments.filter((item) => item.missingFields.length === 0);
  const missingQuantitativeFields = [...new Set(
    (observationAssessments.length ? observationAssessments : [{ missingFields: QUANTITATIVE_FIELDS }])
      .flatMap((item) => item.missingFields)
  )];

  const provenanceReady = Boolean(
    record.pmid && record.title && Number(record.year) && (record.doi || record.url)
  );
  const mechanisticGuidanceReady = Boolean(
    provenanceReady &&
    record.experimentalContext &&
    Array.isArray(record.mechanisticClaims) && record.mechanisticClaims.length &&
    Array.isArray(record.candidateEffects) && record.candidateEffects.length
  );

  return {
    recordId: record.id || (record.pmid ? `pmid:${record.pmid}` : "unknown"),
    provenanceReady,
    mechanisticGuidanceReady,
    quantitativeObservationCount: validObservations.length,
    submittedObservationCount: observations.length,
    calibrationEligible: mechanisticGuidanceReady && validObservations.length > 0,
    missingQuantitativeFields,
    formalModelChange: false
  };
}

export function summarizeTrainingReadiness(records = []) {
  const assessments = records.map(assessLiteratureRecordReadiness);
  const mechanisticGuidanceCount = assessments.filter((item) => item.mechanisticGuidanceReady).length;
  const calibrationEligibleRecordCount = assessments.filter((item) => item.calibrationEligible).length;
  const quantitativeObservationCount = assessments.reduce(
    (sum, item) => sum + item.quantitativeObservationCount,
    0
  );

  return {
    totalRecords: records.length,
    provenanceReadyCount: assessments.filter((item) => item.provenanceReady).length,
    mechanisticGuidanceCount,
    calibrationEligibleRecordCount,
    quantitativeObservationCount,
    stage: calibrationEligibleRecordCount > 0
      ? "candidate_calibration_ready"
      : mechanisticGuidanceCount > 0
        ? "evidence_guided_only"
        : "catalog_only",
    neuralTrainingReady: false,
    formalModelChange: false,
    nextRequirements: [
      "harmonized quantitative observations",
      "units and assay conditions",
      "timepoints, sample sizes, and variability",
      "independent validation datasets"
    ],
    assessments
  };
}

