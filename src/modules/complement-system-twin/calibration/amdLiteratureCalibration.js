export const amdLiteratureCalibration = {
  disease: "Age-related Macular Degeneration",
  modelUse: "retina-centered complement-mediated disease context",
  disclaimer: "Curated evidence records are parameter priors for research visualization. They are not clinical calibration, diagnosis, or patient-specific prediction.",
  parameterPriors: [
    {
      parameter: "alternativeMultiplier",
      label: "Alternative pathway activity",
      range: { min: 1.2, median: 1.35, max: 1.6 },
      evidenceCount: 5,
      evidenceLevel: "clinical + genetic + mechanistic",
      confidence: "moderate-high",
      rationale: "AMD literature repeatedly implicates chronic alternative pathway activity and complement-amplification biology."
    },
    {
      parameter: "factorHRegulationMultiplier",
      label: "Factor H regulation",
      range: { min: 0.7, median: 0.8, max: 0.9 },
      evidenceCount: 4,
      evidenceLevel: "genetic + mechanistic",
      confidence: "moderate-high",
      rationale: "CFH-associated mechanisms support reduced or insufficient regulation in AMD-relevant tissue contexts."
    },
    {
      parameter: "retinalTissueSensitivityMultiplier",
      label: "Retinal tissue sensitivity",
      range: { min: 1.3, median: 1.5, max: 1.8 },
      evidenceCount: 4,
      evidenceLevel: "ocular tissue + mechanistic",
      confidence: "moderate",
      rationale: "RPE, macula, and choroid are modeled as locally sensitive to chronic complement stress."
    },
    {
      parameter: "macFormationLocalRiskMultiplier",
      label: "Local MAC / sC5b-9 risk",
      range: { min: 1.1, median: 1.2, max: 1.4 },
      evidenceCount: 3,
      evidenceLevel: "ocular tissue + biomarker",
      confidence: "moderate",
      rationale: "Terminal pathway signal is treated as local retina/choroid tissue stress rather than systemic organ involvement."
    },
    {
      parameter: "drusenProxyWeight",
      label: "Drusen proxy weight",
      range: { min: 0.8, median: 1.0, max: 1.25 },
      evidenceCount: 3,
      evidenceLevel: "imaging association + mechanistic",
      confidence: "early",
      rationale: "Drusen activity is represented as an AMD-specific proxy linked to C3 activation and C3b deposition."
    }
  ],
  evidenceRecords: [
    {
      id: "AMD-COMPLEMENT-001",
      finding: "Alternative pathway dysregulation is repeatedly associated with AMD biology.",
      biomarkerOrMechanism: "alternative pathway / C3 amplification",
      direction: "increased activity",
      modelParameter: "alternativeMultiplier",
      evidenceLevel: "clinical + genetic + mechanistic",
      sampleContext: "human genetic association, ocular biology, disease mechanism",
      sourceLabel: "Scholl et al., PLOS ONE 2008",
      sourceUrl: "https://doi.org/10.1371/journal.pone.0002593",
      confidence: 0.82
    },
    {
      id: "AMD-COMPLEMENT-002",
      finding: "CFH-related biology supports reduced or insufficient complement regulation in AMD-relevant tissue context.",
      biomarkerOrMechanism: "Factor H / CFH",
      direction: "reduced regulation",
      modelParameter: "factorHRegulationMultiplier",
      evidenceLevel: "genetic + mechanistic",
      sampleContext: "human genetic association and complement regulation mechanism",
      sourceLabel: "Wilke & Apte, JCI 2024",
      sourceUrl: "https://doi.org/10.1172/JCI178296",
      confidence: 0.84
    },
    {
      id: "AMD-COMPLEMENT-003",
      finding: "C3 activation and C3b deposition are modeled as drivers of retina-centered complement activity and drusen proxy signal.",
      biomarkerOrMechanism: "C3 / C3b",
      direction: "increased local signal",
      modelParameter: "drusenProxyWeight",
      evidenceLevel: "mechanistic + ocular tissue association",
      sampleContext: "retina, RPE, drusen, choroid interface",
      sourceLabel: "Wilke & Apte, JCI 2024",
      sourceUrl: "https://doi.org/10.1172/JCI178296",
      confidence: 0.72
    },
    {
      id: "AMD-COMPLEMENT-004",
      finding: "C3a and C5a are treated as inflammatory signaling links between complement activation and choroidal/RPE stress proxies.",
      biomarkerOrMechanism: "C3a / C5a",
      direction: "moderately increased inflammatory signal",
      modelParameter: "retinalTissueSensitivityMultiplier",
      evidenceLevel: "mechanistic",
      sampleContext: "ocular inflammatory signaling",
      sourceLabel: "Altay et al., Eye 2019",
      sourceUrl: "https://doi.org/10.1038/s41433-019-0501-4",
      confidence: 0.66
    },
    {
      id: "AMD-COMPLEMENT-005",
      finding: "Terminal complement signal is modeled as local MAC/sC5b-9 tissue stress in retina/choroid, not systemic organ damage.",
      biomarkerOrMechanism: "MAC / sC5b-9",
      direction: "locally increased risk signal",
      modelParameter: "macFormationLocalRiskMultiplier",
      evidenceLevel: "biomarker + tissue mechanism",
      sampleContext: "retina/choroid local tissue context",
      sourceLabel: "Schick et al., Eye 2017",
      sourceUrl: "https://doi.org/10.1038/eye.2016.328",
      confidence: 0.68
    },
    {
      id: "AMD-COMPLEMENT-006",
      finding: "CFB, CFI, C3, and CFH are represented as genetics-informed pathway relevance markers for AMD model priors.",
      biomarkerOrMechanism: "CFB / CFI / C3 / CFH",
      direction: "pathway relevance",
      modelParameter: "alternativeMultiplier",
      evidenceLevel: "genetic association",
      sampleContext: "human AMD genetic association",
      sourceLabel: "Scholl et al., PLOS ONE 2008",
      sourceUrl: "https://doi.org/10.1371/journal.pone.0002593",
      confidence: 0.76
    }
  ],
  futureIntegrationPoints: [
    "Replace seed evidence records with PMID-linked extraction records.",
    "Add OCT/drusen/geographic atrophy/CNV imaging-derived calibration inputs.",
    "Add plasma, serum, aqueous humor, or retinal tissue complement biomarker data.",
    "Fit disease-specific parameter ranges with cohort-level statistics and uncertainty bands."
  ]
};

export function getAmdCalibrationSummary() {
  const priors = amdLiteratureCalibration.parameterPriors;
  const evidenceCount = amdLiteratureCalibration.evidenceRecords.length;
  const medianAlternative = priors.find((prior) => prior.parameter === "alternativeMultiplier")?.range.median;
  const medianRetina = priors.find((prior) => prior.parameter === "retinalTissueSensitivityMultiplier")?.range.median;
  return `${evidenceCount} curated evidence records define AMD parameter priors. Current seed priors center alternative pathway activity near ${medianAlternative}x and retinal tissue sensitivity near ${medianRetina}x.`;
}
