import { diseaseDynamicsProfiles } from "./diseaseDynamicsProfiles.js";

const seriesMeta = [
  ["C3", "C3", "nM", "#4aa3ff", "c3-system"],
  ["C3a", "C3a", "relative nM", "#6ee7ff", "c3-system"],
  ["C3b", "C3b", "relative nM", "#8a7dff", "c3-system"],
  ["FactorB", "Factor B", "nM", "#5be0a6", "convertases"],
  ["FactorD", "Factor D", "nM", "#b5e853", "convertases"],
  ["C3bBb", "C3bBb", "relative nM", "#f6c85f", "convertases"],
  ["FactorH", "Factor H", "nM", "#ffbe76", "regulators"],
  ["FactorI", "Factor I", "nM", "#ff9f7a", "regulators"],
  ["C5", "C5", "nM", "#ff7ab6", "c5-system"],
  ["C5a", "C5a", "relative nM", "#ff5d6c", "c5-system"],
  ["C5b", "C5b", "relative nM", "#c778ff", "c5-system"],
  ["MAC", "MAC", "relative nM", "#ffffff", "terminal"],
  ["CD59", "CD59", "relative level", "#9fb4ff", "regulators"],
  ["RetinalComplementActivityProxy", "Retinal Complement Activity Proxy", "relative score", "#38bdf8", "amd-retina"],
  ["RPEStressProxy", "RPE Stress Proxy", "relative score", "#f97316", "amd-retina"],
  ["DrusenRiskProxy", "Drusen Formation Risk Proxy", "relative score", "#facc15", "amd-retina"]
];

export function getDynamicsSeriesMeta() {
  return seriesMeta.map(([entityId, name, unit, color, group]) => ({ entityId, name, symbol: name, unit, color, group }));
}

