const EVIDENCE_SCORES = Object.freeze({
  randomized_trial: 40,
  consensus: 38,
  systematic_review: 34,
  mechanistic_study: 30,
  comprehensive_review: 28,
  review: 24,
  commentary: 12
});

function paper({
  pmid,
  doi,
  title,
  authors,
  year,
  journal,
  evidenceType,
  recognition,
  linkedEntities,
  modelUse,
  priorityAuthor = false,
  portfolioSource = null,
  experimentalContext = "",
  mechanisticClaims = [],
  candidateEffects = [],
  transferLimits = []
}) {
  return Object.freeze({
    id: `pmid:${pmid}`,
    pmid,
    doi,
    title,
    authors,
    year,
    journal,
    evidenceType,
    recognition,
    linkedEntities,
    modelUse,
    priorityAuthor,
    portfolioSource,
    experimentalContext,
    mechanisticClaims,
    candidateEffects,
    transferLimits,
    url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    sourceProvider: "PubMed",
    formalModelChanged: false
  });
}

export const APPLIED_LITERATURE = Object.freeze([
  paper({
    pmid: "42063338",
    doi: "10.1021/acs.jmedchem.6c00832",
    title: "New Analogs of the Compstatin Family of Clinical Complement Inhibitors with Low Picomolar Target Affinity",
    authors: "Vogt SA; Lander AJ; Herbine K; et al.",
    year: 2026,
    journal: "Journal of Medicinal Chemistry",
    evidenceType: "mechanistic_study",
    recognition: 88,
    linkedEntities: ["C3", "C3b", "Compstatin", "Cp60", "Therapeutics", "PK/PD"],
    modelUse: "Candidate constraints for compstatin binding, target residence, and proximal C3 inhibition scenarios.",
    priorityAuthor: true,
    portfolioSource: "https://www.lambris.com/articles/",
    experimentalContext: "Structure-activity, in-vitro complement inhibition, and cryo-EM analysis of compstatin analogs.",
    mechanisticClaims: [
      "The V3I substitution increased compstatin-family C3 target affinity in the reported analog series.",
      "Cp60 showed low-picomolar C3 affinity and prolonged target residence in the reported in-vitro system."
    ],
    candidateEffects: [
      { target: "C3 activation", direction: "decrease", basis: "Cp60 proximal C3 binding", numericValue: null },
      { target: "C3 target residence", direction: "increase", basis: "Cp60 binding kinetics", numericValue: null }
    ],
    transferLimits: [
      "Affinity and structural measurements do not establish a disease-specific clinical dose-response.",
      "No numeric parameter is transferred without exposure, concentration, and assay harmonization."
    ]
  }),
  paper({
    pmid: "40243098",
    doi: "10.1111/imm.13930",
    title: "Clinical C3 Inhibition With AMY-101 Reveals Novel Insights Into IL-8-Driven Inflammation in COVID-19",
    authors: "Antoniadou C; Natsi AM; Mastellos DC; et al.",
    year: 2025,
    journal: "Immunology",
    evidenceType: "commentary",
    recognition: 72,
    linkedEntities: ["C3", "AMY-101", "IL-8", "Inflammation", "COVID-19", "Therapeutics"],
    modelUse: "Candidate link between proximal C3 inhibition and IL-8-centered inflammatory interpretation.",
    priorityAuthor: true,
    portfolioSource: "https://www.lambris.com/articles/",
    experimentalContext: "Clinical C3-inhibition report presented as a PubMed-indexed letter.",
    mechanisticClaims: [
      "The report associates clinical C3 inhibition with an IL-8-centered inflammatory response context."
    ],
    candidateEffects: [
      { target: "IL-8 inflammatory signal", direction: "decrease", basis: "AMY-101 C3 inhibition context", numericValue: null }
    ],
    transferLimits: [
      "A letter provides lower calibration strength than a controlled comparative trial.",
      "COVID-19 inflammatory findings cannot be transferred numerically to unrelated diseases."
    ]
  }),
  paper({
    pmid: "39809101",
    doi: "10.1016/j.intimp.2024.113701",
    title: "Cp40-mediated complement C3 inhibition dampens inflammasome activation and inflammatory mediators storm induced by Bitis arietans venom",
    authors: "Fernandes CD; Silva-de-Franca F; Pohl PC; et al.",
    year: 2025,
    journal: "International Immunopharmacology",
    evidenceType: "mechanistic_study",
    recognition: 80,
    linkedEntities: ["C3", "C3a", "C5a", "MAC", "Cp40", "Inflammasome", "IL-8", "IL-1beta", "Sepsis"],
    modelUse: "Directional candidate effects for proximal C3 inhibition on anaphylatoxins, terminal-complex signal, and inflammasome outputs.",
    priorityAuthor: true,
    portfolioSource: "https://www.lambris.com/articles/",
    experimentalContext: "Venom-stimulated ex-vivo human whole blood with a THP-1 macrophage follow-up model.",
    mechanisticClaims: [
      "Venom stimulation increased C3a, C5a, soluble terminal complement complex, and inflammatory mediators in the reported whole-blood model.",
      "Cp40 C3/C3b inhibition reduced the reported anaphylatoxin, terminal-complex, and inflammasome-associated signals."
    ],
    candidateEffects: [
      { target: "C3a", direction: "decrease", basis: "Cp40 C3/C3b inhibition", numericValue: null },
      { target: "C5a", direction: "decrease", basis: "Cp40 C3/C3b inhibition", numericValue: null },
      { target: "MAC", direction: "decrease", basis: "soluble terminal-complex response", numericValue: null },
      { target: "Inflammasome signal", direction: "decrease", basis: "NLRP3/ASC/caspase-1 response", numericValue: null }
    ],
    transferLimits: [
      "The initiating context is snake venom in ex-vivo whole blood, not a general sepsis or chronic-disease calibration dataset.",
      "THP-1 cell findings require validation in the tissue and disease context selected by the user."
    ]
  }),
  paper({
    pmid: "39666368",
    doi: "10.1158/2326-6066.CIR-24-0250",
    title: "The C5a/C5aR1 Axis Promotes Migration of Tolerogenic Dendritic Cells to Lymph Nodes, Impairing the Anticancer Immune Response",
    authors: "Senent Y; Remirez A; Reparaz D; et al.",
    year: 2025,
    journal: "Cancer Immunology Research",
    evidenceType: "mechanistic_study",
    recognition: 86,
    linkedEntities: ["Cancer", "C5a", "C5aR1", "Dendritic cells", "Tolerogenic DC migration", "Tumor microenvironment"],
    modelUse: "Cancer-context candidate mechanism for C5aR1-dependent dendritic-cell migration and immune suppression.",
    priorityAuthor: true,
    portfolioSource: "https://www.lambris.com/articles/",
    experimentalContext: "Human tumor-associated dendritic-cell observations and three syngeneic mouse tumor models.",
    mechanisticClaims: [
      "C5aR1 was associated with a tolerogenic phenotype in tumor-associated dendritic-cell populations.",
      "C5aR1 signaling promoted dendritic-cell migration toward tumor-draining lymph nodes in the reported models."
    ],
    candidateEffects: [
      { target: "Tolerogenic DC migration", direction: "decrease", basis: "C5aR1 inhibition", numericValue: null },
      { target: "Antitumor immune response", direction: "increase", basis: "C5aR1 inhibition combination context", numericValue: null }
    ],
    transferLimits: [
      "The therapeutic effect was evaluated in combination regimens and cannot be assigned to C5aR1 inhibition alone.",
      "Preclinical tumor-model results are not a patient-specific efficacy prediction."
    ]
  }),
  paper({
    pmid: "40683108",
    doi: "10.1016/j.pharmr.2025.100079",
    title: "The complement system: Biology, pathology, and therapeutic interventions",
    authors: "Li XX; Woodruff TM",
    year: 2025,
    journal: "Pharmacological Reviews",
    evidenceType: "comprehensive_review",
    recognition: 92,
    linkedEntities: ["C3", "C5", "MAC", "Factor B", "Factor D", "Therapeutics"],
    modelUse: "System topology, intervention points, and therapeutic mechanism cross-check."
  }),
  paper({
    pmid: "40028332",
    doi: "10.3389/fimmu.2025.1537974",
    title: "Factor B as a therapeutic target for the treatment of complement-mediated diseases",
    authors: "Kavanagh D; Barratt J; Schubart A; et al.",
    year: 2025,
    journal: "Frontiers in Immunology",
    evidenceType: "review",
    recognition: 78,
    linkedEntities: ["Factor B", "C3", "C5", "AMD", "PNH", "aHUS", "C3G"],
    modelUse: "Alternative-pathway amplification and Factor B inhibition candidate priors."
  }),
  paper({
    pmid: "40354320",
    doi: "10.1182/bloodadvances.2024015777",
    title: "Advancements in complement inhibition for PNH and primary complement-mediated thrombotic microangiopathy",
    authors: "Kelley TP; King H; Malhotra A; et al.",
    year: 2025,
    journal: "Blood Advances",
    evidenceType: "review",
    recognition: 82,
    linkedEntities: ["PNH", "aHUS", "C3", "C5", "RBC", "Kidney"],
    modelUse: "Disease-specific intervention and biomarker interpretation boundaries."
  }),
  paper({
    pmid: "37670180",
    doi: "10.1038/s41577-023-00926-1",
    title: "A guide to complement biology, pathology and therapeutic opportunity",
    authors: "Mastellos DC; Hajishengallis G; Lambris JD",
    year: 2024,
    journal: "Nature Reviews Immunology",
    evidenceType: "comprehensive_review",
    recognition: 98,
    linkedEntities: ["C3", "C5", "MAC", "Factor H", "CNS", "Tissue"],
    modelUse: "High-level system architecture, tissue context, and complement crosstalk constraints.",
    priorityAuthor: true
  }),
  paper({
    pmid: "37979593",
    doi: "10.1016/S0140-6736(23)01524-6",
    title: "Complement in human disease: approved and up-and-coming therapeutics",
    authors: "Risitano AM; Peffault de Latour R; et al.",
    year: 2024,
    journal: "The Lancet",
    evidenceType: "comprehensive_review",
    recognition: 96,
    linkedEntities: ["C3", "C5", "PNH", "aHUS", "AMD", "Therapeutics"],
    modelUse: "Cross-disease therapeutic target and safety-mechanism validation."
  }),
  paper({
    pmid: "39618492",
    doi: "10.1159/000542354",
    title: "C3 Glomerulopathy: A Current Perspective in an Evolving Landscape",
    authors: "Magliulo EK; Ravipati P",
    year: 2024,
    journal: "Glomerular Diseases",
    evidenceType: "review",
    recognition: 72,
    linkedEntities: ["C3G", "C3", "Factor H", "Kidney"],
    modelUse: "C3G disease stratification and alternative-pathway candidate assumptions."
  }),
  paper({
    pmid: "38622956",
    doi: "10.1111/ijlh.14281",
    title: "Complement inhibition in paroxysmal nocturnal hemoglobinuria: From biology to therapy",
    authors: "Versino F; Fattizzo B",
    year: 2024,
    journal: "International Journal of Laboratory Hematology",
    evidenceType: "review",
    recognition: 77,
    linkedEntities: ["PNH", "C3", "C5", "Factor B", "Factor D", "RBC"],
    modelUse: "PNH hemolysis mechanism and proximal-versus-terminal inhibition guidance."
  }),
  paper({
    pmid: "37865470",
    doi: "10.1016/S0140-6736(23)01520-9",
    title: "Pegcetacoplan for the treatment of geographic atrophy secondary to age-related macular degeneration (OAKS and DERBY): two multicentre, randomised, double-masked, sham-controlled, phase 3 trials",
    authors: "Heier JS; Lad EM; Holz FG; et al.",
    year: 2023,
    journal: "The Lancet",
    evidenceType: "randomized_trial",
    recognition: 96,
    linkedEntities: ["AMD", "C3", "Retina", "RPE", "Geographic Atrophy"],
    modelUse: "Clinical constraint for chronic retina-centered C3 intervention scenarios."
  }),
  paper({
    pmid: "36755352",
    doi: "10.1002/ajh.26875",
    title: "Complement-targeted therapeutics: An emerging field enabled by academic drug discovery",
    authors: "Lamers C; Ricklin D; Lambris JD",
    year: 2023,
    journal: "American Journal of Hematology",
    evidenceType: "review",
    recognition: 88,
    linkedEntities: ["C3", "C5", "PNH", "Therapeutics"],
    modelUse: "Therapeutic development history and target-selection context.",
    priorityAuthor: true
  })
]);

