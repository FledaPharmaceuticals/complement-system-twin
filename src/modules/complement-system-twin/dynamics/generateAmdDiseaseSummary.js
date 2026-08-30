const disclaimer = "This AMD model is a research visualization and hypothesis-support tool. It does not diagnose disease, predict individual patient outcomes, or replace ophthalmology evaluation.";

export function generateAmdDiseaseSummary(result) {
  const scores = result?.scores ?? {};
  const targets = result?.selectedTargets ?? [];
  const targetText = targets.length ? describeTargets(targets) : "No drug target is currently selected, so the view shows AMD biology without an active intervention.";
  const retinalScore = Math.round(scores.retinalComplementActivityScore ?? 0);
  const rpeScore = Math.round(scores.RPEStressScore ?? 0);
  const choroidScore = Math.round(scores.choroidalInflammationScore ?? 0);

  return [
    `AMD is modeled as a retina-centered complement-mediated disease context. Cohort-level plasma markers inform alternative-pathway activity, while separate ocular proxies summarize retinal complement activity (${retinalScore}/100), RPE stress (${rpeScore}/100), and choroidal inflammatory signaling (${choroidScore}/100).`,
    "The displayed interpolation is not an individual natural history; total proteins, activation fragments, ocular tissue signals, and retinal imaging proxies remain distinct measurement layers.",
    "Secondary brain, kidney, vascular, and immune findings are displayed as association or risk layers rather than direct deterministic organ damage.",
    targetText,
    disclaimer
  ].join(" ");
}

export function getAmdDisclaimer() {
  return disclaimer;
}

function describeTargets(targets) {
  const descriptions = {
    c3Inhibitor: "C3 inhibition broadly suppresses upstream C3a, C3b, C5a, and MAC signals, which may reduce retinal complement activation but carries broader immune suppression concern.",
    c5Inhibitor: "C5 inhibition reduces downstream C5a and MAC while leaving upstream C3b deposition comparatively active.",
    factorBInhibitor: "Factor B inhibition reduces alternative pathway amplification and may be more pathway-selective than broad C3 inhibition.",
    factorDInhibitor: "Factor D inhibition reduces alternative pathway convertase formation and may lower C3bBb-driven amplification.",
    cd59Modifier: "Complement regulation enhancement is represented as improved terminal pathway restraint and lower local MAC tissue stress."
  };
  return targets.map((target) => descriptions[target]).filter(Boolean).join(" ");
}
