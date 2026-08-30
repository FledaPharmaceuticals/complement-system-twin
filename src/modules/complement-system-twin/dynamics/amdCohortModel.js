const cohortBiomarkers = [
  marker("C3", "C3", 100, [95, 105], "#4aa3ff", "Total plasma substrate; generally stable in cohort comparisons."),
  marker("C3aC3", "C3a/C3", 114, [100, 130], "#6ee7ff", "Acute activation ratio; interpreted as a cohort distribution, not accumulation."),
  marker("C3dC3", "C3d/C3", 125, [110, 140], "#8a7dff", "Chronic C3 turnover marker with modest elevation reported in AMD cohorts."),
  marker("BaBb", "Ba/Bb", 125, [110, 140], "#f6c85f", "Alternative-pathway activation products; cohort-level signal."),
  marker("C5aC5", "C5a/C5", 110, [98, 124], "#ff5d6c", "Terminal inflammatory signaling ratio with substantial between-person variability."),
  marker("sC5b9", "sC5b-9", 110, [98, 125], "#ffffff", "Soluble terminal complement complex; not membrane-bound MAC."),
  marker("FactorD", "Factor D", 112, [100, 125], "#b5e853", "Alternative-pathway regulator with cohort-dependent differences."),
  marker("FactorH", "Factor H", 100, [95, 105], "#ffbe76", "Total plasma Factor H; functional and genetic context is more informative than a forced rise."),
  marker("FactorI", "Factor I", 100, [94, 106], "#ff9f7a", "Total plasma Factor I; no assumed stepwise disease trajectory.")
];

export function runAmdCohortSimulation(input) {
  const duration = Math.max(Number(input.duration) || 24, 0.01);
  const dt = Math.min(Math.max(Number(input.timeStep) || duration / 120, 0.01), duration);
  const times = buildTimes(duration, dt);
  const interventionTime = Number.isFinite(Number(input.interventionTime)) ? Number(input.interventionTime) : duration + 1;
  const series = cohortBiomarkers.map((definition) => buildSeries(definition, times, duration, interventionTime, input.interventions));
  const endpoint = Object.fromEntries(series.map((item) => [item.entityId, item.data.at(-1).value]));
  const outputs = buildAmdLayerOutputs(endpoint, input.interventions);

  return {
    timePoints: times.map((time, index) => ({
      time,
      concentrations: Object.fromEntries(series.map((item) => [item.entityId, item.data[index].value]))
    })),
    series,
    events: buildEvents(duration, interventionTime, input.interventions),
    amdSpecificOutputs: outputs,
    modelFrame: "literature_calibrated_cohort_hypothesis",
    summary: "AMD cohort biomarker differences are shown as uncertainty-bounded hypothesis-support trajectories. This is not an observed individual natural history or a patient prediction."
  };
}

export function getAmdCohortSeriesMeta() {
  return cohortBiomarkers.map((definition) => ({
    entityId: definition.entityId,
    name: definition.name,
    symbol: definition.name,
    unit: "control cohort index",
    color: definition.color,
    group: "amd-plasma"
  }));
}

function buildSeries(definition, times, duration, interventionTime, interventions = {}) {
  const effect = interventionEffect(definition.entityId, interventions);
  const data = times.map((time) => {
    const diseaseProgress = smoothstep(time / duration);
    const treatmentProgress = time <= interventionTime
      ? 0
      : smoothstep((time - interventionTime) / Math.max(duration - interventionTime, duration * 0.15));
    const untreatedValue = 100 + (definition.endpoint - 100) * diseaseProgress;
    const value = untreatedValue + (100 - untreatedValue) * effect * treatmentProgress;
    const lowerEndpoint = definition.interval[0] + (100 - definition.interval[0]) * effect * treatmentProgress;
    const upperEndpoint = definition.interval[1] + (100 - definition.interval[1]) * effect * treatmentProgress;
    const lower = 100 + (lowerEndpoint - 100) * diseaseProgress;
    const upper = 100 + (upperEndpoint - 100) * diseaseProgress;
    return {
      time,
      value: round(value),
      lower: round(Math.min(lower, value - 0.5)),
      upper: round(Math.max(upper, value + 0.5))
    };
  });
  return {
    entityId: definition.entityId,
    name: definition.name,
    symbol: definition.name,
    unit: "control cohort index",
    colorKey: definition.color,
    group: "amd-plasma",
    interpretation: definition.interpretation,
    data
  };
}

