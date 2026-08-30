function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const STATUS_LABELS = {
  candidate: "Dry-run candidate",
  testing: "Testing",
  active: "Active",
  rejected: "Rejected",
  rolled_back: "Rolled back"
};

function statusLabel(status) {
  return STATUS_LABELS[status] ?? "Unknown";
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "Not reported";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}%`;
}

function parameterSummary(parameter = {}) {
  const direction = parameter.direction === "unchanged" ? "No change" : `${parameter.direction || "Unknown"} direction`;
  if (Number.isFinite(parameter.normalizedDeltaPercent)) {
    return `${direction} · ${formatPercent(parameter.normalizedDeltaPercent)} normalized change`;
  }
  if (parameter.disclosureLevel === "public_exact" && Number.isFinite(parameter.oldValue) && Number.isFinite(parameter.newValue)) {
    return `${direction} · ${parameter.oldValue} to ${parameter.newValue} ${parameter.unit || ""}`.trim();
  }
  return direction;
}

export function renderLedgerList(entries = [], selectedEntryId = "") {
  if (!entries.length) return '<p class="model-ledger-empty">No ledger entries match the selected filters.</p>';

  return entries.map((entry) => {
    const selected = entry.entryId === selectedEntryId;
    return `
      <button class="model-ledger-entry model-ledger-entry--${escapeHtml(entry.status)}${selected ? " is-selected" : ""}" type="button" data-ledger-entry-id="${escapeHtml(entry.entryId)}" aria-pressed="${selected}">
        <span class="model-ledger-entry-topline">
          <strong>${escapeHtml(entry.version)}</strong>
          <em>${escapeHtml(statusLabel(entry.status))}</em>
        </span>
        <span>${escapeHtml(entry.context?.disease)} · ${escapeHtml(entry.context?.pathway)}</span>
        <small>${escapeHtml(entry.parameter?.label)} · ${escapeHtml(parameterSummary(entry.parameter))}</small>
        ${entry.synthetic ? '<b class="model-ledger-synthetic">Synthetic demonstration record</b>' : ""}
      </button>`;
  }).join("");
}

export function renderLedgerDetail(entry) {
  if (!entry) return '<div class="model-ledger-detail-empty">Select a ledger entry to inspect its evidence and release decision.</div>';
  const publications = entry.evidence?.publications ?? [];
  const evidenceRows = publications.length
    ? publications.map((publication) => `
        <li>
          <strong>${escapeHtml(publication.publicationId)}</strong>
          <span>${escapeHtml(publication.reviewStatus || "unreviewed")}</span>
          ${publication.doi ? `<a href="https://doi.org/${encodeURIComponent(publication.doi)}" target="_blank" rel="noopener">DOI</a>` : ""}
          ${publication.pmid ? `<a href="https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(publication.pmid)}/" target="_blank" rel="noopener">PMID</a>` : ""}
        </li>`).join("")
    : '<li><span>No publication evidence was used for this governance-only record.</span></li>';
  const limitations = (entry.limitations ?? []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");

  return `
    <article class="model-ledger-detail-card">
      <header>
        <div>
          <span class="model-ledger-status model-ledger-status--${escapeHtml(entry.status)}">${escapeHtml(statusLabel(entry.status))}</span>
          <h4>${escapeHtml(entry.version)}</h4>
          <p>${escapeHtml(entry.context?.disease)} · ${escapeHtml(entry.context?.tissue)} · ${escapeHtml(entry.context?.pathway)}</p>
        </div>
        ${entry.synthetic ? '<strong class="model-ledger-synthetic">Synthetic demonstration record</strong>' : ""}
      </header>
      <p class="model-ledger-rationale">${escapeHtml(entry.rationale)}</p>
      <div class="model-ledger-facts">
        <span><small>Parameter</small><strong>${escapeHtml(entry.parameter?.label)}</strong><em>${escapeHtml(parameterSummary(entry.parameter))}</em></span>
        <span><small>Evidence</small><strong>${escapeHtml(entry.evidence?.publicationCount)} publications</strong><em>${escapeHtml(entry.evidence?.independentGroupCount)} independent groups</em></span>
        <span><small>Policy ${escapeHtml(entry.policy?.version)}</small><strong>${escapeHtml(entry.policy?.policyId)}</strong><em>${escapeHtml(entry.policy?.releaseRoute)}</em></span>
        <span><small>Rollback</small><strong>${escapeHtml(entry.rollback?.version)}</strong><em>${escapeHtml(entry.rollback?.status)}</em></span>
      </div>
      <div class="model-ledger-metrics" aria-label="Validation metrics">
        <span><small>Training improvement</small><strong>${escapeHtml(formatPercent(entry.validation?.trainingImprovementPercent))}</strong></span>
        <span><small>Holdout improvement</small><strong>${escapeHtml(formatPercent(entry.validation?.holdoutImprovementPercent))}</strong></span>
        <span><small>Maximum sentinel degradation</small><strong>${escapeHtml(formatPercent(entry.validation?.sentinelDegradationMaximumPercent))}</strong></span>
        <span><small>Uncertainty</small><strong>${escapeHtml(entry.validation?.uncertainty)}</strong></span>
      </div>
      <div class="model-ledger-detail-columns">
        <section><h5>Evidence record</h5><ul class="model-ledger-evidence">${evidenceRows}</ul></section>
        <section><h5>Limitations</h5><ul>${limitations}</ul></section>
      </div>
      <footer>
        <span>Read-only scientific comments: ${escapeHtml(entry.comments?.count ?? 0)}</span>
        <p>Scientific comments become available with the independent Fleda Research Workspace.</p>
      </footer>
    </article>`;
}
