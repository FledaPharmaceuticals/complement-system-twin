const EVIDENCE_SCORES = Object.freeze({
  randomized_trial: 40,
  consensus: 38,
  systematic_review: 34,
  mechanistic_study: 30,
  comprehensive_review: 28,
  review: 24,
  commentary: 12
});

function paper({ pmid, doi, title, authors, year, journal, evidenceType, recognition, linkedEntities, modelUse, priorityAuthor = false }) {
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
    url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    sourceProvider: "PubMed",
    formalModelChanged: false
  });
}

export const APPLIED_LITERATURE = Object.freeze([
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
    if (/c5/i.test(value)) return "C5";
    if (/c3/i.test(value)) return "C3";
    return value;
  });
  const entities = [plan.diseaseContext, ...(plan.focus || []), ...interventionEntities];
  return rankAppliedLiterature(APPLIED_LITERATURE, { entities })
    .filter((record) => record.ranking.contributions.relevance > 0)
    .slice(0, limit);
}
