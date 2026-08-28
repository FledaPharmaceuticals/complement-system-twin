const REPORT_BOUNDARY = {
  use: "research_and_education_only",
  isClinicalPrediction: false,
  containsPatientData: false,
  containsProductionData: false,
  formalModelChanged: false
};

export function buildSimulationReport({
  modelVersion,
  simulationInput,
  simulationOutput,
  evidenceSummary = null,
  comparisonRows = [],
  createdAt = new Date().toISOString()
} = {}) {
  if (!modelVersion) throw new TypeError("modelVersion is required");
  if (!simulationInput || typeof simulationInput !== "object") throw new TypeError("simulationInput is required");
  if (!simulationOutput || typeof simulationOutput !== "object") throw new TypeError("simulationOutput is required");
  if (!Array.isArray(comparisonRows)) throw new TypeError("comparisonRows must be an array");

  return {
    reportType: "fleda_complement_research_simulation",
    reportVersion: "1.0",
    createdAt,
    modelVersion,
    simulationInput: structuredClone(simulationInput),
    simulationOutput: structuredClone(simulationOutput),
    evidenceSummary: evidenceSummary ? structuredClone(evidenceSummary) : null,
    comparisonRows: structuredClone(comparisonRows),
    assumptions: [
      "Outputs are qualitative research proxies from a rule-based model.",
      "Literature evidence and candidate calibrations do not automatically change formal parameters."
    ],
    boundary: { ...REPORT_BOUNDARY }
  };
}
