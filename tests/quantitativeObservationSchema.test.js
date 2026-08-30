import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, ROOT), "utf8"));
}

test("publishes the versioned quantitative observation schema", async () => {
  const schema = await readJson("schemas/fleda-quantitative-observation-1.0.0.schema.json");

  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.title, "FledaQuantitativeObservation");
  assert.deepEqual(schema.properties.schemaName.const, "FledaQuantitativeObservation");
  assert.deepEqual(schema.properties.schemaVersion.const, "1.0.0");
  assert.equal(schema.properties.governance.$ref, "#/$defs/governance");
  assert.equal(schema.$defs.governance.properties.formalModelChange.const, false);
});

test("keeps spatial scope independent from experimental setting", async () => {
  const systemic = await readJson("fixtures/quantitative-observations/amd-systemic-clinical-valid.json");
  const local = await readJson("fixtures/quantitative-observations/amd-local-ex-vivo-valid.json");

  assert.equal(systemic.biologicalContext.spatialScope, "systemic");
  assert.equal(systemic.biologicalContext.experimentalSetting, "clinical");
  assert.equal(local.biologicalContext.spatialScope, "local_tissue");
  assert.equal(local.biologicalContext.experimentalSetting, "ex_vivo");
});

test("synthetic AMD fixtures preserve group, measurement, provenance, and governance identity", async () => {
  for (const file of [
    "fixtures/quantitative-observations/amd-systemic-clinical-valid.json",
    "fixtures/quantitative-observations/amd-local-ex-vivo-valid.json"
  ]) {
    const observation = await readJson(file);
    assert.match(observation.observationId, /^synthetic:/);
    assert.equal(observation.schemaName, "FledaQuantitativeObservation");
    assert.equal(observation.schemaVersion, "1.0.0");
    assert.ok(observation.experiment.groupId);
    assert.notEqual(observation.experiment.groupRole, "unknown");
    assert.ok(observation.measurement.reportedValueText);
    assert.ok(observation.measurement.reportedUnit);
    assert.ok(observation.measurement.unitCode);
    assert.equal(observation.provenance.ruleValidationResult, "passed");
    assert.equal(observation.provenance.reviewResult, "supported");
    assert.equal(observation.governance.formalModelChange, false);
  }
});

test("invalid fixture remains explicitly ineligible instead of inventing context", async () => {
  const observation = await readJson("fixtures/quantitative-observations/amd-invalid-missing-context.json");

  assert.equal(observation.biologicalContext.spatialScope, "unknown");
  assert.equal(observation.biologicalContext.experimentalSetting, "unknown");
  assert.equal(observation.governance.calibrationEligible, false);
  assert.ok(observation.governance.eligibilityReasons.includes("BIOLOGICAL_CONTEXT_INCOMPLETE"));
});
