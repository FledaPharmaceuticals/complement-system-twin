export function runComplementSimulation(input) {
  const disease = diseaseModifiers[input.diseaseContext] ?? diseaseModifiers.normal;
  const classical = clamp(input.classical * disease.classicalBoost * pctRemaining(input.c1sInhibition));
  const lectin = clamp(input.lectin * disease.lectinBoost * pctRemaining(input.masp2Inhibition));
  const alternativeBase = input.alternative * disease.alternativeBoost;
  const regulationPenalty = ((100 - input.factorH) * 0.32) + ((100 - input.factorI) * 0.22) + ((100 - input.cd55) * 0.20);
  const amplification = clamp((alternativeBase * 0.72 + regulationPenalty) * pctRemaining(input.factorBInhibition) * pctRemaining(input.factorDInhibition));
  const alternative = clamp(alternativeBase * pctRemaining(input.factorBInhibition) * pctRemaining(input.factorDInhibition));

  // V1 rule formula:
  // C3 activation combines classical, lectin, alternative, and amplification-loop signals.
  // This is intentionally rule-based and designed to be replaced by a QSP/ODE model.
  const c3Activation = clamp((classical * 0.25 + lectin * 0.20 + alternative * 0.35 + amplification * 0.20) * pctRemaining(input.c3Inhibition));
  const c3aSignal = clamp(c3Activation * 0.82 * disease.inflammationBoost);
  const c3bOpsonization = clamp(c3Activation * 0.95 * pctRemaining(input.c3Inhibition * 0.15));

  // C5 activation is downstream of C3 convertase/C5 convertase strength and terminal activity.
  const terminalActivity = input.terminal * disease.terminalBoost;
  const convertaseFactor = clamp((c3Activation * 0.65 + amplification * 0.35), 0, 100) / 100;
  const c5Activation = clamp(terminalActivity * convertaseFactor * pctRemaining(input.c5Inhibition));
  const c5aSignal = clamp(c5Activation * disease.inflammationBoost * pctRemaining(input.c5aRInhibition * 0.82));

  // MAC increases when C5 activation is high and CD59 protection is low.
  const cd59Modifier = 0.55 + ((100 - input.cd59) / 100) * 0.9 + disease.macSensitivity;
  const macFormation = clamp(c5Activation * cd59Modifier);
  const hostCellDamageRisk = clamp(macFormation * 0.62 + (100 - input.cd55) * 0.16 + (100 - input.cd59) * 0.22 + disease.hostDamageBias);

  // Infection risk rises with broad upstream suppression and terminal pathway blockade.
  const pathogenDefenseCompromise = clamp(input.c3Inhibition * 0.52 + input.factorBInhibition * 0.18 + input.factorDInhibition * 0.18 + input.c5Inhibition * 0.18);
  const infectionRisk = clamp(input.c3Inhibition * 0.42 + input.c5Inhibition * 0.32 + input.factorBInhibition * 0.12 + input.factorDInhibition * 0.12 + input.masp2Inhibition * 0.06);

  const diseaseActivityProxy = clamp(
    c3Activation * disease.c3Weight +
    c5aSignal * disease.c5aWeight +
    macFormation * disease.macWeight +
    hostCellDamageRisk * disease.damageWeight
  );

  return {
    c3Activation,
    c3aSignal,
    c3bOpsonization,
    c5Activation,
    c5aSignal,
    macFormation,
    hostCellDamageRisk,
    pathogenDefenseCompromise,
    infectionRisk,
    diseaseActivityProxy,
    dominantDriver: pickDominant({ classical, lectin, alternative, amplification, c5aSignal, macFormation }),
    diseaseLabel: disease.label
  };
}

export const diseaseModifiers = {
  normal: modifier("Normal", 1, 1, 1, 1, 1, 0, 0, .25, .2, .25, .3),
  PNH: modifier("PNH", 1, 1, 1.05, 1.25, 1.05, 0.55, 18, .15, .10, .45, .30),
  aHUS: modifier("aHUS", 1.05, 1, 1.35, 1.1, 1.05, 0.25, 14, .28, .18, .25, .29),
  C3G: modifier("C3 glomerulopathy", .95, .95, 1.55, 1, 1, 0.1, 8, .48, .12, .15, .25),
  "IgA nephropathy": modifier("IgA nephropathy", 1, 1.35, 1.18, 1, 1.05, 0.05, 5, .30, .20, .18, .32),
  AMD: modifier("AMD", .95, 1, 1.35, 1, 1.08, 0.08, 5, .40, .22, .12, .26),
  "lupus nephritis": modifier("Lupus nephritis", 1.55, 1.05, 1.08, 1, 1.12, 0.05, 6, .36, .24, .10, .30),
  "cancer microenvironment": modifier("Cancer microenvironment", 1.1, 1.05, 1.1, 1, 1.35, 0.05, 6, .20, .45, .10, .25),
  sepsis: modifier("Sepsis", 1.25, 1.25, 1.25, 1.2, 1.65, 0.12, 10, .20, .55, .10, .15)
};

function modifier(label, classicalBoost, lectinBoost, alternativeBoost, terminalBoost, inflammationBoost, macSensitivity, hostDamageBias, c3Weight, c5aWeight, macWeight, damageWeight) {
  return { label, classicalBoost, lectinBoost, alternativeBoost, terminalBoost, inflammationBoost, macSensitivity, hostDamageBias, c3Weight, c5aWeight, macWeight, damageWeight };
}

function pctRemaining(value) {
  return 1 - clamp(value) / 100;
}

export function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function pickDominant(scores) {
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

export async function runQspModel(input) {
  return {
    status: "placeholder",
    message: "QSP/ODE adapter reserved for future Python SciPy, SBML, COPASI, Julia, or MATLAB model integration.",
    input
  };
}
