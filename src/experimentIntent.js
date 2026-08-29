const DISEASE_RULES = [
  ["AMD", /\b(?:amd|age[- ]related macular degeneration|macular degeneration)\b/i],
  ["PNH", /\b(?:pnh|paroxysmal nocturnal hemoglobinuria)\b/i],
  ["aHUS", /\b(?:ahus|atypical hemolytic uremic syndrome)\b/i],
  ["C3G", /\b(?:c3g|c3 glomerulopathy|dense deposit disease)\b/i],
  ["sepsis", /\b(?:sepsis|septic|systemic infection)\b/i],
  ["normal", /\b(?:normal|healthy|physiologic|baseline|control)\b/i]
];

const FOCUS_RULES = [
  ["C3", /\bc3(?:a|b|d)?\b/i],
  ["C5", /\bc5(?:a|b)?\b/i],
  ["MAC", /\b(?:mac|c5b[- ]?9|membrane attack complex)\b/i],
  ["Factor B", /\b(?:factor b|cfb)\b/i],
  ["Factor D", /\b(?:factor d|cfd)\b/i],
  ["Factor H", /\b(?:factor h|cfh)\b/i],
  ["RPE", /\b(?:rpe|retinal pigment epithelium)\b/i],
  ["Retina", /\b(?:retina|retinal|macula|macular)\b/i],
  ["Kidney", /\b(?:kidney|renal|glomerul)\w*\b/i],
  ["RBC", /\b(?:rbc|red blood cell|erythrocyte|hemolysis)\w*\b/i]
];

const INTERVENTION_RULES = [
  ["factorDInhibitor", /\b(?:factor d|cfd)[- ]?(?:inhibit|block)|(?:inhibit|block)\w*\s+(?:factor d|cfd)\b/i],
  ["factorBInhibitor", /\b(?:factor b|cfb)[- ]?(?:inhibit|block)|(?:inhibit|block)\w*\s+(?:factor b|cfb)\b/i],
  ["c3Inhibitor", /\bc3[- ]?(?:inhibit|block)|(?:inhibit|block)\w*\s+c3\b/i],
  ["c5aRInhibitor", /\b(?:c5ar|c5a receptor)[- ]?(?:inhibit|block)|(?:inhibit|block)\w*\s+(?:c5ar|c5a receptor)\b/i],
  ["c5Inhibitor", /\bc5[- ]?(?:inhibit|block)|(?:inhibit|block)\w*\s+c5\b|\b(?:eculizumab|ravulizumab)\b/i],
  ["cd59Modifier", /\bcd59\b/i]
];

const SENSITIVE_OR_CLINICAL = /\b(?:patient|medical record|diagnos(?:e|is)|mrn|date of birth|social security|clinical decision|prescri(?:be|ption))\b/i;

function firstMatch(text, rules, fallback = "unknown") {
  return rules.find(([, pattern]) => pattern.test(text))?.[0] ?? fallback;
}

function allMatches(text, rules) {
  return rules.filter(([, pattern]) => pattern.test(text)).map(([value]) => value);
}

function detectTimeScale(text, diseaseContext) {
  if (diseaseContext === "normal" && /\b(?:baseline|control|normal|healthy)\b/i.test(text)) return "baseline";
  if (/\b(?:month|months|year|years|chronic|long[- ]term|progression)\b/i.test(text)) return "chronic_months";
  if (/\b(?:minute|minutes|hour|hours|acute|rapid|immediate)\b/i.test(text)) return "acute_hours";
  if (diseaseContext === "AMD") return "chronic_months";
  return "unknown";
}

function detectDuration(text) {
  const match = text.match(/\b(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?|days?|weeks?|months?|years?)\b/i);
  if (!match) return null;
  return { value: Number(match[1]), unit: match[2].toLowerCase() };
}

export function parseExperimentIntent(text = "", options = {}) {
  const normalized = String(text).trim();
  const diseaseContext = options.diseaseContext || firstMatch(normalized, DISEASE_RULES);
  const focus = [...new Set([...(options.focus || []), ...allMatches(normalized, FOCUS_RULES)])];
  const intervention = [...new Set([...(options.intervention || []), ...allMatches(normalized, INTERVENTION_RULES)])];
  const timeScale = options.timeScale || detectTimeScale(normalized, diseaseContext);
  const requestedComparison = /\b(?:compare|comparison|versus|vs\.?|treated and untreated|control arm)\b/i.test(normalized);
  const duration = detectDuration(normalized);
  const assumptions = [];
  const missingInformation = [];
  const safetyNotes = ["Research and education use only; outputs are mechanistic proxies, not diagnosis."];

  if (diseaseContext === "unknown") missingInformation.push("Specify a disease context or normal baseline.");
  if (timeScale === "unknown") missingInformation.push("Specify an acute or chronic simulation time scale.");
  if (diseaseContext === "AMD" && !duration) assumptions.push("AMD uses a retina-centered chronic progression scale measured in months.");
  if (diseaseContext === "normal") assumptions.push("Normal baseline remains physiologic and does not introduce an acute reaction event.");
  if (!intervention.length) assumptions.push("No pharmacologic complement intervention is applied.");
  if (!focus.length) assumptions.push("The complete modeled complement panel remains visible.");
  if (SENSITIVE_OR_CLINICAL.test(normalized)) {
    safetyNotes.push("Do not enter patient identifiers, medical records, diagnostic requests, or treatment decisions.");
  }

  const hasSafetyBlock = safetyNotes.length > 1;
  const confidence = hasSafetyBlock || missingInformation.length > 1
    ? "low"
    : missingInformation.length || !focus.length
      ? "medium"
      : "high";

  return {
    diseaseContext,
    focus,
    intervention,
    timeScale,
    requestedComparison,
    assumptions,
    missingInformation,
    confidence,
    safetyNotes,
    duration,
    canRun: !hasSafetyBlock && missingInformation.length === 0
  };
}