function buildAmdLayerOutputs(endpoint, interventions = {}) {
  const alternativeSignal = average(endpoint.C3dC3, endpoint.BaBb, endpoint.FactorD);
  const inflammatorySignal = average(endpoint.C3aC3, endpoint.C5aC5);
  const terminalSignal = endpoint.sC5b9;
  const regulationSignal = average(200 - endpoint.FactorH, 200 - endpoint.FactorI);
  const localIntervention = Math.max(
    percent(interventions.c3Inhibitor),
    percent(interventions.factorBInhibitor),
    percent(interventions.factorDInhibitor),
    percent(interventions.c5Inhibitor)
  ) / 100;
  const retinalComplementActivityScore = scoreFromIndex(average(alternativeSignal, inflammatorySignal) - localIntervention * 18);
  const RPEStressScore = scoreFromIndex(average(alternativeSignal, terminalSignal, regulationSignal) - localIntervention * 14);
  const choroidalInflammationScore = scoreFromIndex(average(inflammatorySignal, terminalSignal) - localIntervention * 15);
  const drusenFormationRiskProxy = scoreFromIndex(alternativeSignal - localIntervention * 10);
  const geographicAtrophyProgressionProxy = clampScore(average(RPEStressScore, drusenFormationRiskProxy) * 0.78);
  const neovascularSignalProxy = clampScore(choroidalInflammationScore * 0.55);

  return {
    layers: {
      systemicPlasma: {
        measurementContext: "EDTA plasma cohort biomarkers",
        unit: "control cohort index with uncertainty interval",
        markers: cohortBiomarkers.map(({ name }) => name)
      },
      localOcular: {
        measurementContext: "aqueous, vitreous, or ocular tissue",
        unit: "literature-linked local activity proxy",
        markers: ["ocular C3a", "ocular Ba", "C3b/iC3b deposition", "local sC5b-9"]
      },
      retinalStructure: {
        measurementContext: "OCT, fundus imaging, or tissue proxy",
        unit: "structural risk proxy",
        markers: ["drusen burden", "RPE stress", "GA lesion growth", "neovascular signal"]
      }
    },
    evidenceBasis: [
      {
        citation: "Scholl et al. Systemic Complement Activation in Age-Related Macular Degeneration (2008)",
        doi: "10.1371/journal.pone.0002593",
        url: "https://doi.org/10.1371/journal.pone.0002593",
        modelUse: "Modest cohort elevation of Ba and C3d with stable total C3 and Factor H."
      },
      {
        citation: "Schick et al. Local complement activation in aqueous humor in patients with AMD (2017)",
        doi: "10.1038/eye.2016.328",
        url: "https://doi.org/10.1038/eye.2016.328",
        modelUse: "Separation of local ocular activation from plasma biomarkers."
      },
      {
        citation: "Altay et al. Early local activation of complement in aqueous humour of patients with AMD (2019)",
        doi: "10.1038/s41433-019-0501-4",
        url: "https://doi.org/10.1038/s41433-019-0501-4",
        modelUse: "Local C3a and alternative-pathway markers across AMD stages."
      },
      {
        citation: "Wilke and Apte. Complement regulation in the eye (2024)",
        doi: "10.1172/JCI178296",
        url: "https://doi.org/10.1172/JCI178296",
        modelUse: "Retina-centered complement regulation and ocular tissue context."
      }
    ],
    vitalsPolicy: "baseline_unless_independent_driver",
    retinalComplementActivityScore,
    retinaMaculaScore: clampScore(Math.max(retinalComplementActivityScore, RPEStressScore) + 5),
    drusenFormationRiskProxy,
    RPEStressScore,
    choroidalInflammationScore,
    geographicAtrophyProgressionProxy,
    neovascularSignalProxy,
    complementDysregulationScore: clampScore(average(retinalComplementActivityScore, drusenFormationRiskProxy)),
    vascularAssociationScore: clampScore(choroidalInflammationScore * 0.55),
    systemicInflammationAssociationScore: clampScore(scoreFromIndex(inflammatorySignal) * 0.45),
    kidneyComplementAssociationScore: clampScore(scoreFromIndex(alternativeSignal) * 0.22),
    neuroinflammationAssociationScore: clampScore(scoreFromIndex(inflammatorySignal) * 0.24),
    liverComplementProductionBurden: clampScore(Math.abs(endpoint.C3 - 100) * 2)
  };
}

function interventionEffect(entityId, interventions = {}) {
  const c3 = percent(interventions.c3Inhibitor) / 100;
  const factorB = percent(interventions.factorBInhibitor) / 100;
  const factorD = percent(interventions.factorDInhibitor) / 100;
  const c5 = percent(interventions.c5Inhibitor) / 100;
  const weights = {
    C3: c3 * 0.20,
    C3aC3: c3 * 0.78,
    C3dC3: Math.max(c3 * 0.72, factorB * 0.62, factorD * 0.58),
    BaBb: Math.max(factorB * 0.78, factorD * 0.72, c3 * 0.45),
    C5aC5: Math.max(c5 * 0.86, c3 * 0.55),
    sC5b9: Math.max(c5 * 0.84, c3 * 0.50),
    FactorD: factorD * 0.18,
    FactorH: 0,
    FactorI: 0
  };
  return Math.min(0.9, weights[entityId] ?? 0);
}

function buildEvents(duration, interventionTime, interventions = {}) {
  const events = [{
    time: 0,
    label: "Control-cohort reference",
    description: "Index 100 represents the comparator cohort, not an individual baseline concentration."
  }, {
    time: duration,
    label: "AMD-cohort hypothesis state",
    description: "Endpoints summarize literature-informed group differences with uncertainty; interpolation is not observed natural history."
  }];
  if (Object.entries(interventions).some(([key, value]) => key !== "cd59Modifier" && percent(value) > 0)) {
    events.push({
      time: Math.max(0, interventionTime),
      label: "Modeled intervention",
      description: "The selected target modifies a hypothesis-support trajectory and does not predict treatment response."
    });
  }
  return events.sort((a, b) => a.time - b.time);
}

function marker(entityId, name, endpoint, interval, color, interpretation) {
  return { entityId, name, endpoint, interval, color, interpretation };
}

function buildTimes(duration, dt) {
  const steps = Math.ceil(duration / dt);
  return Array.from({ length: steps + 1 }, (_, index) => round(Math.min(duration, index * dt)));
}

function smoothstep(value) {
  const x = Math.max(0, Math.min(1, Number(value) || 0));
  return x * x * (3 - 2 * x);
}

function scoreFromIndex(index) {
  return clampScore(50 + (Number(index) - 100) * 1.6);
}

function percent(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function average(...values) {
  const clean = values.filter(Number.isFinite);
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0;
}

function clampScore(value) {
  return Math.round(Math.max(0, Math.min(100, Number(value) || 0)));
}

function round(value) {
  return Math.round(Number(value) * 100) / 100;
}
