export function createCalibrationReviewPackage({
  diseaseContext,
  modelVersion,
  candidates = [],
  conflicts = [],
  evidenceRecords = [],
  createdAt = new Date().toISOString()
} = {}) {
  return {
    packageType: "fleda_calibration_review",
    packageVersion: "1.0",
    createdAt,
    diseaseContext,
    modelVersion,
    status: "candidate_review",
    formalModelChange: false,
    dataBoundary: "public_literature_metadata_and_model_candidates_only",
    candidates: [...candidates],
    conflicts: [...conflicts],
    evidenceRecords: [...evidenceRecords]
  };
}