export function runDynamicsSimulation(input) {
  const profile = diseaseDynamicsProfiles[input.diseaseContext] ?? diseaseDynamicsProfiles.normal;
  const duration = Math.max(Number(input.duration) || 60, 0.01);
  const dt = Math.min(Math.max(Number(input.timeStep) || 1, 0.01), duration);
  const steps = Math.ceil(duration / dt);
  const c = {
    C3: input.initialConcentrations.C3,
    C3a: 0,
    C3b: 0,
    FactorB: input.initialConcentrations.FactorB,
    FactorD: input.initialConcentrations.FactorD,
    C3bBb: 0,
    FactorH: input.initialConcentrations.FactorH,
    FactorI: input.initialConcentrations.FactorI,
    C5: input.initialConcentrations.C5,
    C5a: 0,
    C5b: 0,
    MAC: 0,
    CD59: input.initialConcentrations.CD59
  };

  const cd55 = input.initialConcentrations.CD55;
  const rows = [];
  const events = [
    event(0, "C3 cleavage starts", "Classical, lectin, and tick-over activity begin generating C3a/C3b."),
    event(Math.min(duration, duration * 0.18), "Alternative amplification starts", "C3b, Factor B, and Factor D form C3bBb and amplify C3 activation."),
    event(Math.min(duration, duration * 0.30), "C5 activation starts", "C3/C5 convertase activity begins producing C5a and C5b."),
    event(Math.min(duration, duration * 0.42), "MAC formation begins", "C5b supports terminal pathway assembly into MAC.")
  ];
  if (hasIntervention(input)) {
    events.push(event(input.interventionTime, "Drug intervention applied", "Configured inhibition values are applied after this time point."));
  }

  for (let i = 0; i <= steps; i += 1) {
    const time = Number(Math.min(duration, i * dt).toFixed(4));
    rows.push({ time, concentrations: { ...c } });
    if (i === steps) break;
    const stepDt = Math.min(dt, duration - time);

    const activeIntervention = time >= input.interventionTime;
    const inhibitors = activeIntervention ? input.interventions : emptyIntervention();
    const c3Remaining = remaining(inhibitors.c3Inhibitor);
    const factorBRemaining = remaining(inhibitors.factorBInhibitor);
    const factorDRemaining = remaining(inhibitors.factorDInhibitor);
    const c5Remaining = remaining(inhibitors.c5Inhibitor);

    const classicalDrive = input.pathwayActivity.classical / 100 * profile.classicalMultiplier * 0.018;
    const lectinDrive = input.pathwayActivity.lectin / 100 * profile.lectinMultiplier * 0.014;
    const alternativeDrive = input.pathwayActivity.alternative / 100 * profile.alternativeMultiplier * 0.020;
    const amplificationDrive = (c.C3bBb / 120) * profile.c3bBbPersistence * 0.060;

    // V1 simplified kinetic rule: C3 cleavage is driven by initiation pathways
    // plus alternative amplification. Replace this block with QSP/ODE rates later.
    const c3CleavageRate = Math.min(
      c.C3 * 0.035,
      c.C3 * (classicalDrive + lectinDrive + alternativeDrive + amplificationDrive) * c3Remaining
    );
    c.C3 -= c3CleavageRate * stepDt;
    c.C3a += c3CleavageRate * stepDt * 0.50;
    c.C3b += c3CleavageRate * stepDt * 0.50;

    // C3b + Factor B + Factor D -> C3bBb. Factor D is catalytic, so it is
    // consumed only minimally to create visible but small dynamics.
    const convertaseFormation = Math.min(
      c.C3b * 0.20,
      c.C3b * (c.FactorB / 2200) * (c.FactorD / 83) * 0.026 * factorBRemaining * factorDRemaining * profile.c3bBbPersistence
    );
    c.FactorB -= convertaseFormation * stepDt * 0.55;
    c.FactorD -= convertaseFormation * stepDt * 0.015;
    c.C3bBb += convertaseFormation * stepDt;

    // Factor H / Factor I regulation reduces C3b and destabilizes C3bBb.
    const regulationStrength = (c.FactorH / 3200) * (c.FactorI / 400) * profile.regulationMultiplier;
    const c3bRegulation = Math.min(c.C3b, c.C3b * regulationStrength * 0.032);
    c.C3b -= c3bRegulation * stepDt;
    c.C3bBb -= Math.min(c.C3bBb, c.C3bBb * (0.012 + regulationStrength * 0.026) * stepDt);

    // C5 cleavage is downstream of C3bBb/C5 convertase and terminal activity.
    const terminalDrive = input.pathwayActivity.terminal / 100 * profile.terminalMultiplier;
    const c5Cleavage = Math.min(
      c.C5 * 0.055,
      c.C3bBb * (c.C5 / 500) * terminalDrive * 0.050 * c5Remaining
    );
    c.C5 -= c5Cleavage * stepDt;
    c.C5a += c5Cleavage * stepDt * 0.50 * profile.c5aMultiplier;
    c.C5b += c5Cleavage * stepDt * 0.50;

    const cd55Modifier = 1 + Math.max(0, 80 - cd55) / 130;
    const cd59Level = Math.max(1, c.CD59 * (activeIntervention ? input.interventions.cd59Modifier / 100 : 1));
    const cd59Suppression = Math.max(0.12, Math.min(1.6, 100 / cd59Level));
    const macFormation = Math.min(c.C5b, c.C5b * terminalDrive * cd55Modifier * cd59Suppression * profile.macMultiplier * 0.040);
    c.C5b -= macFormation * stepDt;
    c.MAC += macFormation * stepDt;

    Object.keys(c).forEach((key) => {
      c[key] = Math.max(0, Number.isFinite(c[key]) ? c[key] : 0);
    });
  }

  const amdSpecificOutputs = input.diseaseContext === "AMD" ? buildAmdSpecificOutputs(rows, profile) : null;
  const activeSeriesMeta = input.diseaseContext === "AMD"
    ? seriesMeta
    : seriesMeta.filter(([entityId]) => !entityId.endsWith("Proxy"));

  const series = activeSeriesMeta.map(([entityId, name, unit, colorKey, group]) => ({
    entityId,
    name,
    symbol: name,
    unit,
    colorKey,
    group,
    data: rows.map((row) => ({ time: row.time, value: row.concentrations[entityId] ?? 0 }))
  }));

  return {
    timePoints: rows,
    series,
    events: events.sort((a, b) => a.time - b.time),
    amdSpecificOutputs,
    summary: `${profile.label} dynamics simulated with simplified Euler integration.`
  };
}

