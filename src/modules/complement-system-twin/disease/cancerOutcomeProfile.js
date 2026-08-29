export function calculateCancerMicroenvironmentImpacts(values = {}, options = {}) {
  const c5a = signal(values.C5a) * (1 - clamp(options.c5aRInhibition, 0, 100) / 100);
  const c3a = signal(values.C3a);
  const mac = signal(values.MAC);
  const amplification = average(signal(values.C3b), signal(values.C3bBb));
  const immuneSuppression = weighted([c5a, 0.48], [c3a, 0.16], [amplification, 0.20], [mac, 0.16]);
  const dcMigration = weighted([c5a, 0.62], [c3a, 0.12], [amplification, 0.26]);
  const lymphNode = weighted([dcMigration, 0.58], [immuneSuppression, 0.42]);
  const antitumorResponse = clamp(100 - weighted([immuneSuppression, 0.65], [dcMigration, 0.35]));

  return [
    impact("tumor-immune", "Tumor Immune Microenvironment", Math.max(immuneSuppression, dcMigration), "C5aR1-centered immune-modulation signal within the modeled tumor context."),
    impact("dc-migration", "Tolerogenic DC Migration", dcMigration, "C5aR1-associated dendritic-cell migration proxy; not a direct cell count or clinical prediction."),
    impact("lymph-node", "Tumor-draining Lymph Node Signal", lymphNode, "Association proxy for migration toward tumor-draining lymph nodes."),
    impact("immune-suppression", "Immune Suppression Signal", immuneSuppression, "Complement-linked tolerogenic signaling proxy in the tumor microenvironment."),
    impact("antitumor-response", "Antitumor Immune Response", antitumorResponse, "Protective inverse-pathway proxy showing modeled preservation of antitumor immune activity.", true, true),
    impact("tumor-vascular", "Tumor Vascular Association", weighted([c5a, 0.42], [mac, 0.24], [amplification, 0.34]), "Secondary tumor vascular association signal, not systemic vascular damage.", true)
  ].sort((a, b) => Number(a.secondary) - Number(b.secondary) || b.score - a.score);
}

function impact(id, name, score, description, secondary = false, protective = false) {
  return { id, name, score: Math.round(clamp(score)), description, secondary, protective };
}

function weighted(...pairs) {
  return pairs.reduce((sum, [value, weight]) => sum + signal(value) * weight, 0);
}

function average(...values) {
  return values.length ? values.reduce((sum, value) => sum + signal(value), 0) / values.length : 0;
}

function signal(value) {
  return clamp(Number(value) || 0);
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}
