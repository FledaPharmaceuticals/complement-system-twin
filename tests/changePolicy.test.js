import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { getParameterPolicy, validateChangePolicy } from "../src/controlledRelease/changePolicy.js";

const ROOT = new URL("../", import.meta.url);

async function fixture() {
  return JSON.parse(await readFile(new URL("fixtures/controlled-release/policy-v1.json", ROOT), "utf8"));
}

test("accepts the versioned Fleda policy and returns an immutable parameter copy", async () => {
  const policy = await fixture();
  const result = validateChangePolicy(policy);
  const parameter = getParameterPolicy(policy, "amd.retinalAlternativeAmplification");

  assert.deepEqual(result, { valid: true, errors: [] });
  assert.equal(parameter.unit, "relative_multiplier");
  parameter.lowerBound = 999;
  assert.equal(getParameterPolicy(policy, "amd.retinalAlternativeAmplification").lowerBound, 0.8);
});

test("rejects unversioned, active, unbounded, and overbroad automatic parameters", () => {
  const result = validateChangePolicy({
    policyId: "x",
    status: "active",
    minimumPublications: 1,
    minimumIndependentGroups: 1,
    holdoutRequired: false,
    parameters: [{ parameterId: "x" }]
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /version/i);
  assert.match(result.errors.join(" "), /dry_run/i);
  assert.match(result.errors.join(" "), /bound/i);
  assert.match(result.errors.join(" "), /relative change/i);
});

test("rejects invalid contexts, sentinels, and disclosure levels", async () => {
  const policy = await fixture();
  policy.parameters[0].contexts = [];
  policy.parameters[0].sentinelEndpoints = [];
  policy.parameters[0].disclosureLevel = "private_dump";

  const result = validateChangePolicy(policy);

  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /context/i);
  assert.match(result.errors.join(" "), /sentinel/i);
  assert.match(result.errors.join(" "), /disclosure/i);
});

test("returns null for an unregistered parameter", async () => {
  assert.equal(getParameterPolicy(await fixture(), "not-registered"), null);
});

test("rejects empty scientific context and incomplete calibration registration", async () => {
  const policy = await fixture();
  policy.parameters[0].contexts = [{}];
  delete policy.parameters[0].scientificMeaning;
  delete policy.parameters[0].calibrationObjective;
  delete policy.parameters[0].transformation;

  const result = validateChangePolicy(policy);

  assert.equal(result.valid, false);
  for (const term of ["disease", "tissue", "species", "assay", "time context", "spatial scope", "experimental setting", "scientific meaning", "calibration objective", "transformation"]) {
    assert.match(result.errors.join(" "), new RegExp(term, "i"));
  }
});

test("returns validation errors instead of throwing for malformed parameter collections", () => {
  const result = validateChangePolicy({ policyId: "x", policyVersion: "1.0.0", status: "dry_run", parameters: {} });

  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /registered parameter/i);

  const nullEntry = validateChangePolicy({ policyId: "x", policyVersion: "1.0.0", status: "dry_run", parameters: [null] });
  assert.equal(nullEntry.valid, false);
  assert.match(nullEntry.errors.join(" "), /entries must be objects/i);
});
