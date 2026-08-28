const MAX_TEXT_LENGTH = 2000;

export function createStructuredFeedbackRecord({
  modelVersion,
  diseaseContext = "",
  component = "",
  timeScale = "",
  parameterAdjustment = "",
  predictionObservation = "",
  missingMechanism = "",
  literatureLink = "",
  confirmedNoSensitiveData = false,
  createdAt = new Date().toISOString(),
  feedbackId = `feedback-${Date.now()}`
} = {}) {
  if (!modelVersion) throw new Error("modelVersion is required");
  if (!confirmedNoSensitiveData) {
    throw new Error("Confirm that the feedback contains no patient or production data.");
  }
  if (literatureLink && !/^https?:\/\//i.test(literatureLink)) {
    throw new Error("literatureLink must use an http(s) URL");
  }
  return {
    recordType: "fleda_structured_research_feedback",
    feedbackVersion: "1.0",
    feedbackId,
    createdAt,
    modelVersion,
    status: "unreviewed",
    anonymous: true,
    submissionMode: "local_download_only",
    dataBoundary: "no_patient_or_production_data",
    observations: {
      diseaseContext: clean(diseaseContext, 120),
      component: clean(component, 120),
      timeScale: clean(timeScale, 80),
      parameterAdjustment: clean(parameterAdjustment),
      predictionObservation: clean(predictionObservation),
      missingMechanism: clean(missingMechanism),
      literatureLink: clean(literatureLink, 500)
    }
  };
}

function clean(value, limit = MAX_TEXT_LENGTH) {
  return String(value ?? "").trim().slice(0, limit);
}