function buildAmdSpecificOutputs(rows, profile) {
  // Future integration point: replace these transparent proxy formulas with
  // calibrated retinal imaging, complement biomarker, genetic, and clinical
  // progression data when validated datasets are available.
  const modifiers = profile.diseaseModifiers ?? {};
  const finalRow = rows[rows.length - 1]?.concentrations ?? {};
  const peaks = {};
  ["C3a", "C3b", "C3bBb", "C5a", "MAC"].forEach((key) => {
    peaks[key] = Math.max(...rows.map((row) => row.concentrations[key] ?? 0), 0);
  });
  const regulationLoss = clamp01(1 - average(normalize(finalRow.FactorH, 3200), normalize(finalRow.FactorI, 400), normalize(finalRow.CD59, 85)));
  const retinalSensitivity = modifiers.retinalTissueSensitivityMultiplier ?? 1;
  const macLocalRisk = modifiers.macFormationLocalRiskMultiplier ?? 1;
  const chronicInflammation = modifiers.chronicInflammationMultiplier ?? 1;
  const retinalComplementActivityScore = score(
    average(
      normalize(peaks.C3a, 3000),
      normalize(peaks.C3b, 1500),
      normalize(peaks.C3bBb, 750),
      normalize(peaks.C5a, 320),
      normalize(peaks.MAC, 280) * macLocalRisk
    ) * retinalSensitivity * 0.68
  );
  const drusenFormationRiskProxy = score(average(normalize(peaks.C3b, 1500), normalize(peaks.C3bBb, 750), regulationLoss) * retinalSensitivity * 0.72);
  const RPEStressScore = score(average(normalize(peaks.MAC, 280) * macLocalRisk, normalize(peaks.C5a, 320), regulationLoss) * retinalSensitivity * 0.72);
  const choroidalInflammationScore = score(average(normalize(peaks.C5a, 320), normalize(peaks.C3a, 3000)) * chronicInflammation * 0.78);
  const geographicAtrophyProgressionProxy = score(average(RPEStressScore / 100, drusenFormationRiskProxy / 100, normalize(peaks.MAC, 280) * macLocalRisk));
  const neovascularSignalProxy = score(average(choroidalInflammationScore / 100, normalize(peaks.C5a, 320), normalize(peaks.MAC, 280)));
  const systemicInflammationAssociationScore = score(average(normalize(peaks.C3a, 3000), normalize(peaks.C5a, 320)) * 0.72);
  const kidneyComplementAssociationScore = score(average(normalize(peaks.C3bBb, 750), normalize(peaks.C3b, 1500), regulationLoss) * 0.52);
  const neuroinflammationAssociationScore = score(average(normalize(peaks.C3a, 3000), normalize(peaks.C5a, 320), regulationLoss) * 0.45);

  rows.forEach((row) => {
    const c = row.concentrations;
    const rowRegulationLoss = clamp01(1 - average(normalize(c.FactorH, 3200), normalize(c.FactorI, 400), normalize(c.CD59, 85)));
    c.RetinalComplementActivityProxy = score(average(normalize(c.C3a, 3000), normalize(c.C3b, 1500), normalize(c.C3bBb, 750), normalize(c.C5a, 320), normalize(c.MAC, 280) * macLocalRisk) * retinalSensitivity * 0.68);
    c.RPEStressProxy = score(average(normalize(c.MAC, 280) * macLocalRisk, normalize(c.C5a, 320), rowRegulationLoss) * retinalSensitivity * 0.72);
    c.DrusenRiskProxy = score(average(normalize(c.C3b, 1500), normalize(c.C3bBb, 750), rowRegulationLoss) * retinalSensitivity * 0.72);
  });

  return {
    retinalComplementActivityScore,
    drusenFormationRiskProxy,
    RPEStressScore,
    choroidalInflammationScore,
    geographicAtrophyProgressionProxy,
    neovascularSignalProxy,
    systemicInflammationAssociationScore,
    kidneyComplementAssociationScore,
    neuroinflammationAssociationScore
  };
}

function normalize(value, reference) {
  return Math.max(0, Math.min(1.6, (Number(value) || 0) / reference));
}

function average(...values) {
  const clean = values.filter((value) => Number.isFinite(value));
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0;
}

function score(value) {
  return Math.round(Math.max(0, Math.min(100, value * 100)));
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function remaining(percent) {
  return 1 - Math.max(0, Math.min(100, Number(percent) || 0)) / 100;
}

function emptyIntervention() {
  return { c3Inhibitor: 0, factorBInhibitor: 0, factorDInhibitor: 0, c5Inhibitor: 0, c5aRInhibitor: 0, cd59Modifier: 100 };
}

function hasIntervention(input) {
  return Object.entries(input.interventions).some(([key, value]) => key === "cd59Modifier" ? Number(value) !== 100 : Number(value) > 0);
}

function event(time, label, description) {
  return { time: Math.max(0, Number(time) || 0), label, description };
}
