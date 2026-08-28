import test from "node:test";
import assert from "node:assert/strict";

import {
  MODEL_VERSION,
  createEvidenceRecord,
  createSimulationContext,
  createSimulationRun,
  validateEvidenceRecord
} from "../src/modelContract.js";

test("creates a simulation context with explicit disease, signals, intervention, and provenance", () => {
  const context = createSimulationContext({
    diseaseContext: "AMD",
    complementDynamics: { c3Activation: 72, c3bDeposition: 68, macActivity: 34 },
    intervention: { drugId: "factor-b-inhibition", startMinute: 60, intensity: 40 },
    evidenceIds: ["pmid:00000001"]
  });

  assert.deepEqual(context, {
    diseaseContext: "AMD",
    complementDynamics: { c3Activation: 72, c3bDeposition: 68, macActivity: 34 },
    intervention: { drugId: "factor-b-inhibition", startMinute: 60, intensity: 40 },
    evidenceIds: ["pmid:00000001"]
  });
});

test("creates auditable evidence records with uncertainty and source metadata", () => {
  const record = createEvidenceRecord({
    id: "pmid:00000001",
    title: "Complement regulation in AMD",
    sourceType: "publication",
    sourceLocator: "https://pubmed.ncbi.nlm.nih.gov/1/",
    evidenceLevel: "mechanistic",
    extractedClaim: "Alternative pathway regulation is relevant to retinal biology.",
    uncertainty: "moderate",
    linkedEntities: ["AMD", "Factor H"],
    parameterPriors: { retinalTissueSensitivityMultiplier: { min: 1.2, max: 1.8 } }
  });

  assert.equal(validateEvidenceRecord(record), true);
  assert.equal(record.modelVersion, MODEL_VERSION);
  assert.equal(record.sourceLocator, "https://pubmed.ncbi.nlm.nih.gov/1/");
  assert.equal(record.uncertainty, "moderate");
});

test("rejects evidence records without source or uncertainty fields", () => {
  assert.equal(validateEvidenceRecord({ id: "missing-source" }), false);
});

test("creates a versioned simulation run without implying clinical validation", () => {
  const run = createSimulationRun({
    context: createSimulationContext({ diseaseContext: "AMD" }),
    outputs: { diseaseActivityProxy: 54 },
    status: "research_proxy"
  });

  assert.equal(run.modelVersion, MODEL_VERSION);
  assert.equal(run.status, "research_proxy");
  assert.equal(run.outputs.diseaseActivityProxy, 54);
  assert.equal(run.isClinicalPrediction, false);
});
