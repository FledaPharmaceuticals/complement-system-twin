import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { evaluateEvidenceGate } from "../src/controlledRelease/evidenceGate.js";
import { getParameterPolicy } from "../src/controlledRelease/changePolicy.js";

const ROOT = new URL("../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, ROOT), "utf8"));
}

async function inputs() {
  const policy = await readJson("fixtures/controlled-release/policy-v1.json");
  return {
    policy,
    parameterPolicy: getParameterPolicy(policy, "amd.retinalAlternativeAmplification"),
    evidence: await readJson("fixtures/controlled-release/amd-evidence-set.json")
  };
}

test("accepts three eligible publications from two groups with a locked holdout", async () => {
  const result = evaluateEvidenceGate(await inputs());

  assert.equal(result.status, "passed");
  assert.equal(result.independentGroupCount, 2);
  assert.deepEqual(result.trainingPublicationIds, ["synthetic:amd-publication-1", "synthetic:amd-publication-2"]);
  assert.deepEqual(result.holdoutPublicationIds, ["synthetic:amd-publication-3"]);
  assert.equal(result.formalModelChanged, false);
});

test("blocks missing holdout, group independence, conflicts, and context mismatch", async () => {
  const input = await inputs();
  input.evidence[0].integrityStatus = "conflicted";
  input.evidence[1].researchGroupId = input.evidence[0].researchGroupId;
  input.evidence[2].researchGroupId = input.evidence[0].researchGroupId;
  input.evidence[2].assignment = "training";
  input.evidence[2].contexts[0].spatialScope = "systemic";

  const result = evaluateEvidenceGate(input);
  const errors = result.errors.join(" ");

  assert.equal(result.status, "blocked");
  assert.match(errors, /holdout/i);
  assert.match(errors, /independent/i);
  assert.match(errors, /conflict/i);
  assert.match(errors, /context/i);
});

test("blocks ineligible, duplicate, retracted, and expression-of-concern evidence", async () => {
  const input = await inputs();
  input.evidence[0].calibrationEligible = false;
  input.evidence[1].publicationId = input.evidence[0].publicationId;
  input.evidence[1].integrityStatus = "retracted";
  input.evidence[2].integrityStatus = "expression_of_concern";

  const result = evaluateEvidenceGate(input);
  const errors = result.errors.join(" ");

  assert.equal(result.status, "blocked");
  assert.match(errors, /eligible/i);
  assert.match(errors, /duplicate/i);
  assert.match(errors, /retracted/i);
  assert.match(errors, /expression of concern/i);
});

test("returns sorted unique evidence IDs for reproducible decisions", async () => {
  const input = await inputs();
  input.evidence.reverse();

  const result = evaluateEvidenceGate(input);

  assert.deepEqual(result.trainingPublicationIds, ["synthetic:amd-publication-1", "synthetic:amd-publication-2"]);
  assert.deepEqual(result.holdoutPublicationIds, ["synthetic:amd-publication-3"]);
  assert.deepEqual(result.observationIds, ["synthetic:observation-1", "synthetic:observation-2", "synthetic:observation-3"]);
});
