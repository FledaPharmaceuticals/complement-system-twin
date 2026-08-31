import test from "node:test";
import assert from "node:assert/strict";

import {
  buildVerificationCases,
  summarizeVerificationCases
} from "../scripts/verifyC3PublicApi.mjs";

test("builds the contract-sized deterministic HTTPS differential set", () => {
  const cases = buildVerificationCases();
  const summary = summarizeVerificationCases(cases);

  assert.deepEqual(summary, { fixed: 6, boundary: 12, randomized: 32 });
  assert.equal(new Set(cases.map((item) => item.id)).size, 50);
  assert.deepEqual(
    cases.filter((item) => item.category === "fixed").map((item) => item.scenarioId),
    ["normal", "AMD", "PNH", "aHUS", "C3G", "sepsis"]
  );

  for (const item of cases) {
    assert.equal(item.input.diseaseContext, item.scenarioId);
    for (const [key, value] of Object.entries(item.input)) {
      if (key !== "diseaseContext") {
        assert.equal(Number.isFinite(value), true, `${item.id}.${key}`);
        assert.ok(value >= 0 && value <= 100, `${item.id}.${key}`);
      }
    }
  }
});
