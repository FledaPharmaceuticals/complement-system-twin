import { PUBLIC_TRAINING_RECORD } from "./publicTrainingRecord.js";

const PUBLICATION_LABELS = Object.freeze({
  "10.1002/sctm.20-0211": "Cerniauskas et al.",
  "10.1038/s41467-022-33003-7": "Lamers et al."
});

export function renderPublicTrainingRecord(record) {
  const publications = record.publications.map((publication) => {
    const authorLabel = PUBLICATION_LABELS[publication.doi] || "Reviewed publication";
    const doiLink = isApprovedDoiUrl(publication)
      ? `<a href="${escapeHtml(publication.doiUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(publication.doi)}</a>`
      : escapeHtml(publication.doi);
    return `<li><strong>${escapeHtml(authorLabel)}</strong><span>${escapeHtml(publication.title)}</span><span class="model-training-record-doi">DOI: ${doiLink}</span></li>`;
  }).join("");

  const categories = record.parameterCategories.map((category) => (
    `<li><span>${escapeHtml(category.label)}</span><small>${escapeHtml(category.status)}</small></li>`
  )).join("");
  const capabilities = record.capabilities.map((capability) => (
    `<li><span>${escapeHtml(capability.label)}</span><small>${escapeHtml(capability.validationStatus)}</small></li>`
  )).join("");

  return `
    <div class="model-training-record-intro">
      <p class="eyebrow">Candidate evaluation</p>
      <h3>Two-paper AMD test record</h3>
      <p>This used <strong>${escapeHtml(record.method.label)}</strong>, not machine learning. The active model was not changed.</p>
    </div>
    <dl class="model-training-record-facts">
      <div><dt>Training date</dt><dd>${escapeHtml(record.trainingDate)}</dd></div>
      <div><dt>Conclusion</dt><dd><strong>${escapeHtml(record.conclusion)}</strong></dd></div>
      <div><dt>Applicability</dt><dd>${escapeHtml(record.applicability.status)}</dd></div>
      <div><dt>Uncertainty</dt><dd>${escapeHtml(record.uncertainty.level)}</dd></div>
    </dl>
    <section class="model-training-record-section" aria-labelledby="training-record-publications">
      <h4 id="training-record-publications">Publications</h4>
      <ul class="model-training-record-publications">${publications}</ul>
    </section>
    <div class="model-training-record-columns">
      <section class="model-training-record-section" aria-labelledby="training-record-parameters">
        <h4 id="training-record-parameters">Parameter categories</h4>
        <ul>${categories}</ul>
      </section>
      <section class="model-training-record-section" aria-labelledby="training-record-capabilities">
        <h4 id="training-record-capabilities">Capabilities</h4>
        <ul>${capabilities}</ul>
      </section>
    </div>
    <dl class="model-training-record-counts" aria-label="Observation counts">
      <div><dt>Train</dt><dd>${escapeHtml(record.observationCounts.train)}</dd></div>
      <div><dt>Holdout</dt><dd>${escapeHtml(record.observationCounts.holdout)}</dd></div>
      <div><dt>Context only</dt><dd>${escapeHtml(record.observationCounts.contextOnly)}</dd></div>
    </dl>
    <div class="model-training-record-boundary">
      <p><strong>Applicability:</strong> ${escapeHtml(record.applicability.summary)}</p>
      <p><strong>High uncertainty:</strong> ${escapeHtml(record.uncertainty.summary)}</p>
      <p><strong>Research and education only.</strong> Candidate rejected; the active model was not changed.</p>
    </div>`;
}

export function initPublicTrainingRecord() {
  const container = document.getElementById("model-training-record-content");
  if (!container) return;
  container.innerHTML = renderPublicTrainingRecord(PUBLIC_TRAINING_RECORD);
}

function isApprovedDoiUrl(publication) {
  return typeof publication.doi === "string"
    && /^10\.\d{4,9}\/[A-Za-z0-9._;()/:+-]+$/.test(publication.doi)
    && publication.doiUrl === `https://doi.org/${publication.doi}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
