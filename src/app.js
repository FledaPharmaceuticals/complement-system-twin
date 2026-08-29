import { entities, relationships, diseases, drugs, publications } from "./data.js";
import { runComplementSimulation } from "./simulation.js";
import { generateComplementTwinSummary } from "./summary.js";
import { getDynamicsSeriesMeta, runDynamicsSimulation } from "./modules/complement-system-twin/dynamics/runDynamicsSimulation.js";
import { generateDynamicsInterpretation, nearestTimePoint } from "./modules/complement-system-twin/dynamics/generateDynamicsInterpretation.js";
import { generateAmdDiseaseSummary, getAmdDisclaimer } from "./modules/complement-system-twin/dynamics/generateAmdDiseaseSummary.js";
import { diseaseOrganWeightMatrix } from "./modules/complement-system-twin/disease/organWeightMatrix.js";
import { rankDiseaseSpecificImpacts } from "./modules/complement-system-twin/disease/diseaseOrganScoring.js";
import { amdLiteratureCalibration, getAmdCalibrationSummary } from "./modules/complement-system-twin/calibration/amdLiteratureCalibration.js";
import { getLiteratureServiceStatus, getLocalLiteratureRecords, searchPublicPubMed } from "./literatureService.js";
import { getLocalProteinAnnotations, searchUniProtAnnotations } from "./annotationService.js";
import { fetchReactomePathway, getLocalPathwayAnnotations } from "./pathwayService.js";
import { getKnowledgeRecords } from "./knowledgeService.js";
import { buildModelAuditSummary } from "./modelAudit.js";
import { MODEL_VERSION } from "./modelContract.js";
import { buildSimulationEvidenceSummary } from "./evidenceSummary.js";
import { generateCalibrationCandidates } from "./calibrationCandidates.js";
import { MODEL_RELEASES } from "./modelRegistry.js";
import { renderModelHistory } from "./modelHistoryView.js";
import { buildEvidenceCatalog } from "./evidenceCatalog.js";
import { linkEvidenceRecords } from "./evidenceLinking.js";
import { generateEvidenceParameterCandidates } from "./evidenceParameterCandidates.js";
import { reviewCalibrationCandidates } from "./calibrationReview.js";
import { createCalibrationReviewPackage } from "./calibrationReviewPackage.js";
import { auditEvidenceCatalog } from "./evidenceAudit.js";
import { createStructuredFeedbackRecord } from "./structuredFeedback.js";
import { compareDrugInterventions } from "./drugComparison.js";
import { buildSimulationReport } from "./reportExport.js";
import { createValidationDataset, compareValidationDataset, parseValidationDatasetJson } from "./validationDataset.js";
import { generateValidationCalibrationCandidates } from "./validationCalibration.js";
import { preflightValidationIntake } from "./validationIntake.js";

const state = {
  entityFilter: "all",
  selectedEntity: "C3",
  selectedDisease: "PNH",
  selectedDrug: "C5 inhibition",
  dynamicsResult: null,
  visibleDynamicsGroups: new Set(["c3-system", "c5-system", "convertases", "regulators", "terminal", "amd-retina"]),
  heroPlayback: {
    traces: [],
    layout: null,
    config: null,
    timer: null,
    currentTime: 0,
    duration: 120,
    speed: 10,
    isPlaying: false,
    mode: "baseline",
    amdSpecificOutputs: null,
    biomarkerEstimate: null,
    biomarkerApplied: false
  },
  monitorAudio: {
    context: null,
    timer: null,
    bpm: 72
  },
  selectedMicrostructureOrgan: null
};

const evidenceVocabulary = [
  ...entities.map((entity) => ({ id: entity.id, terms: [entity.id, entity.symbol, entity.name] })),
  ...diseases.map((disease) => ({ id: disease.id, terms: [disease.id, disease.disease_name] }))
];
const linkExternalEvidence = (records) => linkEvidenceRecords(records, evidenceVocabulary);
let evidenceCatalog = buildEvidenceCatalog({ publications });
let localEvidenceState = { count: 0, records: [], error: null };
let localAnnotationState = { count: 0, records: [], error: null };
let localPathwayState = { count: 0, records: [], error: null };
let knowledgeLayerState = { count: 0, records: [], error: null };
let validationAuditComparisons = [];
let validationAuditCandidates = [];

document.getElementById("entity-count").textContent = entities.length;
document.getElementById("relationship-count").textContent = relationships.length;

initGraph();
initSimulation();
initDiseasePanel();
initDrugPanel();
renderPublications();
initDynamicsExplorer();
initHeroDynamicsChart();
initMicrostructureInteractions();
initBiomarkerPanel();
initDrugComparisonPanel();
initValidationDatasetPanel();
initLiteratureServicePanel();
document.getElementById("model-history-list").innerHTML = renderModelHistory(MODEL_RELEASES);
renderModelAuditSummary();
renderEvidenceAudit();
window.setTimeout(initBiomarkerPanel, 0);

function initLiteratureServicePanel() {
  const refreshButton = document.getElementById("refresh-literature-status");
  const searchForm = document.getElementById("pubmed-search-form");
  const annotationForm = document.getElementById("uniprot-search-form");
  const pathwayForm = document.getElementById("reactome-pathway-form");
  if (!refreshButton) return;
  refreshButton.addEventListener("click", refreshLiteratureServiceStatus);
  searchForm?.addEventListener("submit", handlePubMedSearch);
  annotationForm?.addEventListener("submit", handleUniProtSearch);
  pathwayForm?.addEventListener("submit", handleReactomeLookup);
  document.getElementById("download-amd-review-package")?.addEventListener("click", downloadAmdReviewPackage);
  document.getElementById("research-feedback-form")?.addEventListener("submit", handleResearchFeedback);
  refreshLiteratureServiceStatus();
}

async function handleReactomeLookup(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const stableId = form.elements.stable_id.value.trim();
  const status = document.getElementById("reactome-search-status");
  if (!stableId) {
    status.textContent = "Enter a Reactome stable ID.";
    return;
  }
  status.textContent = "Loading public Reactome pathway...";
  form.querySelector("button[type='submit']").disabled = true;
  try {
    const result = await fetchReactomePathway(stableId);
    localPathwayState = { ...(await getLocalPathwayAnnotations()), error: null };
    renderLocalPathwayAnnotations();
    status.textContent = `${result.saved ? "Pathway saved locally" : "Pathway loaded"}; formal model parameters were not changed.`;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Reactome lookup unavailable.";
  } finally {
    form.querySelector("button[type='submit']").disabled = false;
  }
}

async function handleUniProtSearch(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const query = form.elements.query.value.trim();
  const size = Number(form.elements.size.value);
  const status = document.getElementById("uniprot-search-status");
  if (!query) {
    status.textContent = "Enter a UniProt search term.";
    return;
  }
  status.textContent = "Searching public UniProtKB...";
  form.querySelector("button[type='submit']").disabled = true;
  try {
    const result = await searchUniProtAnnotations(query, size);
    localAnnotationState = { ...(await getLocalProteinAnnotations()), error: null };
    renderLocalProteinAnnotations();
    status.textContent = `${result.count} public protein annotation(s) found; ${result.saved} saved locally. Formal model parameters were not changed.`;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "UniProt search unavailable.";
  } finally {
    form.querySelector("button[type='submit']").disabled = false;
  }
}

function initDrugComparisonPanel() {
  const button = document.getElementById("run-drug-comparison");
  const diseaseSelect = document.getElementById("drug-comparison-disease");
  if (!button || !diseaseSelect) return;
  button.addEventListener("click", renderDrugComparison);
  diseaseSelect.addEventListener("change", renderDrugComparison);
  renderDrugComparison();
}

function renderDrugComparison() {
  const disease = document.getElementById("drug-comparison-disease")?.value || "AMD";
  const preset = getHeroDiseasePreset(disease);
  const baseInput = {
    diseaseContext: disease,
    classical: preset.pathwayActivity.classical,
    lectin: preset.pathwayActivity.lectin,
    alternative: preset.pathwayActivity.alternative,
    terminal: preset.pathwayActivity.terminal,
    c1sInhibition: 0,
    masp2Inhibition: 0,
    c3Inhibition: 0,
    factorBInhibition: 0,
    factorDInhibition: 0,
    c5Inhibition: 0,
    c5aRInhibition: 0,
    cd55: preset.cd55,
    cd59: preset.cd59
  };
  const rows = compareDrugInterventions(baseInput);
  const container = document.getElementById("drug-comparison-results");
  if (!container) return;
  const metrics = [
    ["diseaseActivityProxy", "Disease activity"],
    ["c3Activation", "C3 activation"],
    ["c5aSignal", "C5a signal"],
    ["macFormation", "MAC formation"],
    ["infectionRisk", "Infection risk"]
  ];
  container.innerHTML = `<div class="drug-comparison-grid">${rows.map((row) => `
    <article class="drug-comparison-card">
      <strong>${escapeHtml(row.label)}</strong>
      ${metrics.map(([key, label]) => {
        const value = Math.round(row.metrics[key] ?? 0);
        return `<div class="comparison-metric"><span>${label}</span><b>${value}</b><i style="--score-width:${value}%"></i></div>`;
      }).join("")}
      <small>Research proxy · no clinical prediction</small>
    </article>
  `).join("")}</div>`;
}

function initValidationDatasetPanel() {
  document.getElementById("validation-dataset-form")?.addEventListener("submit", handleValidationDataset);
  document.getElementById("validation-dataset-file")?.addEventListener("change", handleValidationDatasetFile);
}

function handleValidationDataset(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const resultContainer = document.getElementById("validation-dataset-results");
  try {
    const disease = form.elements.diseaseContext.value;
    const observation = Object.fromEntries(["diseaseActivityProxy", "c3Activation", "c5aSignal", "macFormation", "infectionRisk"]
      .map((key) => [key, Number(form.elements[key].value)]));
    const intakePayload = {
      datasetId: `local-${Date.now()}`,
      diseaseContext: disease,
      source: {
        sourceType: "local_aggregate_entry",
        title: "Local anonymized aggregate observation",
        sourceLocator: "local://browser-entry",
        retrievedAt: new Date().toISOString()
      },
      measurementScale: "normalized_0_100_proxy",
      experimentalContext: {
        assay: "user-entered research proxy",
        timeScale: "context_not_specified",
        units: "normalized_0_100_proxy",
        conditions: "aggregate observation; conditions not specified"
      },
      observations: [observation],
      containsPatientData: form.elements.containsPatientData.checked,
      containsProductionData: form.elements.containsProductionData.checked
    };
    assertEligibleValidationIntake(intakePayload);
    const dataset = createValidationDataset(intakePayload);
    renderValidationComparison(dataset, resultContainer);
  } catch (error) {
    resultContainer.textContent = error instanceof Error ? error.message : "Validation comparison could not be created.";
  }
}

async function handleValidationDatasetFile(event) {
  const file = event.target.files?.[0];
  const resultContainer = document.getElementById("validation-dataset-results");
  if (!file || !resultContainer) return;
  try {
    const payload = JSON.parse(await file.text());
    assertEligibleValidationIntake(payload);
    const dataset = parseValidationDatasetJson(JSON.stringify(payload));
    renderValidationComparison(dataset, resultContainer);
  } catch (error) {
    resultContainer.textContent = error instanceof Error ? error.message : "Validation dataset could not be imported.";
  }
}

function assertEligibleValidationIntake(payload) {
  const preflight = preflightValidationIntake(payload);
  if (preflight.status !== "eligible_for_review") {
    throw new Error(`Validation intake blocked: ${preflight.reasons.join("; ")}`);
  }
  return preflight;
}

function renderValidationComparison(dataset, resultContainer) {
  const comparison = compareValidationDataset(
    dataset,
    dataset.observations.map(() => runComplementSimulation(buildValidationModelInput(dataset.diseaseContext)))
  );
  const candidates = generateValidationCalibrationCandidates({ comparison });
  validationAuditComparisons = [
    ...validationAuditComparisons.filter((item) => item.datasetId !== comparison.datasetId),
    comparison
  ];
  validationAuditCandidates = [
    ...validationAuditCandidates.filter((item) => !(item.evidenceIds || []).includes(`validation:${comparison.datasetId}`)),
    ...candidates
  ];
  renderModelAuditSummary();
  const candidateMarkup = candidates.length
    ? `<div class="validation-candidates"><strong>Reviewable calibration directions</strong>${candidates.map((candidate) => `<p><b>${escapeHtml(candidate.parameter)}</b> · ${escapeHtml(candidate.direction)} · ${escapeHtml(candidate.rationale)}</p>`).join("")}<small>Candidate hypotheses only; no formal model change was made.</small></div>`
    : "";
  resultContainer.innerHTML = `<div class="validation-result-header"><strong>Local comparison · ${dataset.observations.length} observation(s)</strong><button type="button" id="download-validation-result">Download JSON</button></div><small>Scale: ${escapeHtml(dataset.measurementScale)} · Tissue: ${escapeHtml(dataset.experimentalContext?.tissue || "not specified")}</small>${Object.entries(comparison.metrics).map(([key, metric]) => `<div class="validation-result-row"><span>${key}</span><b>MAE ${metric.mae}</b><b>Bias ${metric.bias}</b></div>`).join("")}${candidateMarkup}<small>Proxy comparison only · formal model unchanged</small>`;
  document.getElementById("download-validation-result")?.addEventListener("click", () => downloadJson({ ...comparison, calibrationCandidates: candidates }, `fleda-validation-${dataset.diseaseContext}.json`), { once: true });
}

