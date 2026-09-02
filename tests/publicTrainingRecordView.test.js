import test from "node:test";
import assert from "node:assert/strict";

import { renderModelTrainingRecordHistory } from "../src/publicTrainingRecordView.js";

test("does not retain the retired static two-paper training record as a browser fallback", () => {
  const html = renderModelTrainingRecordHistory();
  assert.match(html, /Training record unavailable/i);
  assert.doesNotMatch(html, /Two-paper AMD|Cerniauskas|Lamers|candidate_parameter_values/i);
});
