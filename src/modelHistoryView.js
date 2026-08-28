function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderModelHistory(releases = []) {
  if (!releases.length) {
    return '<p class="model-history-empty">No model releases recorded.</p>';
  }

  return releases.map((release) => `
    <article class="model-release-card model-release-card--${escapeHtml(release.status)}">
      <header>
        <strong>${escapeHtml(release.version)}</strong>
        <span>${escapeHtml(release.status)}</span>
      </header>
      <p>${escapeHtml(release.summary)}</p>
      <small>Released ${escapeHtml(release.releasedAt)} · Formal model change: ${release.formalModelChange ? "yes" : "no"}</small>
      <small>Evidence records: ${release.evidenceIds.length}</small>
    </article>
  `).join("");
}