function buildValidationModelInput(disease) {
  const preset = getHeroDiseasePreset(disease);
  return {
    diseaseContext: disease,
    classical: preset.pathwayActivity.classical,
    lectin: preset.pathwayActivity.lectin,
    alternative: preset.pathwayActivity.alternative,
    terminal: preset.pathwayActivity.terminal,
    c1sInhibition: 0, masp2Inhibition: 0, c3Inhibition: 0,
    factorBInhibition: 0, factorDInhibition: 0, c5Inhibition: 0,
    c5aRInhibition: 0, cd55: preset.cd55, cd59: preset.cd59
  };
}

function downloadJson(value, filename) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function handleResearchFeedback(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.getElementById("research-feedback-status");
  try {
    const record = createStructuredFeedbackRecord({
      modelVersion: MODEL_VERSION,
      diseaseContext: form.elements.diseaseContext.value,
      component: form.elements.component.value,
      timeScale: form.elements.timeScale.value,
      parameterAdjustment: form.elements.parameterAdjustment.value,
      predictionObservation: form.elements.predictionObservation.value,
      missingMechanism: form.elements.missingMechanism.value,
      literatureLink: form.elements.literatureLink.value,
      confirmedNoSensitiveData: form.elements.confirmedNoSensitiveData.checked
    });
    const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "fleda-structured-research-feedback.json";
    link.click();
    URL.revokeObjectURL(url);
    status.textContent = "Feedback package downloaded locally. It was not uploaded or submitted.";
    form.reset();
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Feedback package could not be created.";
  }
}

async function handlePubMedSearch(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const query = form.elements.query.value.trim();
  const retmax = Number(form.elements.retmax.value);
  const source = form.elements.source.value;
  const status = document.getElementById("pubmed-search-status");
  if (!query) {
    status.textContent = "Enter a PubMed search term.";
    return;
  }
  status.textContent = "Searching public PubMed metadata...";
  form.querySelector("button[type='submit']").disabled = true;
  try {
    const includeAbstract = document.getElementById("pubmed-search-abstracts")?.checked === true;
    const result = await searchPublicPubMed(query, retmax, fetch, includeAbstract, source);
    const refreshed = await getLocalLiteratureRecords();
    localEvidenceState = { ...refreshed, error: null };
      evidenceCatalog = buildEvidenceCatalog({ publications, externalRecords: linkExternalEvidence(localEvidenceState.records) });
      renderLocalLiteratureRecords();
      renderEvidenceAudit();
      renderSimulation();
    const boundary = result.data_boundary === "public_pubmed_metadata_and_abstract"
      ? "public metadata + abstracts"
      : "public metadata only";
    status.textContent = `${result.count} ${source === "europe_pmc" ? "Europe PMC" : "PubMed"} record(s) found; ${result.saved} saved locally (${boundary}). Formal model parameters were not changed.`;
    document.getElementById("literature-database-status").textContent = `Ready · ${localEvidenceState.count} local records`;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "PubMed search unavailable.";
  } finally {
    form.querySelector("button[type='submit']").disabled = false;
  }
}

async function refreshLiteratureServiceStatus() {
  const refreshButton = document.getElementById("refresh-literature-status");
  const statusElement = document.getElementById("literature-service-status");
  refreshButton.disabled = true;
  refreshButton.classList.add("is-loading");
  statusElement.innerHTML = `<i class="service-status-dot checking"></i>Checking...`;

  const result = await getLiteratureServiceStatus();
  if (result.online) {
    try {
      localEvidenceState = { ...(await getLocalLiteratureRecords()), error: null };
    } catch (error) {
      localEvidenceState = { count: 0, records: [], error: error instanceof Error ? error.message : "Records unavailable" };
    }
    try {
      localAnnotationState = { ...(await getLocalProteinAnnotations()), error: null };
    } catch (error) {
      localAnnotationState = { count: 0, records: [], error: error instanceof Error ? error.message : "Annotations unavailable" };
    }
    try {
      localPathwayState = { ...(await getLocalPathwayAnnotations()), error: null };
    } catch (error) {
      localPathwayState = { count: 0, records: [], error: error instanceof Error ? error.message : "Pathways unavailable" };
    }
    try {
      knowledgeLayerState = { ...(await getKnowledgeRecords()), error: null };
    } catch (error) {
      knowledgeLayerState = { count: 0, records: [], error: error instanceof Error ? error.message : "Knowledge layer unavailable" };
    }
    evidenceCatalog = buildEvidenceCatalog({ publications, externalRecords: linkExternalEvidence(localEvidenceState.records) });
    renderLocalLiteratureRecords();
    renderLocalProteinAnnotations();
    renderLocalPathwayAnnotations();
    renderKnowledgeLayer();
    renderModelAuditSummary();
    renderEvidenceAudit();
    renderSimulation();
  }
  renderLiteratureServiceStatus(result);
  refreshButton.disabled = false;
  refreshButton.classList.remove("is-loading");
}

function renderLiteratureServiceStatus(result) {
  const statusElement = document.getElementById("literature-service-status");
  const databaseElement = document.getElementById("literature-database-status");
  const usageElement = document.getElementById("literature-budget-usage");
  const progressElement = document.getElementById("literature-budget-progress");
  const messageElement = document.getElementById("literature-service-message");
  const searchButton = document.querySelector("#pubmed-search-form button[type='submit']");

  if (!result.online) {
    statusElement.innerHTML = `<i class="service-status-dot offline"></i>Offline`;
    databaseElement.textContent = "Unavailable";
    usageElement.textContent = "$0.00 / $50.00";
    usageElement.classList.remove("blocked");
    progressElement.style.width = "0%";
    progressElement.classList.remove("blocked");
    if (searchButton) searchButton.disabled = true;
    messageElement.textContent = "Start the local literature service to enable evidence infrastructure. The existing simulations remain available.";
    renderLocalLiteratureRecords();
    return;
  }

  const spent = Number(result.budget.spent_usd);
  const limit = Number(result.budget.limit_usd);
  const percentUsed = Math.min(100, Math.max(0, Number(result.budget.percent_used)));
  const blocked = !result.budget.allowed;

  statusElement.innerHTML = `<i class="service-status-dot online"></i>Online`;
  databaseElement.textContent = result.health.database === "ready"
    ? `Ready${localEvidenceState.count ? ` · ${localEvidenceState.count} local records` : ""}`
    : "Unavailable";
  usageElement.textContent = `$${spent.toFixed(2)} / $${limit.toFixed(2)}`;
  usageElement.classList.toggle("blocked", blocked);
  progressElement.style.width = `${percentUsed}%`;
  progressElement.classList.toggle("blocked", blocked);
  if (searchButton) searchButton.disabled = false;
  messageElement.textContent = blocked
    ? "Monthly paid-AI budget reached. New paid processing is blocked; public PubMed metadata access remains available."
    : localEvidenceState.error
      ? "Service online, but saved literature records could not be loaded. Seed evidence remains available."
      : "Foundation online. Public PubMed metadata and local evidence records are available; formal model parameters remain unchanged.";
}

function renderLocalLiteratureRecords() {
  const container = document.getElementById("local-literature-records");
  if (!container) return;
  if (!localEvidenceState.records.length) {
    container.innerHTML = "<p class=\"muted\">No locally saved PubMed records yet.</p>";
    return;
  }
  container.innerHTML = localEvidenceState.records.slice(0, 20).map((record) => `
    <article class="local-literature-record">
      <a href="${escapeAttr(record.sourceLocator)}" target="_blank" rel="noopener">${escapeHtml(record.title)}</a>
      <span>${escapeHtml(record.id)} · ${escapeHtml((record.metadata?.sourceProviders || [record.metadata?.sourceProvider || "public source"]).join(", "))} · ${escapeHtml(record.evidenceLevel)} · uncertainty ${escapeHtml(record.uncertainty)} · ${record.metadata?.abstractAvailable ? "abstract available for local linking" : "metadata only"}</span>
      ${record.metadata?.abstractEvidenceSnippets?.length ? `<details class="local-record-snippets"><summary>Explicit evidence snippets (${record.metadata.abstractEvidenceSnippets.length})</summary><ul>${record.metadata.abstractEvidenceSnippets.map((snippet) => `<li>${escapeHtml(snippet)}</li>`).join("")}</ul></details>` : ""}
    </article>
  `).join("");
}

function renderLocalProteinAnnotations() {
  const container = document.getElementById("local-protein-annotations");
  if (!container) return;
  if (!localAnnotationState.records.length) {
    container.innerHTML = "<p class=\"muted\">No locally saved protein annotations yet.</p>";
    return;
  }
  container.innerHTML = localAnnotationState.records.slice(0, 20).map((record) => `
    <article class="local-literature-record">
      <a href="${escapeAttr(record.sourceLocator)}" target="_blank" rel="noopener">${escapeHtml(record.title)}</a>
      <span>${escapeHtml(record.metadata?.accession || record.id)} · ${escapeHtml((record.metadata?.geneNames || []).join(", ") || "gene not supplied")} · ${escapeHtml(record.metadata?.organism || "organism not supplied")}</span>
      ${record.metadata?.function ? `<p class="annotation-function">${escapeHtml(record.metadata.function)}</p>` : ""}
    </article>
  `).join("");
}

function renderLocalPathwayAnnotations() {
  const container = document.getElementById("local-pathway-annotations");
  if (!container) return;
  if (!localPathwayState.records.length) {
    container.innerHTML = "<p class=\"muted\">No locally saved Reactome pathways yet.</p>";
    return;
  }
  container.innerHTML = localPathwayState.records.slice(0, 20).map((record) => `
    <article class="local-literature-record">
      <a href="${escapeAttr(record.sourceLocator)}" target="_blank" rel="noopener">${escapeHtml(record.title)}</a>
      <span>${escapeHtml(record.metadata?.stableId || record.id)} · ${escapeHtml(record.metadata?.species || "species not supplied")} · ${escapeHtml(record.evidenceLevel || "unknown evidence")}</span>
      <p class="annotation-function">${escapeHtml(record.metadata?.participantOrEventCount ?? 0)} pathway events or participants · ${escapeHtml(record.metadata?.literatureReferenceCount ?? 0)} literature references</p>
    </article>
  `).join("");
}

function renderKnowledgeLayer() {
  const container = document.getElementById("unified-knowledge-layer");
  if (!container) return;
  if (!knowledgeLayerState.records.length) {
    container.innerHTML = "<p class=\"muted\">No public knowledge records saved yet.</p>";
    return;
  }
  container.innerHTML = knowledgeLayerState.records.slice(0, 20).map((record) => `
    <article class="local-literature-record">
      <a href="${escapeAttr(record.sourceLocator)}" target="_blank" rel="noopener">${escapeHtml(record.title)}</a>
      <span>${escapeHtml(record.knowledgeLayer)} · ${escapeHtml(record.recordType)} · ${escapeHtml(record.metadata?.sourceProvider || "public source")}</span>
    </article>
  `).join("");
}

function renderModelAuditSummary() {
  const container = document.getElementById("model-audit-summary");
  if (!container) return;
  const review = typeof getAmdCalibrationReviewData === "function" ? getAmdCalibrationReviewData().review : {};
  const summary = buildModelAuditSummary({
    releases: MODEL_RELEASES,
    review,
    validationComparisons: validationAuditComparisons,
    validationCandidates: validationAuditCandidates,
    knowledgeRecords: knowledgeLayerState.records
  });
  container.innerHTML = `
    <span><strong>${escapeHtml(summary.activeVersion || "none")}</strong> active version</span>
    <span><strong>${summary.knowledgeRecordCount}</strong> public knowledge records</span>
    <span><strong>${summary.candidateCount}</strong> calibration candidates</span>
    <span><strong>${summary.conflictCount}</strong> conflicts</span>
    <span class="model-audit-status model-audit-status--${escapeHtml(summary.status)}">${escapeHtml(summary.status.replaceAll("_", " "))}</span>
  `;
}

