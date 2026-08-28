import { runComplementSimulation } from "./simulation.js";
import { createSimulationContext, createSimulationRun } from "./modelContract.js";

const DEFAULT_INPUT = Object.freeze({
  classical: 35,
  lectin: 35,
  alternative: 35,
  terminal: 30,
  factorH: 80,
  factorI: 80,
  cd55: 80,
  cd59: 80,
  diseaseContext: "normal",
  c1sInhibition: 0,
  masp2Inhibition: 0,
  c3Inhibition: 0,
  factorBInhibition: 0,
  factorDInhibition: 0,
  c5Inhibition: 0,
  c5aRInhibition: 0
});

export function simulateVersioned(input = {}, { evidenceIds = [], intervention = null } = {}) {
  const simulationInput = { ...DEFAULT_INPUT, ...input };
  const outputs = runComplementSimulation(simulationInput);
  const context = createSimulationContext({
    diseaseContext: simulationInput.diseaseContext,
    complementDynamics: {
      c3Activation: outputs.c3Activation,
      c3bDeposition: outputs.c3bOpsonization,
      c5aSignal: outputs.c5aSignal,
      macActivity: outputs.macFormation,
      inflammatorySignal: outputs.c5aSignal,
      regulatoryWeakness: 100 - simulationInput.factorH
    },
    intervention,
    evidenceIds
  });

  return createSimulationRun({ context, outputs });
}
