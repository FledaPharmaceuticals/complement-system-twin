const MINUTES_PER_UNIT = {
  minute: 1,
  minutes: 1,
  min: 1,
  mins: 1,
  hour: 60,
  hours: 60,
  hr: 60,
  hrs: 60,
  day: 1440,
  days: 1440,
  week: 10080,
  weeks: 10080
};

const MONTHS_PER_UNIT = {
  month: 1,
  months: 1,
  year: 12,
  years: 12
};

export function normalizeExperimentDuration(duration, timeScale) {
  if (!duration || !Number.isFinite(duration.value) || duration.value <= 0) return null;
  const unit = String(duration.unit || "").toLowerCase();
  if (timeScale === "chronic_months") {
    const multiplier = MONTHS_PER_UNIT[unit];
    if (!multiplier) return null;
    const normalized = duration.value * multiplier;
    return normalized >= 0.01 ? { duration: normalized, unit: "months" } : null;
  }
  const multiplier = MINUTES_PER_UNIT[unit];
  if (!multiplier) return null;
  const normalized = duration.value * multiplier;
  return normalized >= 0.01 ? { duration: normalized, unit: "min" } : null;
}

export function formatSimulationTime(time, unit) {
  const value = Math.round(Number(time) * 100) / 100;
  const display = Number.isInteger(value) ? value.toFixed(0) : String(value);
  if (unit === "months") return `${display} ${value === 1 ? "month" : "months"}`;
  return `${display} min`;
}

export function resolveResearchHeartRate({ diseaseContext, experimentText = "", vascularImpact = 0, inflammation = 0 }) {
  const text = String(experimentText);
  if (diseaseContext === "normal") return 72;
  const stress = Math.max(Number(vascularImpact) || 0, Number(inflammation) || 0);
  if (/\b(?:bradycardia|slow heart rate)\b/i.test(text)) return Math.round(clamp(64 - stress * 0.12, 42, 64));
  const hasPositiveDriver = /\b(?:sepsis|septic|systemic infection|fever|febrile|anemia|anaemia|hemoglobin|hypotension|shock|tachycardia|arrhythmia|cardiac stress)\b/i.test(text);
  if (!hasPositiveDriver) return 72;
  return Math.round(clamp(72 + stress * 0.22, 58, 112));
}

export function buildEndpointComparison({ untreated = {}, treated = {} }) {
  const signals = Object.keys(untreated).filter((signal) => Number.isFinite(untreated[signal]) && Number.isFinite(treated[signal]));
  return signals.map((signal) => ({
    signal,
    untreated: round(untreated[signal]),
    treated: round(treated[signal]),
    delta: round(treated[signal] - untreated[signal])
  }));
}

export function prepareEndpointComparisonInputs({ untreated = {}, treated = {}, targets = [], strength = 0 }) {
  const untreatedCopy = { ...untreated };
  const treatedCopy = { ...treated };
  if (targets.includes("c5aRInhibitor")) {
    const untreatedLigand = Number(untreatedCopy.C5a) || 0;
    const treatedLigand = Number(treatedCopy.C5a) || 0;
    delete untreatedCopy.C5a;
    delete treatedCopy.C5a;
    untreatedCopy["C5aR signaling"] = untreatedLigand;
    treatedCopy["C5aR signaling"] = treatedLigand * (1 - clamp(strength, 0, 100) / 100);
  }
  return { untreated: untreatedCopy, treated: treatedCopy };
}

export function summarizeOrganImpact(diseaseContext, impacts = []) {
  if (diseaseContext === "normal") {
    return "All modeled organ signals remain within the physiologic reference range. No dominant disease impact is assigned.";
  }
  const dominant = impacts[0];
  return dominant ? `Dominant modeled signal: ${dominant.name}.` : "No organ-impact signal is available.";
}

function round(value) {
  return Math.round(Number(value) * 10) / 10;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}