function renderEvidenceAudit() {
  const container = document.getElementById("literature-audit-summary");
  if (!container) return;
  const audit = auditEvidenceCatalog(evidenceCatalog);
  container.innerHTML = `
    <span><strong>${audit.totalCount}</strong> evidence records</span>
    <span><strong>${audit.acceptedCount}</strong> accepted metadata</span>
    <span><strong>${audit.needsReviewCount}</strong> need review</span>
    <span><strong>${audit.linkedCount}</strong> linked to entities</span>
    <span><strong>${audit.unlinkedCount}</strong> unlinked</span>
  `;
  container.classList.toggle("has-review-items", audit.status === "needs_review");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
}

document.querySelectorAll("[data-entity]").forEach((node) => {
  node.addEventListener("click", () => {
    state.selectedEntity = node.dataset.entity;
    renderEntityDetails();
    document.getElementById("knowledge").scrollIntoView({ behavior: "smooth" });
  });
});

document.querySelectorAll(".filter-button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter-button").forEach((b) => b.classList.remove("active"));
    button.classList.add("active");
    state.entityFilter = button.dataset.filter;
    renderGraph();
  });
});

function initGraph() {
  renderGraph();
  renderEntityDetails();
}

function renderGraph() {
  const graph = document.getElementById("graph");
  const selected = state.entityFilter === "all" ? entities : entities.filter((e) => e.entity_type === state.entityFilter);
  const groups = groupEntities(selected);
  graph.innerHTML = groups.map(([label, members]) => `
    <section class="graph-group">
      <h3>${label}</h3>
      <div class="graph-node-grid">
        ${members.map((entity) => {
          const active = entity.id === state.selectedEntity ? " active" : "";
          return `<button class="graph-node ${entity.entity_type}${active}" data-id="${escapeAttr(entity.id)}">
            <strong>${entity.symbol}</strong>
            <span>${entity.entity_type.replaceAll("_", " ")}</span>
          </button>`;
        }).join("")}
      </div>
    </section>
  `).join("");

  graph.querySelectorAll(".graph-node").forEach((node) => {
    node.addEventListener("click", () => {
      state.selectedEntity = node.dataset.id;
      renderGraph();
      renderEntityDetails();
    });
  });
}

function groupEntities(selected) {
  const order = [
    ["Classical pathway", (e) => e.pathway_membership.includes("classical")],
    ["Lectin pathway", (e) => e.pathway_membership.includes("lectin")],
    ["Alternative pathway", (e) => e.pathway_membership.includes("alternative")],
    ["Terminal pathway", (e) => e.pathway_membership.includes("terminal")],
    ["Regulators and receptors", (e) => ["regulator", "receptor"].includes(e.entity_type)],
    ["Biomarkers", (e) => e.entity_type === "biomarker"],
    ["Diseases", (e) => e.entity_type === "disease"],
    ["Drug target classes", (e) => e.entity_type === "drug"]
  ];
  const used = new Set();
  const groups = [];
  for (const [label, predicate] of order) {
    const members = selected.filter((entity) => !used.has(entity.id) && predicate(entity));
    members.forEach((entity) => used.add(entity.id));
    if (members.length) groups.push([label, members]);
  }
  const remaining = selected.filter((entity) => !used.has(entity.id));
  if (remaining.length) groups.push(["Other complement entities", remaining]);
  return groups;
}

function renderEntityDetails() {
  const entity = entities.find((e) => e.id === state.selectedEntity) ?? entities.find((e) => e.id === "C3");
  const related = relationships.filter((r) => r.source === entity.id || r.target === entity.id).slice(0, 10);
  document.getElementById("entity-details").innerHTML = `
    <p class="eyebrow">Selected Entity</p>
    <h3>${entity.name}</h3>
    <p class="muted">${entity.description}</p>
    ${tagBlock("Type", [entity.entity_type])}
    ${tagBlock("Pathway membership", entity.pathway_membership)}
    ${tagBlock("Upstream", entity.upstream_entities)}
    ${tagBlock("Downstream", entity.downstream_entities)}
    ${tagBlock("Regulators", entity.regulators)}
    ${tagBlock("Diseases", entity.diseases)}
    ${tagBlock("Drug targets", entity.drug_targets)}
    <div class="relationship-list">
      <strong>Relationships</strong>
      ${related.map((r) => `<p><span>${r.source}</span> ${r.relationship_type.replaceAll("_", " ")} <span>${r.target}</span></p>`).join("") || "<p>No seed relationships yet.</p>"}
    </div>
  `;
}

function initSimulation() {
  const select = document.getElementById("disease-select");
  select.innerHTML = diseases.map((d) => `<option value="${escapeAttr(d.id)}">${d.disease_name}</option>`).join("");
  select.value = "normal";

  const form = document.getElementById("simulation-form");
  form.querySelectorAll("input[type='range']").forEach((input) => {
    input.addEventListener("input", () => {
      input.nextElementSibling.textContent = input.value;
      renderSimulation();
    });
  });
  select.addEventListener("change", () => {
    applyDiseaseDefaults(select.value);
    renderSimulation();
  });
  renderSimulation();
}

function applyDiseaseDefaults(disease) {
  const form = document.getElementById("simulation-form");
  const presets = {
    PNH: { cd55: 28, cd59: 18, terminal: 75, alternative: 55 },
    aHUS: { factorH: 42, factorI: 55, alternative: 75, terminal: 65 },
    C3G: { alternative: 88, factorH: 55, factorI: 62 },
    "IgA nephropathy": { lectin: 72, alternative: 60 },
    AMD: { alternative: 74, factorH: 58 },
    "lupus nephritis": { classical: 82, lectin: 42 },
    "cancer microenvironment": { terminal: 58, alternative: 60 },
    sepsis: { classical: 82, lectin: 75, alternative: 80, terminal: 85 }
  };
  const preset = presets[disease];
  if (!preset) return;
  Object.entries(preset).forEach(([name, value]) => {
    const input = form.elements[name];
    if (input) {
      input.value = value;
      input.nextElementSibling.textContent = value;
    }
  });
}

function renderSimulation() {
  const input = getSimulationInput();
  const result = runComplementSimulation(input);
  const cards = [
    ["C3 activation", result.c3Activation],
    ["C3a inflammatory signal", result.c3aSignal],
    ["C3b opsonization", result.c3bOpsonization],
    ["C5 activation", result.c5Activation],
    ["C5a inflammatory signal", result.c5aSignal],
    ["MAC formation", result.macFormation],
    ["Host cell damage risk", result.hostCellDamageRisk],
    ["Pathogen defense compromise", result.pathogenDefenseCompromise],
    ["Infection risk", result.infectionRisk],
    ["Disease activity proxy", result.diseaseActivityProxy]
  ];
  document.getElementById("result-cards").innerHTML = cards.map(([label, value]) => `
    <div class="result-card ${scoreClass(value)}">
      <span>${label}</span>
      <strong>${Math.round(value)}</strong>
      <div class="score-bar"><i style="width:${Math.round(value)}%"></i></div>
    </div>
  `).join("");
  document.getElementById("simulation-summary").textContent = generateComplementTwinSummary(result, input);
  document.getElementById("simulation-model-version").textContent = MODEL_VERSION;
  const evidence = buildSimulationEvidenceSummary(input.diseaseContext, evidenceCatalog);
  document.getElementById("simulation-evidence-basis").textContent = `${evidence.label} (${evidence.count})`;
  document.getElementById("simulation-uncertainty").textContent = `${evidence.uncertainty}; research proxy only`;
}

function getSimulationInput() {
  const form = document.getElementById("simulation-form");
  const fields = ["classical", "lectin", "alternative", "terminal", "factorH", "factorI", "cd55", "cd59", "c1sInhibition", "masp2Inhibition", "c3Inhibition", "factorBInhibition", "factorDInhibition", "c5Inhibition", "c5aRInhibition"];
  const out = {};
  fields.forEach((field) => out[field] = Number(form.elements[field].value));
  out.diseaseContext = form.elements.diseaseContext.value;
  return out;
}

function initDiseasePanel() {
  const list = document.getElementById("disease-list");
  list.innerHTML = diseases.filter((d) => d.id !== "normal").map((d) => `<button data-id="${escapeAttr(d.id)}">${d.disease_name}<span>${d.disease_category}</span></button>`).join("");
  list.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => {
    state.selectedDisease = button.dataset.id;
    renderDiseaseDetails();
  }));
  renderDiseaseDetails();
}

function renderDiseaseDetails() {
  const disease = diseases.find((d) => d.id === state.selectedDisease) ?? diseases[1];
  document.getElementById("disease-details").innerHTML = `
    <p class="eyebrow">Disease Context</p>
    <h3>${disease.disease_name}</h3>
    <p class="muted">${disease.complement_mechanism}</p>
    ${tagBlock("Dominant pathways", disease.implicated_pathways)}
    ${tagBlock("Biomarkers", disease.key_biomarkers)}
    ${tagBlock("Likely targets", disease.known_targets)}
    <div class="model-note"><strong>Modeling note</strong><p>${disease.notes}</p></div>
  `;
}

function initDrugPanel() {
  const list = document.getElementById("drug-list");
  list.innerHTML = drugs.map((d) => `<button data-id="${escapeAttr(d.id)}">${d.drug_name}<span>${d.target}</span></button>`).join("");
  list.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => {
    state.selectedDrug = button.dataset.id;
    renderDrugDetails();
  }));
  renderDrugDetails();
}

function renderDrugDetails() {
  const drug = drugs.find((d) => d.id === state.selectedDrug) ?? drugs[5];
  document.getElementById("drug-details").innerHTML = `
    <p class="eyebrow">Drug Target</p>
    <h3>${drug.drug_name}</h3>
    ${tagBlock("Target", [drug.target])}
    ${tagBlock("Modality", [drug.modality])}
    ${tagBlock("Status", [drug.approved_status])}
    <div class="model-note"><strong>Upstream effect</strong><p>${drug.upstream_effect}</p></div>
    <div class="model-note"><strong>Downstream effect</strong><p>${drug.downstream_effect}</p></div>
    <div class="model-note"><strong>Expected benefit</strong><p>${drug.expected_benefit}</p></div>
    <div class="model-note"><strong>Expected risk</strong><p>${drug.expected_risk}</p></div>
  `;
}

function renderPublications() {
  document.getElementById("publication-list").innerHTML = publications.map((pub) => `
    <article class="publication-card">
      <span>${pub.evidence_type.replaceAll("_", " ")}</span>
      <h3>${pub.title}</h3>
      <p>${pub.key_findings}</p>
      ${tagBlock("Linked entities", pub.linked_entities)}
    </article>
  `).join("");
}

function initDynamicsExplorer() {
  const form = document.getElementById("dynamics-form");
  if (!form) return;
  const advancedDetails = document.getElementById("advanced-dynamics-details");
  renderDynamicsGroupFilters();

  form.querySelectorAll("input[type='range']").forEach((input) => {
    input.addEventListener("input", () => {
      input.nextElementSibling.textContent = input.value;
      if (input.name === "duration") return;
      renderDynamicsExplorer();
    });
  });

  form.querySelectorAll("input, select").forEach((control) => {
    control.addEventListener("change", () => {
      if (control.name === "duration") {
        const intervention = form.elements.interventionTime;
        intervention.max = control.value;
        if (Number(intervention.value) > Number(control.value)) intervention.value = Math.round(Number(control.value) * 0.35);
        intervention.nextElementSibling.textContent = intervention.value;
      }
      applyDynamicsDiseaseDefaults(control.name === "diseaseContext" ? control.value : null);
      renderDynamicsExplorer();
    });
  });

  document.querySelectorAll("[data-dynamics-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const groups = getDynamicsGroups();
      state.visibleDynamicsGroups = button.dataset.dynamicsAction === "all" ? new Set(groups) : new Set();
      renderDynamicsGroupFilters();
      renderDynamicsExplorer();
    });
  });

  document.getElementById("reset-dynamics-zoom").addEventListener("click", () => renderDynamicsChart(true));
  document.getElementById("export-simulation-report")?.addEventListener("click", downloadSimulationReport);
  document.getElementById("time-inspector-slider").addEventListener("input", (event) => {
    event.target.nextElementSibling.textContent = event.target.value;
    renderDynamicsInspector(Number(event.target.value));
  });

  advancedDetails?.addEventListener("toggle", () => {
    if (!advancedDetails.open) return;
    renderDynamicsExplorer();
    window.requestAnimationFrame(() => {
      const chart = document.getElementById("dynamics-chart");
      if (chart && window.Plotly) window.Plotly.Plots.resize(chart);
    });
  });

  if (advancedDetails?.open) renderDynamicsExplorer();
}

