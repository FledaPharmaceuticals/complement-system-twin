import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { evaluateParameterEnvelope } from "../src/controlledRelease/parameterEnvelope.js";

const ROOT = new URL("../", import.meta.url);

async function parameterPolicy() {
  const policy = JSON.parse(await readFile(new URL("fixtures/controlled-release/policy-v1.json", ROOT), "utf8"));
  return policy.parameters[0];
}

test("passes an in-bounds eight percent release change", async () => {
  const result = evaluateParameterEnvelope({
    parameterPolicy: await parameterPolicy(),
    anchorValue: 1,
    activeValue: 1,
    candidateValue: 1.08
  });

  assert.equal(result.status, "passed");
  assert.equal(result.relativeChange, 0.08);
  assert.equal(result.cumulativeChange, 0.08);
  assert.deepEqual(result.errors, []);
});

test("blocks per-release and cumulative change violations", async () => {
  const policy = await parameterPolicy();
  const release = evaluateParameterEnvelope({ parameterPolicy: policy, anchorValue: 1, activeValue: 1, candidateValue: 1.11 });
  const cumulative = evaluateParameterEnvelope({ parameterPolicy: policy, anchorValue: 1, activeValue: 1.18, candidateValue: 1.21 });

  assert.equal(release.status, "blocked");
  assert.match(release.errors.join(" "), /per-release/i);
  assert.equal(cumulative.status, "blocked");
  assert.match(cumulative.errors.join(" "), /cumulative/i);
});

test("blocks physiologic bounds and invalid numeric bases", async () => {
  const policy = await parameterPolicy();
  const bound = evaluateParameterEnvelope({ parameterPolicy: policy, anchorValue: 1, activeValue: 1, candidateValue: 1.6 });
  const zero = evaluateParameterEnvelope({ parameterPolicy: policy, anchorValue: 0, activeValue: 0, candidateValue: 1 });
  const nonfinite = evaluateParameterEnvelope({ parameterPolicy: policy, anchorValue: 1, activeValue: 1, candidateValue: Number.NaN });

  assert.match(bound.errors.join(" "), /bounds/i);
  assert.match(zero.errors.join(" "), /non-zero/i);
  assert.match(nonfinite.errors.join(" "), /finite/i);
});
