const SIGNAL_KEYS = [
  "diseaseActivityProxy",
  "c3Activation",
  "c5aSignal",
  "macFormation",
  "infectionRisk"
];

export const VALIDATION_SIGNAL_KEYS = Object.freeze([...SIGNAL_KEYS]);

export function createValidationDataset({
  datasetId,
  diseaseContext,
  source,
  observations,
  containsPatientData,
  containsProductionData,
  measurementScale = "normalized_0_100_proxy",
  experimentalContext = {}
} = {}) {
  if (!datasetId) throw new TypeError("datasetId is required");
  if (!diseaseContext) throw new TypeError("diseaseContext is required");
  if (!source) throw new TypeError("source is required");
  if (containsPatientData !== false) throw new TypeError("containsPatientData must be false");
  if (containsProductionData !== false) throw new TypeError("containsProductionData must be false");
  if (!Array.isArray(observations)) throw new TypeError("observations must be an array");
  if (measurementScale !== "normalized_0_100_proxy") {
    throw new TypeError("measurementScale must be normalized_0_100_proxy until unit conversion is validated");
  }
  if (!experimentalContext || typeof experimentalContext !== "object" || Array.isArray(experimentalContext)) {
    throw new TypeError("experimentalContext must be an object");
  }
  observations.forEach((observation) => {
    if (!observation || typeof observation !== "object" || Array.isArray(observation)) throw new TypeError("each observation must be an object");
    SIGNAL_KEYS.forEach((key) => {
      if (key in observation && (!Number.isFinite(observation[key]) || observation[key] < 0 || observation[key] > 100)) {
        throw new RangeError(`${key} must be between 0 and 100`);
      }
    });
  });
  return {
    recordType: "fleda_anonymous_validation_dataset",
    validationVersion: "1.0",
    datasetId,
    diseaseContext,
    source,
    measurementScale,
    experimentalContext: structuredClone(experimentalContext),
    anonymous: true,
    observations: structuredClone(observations),
    boundary: {
      containsPatientData: false,
      containsProductionData: false,
      formalModelChanged: false
    }
  };
}

export function parseValidationDatasetJson(jsonText) {
  if (typeof jsonText !== "string") throw new TypeError("validation dataset must be valid JSON");
  let payload;
  try {
    payload = JSON.parse(jsonText);
  } catch {
    throw new TypeError("validation dataset must be valid JSON");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("validation dataset must be a JSON object");
  }
  return createValidationDataset(payload);
}

export function compareValidationDataset(dataset, predictions = []) {
  if (!dataset?.anonymous || !dataset.boundary || dataset.boundary.containsPatientData !== false) {
    throw new TypeError("an anonymous validation dataset is required");
  }
  if (!Array.isArray(predictions) || predictions.length !== dataset.observations.length) {
    throw new TypeError("predictions must match observation count");
  }
  const metrics = {};
  SIGNAL_KEYS.forEach((key) => {
    const pairs = dataset.observations.map((observation, index) => [observation[key], predictions[index]?.[key]])
      .filter(([observed, predicted]) => Number.isFinite(observed) && Number.isFinite(predicted));
    if (!pairs.length) return;
    const errors = pairs.map(([observed, predicted]) => predicted - observed);
    metrics[key] = {
      n: pairs.length,
      mae: round(errors.reduce((sum, value) => sum + Math.abs(value), 0) / pairs.length),
      bias: round(errors.reduce((sum, value) => sum + value, 0) / pairs.length)
    };
  });
  return {
    recordType: "fleda_validation_comparison",
    datasetId: dataset.datasetId,
    diseaseContext: dataset.diseaseContext,
    metrics,
    boundary: { ...dataset.boundary, formalModelChanged: false }
  };
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}
