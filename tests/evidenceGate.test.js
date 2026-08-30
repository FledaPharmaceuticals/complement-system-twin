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
  const result = await evaluateEvidenceGate(await inputs());

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

  const result = await evaluateEvidenceGate(input);
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

  const result = await evaluateEvidenceGate(input);
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

  const result = await evaluateEvidenceGate(input);

  assert.deepEqual(result.trainingPublicationIds, ["synthetic:amd-publication-1", "synthetic:amd-publication-2"]);
  assert.deepEqual(result.holdoutPublicationIds, ["synthetic:amd-publication-3"]);
  assert.deepEqual(result.observationIds, ["synthetic:observation-1", "synthetic:observation-2", "synthetic:observation-3"]);
});

test("blocks missing observation provenance and duplicate measurement fingerprints", async () => {
  const input = await inputs();
  delete input.evidence[0].observations[0].sourceLocator;
  input.evidence[1].observations[0].measurementFingerprint = input.evidence[2].observations[0].measurementFingerprint;
  input.evidence[1].observationIds = [input.evidence[2].observationIds[0]];

  const result = await evaluateEvidenceGate(input);
  const errors = result.errors.join(" ");

  assert.equal(result.status, "blocked");
  assert.match(errors, /source locator/i);
  assert.match(errors, /measurement fingerprint/i);
  assert.match(errors, /observation IDs/i);
});

test("blocks empty contexts and incomplete quantitative observations", async () => {
  const input = await inputs();
  input.evidence[0].contexts = [{}];
  delete input.evidence[0].observations[0].assay;
  delete input.evidence[0].observations[0].sampleSize;
  delete input.evidence[0].observations[0].timepoint;

  const result = await evaluateEvidenceGate(input);
  const errors = result.errors.join(" ");

  assert.equal(result.status, "blocked");
  assert.match(errors, /context/i);
  assert.match(errors, /assay/i);
  assert.match(errors, /sample size/i);
  assert.match(errors, /timepoint/i);
});

test("blocks observation context that contradicts its publication and parameter policy", async () => {
  const input = await inputs();
  Object.assign(input.evidence[0].observations[0], {
    disease: "PNH",
    tissue: "blood_rbc",
    assay: "flow_cytometry",
    spatialScope: "systemic",
    experimentalSetting: "clinical"
  });

  const result = await evaluateEvidenceGate(input);

  assert.equal(result.status, "blocked");
  assert.match(result.errors.join(" "), /observation context/i);
});

test("malformed evidence collections fail closed", async () => {
  const input = await inputs();
  input.evidence = {};
  const result = await evaluateEvidenceGate(input);

  assert.equal(result.status, "blocked");
  assert.match(result.errors.join(" "), /evidence must be an array/i);
});