function downloadSimulationReport() {
  if (!state.dynamicsResult) return;
  const input = getDynamicsInput();
  const report = buildSimulationReport({
    modelVersion: MODEL_VERSION,
    simulationInput: input,
    simulationOutput: state.dynamicsResult,
    evidenceSummary: buildSimulationEvidenceSummary(input.diseaseContext, evidenceCatalog),
    createdAt: new Date().toISOString()
  });
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `fleda-complement-research-report-${input.diseaseContext}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function initHeroDynamicsChart() {
  const runButton = document.getElementById("hero-run-simulation");
  const playButton = document.getElementById("hero-play-chart");
  const pauseButton = document.getElementById("hero-pause-chart");
  const resetButton = document.getElementById("hero-reset-chart");
  const speedSelect = document.getElementById("hero-playback-speed");
  const interventionStrength = document.getElementById("hero-intervention-strength");
  const interventionTime = document.getElementById("hero-intervention-time");
  const controls = [
    speedSelect,
    document.getElementById("hero-disease-scenario"),
    interventionStrength,
    interventionTime,
    document.getElementById("hero-highlight-series"),
    ...document.querySelectorAll("input[name='heroInterventionTarget']")
  ].filter(Boolean);
  syncHeroTimeScaleControls();
  renderHeroDynamicsChart("baseline");
  runButton?.addEventListener("click", (event) => {
    event.preventDefault();
    startHeroPlayback(0);
  });
  playButton?.addEventListener("click", () => startHeroPlayback(0));
  pauseButton?.addEventListener("click", () => pauseHeroPlayback());
  interventionStrength?.addEventListener("input", () => {
    document.getElementById("hero-intervention-strength-output").textContent = interventionStrength.value;
  });
  interventionTime?.addEventListener("input", () => {
    document.getElementById("hero-intervention-time-output").textContent = formatHeroTime(Number(interventionTime.value));
  });
  controls.forEach((control) => {
    control.addEventListener("change", () => {
      syncHeroTimeScaleControls();
      if (state.heroPlayback.isPlaying) {
        startHeroPlayback(state.heroPlayback.currentTime);
        return;
      }
      const nextMode = getHeroChartModeFromControls();
      renderHeroDynamicsChart(nextMode, false, nextMode === "baseline" ? null : state.heroPlayback.currentTime);
    });
  });
  resetButton?.addEventListener("click", () => {
    pauseHeroPlayback();
    renderHeroDynamicsChart("baseline", true);
  });
}

function initMicrostructureInteractions() {
  const cards = document.getElementById("organ-impact-cards");
  document.querySelectorAll(".organ-hotspot").forEach((hotspot) => {
    hotspot.addEventListener("click", () => {
      state.selectedMicrostructureOrgan = hotspot.dataset.organ;
      renderOrganImpactTwin(state.heroPlayback.currentTime);
    });
  });
  cards?.addEventListener("click", (event) => {
    const card = event.target.closest("[data-micro-organ]");
    if (!card) return;
    state.selectedMicrostructureOrgan = card.dataset.microOrgan;
    renderOrganImpactTwin(state.heroPlayback.currentTime);
  });
  cards?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest("[data-micro-organ]");
    if (!card) return;
    event.preventDefault();
    state.selectedMicrostructureOrgan = card.dataset.microOrgan;
    renderOrganImpactTwin(state.heroPlayback.currentTime);
  });
}

function initBiomarkerPanel() {
  const form = document.getElementById("biomarker-form");
  if (!form) return;
  if (form.dataset.initialized === "true") {
    renderBiomarkerEstimates();
    return;
  }
  form.dataset.initialized = "true";
  const estimateButton = document.getElementById("estimate-biomarkers");
  const applyButton = document.getElementById("apply-biomarkers");
  form.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", () => {
      state.heroPlayback.biomarkerApplied = false;
      renderBiomarkerEstimates();
    });
  });
  estimateButton?.addEventListener("click", () => {
    state.heroPlayback.biomarkerApplied = false;
    renderBiomarkerEstimates();
  });
  applyButton?.addEventListener("click", () => {
    state.heroPlayback.biomarkerEstimate = estimateBiomarkerGuidedActivity();
    state.heroPlayback.biomarkerApplied = true;
    const nextMode = getHeroChartModeFromControls();
    renderHeroDynamicsChart(nextMode === "baseline" ? "reaction" : nextMode, true);
    document.getElementById("biomarker-interpretation").textContent =
      `${state.heroPlayback.biomarkerEstimate.interpretation} Applied to Live Dynamics as initialization priors.`;
  });
  renderBiomarkerEstimates();
}

function renderBiomarkerEstimates() {
  const estimate = estimateBiomarkerGuidedActivity();
  state.heroPlayback.biomarkerEstimate = estimate;
  const cards = document.getElementById("biomarker-estimate-cards");
  const interpretation = document.getElementById("biomarker-interpretation");
  if (!cards || !interpretation) return;
  cards.innerHTML = [
    ["Classical activity", estimate.pathwayActivity.classical],
    ["Alternative activity", estimate.pathwayActivity.alternative],
    ["Terminal activity", estimate.pathwayActivity.terminal],
    ["Regulatory weakness", estimate.regulatoryWeakness],
    ["Inflammatory signal", estimate.inflammatorySignal],
    ["Suggested relevance", estimate.diseaseRelevanceScore]
  ].map(([label, value]) => `
    <article class="biomarker-estimate-card" style="--score-width:${Math.round(clamp(value))}%">
      <span>${label}</span>
      <strong>${Math.round(clamp(value))}</strong>
      <i></i>
    </article>
  `).join("");
  interpretation.textContent = estimate.interpretation;
}

function estimateBiomarkerGuidedActivity() {
  const form = document.getElementById("biomarker-form");
  const get = (name) => Number(form?.querySelector(`[name="${name}"]`)?.value ?? 0);
  const c3 = get("C3");
  const c4 = get("C4");
  const ch50 = get("CH50");
  const ah50 = get("AH50");
  const c3a = get("C3a");
  const c5a = get("C5a");
  const sc5b9 = get("sC5b9");
  const factorH = get("FactorH");
  const factorI = get("FactorI");
  const factorB = get("FactorB");
  const factorD = get("FactorD");

  const c3Consumption = clamp((1 - c3 / 5400) * 100);
  const c4Consumption = clamp((1 - c4 / 2000) * 100);
  const alternativeTone = clamp((ah50 - 50) * 0.9 + normalizePercent(factorB, 2200) * 16 + normalizePercent(factorD, 83) * 12 + c3a * 0.65);
  const classicalTone = clamp((ch50 - 50) * 0.82 + c4Consumption * 0.55 + c3a * 0.42);
  const terminalTone = clamp(sc5b9 * 1.9 + c5a * 1.15 + Math.max(0, ch50 - 55) * 0.22);
  const regulatoryWeakness = clamp((1 - average(factorH / 3200, factorI / 400)) * 100 + c3Consumption * 0.42);
  const inflammatorySignal = clamp(average(c3a * 2.2, c5a * 2.8, sc5b9 * 1.3));
  const diseaseRelevanceScore = clamp(average(alternativeTone, regulatoryWeakness, inflammatorySignal, terminalTone * 0.65));
  const suggestedDisease = suggestDiseaseFromBiomarkers({ alternativeTone, classicalTone, terminalTone, regulatoryWeakness, inflammatorySignal, c3Consumption, c4Consumption });

  return {
    pathwayActivity: {
      classical: Math.round(clamp(classicalTone, 5, 95)),
      lectin: Math.round(clamp(average(classicalTone, inflammatorySignal) * 0.62, 5, 85)),
      alternative: Math.round(clamp(alternativeTone, 5, 96)),
      terminal: Math.round(clamp(terminalTone, 5, 95))
    },
    initialConcentrations: {
      C3: c3 || 5400,
      C5: 500,
      FactorB: factorB || 2200,
      FactorD: factorD || 83,
      FactorH: factorH || 3200,
      FactorI: factorI || 400,
      CD55: 85,
      CD59: 85
    },
    regulatoryWeakness: Math.round(regulatoryWeakness),
    inflammatorySignal: Math.round(inflammatorySignal),
    diseaseRelevanceScore: Math.round(diseaseRelevanceScore),
    suggestedDisease,
    interpretation: `Biomarker pattern suggests ${suggestedDisease} relevance, with alternative pathway ${Math.round(alternativeTone)}/100, terminal signal ${Math.round(terminalTone)}/100, and regulatory weakness ${Math.round(regulatoryWeakness)}/100.`
  };
}

function normalizePercent(value, reference) {
  return clamp((Number(value) || 0) / reference, 0, 2);
}

function suggestDiseaseFromBiomarkers(scores) {
  if (scores.alternativeTone > 68 && scores.regulatoryWeakness > 38 && scores.inflammatorySignal < 70) return "AMD-like chronic alternative-pathway";
  if (scores.terminalTone > 72 && scores.c3Consumption < 35) return "PNH-like terminal pathway";
  if (scores.alternativeTone > 72 && scores.regulatoryWeakness > 48) return "aHUS/C3G-like regulatory dysregulation";
  if (scores.inflammatorySignal > 78 && scores.terminalTone > 72) return "sepsis-like systemic inflammatory";
  if (scores.classicalTone > 70 && scores.c4Consumption > 25) return "classical pathway immune-complex";
  return "baseline or mixed complement";
}

function getHeroChartModeFromControls() {
  const controls = getHeroInterventionControls();
  return controls.disease === "normal" && controls.targets.length === 0 && !state.heroPlayback.biomarkerApplied ? "baseline" : "reaction";
}

function renderHeroDynamicsChart(mode = "baseline", resetZoom = false, visibleUntil = null) {
  const chart = document.getElementById("hero-dynamics-chart");
  const title = document.querySelector(".hero-dynamics-preview .chart-toolbar h3");
  if (title) {
    const isAmd = getHeroInterventionControls().disease === "AMD";
    title.textContent = mode === "reaction" || mode === "playback"
      ? isAmd ? "AMD Chronic Complement Progression Simulation" : "Active Complement Reaction Simulation"
      : isAmd ? "AMD Chronic Complement Baseline" : "Normal Complement Protein Concentration Baseline";
  }
  if (!chart) return;
  if (!window.Plotly) {
    chart.innerHTML = `<div class="plotly-fallback">Plotly.js is loading. Refresh if the interactive chart does not appear.</div>`;
    return;
  }
  state.heroPlayback.mode = mode;
  if (mode === "baseline") state.heroPlayback.amdSpecificOutputs = null;
  const rawTraces = mode === "reaction" || mode === "playback" ? heroReactionTraces() : heroBaselineTraces();
  const traces = applyHeroHighlight(rawTraces);
  const displayTraces = visibleUntil === null ? traces : trimTracesToTime(traces, visibleUntil);
  const annotations = heroTraceAnnotations(displayTraces);
  const intervention = getHeroInterventionControls();
  const timeScale = getHeroTimeScale();
  const showInterventionMarker = (mode === "reaction" || mode === "playback") && intervention.targets.length > 0 && intervention.strength > 0;
  if (showInterventionMarker) {
    annotations.push({
      x: intervention.time,
      y: 1,
      yref: "paper",
      text: timeScale.isAmd ? "Intervention month" : "Drug intervention",
      showarrow: false,
      yanchor: "bottom",
      font: { color: "#ff9aa8", size: 12 },
      bgcolor: "rgba(11,22,40,.72)",
      borderpad: 3
    });
  }
  const layout = {
    paper_bgcolor: "#0b1628",
    plot_bgcolor: "#0b1628",
    font: { color: "#eef6ff" },
    margin: { l: 58, r: 110, t: 10, b: 52 },
    xaxis: {
      title: timeScale.axisTitle,
      gridcolor: "rgba(133,171,233,0.18)",
      fixedrange: true,
      zeroline: false
    },
    yaxis: {
      title: "Concentration / Relative Activity",
      gridcolor: "rgba(133,171,233,0.18)",
      fixedrange: true,
      rangemode: "tozero",
      zeroline: false
    },
    legend: { orientation: "h", y: -0.34, x: 0, font: { size: 11 } },
    hovermode: "x unified",
    dragmode: false,
    shapes: showInterventionMarker ? [{
      type: "line",
      x0: intervention.time,
      x1: intervention.time,
      y0: 0,
      y1: 1,
      yref: "paper",
      line: { color: "#ff334d", width: 2, dash: "dash" }
    }] : [],
    annotations
  };
  const config = {
    responsive: true,
    displaylogo: false,
    scrollZoom: false,
    doubleClick: false,
    displayModeBar: false
  };
  state.heroPlayback.traces = traces;
  state.heroPlayback.layout = layout;
  state.heroPlayback.config = config;
  state.heroPlayback.duration = Math.max(...traces.flatMap((trace) => trace.x));
  updateHeroTimeReadout(visibleUntil ?? 0);
  if (resetZoom || !chart.data) window.Plotly.newPlot(chart, displayTraces, layout, config);
  else window.Plotly.react(chart, displayTraces, layout, config);
}

function startHeroPlayback(startAt = 0) {
  const speedSelect = document.getElementById("hero-playback-speed");
  pauseHeroPlayback();
  state.heroPlayback.speed = Number(speedSelect?.value ?? state.heroPlayback.speed);
  state.heroPlayback.currentTime = Math.min(startAt || state.heroPlayback.speed, state.heroPlayback.duration);
  // Normal baseline playback animates the baseline traces without inventing
  // acute pathway events. Reaction traces are reserved for active scenarios.
  const chartMode = getHeroChartModeFromControls();
  renderHeroDynamicsChart(chartMode === "baseline" ? "baseline" : "playback", startAt === 0, state.heroPlayback.currentTime);
  state.heroPlayback.isPlaying = true;
  startMonitorBeep();
  state.heroPlayback.timer = window.setInterval(() => {
    state.heroPlayback.currentTime = Math.min(
      state.heroPlayback.currentTime + state.heroPlayback.speed,
      state.heroPlayback.duration
    );
    renderHeroPlaybackFrame();
    if (state.heroPlayback.currentTime >= state.heroPlayback.duration) pauseHeroPlayback();
  }, 1000);
}

function pauseHeroPlayback() {
  if (state.heroPlayback.timer) {
    window.clearInterval(state.heroPlayback.timer);
    state.heroPlayback.timer = null;
  }
  state.heroPlayback.isPlaying = false;
  stopMonitorBeep();
}

function renderHeroPlaybackFrame() {
  const chart = document.getElementById("hero-dynamics-chart");
  if (!chart || !window.Plotly || !state.heroPlayback.traces.length) return;
  const displayTraces = trimTracesToTime(state.heroPlayback.traces, state.heroPlayback.currentTime);
  const layout = {
    ...state.heroPlayback.layout,
    annotations: heroTraceAnnotations(displayTraces)
  };
  updateHeroTimeReadout(state.heroPlayback.currentTime);
  window.Plotly.react(chart, displayTraces, layout, state.heroPlayback.config);
}

function trimTracesToTime(traces, visibleUntil) {
  return traces.map((trace) => {
    const indexes = trace.x
      .map((time, index) => [time, index])
      .filter(([time]) => time <= visibleUntil)
      .map(([, index]) => index);
    const visibleIndexes = indexes.length ? indexes : [0];
    return {
      ...trace,
      x: visibleIndexes.map((index) => trace.x[index]),
      y: visibleIndexes.map((index) => trace.y[index])
    };
  });
}

function heroTraceAnnotations(traces) {
  return traces.map((trace) => {
    const x = trace.x[trace.x.length - 1];
    const y = trace.y[trace.y.length - 1];
    return {
      x,
      y,
      text: trace.name,
      showarrow: false,
      xanchor: "left",
      font: { color: trace.line.color, size: 11 },
      bgcolor: "rgba(11,22,40,.72)",
      borderpad: 2
    };
  });
}

function updateHeroTimeReadout(time) {
  const readout = document.getElementById("hero-time-readout");
  if (readout) readout.textContent = formatHeroTime(time);
  renderOrganImpactTwin(time);
}

function renderOrganImpactTwin(time) {
  const cards = document.getElementById("organ-impact-cards");
  if (!cards || !state.heroPlayback.traces.length) return;
  const values = getHeroTraceValues(time);
  const isAmd = getHeroInterventionControls().disease === "AMD";
  const impacts = calculateDiseaseSpecificOrganScores(getHeroInterventionControls().disease, values, time);
  document.querySelector(".organ-impact-twin")?.classList.toggle("amd-focus-mode", isAmd);
  const strongest = impacts.reduce((top, item) => item.score > top.score ? item : top, impacts[0]);
  const selectedImpact = impacts.find((impact) => impact.id === state.selectedMicrostructureOrgan) ?? strongest;
  state.selectedMicrostructureOrgan = selectedImpact.id;
  document.getElementById("organ-impact-time").textContent = formatHeroTime(time);
  cards.innerHTML = isAmd ? renderAmdOrganImpactCards(impacts) : impacts.map((impact) => `
    <article class="organ-impact-card ${impact.secondary ? "secondary-association-card" : "primary-signal-card"}" data-micro-organ="${impact.id}" tabindex="0" role="button" style="--organ-color:${impact.color};--score-width:${impact.score}%">
      <header>
        <strong>${impact.name}</strong>
        <span>${impact.score}/100</span>
      </header>
      <div class="organ-score-bar"><i></i></div>
      <p>${impact.description}</p>
    </article>
  `).join("");
  impacts.forEach((impact) => {
    const node = document.querySelector(`[data-organ="${impact.id}"]`);
    const zone = document.querySelector(`[data-organ-zone="${impact.id}"]`);
    [node, zone].forEach((element) => {
      if (!element) return;
      element.style.setProperty("--organ-color", impact.color);
      if (element === node) element.dataset.score = `${impact.score}`;
      element.title = `${impact.name}: ${impact.score}/100`;
    });
  });
  if (isAmd) muteUnmappedAmdOrgans(impacts);
  renderHeartRhythm(impacts, values);
  renderMicrostructureComparison(selectedImpact);
  renderAmdDiseaseDashboard(values, time);
  document.getElementById("organ-impact-summary").textContent =
    isAmd
      ? "Dominant predicted impact: Retina / Macula. AMD is modeled as a retina-centered complement-mediated disease state; systemic cards represent association or pathway relevance, not deterministic organ damage."
      : `Dominant predicted impact: ${strongest.name}. This V1 rule model links complement dynamics to organ-level risk signals, not clinical diagnosis.`;
}

function muteUnmappedAmdOrgans(impacts) {
  const activeIds = new Set(impacts.map((impact) => impact.id));
  document.querySelectorAll("[data-organ], [data-organ-zone]").forEach((element) => {
    const id = element.dataset.organ ?? element.dataset.organZone;
    if (!id || activeIds.has(id)) return;
    element.style.setProperty("--organ-color", "#335b7a");
    if (element.dataset.organ) element.dataset.score = "";
    element.title = "Not a primary AMD tissue signal";
  });
}

function renderAmdOrganImpactCards(impacts) {
  const primary = impacts.filter((impact) => !impact.secondary);
  const secondary = impacts.filter((impact) => impact.secondary);
  const renderCard = (impact) => `
    <article class="organ-impact-card ${impact.secondary ? "secondary-association-card" : "primary-signal-card"}" data-micro-organ="${impact.id}" tabindex="0" role="button" style="--organ-color:${impact.color};--score-width:${impact.score}%">
      <header>
        <strong>${impact.name}</strong>
        <span>${impact.score}/100</span>
      </header>
      <div class="organ-score-bar"><i></i></div>
      <p>${impact.description}</p>
    </article>
  `;
  return `
    <div class="amd-organ-signal-group">
      <h4>Primary AMD Tissue Signals</h4>
      <div class="organ-impact-cards-inner">${primary.map(renderCard).join("")}</div>
    </div>
    <details class="amd-organ-signal-group amd-secondary-details">
      <summary>Secondary Association Signals</summary>
      <div class="organ-impact-cards-inner">${secondary.map(renderCard).join("")}</div>
    </details>
  `;
}

function renderMicrostructureComparison(impact) {
  const panels = document.getElementById("microstructure-panels");
  const selection = document.getElementById("microstructure-selection");
  if (!panels || !impact) return;
  const organLabels = {
    brain: "Brain / CNS", lung: "Lung", blood: "Blood / RBC", liver: "Liver", kidney: "Kidney",
    retina: "Retina / Macula", vessels: "Vessels", skin: "Skin / Joint", rpe: "RPE", choroid: "Choroid",
    drusen: "Drusen", "retinal-complement": "Retinal Complement Activity", "geographic-atrophy": "Geographic Atrophy",
    "neovascular-signal": "Neovascular Signal", "complement-dysregulation": "Complement Dysregulation"
  };
  const label = organLabels[impact.id] ?? impact.name;
  const cells = Array.from({ length: 20 }, (_, index) => `<i class="micro-cell micro-cell-${index % 5}"></i>`).join("");
  const damage = Math.round(impact.score);
  panels.innerHTML = `
    <article class="microstructure-panel normal-microstructure">
      <header><strong>Normal microstructure</strong><span>Reference pattern</span></header>
      <div class="microstructure-visual" aria-label="Illustrative normal ${escapeHtml(label)} microstructure">${cells}<b class="micro-vessel"></b></div>
      <p>Organ or tissue organization is shown as a stable reference proxy.</p>
    </article>
    <article class="microstructure-panel impact-microstructure" style="--impact-strength:${damage}%">
      <header><strong>Impact-state microstructure</strong><span>${damage}/100 signal</span></header>
      <div class="microstructure-visual" aria-label="Illustrative impact-state ${escapeHtml(label)} microstructure">${cells}<b class="micro-vessel"></b><em class="micro-inflammation"></em></div>
      <p>${escapeHtml(impact.description)} This visualization is a model proxy.</p>
    </article>`;
  selection.textContent = `${label} · ${damage}/100 modeled signal`;
}

function renderAmdDiseaseDashboard(values, time) {
  const dashboard = document.getElementById("amd-disease-dashboard");
  if (!dashboard) return;
  const intervention = getHeroInterventionControls();
  const isAmd = intervention.disease === "AMD";
  dashboard.hidden = !isAmd;
  if (!isAmd) return;

  const scores = state.heroPlayback.amdSpecificOutputs ?? calculateAmdScoresFromVisibleValues(values);
  const liveScores = calculateAmdScoresFromVisibleValues(values);
  const displayScores = time > 0 ? { ...scores, ...liveScores } : { ...liveScores, ...scores };
  const targets = intervention.targets;
  const result = { scores: displayScores, selectedTargets: targets };
  document.getElementById("amd-retinal-score").textContent = `${Math.round(displayScores.retinalComplementActivityScore)}/100`;
  document.getElementById("amd-retina-focus").innerHTML = [
    ["Macula", "primary focus"],
    ["Retina", "primary tissue"],
    ["RPE", "stress layer"],
    ["Photoreceptors", "downstream vulnerability"],
    ["Choroid", "vascular interface"],
    ["Drusen", "risk proxy"],
    ["CNV", "wet AMD signal"],
    ["Geographic atrophy", "advanced dry AMD proxy"]
  ].map(([label, role]) => `<span><strong>${label}</strong><em>${role}</em></span>`).join("");

  document.getElementById("amd-mechanisms").innerHTML = [
    "Alternative pathway chronic activation",
    "C3 activation and C3b deposition increased",
    "C3a / C5a inflammatory signaling increased",
    "Factor H regulation reduced or insufficient",
    "CFH / C3 / CFB / CFI genetic relevance",
    "Local MAC tissue injury risk in retina/choroid context"
  ].map((item) => `<li>${item}</li>`).join("");

  document.getElementById("amd-system-impact").innerHTML = renderAmdSignalGroups(displayScores);

  document.getElementById("amd-output-scores").innerHTML = [
    ["Retinal complement activity", displayScores.retinalComplementActivityScore],
    ["Drusen risk proxy", displayScores.drusenFormationRiskProxy],
    ["RPE stress", displayScores.RPEStressScore],
    ["Choroidal inflammation", displayScores.choroidalInflammationScore],
    ["Geographic atrophy proxy", displayScores.geographicAtrophyProgressionProxy],
    ["Neovascular signal proxy", displayScores.neovascularSignalProxy],
    ["Systemic inflammation association", displayScores.systemicInflammationAssociationScore],
    ["Kidney complement association", displayScores.kidneyComplementAssociationScore],
    ["Neuroinflammation association", displayScores.neuroinflammationAssociationScore]
  ].map(([label, score]) => `
    <div class="amd-output-card" style="--score-width:${Math.round(clamp(score))}%">
      <span>${label}</span>
      <strong>${Math.round(clamp(score))}</strong>
      <i></i>
    </div>
  `).join("");

  document.getElementById("amd-drug-summary").textContent = getAmdDrugTargetExplanation(targets);
  document.getElementById("amd-summary").textContent = generateAmdDiseaseSummary(result);
  document.getElementById("amd-disclaimer").textContent = getAmdDisclaimer();
  renderAmdCalibrationPanel();
}

function renderAmdCalibrationPanel() {
  const summary = document.getElementById("amd-calibration-summary");
  const priors = document.getElementById("amd-calibration-priors");
  const records = document.getElementById("amd-evidence-records");
  const candidates = document.getElementById("amd-calibration-candidates");
  if (!summary || !priors || !records || !candidates) return;
  summary.textContent = `${getAmdCalibrationSummary()} ${amdLiteratureCalibration.disclaimer}`;
  priors.innerHTML = amdLiteratureCalibration.parameterPriors.map((prior) => `
    <article class="amd-prior-card">
      <header>
        <strong>${prior.label}</strong>
        <span>${prior.confidence}</span>
      </header>
      <div class="amd-prior-range">
        <i style="left:${priorToPercent(prior.range.min)}%;width:${Math.max(4, priorToPercent(prior.range.max) - priorToPercent(prior.range.min))}%"></i>
        <b style="left:${priorToPercent(prior.range.median)}%"></b>
      </div>
      <p><span>${prior.parameter}</span> ${prior.range.min}-${prior.range.max}, median ${prior.range.median}</p>
      <em>${prior.evidenceCount} evidence records · ${prior.evidenceLevel}</em>
      <small>${prior.rationale}</small>
    </article>
  `).join("");
  records.innerHTML = amdLiteratureCalibration.evidenceRecords.map((record) => `
    <article class="amd-evidence-card">
      <strong>${record.id}</strong>
      <p>${record.finding}</p>
      <div>
        <span>${record.biomarkerOrMechanism}</span>
        <span>${record.direction}</span>
        <span>${record.modelParameter}</span>
        <span>confidence ${Math.round(record.confidence * 100)}%</span>
      </div>
    </article>
  `).join("");
  const { seedCandidates, localCandidates, review } = getAmdCalibrationReviewData();
  const reviewSummary = document.getElementById("amd-calibration-review");
  if (reviewSummary) {
    reviewSummary.textContent = review.conflicts.length
      ? `${review.conflicts.length} candidate conflict(s) require review before any model change.`
      : "No candidate conflicts detected; all suggestions still require scientific review before any model change.";
    reviewSummary.classList.toggle("has-conflicts", review.conflicts.length > 0);
  }
  renderModelAuditSummary();
  const renderCandidate = (candidate, sourceLabel) => `
    <article class="amd-evidence-card candidate-card">
      <strong>${candidate.parameter}</strong>
      <p>${candidate.rationale}</p>
      <div>
        <span>${sourceLabel}</span>
        <span>${candidate.evidenceIds[0]}</span>
        <span>${candidate.reviewStatus === "needs_review" ? "needs review" : "no conflict detected"}</span>
        <span>${candidate.direction} to ${candidate.suggestedValue}</span>
        <span>range ${candidate.suggestedRange.min}-${candidate.suggestedRange.max}</span>
        <span>${candidate.uncertainty} uncertainty</span>
      </div>
    </article>
  `;
  candidates.innerHTML = review.candidates.map((candidate) => renderCandidate(
    candidate,
    localCandidates.some((localCandidate) => localCandidate.id === candidate.id)
      ? "local evidence hypothesis"
      : "curated seed hypothesis"
  )).join("") || "<p class=\"muted\">No parameter candidates have been generated from local records yet.</p>";
}

function getAmdCalibrationReviewData() {
  const currentParameters = Object.fromEntries(
    amdLiteratureCalibration.parameterPriors.map((prior) => [prior.parameter, prior.range.min])
  );
  const candidateRecords = amdLiteratureCalibration.parameterPriors.map((prior) => ({
    id: `seed:${prior.parameter}`,
    sourceLocator: `seed://amd-literature-calibration/${prior.parameter}`,
    evidenceLevel: "curated",
    uncertainty: prior.confidence === "moderate-high" ? "moderate" : "high",
    extractedClaim: prior.rationale,
    parameterPriors: { [prior.parameter]: prior.range }
  }));
  const seedCandidates = generateCalibrationCandidates({ diseaseContext: "AMD", currentParameters, evidenceRecords: candidateRecords });
  const localCandidates = generateEvidenceParameterCandidates({
    diseaseContext: "AMD",
    currentParameters,
    evidenceRecords: localEvidenceState.records
  });
  const review = reviewCalibrationCandidates([...localCandidates, ...seedCandidates]);
  return { candidateRecords, seedCandidates, localCandidates, review };
}

