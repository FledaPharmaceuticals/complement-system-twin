import {
  createValidatedTrainingRecordView,
  isValidatedTrainingRecordView,
  UNAVAILABLE_TRAINING_RECORD_VIEW
} from "./publicTrainingRecord.js";

export { createValidatedTrainingRecordView };

const STATUS_MESSAGES = Object.freeze({
  rejected: "Candidate did not pass; model knowledge and falsification results were retained.",
  candidate_only: "Candidate record retained; not approved for exploratory or formal model use.",
  supported_exploratory: "Supported for research exploration; not formally approved or clinically validated.",
  formally_approved: "Formally approved model record."
});

export function statusMessageFor(status) {
  return STATUS_MESSAGES[status] ?? "Training record unavailable.";
}

export function renderModelTrainingRecordHistory(view = UNAVAILABLE_TRAINING_RECORD_VIEW) {
  if (!isValidatedTrainingRecordView(view)) return renderUnavailableTrainingRecord();

  const records = view.snapshot.records;
  return `
    <div class="model-training-record-heading">
      <div>
        <p class="eyebrow">Private Model Research</p>
        <h2>Model Training Record</h2>
      </div>
      <p>Immutable public-safe history</p>
    </div>
    <div class="model-training-record-list" aria-label="Model training record history">
      ${records.map(renderRecordRow).join("")}
    </div>`;
}

export function bindSingleOpenTrainingRecord(root) {
  const rows = [...root.querySelectorAll("details.model-training-record-row")];
  const listeners = rows.map((row) => {
    const listener = () => {
      if (!row.open) return;
      for (const other of rows) if (other !== row) other.open = false;
    };
    row.addEventListener("toggle", listener);
    return [row, listener];
  });
  return () => listeners.forEach(([row, listener]) => row.removeEventListener("toggle", listener));
}

export function initPublicTrainingRecord(view = UNAVAILABLE_TRAINING_RECORD_VIEW) {
  const container = document.getElementById("model-training-record-content");
  if (!container) return;
  container.innerHTML = renderModelTrainingRecordHistory(view);
  if (isValidatedTrainingRecordView(view)) bindSingleOpenTrainingRecord(container);
}

function renderRecordRow(record) {
  const publications = record.publications.map((publication) => {
    const doi = isValidatedDoi(publication.doi) ? publication.doi : null;
    const doiContent = doi
      ? `<a href="https://doi.org/${escapeAttr(doi)}" target="_blank" rel="noopener noreferrer">${escapeHtml(doi)}</a>`
      : "Unavailable";
    return `<li><strong>${escapeHtml(publication.title)}</strong><span>${escapeHtml(publication.publicationYear)} · ${escapeHtml(publication.accessStatement)}</span><span class="model-training-record-doi">DOI: ${doiContent}</span></li>`;
  }).join("");

  return `
    <details class="model-training-record-row">
      <summary>
        <span class="model-training-record-row-main">
          <strong>${escapeHtml(record.trainingDate)}</strong>
          <span>${escapeHtml(record.publicationCount)} publications · ${escapeHtml(record.method.label)}</span>
        </span>
        <span class="model-training-record-row-meta">
          <span>${escapeHtml(record.candidateStatus)}</span>
          <span>${escapeHtml(record.observationCount)} observations</span>
          <span>${record.formalModelChanged ? "Formal model changed" : "Formal model unchanged"}</span>
        </span>
      </summary>
      <div class="model-training-record-row-content">
        <p class="model-training-record-status"><strong>${escapeHtml(record.candidateStatus)}</strong> · ${escapeHtml(statusMessageFor(record.candidateStatus))}</p>
        ${renderSection("Publications", `<ul class="model-training-record-publications">${publications}</ul>`)}
        ${renderSection("Method", `<p>${escapeHtml(record.method.label)}</p>`)}
        ${renderFindings("Retained knowledge", record.knowledgeAcquired)}
        ${renderFindings("Modeling constraints", record.modelingConstraints)}
        ${renderRejectionReasons(record.rejectionReasons)}
        ${renderSection("Uncertainty", `<p>${escapeHtml(record.uncertaintySummary.level)} · ${escapeHtml(record.uncertaintySummary.summary)}</p>`)}
        ${renderStringList("Limitations", record.limitations)}
        ${renderLinkedStatements("Missing mechanisms", record.missingMechanisms)}
        ${renderLinkedStatements("Architecture implications", record.architectureImplications)}
        ${renderSection("Formal model change", `<p>${record.formalModelChanged ? "A formal model change is recorded." : "The formal model was not changed."}</p>`)}
      </div>
    </details>`;
}

function renderFindings(heading, findings) {
  return renderSection(heading, `<ul>${findings.map((finding) => `<li>${escapeHtml(finding.statement)}</li>`).join("")}</ul>`);
}

function renderRejectionReasons(reasons) {
  return renderSection("Rejection reasons", `<ul>${reasons.map((reason) => `<li><strong>${escapeHtml(reason.code)}</strong> · ${escapeHtml(reason.statement)}</li>`).join("")}</ul>`);
}

function renderLinkedStatements(heading, statements) {
  return renderSection(heading, `<ul>${statements.map((item) => `<li>${escapeHtml(item.statement)}</li>`).join("")}</ul>`);
}

function renderStringList(heading, values) {
  return renderSection(heading, `<ul>${values.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>`);
}

function renderSection(heading, body) {
  return `<section class="model-training-record-section"><h3>${escapeHtml(heading)}</h3>${body}</section>`;
}

function renderUnavailableTrainingRecord() {
  return `
    <div class="model-training-record-heading">
      <div>
        <p class="eyebrow">Private Model Research</p>
        <h2>Model Training Record</h2>
      </div>
    </div>
    <p class="model-training-record-unavailable" role="status">Training record unavailable. A verified public-safe training snapshot is required.</p>`;
}

function isValidatedDoi(value) {
  return typeof value === "string" && /^10\.\d{4,9}\/[A-Za-z0-9._;()/:+-]+$/i.test(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
