import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { createJcsResultId } from "../src/jcsResultHash.js";
import {
  C3G_LIMITATION_TERMS,
  FORBIDDEN_PUBLIC_FIELDS,
  PUBLIC_SIMULATION_METADATA,
  validatePublicSimulationResponse
} from "../src/serverSimulationContract.js";

const fixture = JSON.parse(await readFile(
  new URL("../fixtures/c3-safe-simulation/normal-response.json", import.meta.url),
  "utf8"
));
const handoff = JSON.parse(await readFile(
  new URL("../contracts/c3-safe-simulation-result-1.0.0.json", import.meta.url),
  "utf8"
));

test("keeps the client disclosure denylist synchronized with the server handoff", () => {
  assert.deepEqual([...FORBIDDEN_PUBLIC_FIELDS], handoff.forbiddenPublicFields);
});

test("accepts the safe fixture only when its hash, shape, and JavaScript result agree", async () => {
  const result = await validatePublicSimulationResponse(fixture, {
    expectedScenarioId: "normal-example",
    javascriptOutputs: fixture.outputs
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.outputs, fixture.outputs);
  assert.equal(result.resultId, fixture.publicResult.resultId);
  assert.deepEqual(result.model, PUBLIC_SIMULATION_METADATA);
});

test("fails closed on an invalid resultId", async () => {
  const response = structuredClone(fixture);
  response.publicResult.resultId = `sha256:${"0".repeat(64)}`;

  const result = await validatePublicSimulationResponse(response, {
    expectedScenarioId: "normal-example",
    javascriptOutputs: fixture.outputs
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid_result_hash");
});

test("requires the exact 12-field output schema with no private additions", async () => {
  const missing = structuredClone(fixture);
  delete missing.publicResult.outputs.c5aSignal;
  assert.equal((await validate(missing)).reason, "missing_required_fields");

  const extra = structuredClone(fixture);
  extra.publicResult.outputs.candidate_parameter_values = 4;
  assert.equal((await validate(extra)).reason, "forbidden_public_field");

  const topLevelExtra = structuredClone(fixture);
  topLevelExtra.database_id = 9;
  assert.equal((await validate(topLevelExtra)).reason, "invalid_schema");
});

test("rejects forbidden public fields even when nested in compatibility metadata", async () => {
  const response = structuredClone(fixture);
  response.uncertainty.candidate_parameter_values = { c3Activation: 91 };

  const result = await validate(response);

  assert.equal(result.ok, false);
  assert.equal(result.reason, "forbidden_public_field");
  assert.equal(result.detail, "uncertainty.candidate_parameter_values");
});

test("requires top-level compatibility outputs to equal public outputs exactly", async () => {
  const response = structuredClone(fixture);
  response.outputs.c3Activation += 1;

  assert.equal((await validate(response)).reason, "invalid_schema");
});

test("accepts numeric parity at 1e-9 and rejects values outside tolerance", async () => {
  const within = structuredClone(fixture.outputs);
  within.c3Activation += 1e-9;
  assert.equal((await validatePublicSimulationResponse(fixture, {
    expectedScenarioId: "normal-example",
    javascriptOutputs: within
  })).ok, true);

  const outside = structuredClone(fixture.outputs);
  outside.c3Activation += 1.0001e-9;
  assert.equal((await validatePublicSimulationResponse(fixture, {
    expectedScenarioId: "normal-example",
    javascriptOutputs: outside
  })).reason, "result_mismatch");
});

test("requires exact model and validation metadata", async () => {
  assert.deepEqual(PUBLIC_SIMULATION_METADATA, {
    version: "0.2.0-local-parity",
    parameterSetVersion: "js-v1-parity",
    calibrationStatus: "teaching_candidate",
    reviewStatus: "not_clinically_validated"
  });

  for (const mutate of [
    (response) => { response.publicResult.model.reviewStatus = "validated"; },
    (response) => { response.publicResult.validation.hashCanonicalization = "legacy"; },
    (response) => { response.publicResult.scope.supportedOutputs = "everything"; }
  ]) {
    const response = structuredClone(fixture);
    mutate(response);
    assert.equal((await validate(response)).reason, "invalid_schema");
  }
});

test("requires all six unstratified C3G warning concepts", async () => {
  const response = structuredClone(fixture);
  response.scenario_id = "c3g-example";
  response.publicResult.scenarioId = "c3g-example";
  response.publicResult.warnings = [C3G_LIMITATION_TERMS.join("; ")];
  const hashPayload = structuredClone(response.publicResult);
  delete hashPayload.resultId;
  response.publicResult.resultId = await createJcsResultId(hashPayload);

  assert.equal((await validatePublicSimulationResponse(response, {
    expectedScenarioId: "c3g-example",
    diseaseContext: "C3G",
    javascriptOutputs: fixture.outputs
  })).ok, true);

  response.publicResult.warnings = ["C3G remains unstratified."];
  const invalidPayload = structuredClone(response.publicResult);
  delete invalidPayload.resultId;
  response.publicResult.resultId = await createJcsResultId(invalidPayload);
  assert.equal((await validatePublicSimulationResponse(response, {
    expectedScenarioId: "c3g-example",
    diseaseContext: "C3G",
    javascriptOutputs: fixture.outputs
  })).reason, "invalid_schema");
});

function validate(response) {
  return validatePublicSimulationResponse(response, {
    expectedScenarioId: "normal-example",
    javascriptOutputs: fixture.outputs
  });
}