const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const DISEASE_CONTEXTS = new Set(["amd", "pnh", "ahus", "c3g", "sepsis", "cancer", "covid 19"]);
const diseaseContextAlias = (value) => ({
  AMD: "amd",
  PNH: "pnh",
  aHUS: "ahus",
  C3G: "c3g",
  sepsis: "sepsis",
  cancer: "cancer",
  "cancer microenvironment": "cancer"
})[value] || "";

function isDiseaseCompatible(record, diseaseContext) {
  const requested = diseaseContextAlias(diseaseContext);
  if (!requested) return true;
  const recordContexts = record.linkedEntities.map(normalize).filter((entity) => DISEASE_CONTEXTS.has(entity));
  return recordContexts.length === 0 || recordContexts.includes(requested);
}

function relevanceScore(record, entities) {
  const requested = entities.map(normalize).filter(Boolean);
  const linked = record.linkedEntities.map(normalize);
  const matches = requested.filter((term) => linked.some((item) => item.includes(term) || term.includes(item)));
  return Math.min(25, new Set(matches).size * 7);
}

export function rankAppliedLiterature(records = APPLIED_LITERATURE, options = {}) {
  const currentYear = Number(options.currentYear) || new Date().getUTCFullYear();
  const entities = options.entities || [];
  return records
    .map((record) => {
      const contributions = {
        recency: Math.max(0, 30 - Math.max(0, currentYear - Number(record.year || 0)) * 3),
        evidence: EVIDENCE_SCORES[record.evidenceType] || 10,
        recognition: Math.min(20, Math.max(0, Number(record.recognition || 0)) * 0.2),
        expertSource: record.priorityAuthor ? 8 : 0,
        relevance: relevanceScore(record, entities)
      };
      const score = Object.values(contributions).reduce((sum, value) => sum + value, 0);
      return { ...record, ranking: { score: Math.round(score * 10) / 10, contributions } };
    })
    .sort((a, b) => b.ranking.score - a.ranking.score || Number(b.year) - Number(a.year));
}

export function selectLiteratureForExperiment(plan, limit = 5) {
  const interventionEntities = (plan.intervention || []).map((value) => {
    if (/factorD/i.test(value)) return "Factor D";
    if (/factorB/i.test(value)) return "Factor B";
    if (/c5aR/i.test(value)) return "C5aR1";
    if (/c5/i.test(value)) return "C5";
    if (/c3/i.test(value)) return "C3";
    return value;
  });
  const entities = [plan.diseaseContext, ...(plan.focus || []), ...interventionEntities];
  return rankAppliedLiterature(APPLIED_LITERATURE, { entities })
    .filter((record) => isDiseaseCompatible(record, plan.diseaseContext))
    .filter((record) => record.ranking.contributions.relevance > 0)
    .slice(0, limit);
}
