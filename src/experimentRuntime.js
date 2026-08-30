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

export function resolveResearchVitalSigns({
  diseaseContext,
  experimentText = "",
  vascularImpact = 0,
  lungImpact = 0,
  inflammation = 0
}) {
  const baseline = { heartRate: 72, systolic: 120, diastolic: 80, respiratoryRate: 16 };
  if (diseaseContext === "normal") return baseline;

  const text = diseaseContext === "sepsis"
    ? `${String(experimentText)} sepsis`
    : String(experimentText);
  const cardiovascularStress = Math.max(Number(vascularImpact) || 0, Number(inflammation) || 0);
  const respiratoryStress = Math.max(Number(lungImpact) || 0, Number(inflammation) || 0);

  let heartRate = baseline.heartRate;
  if (hasAffirmedTerm(text, ["bradycardia", "slow heart rate"])) {
    heartRate = Math.round(clamp(64 - cardiovascularStress * 0.12, 42, 64));
  } else if (hasAffirmedTerm(text, [
    "sepsis", "septic", "systemic infection", "fever", "febrile", "anemia", "anaemia",
    "low hemoglobin", "hypotension", "shock", "tachycardia", "arrhythmia", "cardiac stress"
  ])) {
    heartRate = Math.round(clamp(72 + cardiovascularStress * 0.22, 58, 112));
  }

  let systolic = baseline.systolic;
  let diastolic = baseline.diastolic;
  if (hasAffirmedTerm(text, ["hypertension", "high blood pressure", "elevated blood pressure"])) {
    systolic = Math.round(clamp(120 + cardiovascularStress * 0.35, 120, 180));
    diastolic = Math.round(clamp(80 + cardiovascularStress * 0.22, 80, 115));
  } else if (hasAffirmedTerm(text, [
    "sepsis", "septic", "systemic infection", "hypotension", "shock", "hemodynamic instability"
  ])) {
    systolic = Math.round(clamp(120 - cardiovascularStress * 0.35, 75, 120));
    diastolic = Math.round(clamp(80 - cardiovascularStress * 0.22, 45, 80));
  }

  let respiratoryRate = baseline.respiratoryRate;
  if (hasAffirmedTerm(text, ["bradypnea", "respiratory depression", "slow breathing"])) {
    respiratoryRate = Math.round(clamp(16 - respiratoryStress * 0.07, 6, 16));
  } else if (hasAffirmedTerm(text, [
    "sepsis", "septic", "systemic infection", "fever", "febrile", "hypoxia", "dyspnea",
    "shortness of breath", "tachypnea", "respiratory distress", "lung injury", "pneumonia"
  ])) {
    respiratoryRate = Math.round(clamp(16 + respiratoryStress * 0.12, 16, 32));
  }

  return { heartRate, systolic, diastolic, respiratoryRate };
}

export function resolveResearchHeartRate(input) {
  return resolveResearchVitalSigns(input).heartRate;
}

export function resolvePlaybackResumeTime({ currentTime = 0, duration = 0 }) {
  const current = Number(currentTime) || 0;
  const end = Number(duration) || 0;
  return current > 0 && current < end ? current : 0;
}

export function resolvePlaybackStartTime({ requestedStart = 0, duration = 0, contextChanged = false }) {
  if (contextChanged) return 0;
  return clamp(requestedStart, 0, Math.max(0, Number(duration) || 0));
}

export function createHeroResetSnapshot() {
  return {
    controls: {
      disease: "normal",
      targets: [],
      strength: 70,
      highlight: "none"
    },
    playback: {
      currentTime: 0,
      activeDuration: null,
      experimentText: "",
      comparisonRows: [],
      biomarkerEstimate: null,
      biomarkerApplied: false,
      amdSpecificOutputs: null,
      mode: "baseline"
    }
  };
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

function hasAffirmedTerm(text, terms) {
  const source = terms
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length)
    .join("|");
  const matcher = new RegExp(`\\b(?:${source})\\b`, "gi");
  for (const match of String(text).matchAll(matcher)) {
    const prefix = String(text).slice(Math.max(0, match.index - 120), match.index);
    const clause = prefix.split(/[.;:]/).at(-1) || "";
    const negations = [...clause.matchAll(/\b(?:no|not|without|denies?|negative for|absence of|free of)\b/gi)];
    const latestNegation = negations.at(-1);
    const negated = latestNegation
      ? !/\b(?:but|however|although|yet|with|has|had|developed|develops|showing|shows|followed by)\b/i.test(clause.slice(latestNegation.index + latestNegation[0].length))
      : false;
    if (!negated) return true;
  }
  return false;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}
