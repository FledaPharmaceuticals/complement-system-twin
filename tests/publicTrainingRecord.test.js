import test from "node:test";
import assert from "node:assert/strict";

import {
  UNAVAILABLE_TRAINING_RECORD_VIEW,
  isValidatedTrainingRecordView
} from "../src/publicTrainingRecord.js";

test("keeps the default training record state unavailable until a verified snapshot is supplied", () => {
  assert.equal(Object.isFrozen(UNAVAILABLE_TRAINING_RECORD_VIEW), true);
  assert.equal(UNAVAILABLE_TRAINING_RECORD_VIEW.status, "unavailable");
  assert.equal(UNAVAILABLE_TRAINING_RECORD_VIEW.snapshot, null);
  assert.equal(isValidatedTrainingRecordView(UNAVAILABLE_TRAINING_RECORD_VIEW), false);
  assert.equal(isValidatedTrainingRecordView(Object.freeze({ status: "available", snapshot: Object.freeze({ records: [] }) })), false);
});