function downloadAmdReviewPackage() {
  const { candidateRecords, review } = getAmdCalibrationReviewData();
  const reviewPackage = createCalibrationReviewPackage({
    diseaseContext: "AMD",
    modelVersion: MODEL_VERSION,
    candidates: review.candidates,
    conflicts: review.conflicts,
    evidenceRecords: [...candidateRecords, ...localEvidenceState.records]
  });
  const blob = new Blob([JSON.stringify(reviewPackage, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "fleda-amd-calibration-review.json";
  link.click();
  URL.revokeObjectURL(url);
}

function priorToPercent(value) {
  return clamp((Number(value) - 0.5) / 1.5 * 100);
}

function renderAmdSignalGroups(scores) {
  const primary = [
    ["Retina / Macula", "Primary AMD tissue signal", scores.retinaMaculaScore ?? scores.retinalComplementActivityScore],
    ["RPE Stress", "RPE stress proxy", scores.RPEStressScore],
    ["Choroid", "Choroidal inflammation proxy", scores.choroidalInflammationScore],
    ["Drusen", "Drusen activity proxy", scores.drusenFormationRiskProxy],
    ["Geographic Atrophy", "Advanced dry AMD progression proxy", scores.geographicAtrophyProgressionProxy],
    ["Neovascular Signal", "Wet AMD pathway signal proxy", scores.neovascularSignalProxy]
  ];
  const secondary = [
    ["Vascular", "Association layer", scores.vascularAssociationScore],
    ["Brain / CNS", "Neuroinflammation association", scores.neuroinflammationAssociationScore],
    ["Kidney", "Complement dysregulation association", scores.kidneyComplementAssociationScore],
    ["Liver production burden", "Complement production burden proxy", scores.liverComplementProductionBurden]
  ];
  return `
    <div class="amd-signal-section">
      <h5>Primary AMD Tissue Signals</h5>
      ${primary.map(([name, description, score]) => amdSystemRow(name, description, score)).join("")}
    </div>
    <details class="amd-signal-section amd-secondary-section">
      <summary>Secondary Association Signals</summary>
      ${secondary.map(([name, description, score]) => amdSystemRow(name, description, score)).join("")}
    </details>
  `;
}

function amdSystemRow(name, description, score) {
  return `
    <div class="amd-system-row" style="--score-width:${Math.round(clamp(score))}%">
      <strong>${name}</strong>
      <span>${description}</span>
      <i></i>
    </div>
  `;
}

function calculateAmdScoresFromVisibleValues(values) {
  const inflammation = average(values.C3a, values.C5a);
  const amplification = average(values.C3b, values.C3bBb);
  const regulationLoss = clamp(100 - average(values["Factor H"], values["Factor I"], values.CD59));
  const mac = values.MAC ?? 0;
  const retinalComplementActivityScore = clamp(weightedScore([amplification, 0.34], [inflammation, 0.22], [mac, 0.20], [regulationLoss, 0.24]) * 1.22);
  const drusenFormationRiskProxy = clamp(weightedScore([values.C3b ?? 0, 0.34], [values.C3bBb ?? 0, 0.32], [regulationLoss, 0.34]) * 1.16);
  const RPEStressScore = clamp(weightedScore([mac, 0.36], [values.C5a ?? 0, 0.26], [regulationLoss, 0.38]) * 1.20);
  const choroidalInflammationScore = clamp(weightedScore([values.C5a ?? 0, 0.44], [values.C3a ?? 0, 0.32], [amplification, 0.24]) * 1.05);
  const retinaMaculaScore = clamp(Math.max(retinalComplementActivityScore, RPEStressScore, drusenFormationRiskProxy) + 5);
  return {
    retinaMaculaScore,
    retinalComplementActivityScore,
    drusenFormationRiskProxy,
    RPEStressScore,
    choroidalInflammationScore,
    geographicAtrophyProgressionProxy: clamp(average(RPEStressScore, drusenFormationRiskProxy, mac)),
    neovascularSignalProxy: clamp(average(choroidalInflammationScore, values.C5a ?? 0, mac)),
    complementDysregulationScore: clamp(average(amplification, regulationLoss, retinalComplementActivityScore)),
    vascularAssociationScore: clamp(average(choroidalInflammationScore, inflammation) * 0.62),
    systemicInflammationAssociationScore: clamp(average(inflammation, amplification) * 0.70),
    kidneyComplementAssociationScore: clamp(average(amplification, regulationLoss) * 0.52),
    neuroinflammationAssociationScore: clamp(average(inflammation, regulationLoss) * 0.45),
    liverComplementProductionBurden: clamp(average(100 - (values.C3 ?? 0), inflammation) * 0.22)
  };
}

function getAmdDrugTargetExplanation(targets) {
  if (!targets.length) return "Select C3, C5, Factor B, Factor D, or CD59 support to compare how target intervention changes retinal complement activity, RPE stress, and downstream association layers.";
  const labels = {
    c3Inhibitor: "C3 inhibition broadly reduces upstream C3a/C3b and downstream C5a/MAC signals, with broader immune suppression concern.",
    c5Inhibitor: "C5 inhibition lowers C5a and MAC but does not directly remove upstream C3b deposition.",
    factorBInhibitor: "Factor B inhibition reduces alternative pathway amplification and may be more pathway-selective.",
    factorDInhibitor: "Factor D inhibition reduces alternative pathway convertase formation and C3bBb-driven amplification.",
    c5aRInhibitor: "C5aR inhibition reduces inflammatory response signaling while leaving complement cleavage products visible in the model.",
    cd59Modifier: "CD59 support represents improved terminal pathway regulation and lower local MAC stress."
  };
  return targets.map((target) => labels[target]).filter(Boolean).join(" ");
}

function renderHeartRhythm(impacts, values) {
  const heartRate = document.getElementById("organ-heart-rate");
  const monitor = document.querySelector(".heartbeat-monitor");
  const human = document.querySelector(".human-outline");
  if (!heartRate || !monitor) return;
  if (getHeroInterventionControls().disease === "AMD") {
    const bpm = 72;
    heartRate.textContent = bpm;
    state.monitorAudio.bpm = bpm;
    monitor.style.setProperty("--heartbeat-speed", `${60 / bpm}s`);
    monitor.style.setProperty("--ecg-speed", "1.45s");
    monitor.style.setProperty("--heart-color", "#38bdf8");
    human?.style.setProperty("--heartbeat-speed", `${60 / bpm}s`);
    human?.style.setProperty("--heart-color", "#38bdf8");
    return;
  }
  const vascularImpact = impacts.find((impact) => impact.id === "vessels")?.score ?? 0;
  const inflammation = average(values.C3a, values.C5a);
  const bpm = Math.round(clamp(68 + vascularImpact * 0.16 + inflammation * 0.10, 58, 112));
  const speed = clamp(60 / bpm, 0.52, 1.05);
  const color = impactColor(Math.max(vascularImpact, inflammation));
  heartRate.textContent = bpm;
  state.monitorAudio.bpm = bpm;
  monitor.style.setProperty("--heartbeat-speed", `${speed}s`);
  monitor.style.setProperty("--ecg-speed", `${Math.max(0.75, speed * 1.55)}s`);
  monitor.style.setProperty("--heart-color", color);
  human?.style.setProperty("--heartbeat-speed", `${speed}s`);
  human?.style.setProperty("--heart-color", color);
}

function startMonitorBeep() {
  if (state.monitorAudio.timer) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  if (!state.monitorAudio.context) state.monitorAudio.context = new AudioContext();
  state.monitorAudio.context.resume?.();
  const schedule = () => {
    playMonitorBeep();
    const delay = Math.max(420, 60000 / (state.monitorAudio.bpm || 72));
    state.monitorAudio.timer = window.setTimeout(schedule, delay);
  };
  schedule();
}

function stopMonitorBeep() {
  if (!state.monitorAudio.timer) return;
  window.clearTimeout(state.monitorAudio.timer);
  state.monitorAudio.timer = null;
}

function playMonitorBeep() {
  const context = state.monitorAudio.context;
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, context.currentTime);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.035, context.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.09);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(context.currentTime);
  oscillator.stop(context.currentTime + 0.1);
}

function getHeroTraceValues(time) {
  const values = {};
  state.heroPlayback.traces.forEach((trace) => {
    const index = trace.x.reduce((bestIndex, x, currentIndex) => {
      return Math.abs(x - time) < Math.abs(trace.x[bestIndex] - time) ? currentIndex : bestIndex;
    }, 0);
    values[trace.name] = trace.y[index] ?? 0;
  });
  return values;
}

function getHeroTimeScale() {
  const disease = getHeroInterventionControls().disease;
  const isAmd = disease === "AMD";
  return {
    isAmd,
    unit: isAmd ? "months" : "min",
    unitSingular: isAmd ? "month" : "min",
    axisTitle: isAmd ? "Chronic progression time (months)" : "Time (minutes)",
    duration: isAmd ? 24 : 120,
    timeStep: isAmd ? 0.2 : 1,
    defaultInterventionTime: isAmd ? 12 : 60,
    defaultSpeed: isAmd ? 1 : 10
  };
}

function syncHeroTimeScaleControls() {
  const scale = getHeroTimeScale();
  const speedSelect = document.getElementById("hero-playback-speed");
  const interventionTime = document.getElementById("hero-intervention-time");
  const interventionOutput = document.getElementById("hero-intervention-time-output");
  const interventionLabel = document.querySelector(".hero-intervention-time-control");
  if (speedSelect && speedSelect.dataset.scale !== scale.unit) {
    speedSelect.dataset.scale = scale.unit;
    speedSelect.innerHTML = scale.isAmd
      ? `<option value="0.5">1 sec = 0.5 month</option><option value="1" selected>1 sec = 1 month</option><option value="3">1 sec = 3 months</option>`
      : `<option value="1">1 sec = 1 min</option><option value="10" selected>1 sec = 10 min</option><option value="30">1 sec = 30 min</option>`;
  }
  if (interventionTime && interventionTime.dataset.scale !== scale.unit) {
    interventionTime.dataset.scale = scale.unit;
    interventionTime.max = String(scale.duration);
    interventionTime.step = scale.isAmd ? "0.5" : "1";
    interventionTime.value = String(scale.defaultInterventionTime);
  }
  if (interventionLabel) {
    interventionLabel.childNodes[0].textContent = scale.isAmd ? "Intervention month " : "Intervention time ";
  }
  if (interventionOutput && interventionTime) {
    interventionOutput.textContent = formatHeroTime(Number(interventionTime.value));
  }
}

function formatHeroTime(time) {
  const scale = getHeroTimeScale();
  if (scale.isAmd) {
    const rounded = Math.round(Number(time) * 10) / 10;
    return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)} months`;
  }
  return `${Math.round(time)} min`;
}

function calculateDiseaseSpecificOrganScores(diseaseContext, values, time) {
  if (diseaseContext === "AMD") return calculateAmdOrganScores(values);
  return calculateOrganImpacts(values, time);
}

function calculateAmdOrganScores(values) {
  const weights = diseaseOrganWeightMatrix.AMD;
  const scores = calculateAmdScoresFromVisibleValues(values);
  const primary = [
    {
      id: "retina",
      name: "Retina / Macula",
      score: diseaseWeightedScore(scores.retinaMaculaScore, weights.retinaEye),
      description: "Primary AMD tissue signal centered on retina, macula, RPE, and choroid."
    },
    {
      id: "rpe",
      name: "RPE Stress",
      score: diseaseWeightedScore(scores.RPEStressScore, weights.rpe),
      description: "RPE stress proxy driven by local complement activity, regulatory weakness, and terminal pathway signal."
    },
    {
      id: "drusen",
      name: "Drusen Activity",
      score: diseaseWeightedScore(scores.drusenFormationRiskProxy, weights.drusen),
      description: "Drusen activity proxy linked to chronic C3 activation and C3b deposition."
    },
    {
      id: "choroid",
      name: "Choroidal Inflammation",
      score: diseaseWeightedScore(scores.choroidalInflammationScore, weights.choroid),
      description: "Choroidal inflammation proxy connected to C3a/C5a signaling and vascular interface biology."
    },
    {
      id: "retinal-complement",
      name: "Retinal Complement Activity",
      score: diseaseWeightedScore(scores.retinalComplementActivityScore, weights.macula),
      description: "Retina-centered alternative pathway activity signal, not a whole-body complement storm."
    },
    {
      id: "geographic-atrophy",
      name: "Geographic Atrophy Proxy",
      score: clamp(diseaseWeightedScore(scores.geographicAtrophyProgressionProxy, weights.rpe) - 6),
      description: "Advanced dry AMD progression proxy based on RPE stress, drusen activity, and local terminal pathway signal."
    },
    {
      id: "neovascular-signal",
      name: "Neovascular Signal Proxy",
      score: clamp(diseaseWeightedScore(scores.neovascularSignalProxy, weights.choroid) - 18),
      description: "Wet AMD pathway signal proxy. In V1 this remains a pathway signal, not a diagnosis."
    },
    {
      id: "complement-dysregulation",
      name: "Complement Dysregulation",
      score: diseaseWeightedScore(scores.complementDysregulationScore, weights.immuneComplement),
      description: "Alternative pathway and regulatory imbalance signal relevant to AMD mechanism."
    }
  ];
  const secondary = [
    {
      id: "vessels",
      name: "Vascular Association",
      score: clamp(diseaseWeightedScore(scores.vascularAssociationScore, weights.vascular), 0, 65),
      description: "Secondary choroidal/endothelial association layer, not systemic vascular injury.",
      secondary: true
    },
    {
      id: "brain",
      name: "Neuroinflammation Association",
      score: clamp(diseaseWeightedScore(scores.neuroinflammationAssociationScore, weights.brainCns), 0, 40),
      description: "Secondary association layer for shared inflammatory biology; not deterministic CNS damage.",
      secondary: true
    },
    {
      id: "kidney",
      name: "Kidney Complement Association",
      score: clamp(diseaseWeightedScore(scores.kidneyComplementAssociationScore, weights.kidney), 0, 30),
      description: "Shared complement dysregulation association layer, especially CFH/CFI/C3 biology.",
      secondary: true
    },
    {
      id: "liver",
      name: "Liver Complement Production Burden",
      score: clamp(diseaseWeightedScore(scores.liverComplementProductionBurden, weights.liver), 0, 25),
      description: "Low-weight complement production burden proxy, not a primary AMD tissue signal.",
      secondary: true
    }
  ];
  return [...primary, ...secondary].map((impact) => ({
    ...impact,
    score: Math.round(clamp(impact.score)),
    color: impactColor(impact.score)
  })).sort((a, b) => {
    if (a.secondary !== b.secondary) return a.secondary ? 1 : -1;
    return b.score - a.score;
  });
}

function diseaseWeightedScore(score, tissueWeight) {
  return clamp((Number(score) || 0) * Math.sqrt((Number(tissueWeight) || 1) / 10));
}

function calculateOrganImpacts(values, time) {
  const intervention = getHeroInterventionControls();
  const diseaseBias = getDiseaseOrganBias(intervention.disease);
  const interventionActive = intervention.targets.length > 0 && intervention.strength > 0 && time >= intervention.time;
  const infectionBurden = interventionActive ? Math.min(100, intervention.strength * intervention.targets.length * 0.38) : 8;
  const inflammation = average(values.C3a, values.C5a);
  const amplification = average(values.C3b, values.C3bBb);
  const terminal = average(values.C5b, values.MAC);
  const regulationLoss = clamp(100 - average(values["Factor H"], values["Factor I"], values.CD59));
  const c3Consumption = clamp(100 - (values.C3 ?? 0));
  const organImpacts = [
    {
      id: "kidney",
      name: "Kidney",
      score: weightedScore([amplification, 0.28], [values.C3b, 0.20], [terminal, 0.20], [regulationLoss, 0.18], [inflammation, 0.14]),
      description: "C3b/C3bBb amplification, terminal pathway activity, and regulatory imbalance raise renal deposition or microvascular injury signals."
    },
    {
      id: "blood",
      name: "Blood / RBC",
      score: weightedScore([values.MAC, 0.38], [values.C5b, 0.24], [regulationLoss, 0.20], [values.C5a, 0.18]),
      description: "MAC and weak surface regulation increase hemolysis-like host cell injury signals, especially in PNH-like contexts."
    },
    {
      id: "lung",
      name: "Lung",
      score: weightedScore([values.C5a, 0.34], [values.C3a, 0.24], [inflammation, 0.18], [infectionBurden, 0.16], [values.MAC, 0.08]),
      description: "Anaphylatoxin burden can amplify leukocyte recruitment, permeability, and inflammatory lung signal."
    },
    {
      id: "vessels",
      name: "Vessels",
      score: weightedScore([values.C5a, 0.30], [values.MAC, 0.24], [amplification, 0.22], [inflammation, 0.24]),
      description: "C5a, MAC, and amplification products increase endothelial activation and thrombo-inflammatory risk signals."
    },
    {
      id: "brain",
      name: "Brain / CNS",
      score: weightedScore([values.C5a, 0.28], [values.MAC, 0.22], [regulationLoss, 0.20], [inflammation, 0.18], [amplification, 0.12]),
      description: "CNS signal rises when inflammatory and vascular complement stress increase together."
    },
    {
      id: "retina",
      name: "Retina / Eye",
      score: weightedScore([amplification, 0.30], [regulationLoss, 0.26], [values.MAC, 0.22], [values.C3b, 0.22]),
      description: "Alternative pathway amplification and regulatory weakness are mapped to AMD-like retinal stress signals."
    },
    {
      id: "liver",
      name: "Liver",
      score: weightedScore([c3Consumption, 0.32], [inflammation, 0.28], [values.C3a, 0.20], [values.C5a, 0.20]),
      description: "High systemic inflammatory demand and C3 consumption suggest hepatic acute-phase/complement production burden."
    },
    {
      id: "skin",
      name: "Skin / Joint",
      score: weightedScore([inflammation, 0.34], [values.C3b, 0.24], [values.C5a, 0.24], [amplification, 0.18]),
      description: "Immune-complex-like deposition and anaphylatoxin activity raise skin, joint, or small-vessel inflammation signals."
    }
  ];
  const rawImpacts = organImpacts.map((impact) => {
    const score = Math.round(clamp(impact.score + (diseaseBias[impact.id] ?? 0)));
    return {
      ...impact,
      score,
      color: impactColor(score)
    };
  });
  return rankDiseaseSpecificImpacts(intervention.disease, rawImpacts).map((impact) => ({
    ...impact,
    color: impactColor(impact.score)
  }));
}

function getDiseaseOrganBias(disease) {
  return {
    normal: {},
    PNH: { blood: 30, kidney: 8, vessels: 6 },
    aHUS: { kidney: 34, vessels: 18, brain: 10, blood: 8 },
    C3G: { kidney: 36, retina: 8 },
    AMD: { retina: 38, vessels: 8, kidney: 4, brain: 3 },
    sepsis: { lung: 28, vessels: 24, liver: 18, brain: 8 },
    "cancer microenvironment": { vessels: 16, lung: 12, liver: 8, skin: 8 }
  }[disease] ?? {};
}

function average(...values) {
  const clean = values.filter((value) => Number.isFinite(value));
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0;
}

function weightedScore(...pairs) {
  return pairs.reduce((sum, [value, weight]) => sum + clamp(value) * weight, 0);
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function impactColor(score) {
  if (score >= 82) return "#ef4444";
  if (score >= 62) return "#f97316";
  if (score >= 40) return "#facc15";
  return "#38bdf8";
}

function getHeroInterventionControls() {
  return {
    disease: document.getElementById("hero-disease-scenario")?.value ?? "normal",
    targets: [...document.querySelectorAll("input[name='heroInterventionTarget']:checked")].map((input) => input.value),
    strength: Number(document.getElementById("hero-intervention-strength")?.value ?? 70),
    time: Number(document.getElementById("hero-intervention-time")?.value ?? 60),
    highlight: document.getElementById("hero-highlight-series")?.value ?? "none"
  };
}

function applyHeroHighlight(traces) {
  const { highlight } = getHeroInterventionControls();
  if (highlight === "none") return traces;
  return traces.map((trace) => {
    const selected = trace.name === highlight;
    return {
      ...trace,
      line: {
        ...trace.line,
        color: selected ? "#ff334d" : "rgba(165, 174, 191, 0.26)",
        width: selected ? 5 : 1.6
      },
      opacity: selected ? 1 : 0.52
    };
  });
}

function heroBaselineTraces() {
  const names = ["C3", "C3a", "C3b", "Factor B", "Factor D", "C3bBb", "Factor H", "Factor I", "C5", "C5a", "C5b", "MAC", "CD59"];
  const colors = ["#4aa3ff", "#6ee7ff", "#8a7dff", "#5be0a6", "#b5e853", "#f6c85f", "#ffbe76", "#ff9f7a", "#ff7ab6", "#ff5d6c", "#c778ff", "#ffffff", "#9fb4ff"];
  const baselines = [82, 14, 18, 70, 52, 10, 76, 64, 58, 12, 9, 7, 78];
  const x = Array.from({ length: 121 }, (_, i) => i);
  return names.map((name, index) => ({
    x,
    y: x.map((t) => baselines[index] + Math.sin(t / (8 + index) + index) * (1.2 + (index % 3) * 0.5)),
    mode: "lines",
    type: "scatter",
    name,
    line: { color: colors[index], width: ["MAC", "C3bBb"].includes(name) ? 3.5 : 2.2 },
    hovertemplate: `${name}<br>Time: %{x:.1f} min<br>Relative concentration: %{y:.2f}<extra></extra>`
  }));
}

function heroReactionTraces() {
  const intervention = getHeroInterventionControls();
  const diseasePreset = getHeroDiseasePreset(intervention.disease);
  const timeScale = getHeroTimeScale();
  const biomarkerEstimate = state.heroPlayback.biomarkerApplied ? state.heroPlayback.biomarkerEstimate : null;
  const interventions = { c3Inhibitor: 0, factorBInhibitor: 0, factorDInhibitor: 0, c5Inhibitor: 0, c5aRInhibitor: 0, cd59Modifier: 100 };
  intervention.targets.forEach((target) => {
    if (target === "cd59Modifier") interventions.cd59Modifier = 100 + intervention.strength;
    else interventions[target] = intervention.strength;
  });
  const input = {
    duration: timeScale.duration,
    timeStep: timeScale.timeStep,
    diseaseContext: intervention.disease,
    initialConcentrations: {
      C3: biomarkerEstimate?.initialConcentrations.C3 ?? 5400,
      C5: biomarkerEstimate?.initialConcentrations.C5 ?? 500,
      FactorB: biomarkerEstimate?.initialConcentrations.FactorB ?? 2200,
      FactorD: biomarkerEstimate?.initialConcentrations.FactorD ?? 83,
      FactorH: biomarkerEstimate?.initialConcentrations.FactorH ?? diseasePreset.factorH,
      FactorI: biomarkerEstimate?.initialConcentrations.FactorI ?? diseasePreset.factorI,
      CD55: diseasePreset.cd55,
      CD59: diseasePreset.cd59
    },
    pathwayActivity: biomarkerEstimate?.pathwayActivity ?? diseasePreset.pathwayActivity,
    interventionTime: intervention.time,
    interventions
  };
  const result = runDynamicsSimulation(input);
  state.heroPlayback.amdSpecificOutputs = result.amdSpecificOutputs;
  return result.series.map((series) => {
    const max = Math.max(...series.data.map((point) => point.value), 1);
    return {
      x: series.data.map((point) => point.time),
      y: series.data.map((point) => point.value / max * 100),
      mode: "lines",
      type: "scatter",
      name: series.name,
    line: { color: series.colorKey, width: ["MAC", "C3bBb"].includes(series.entityId) ? 3.5 : 2.2 },
      hovertemplate: `${series.name}<br>Time: %{x:.1f} ${timeScale.unit}<br>Relative concentration: %{y:.2f}<extra></extra>`
    };
  });
}

function getHeroDiseasePreset(disease) {
  const base = {
    factorH: 3200,
    factorI: 400,
    cd55: 85,
    cd59: 85,
    pathwayActivity: { classical: 45, lectin: 38, alternative: 72, terminal: 64 }
  };
  const presets = {
    PNH: { cd55: 25, cd59: 18, pathwayActivity: { classical: 45, lectin: 38, alternative: 78, terminal: 88 } },
    aHUS: { factorH: 1650, factorI: 260, pathwayActivity: { classical: 48, lectin: 38, alternative: 92, terminal: 78 } },
    C3G: { factorH: 2100, factorI: 300, pathwayActivity: { classical: 38, lectin: 34, alternative: 96, terminal: 68 } },
    AMD: { factorH: 2450, factorI: 360, pathwayActivity: { classical: 35, lectin: 38, alternative: 84, terminal: 66 } },
    sepsis: { factorH: 3000, factorI: 390, pathwayActivity: { classical: 92, lectin: 82, alternative: 86, terminal: 92 } },
    "cancer microenvironment": { factorH: 2950, factorI: 380, pathwayActivity: { classical: 54, lectin: 48, alternative: 78, terminal: 72 } }
  };
  return { ...base, ...(presets[disease] ?? {}) };
}

function renderDynamicsGroupFilters() {
  const container = document.getElementById("dynamics-groups");
  if (!container) return;
  const labels = {
    "c3-system": "C3 system",
    "c5-system": "C5 system",
    regulators: "Regulators",
    convertases: "Convertases",
    terminal: "Terminal pathway",
    "amd-retina": "AMD retina proxies"
  };
  container.innerHTML = getDynamicsGroups().map((group) => `
    <label class="checkbox-row">
      <input type="checkbox" value="${group}" ${state.visibleDynamicsGroups.has(group) ? "checked" : ""}>
      ${labels[group] ?? group}
    </label>
  `).join("");
  container.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) state.visibleDynamicsGroups.add(input.value);
      else state.visibleDynamicsGroups.delete(input.value);
      renderDynamicsExplorer();
    });
  });
}

function getDynamicsGroups() {
  return [...new Set(getDynamicsSeriesMeta().map((item) => item.group))];
}

function applyDynamicsDiseaseDefaults(disease) {
  if (!disease) return;
  const form = document.getElementById("dynamics-form");
  const presets = {
    PNH: { CD55: 25, CD59: 18, terminal: 75, alternative: 55 },
    aHUS: { FactorH: 1500, FactorI: 260, alternative: 78, terminal: 62 },
    C3G: { alternative: 88, FactorH: 2100, FactorI: 300 },
    AMD: { alternative: 70, FactorH: 2400 },
    sepsis: { classical: 82, lectin: 74, alternative: 78, terminal: 86 },
    "cancer microenvironment": { alternative: 62, terminal: 58 }
  };
  const preset = presets[disease];
  if (!preset) return;
  Object.entries(preset).forEach(([name, value]) => {
    const control = form.elements[name];
    if (!control) return;
    control.value = value;
    if (control.nextElementSibling?.tagName === "OUTPUT") control.nextElementSibling.textContent = value;
  });
}

function renderDynamicsExplorer() {
  const input = getDynamicsInput();
  state.dynamicsResult = runDynamicsSimulation(input);
  const slider = document.getElementById("time-inspector-slider");
  slider.max = input.duration;
  slider.step = input.timeStep;
  if (Number(slider.value) > input.duration) slider.value = Math.round(input.duration * 0.35);
  slider.nextElementSibling.textContent = slider.value;
  renderDynamicsChart(false);
  renderDynamicsEvents();
  renderDynamicsInspector(Number(slider.value));
}

function getDynamicsInput() {
  const form = document.getElementById("dynamics-form");
  return {
    duration: Number(form.elements.duration.value),
    timeStep: Number(form.elements.timeStep.value),
    diseaseContext: form.elements.diseaseContext.value,
    initialConcentrations: {
      C3: Number(form.elements.C3.value),
      C5: Number(form.elements.C5.value),
      FactorB: Number(form.elements.FactorB.value),
      FactorD: Number(form.elements.FactorD.value),
      FactorH: Number(form.elements.FactorH.value),
      FactorI: Number(form.elements.FactorI.value),
      CD55: Number(form.elements.CD55.value),
      CD59: Number(form.elements.CD59.value)
    },
    pathwayActivity: {
      classical: Number(form.elements.classical.value),
      lectin: Number(form.elements.lectin.value),
      alternative: Number(form.elements.alternative.value),
      terminal: Number(form.elements.terminal.value)
    },
    interventionTime: Number(form.elements.interventionTime.value),
    interventions: {
      c3Inhibitor: Number(form.elements.c3Inhibitor.value),
      factorBInhibitor: Number(form.elements.factorBInhibitor.value),
      factorDInhibitor: Number(form.elements.factorDInhibitor.value),
      c5Inhibitor: Number(form.elements.c5Inhibitor.value),
      c5aRInhibitor: Number(form.elements.c5aRInhibitor.value),
      cd59Modifier: Number(form.elements.cd59Modifier.value)
    },
    logScale: form.elements.logScale.checked
  };
}

function renderDynamicsChart(resetZoom) {
  const result = state.dynamicsResult;
  if (!result) return;
  const formInput = getDynamicsInput();
  const visibleSeries = result.series.filter((series) => state.visibleDynamicsGroups.has(series.group));
  const traces = visibleSeries.map((series) => ({
    x: series.data.map((point) => point.time),
    y: series.data.map((point) => point.value),
    mode: "lines",
    type: "scatter",
    name: series.name,
    line: { color: series.colorKey, width: ["MAC", "C3bBb"].includes(series.entityId) ? 4 : 2.5 },
    hovertemplate: `${series.name}<br>Time: %{x:.2f} min<br>Value: %{y:.3f} ${series.unit}<extra></extra>`
  }));
  const interventionEvent = result.events.find((event) => event.label === "Drug intervention applied");
  const shapes = interventionEvent ? [{
    type: "line",
    x0: interventionEvent.time,
    x1: interventionEvent.time,
    y0: 0,
    y1: 1,
    yref: "paper",
    line: { color: "#ff6b7a", width: 2, dash: "dash" }
  }] : [];
  const annotations = interventionEvent ? [{
    x: interventionEvent.time,
    y: 1,
    yref: "paper",
    text: "Drug intervention",
    showarrow: false,
    yanchor: "bottom",
    font: { color: "#ffadb6", size: 12 }
  }] : [];
  const layout = {
    paper_bgcolor: "#0b1628",
    plot_bgcolor: "#0b1628",
    font: { color: "#eef6ff" },
    margin: { l: 58, r: 24, t: 20, b: 52 },
    xaxis: {
      title: "Time",
      gridcolor: "rgba(133,171,233,0.18)",
      rangeslider: { visible: true, bgcolor: "#111f35", bordercolor: "rgba(133,171,233,0.28)" },
      zeroline: false
    },
    yaxis: {
      title: "Concentration / Relative Activity",
      type: formInput.logScale ? "log" : "linear",
      gridcolor: "rgba(133,171,233,0.18)",
      fixedrange: false,
      rangemode: "tozero",
      zeroline: false
    },
    legend: { orientation: "h", y: -0.34, x: 0, font: { size: 11 } },
    hovermode: "x unified",
    dragmode: "pan",
    shapes,
    annotations
  };
  const config = {
    responsive: true,
    displaylogo: false,
    scrollZoom: true,
    modeBarButtonsToRemove: ["lasso2d", "select2d"]
  };
  if (!window.Plotly) {
    document.getElementById("dynamics-chart").innerHTML = `<div class="plotly-fallback">Plotly.js is loading or unavailable. Refresh the page to render the interactive chart.</div>`;
    return;
  }
  const chart = document.getElementById("dynamics-chart");
  if (resetZoom || !chart.data) window.Plotly.newPlot(chart, traces, layout, config);
  else window.Plotly.react(chart, traces, layout, config);
}

function renderDynamicsEvents() {
  const result = state.dynamicsResult;
  document.getElementById("event-timeline").innerHTML = result.events.map((event) => `
    <div class="timeline-event">
      <strong>${formatDynamicsTime(event.time)}</strong>
      <span>${event.label}</span>
      <p>${event.description}</p>
    </div>
  `).join("");
}

function renderDynamicsInspector(selectedTime) {
  const result = state.dynamicsResult;
  if (!result) return;
  const point = nearestTimePoint(result.timePoints, selectedTime);
  const keyOrder = ["C3", "C3a", "C3b", "FactorB", "FactorD", "C3bBb", "FactorH", "FactorI", "C5", "C5a", "C5b", "MAC", "CD59"];
  document.getElementById("time-inspector").innerHTML = `
    <h3>${formatDynamicsTime(point.time)}</h3>
    <div class="inspector-grid">
      ${keyOrder.map((key) => `<span><strong>${key}</strong>${formatNumber(point.concentrations[key])}</span>`).join("")}
    </div>
  `;
  document.getElementById("dynamics-interpretation").textContent = generateDynamicsInterpretation(result, selectedTime);
}

function formatDynamicsTime(time) {
  if (time >= 1440) return `${(time / 1440).toFixed(1)} days`;
  if (time >= 60) return `${(time / 60).toFixed(1)} h`;
  return `${Number(time).toFixed(time % 1 ? 2 : 0)} min`;
}

function formatNumber(value) {
  if (value >= 100) return Math.round(value).toLocaleString();
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(3);
}

function tagBlock(label, items = []) {
  const clean = items.filter(Boolean);
  if (!clean.length) return "";
  return `<div class="tag-block"><strong>${label}</strong><div>${clean.map((item) => `<span>${item}</span>`).join("")}</div></div>`;
}

function scoreClass(value) {
  if (value >= 67) return "high";
  if (value >= 34) return "medium";
  return "low";
}

function escapeAttr(value) {
  return String(value).replaceAll('"', "&quot;");
}
