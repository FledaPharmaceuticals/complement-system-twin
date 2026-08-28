import test from "node:test";
import assert from "node:assert/strict";

import { createStructuredFeedbackRecord } from "../src/structuredFeedback.js";

test("creates an anonymous local-only feedback record", () => {
  const record = createStructuredFeedbackRecord({
    modelVersion: "complement-twin-v1.1-contract",
    diseaseContext: "AMD",
    component: "C3",
    predictionObservation: "Observed signal was lower.",
    confirmedNoSensitiveData: true,
    createdAt: "2026-08-27T00:00:00.000Z",
    feedbackId: "feedback:test"
  });

  assert.equal(record.anonymous, true);
  assert.equal(record.submissionMode, "local_download_only");
  assert.equal(record.status, "unreviewed");
  assert.equal(record.observations.diseaseContext, "AMD");
  assert.equal(record.dataBoundary, "no_patient_or_production_data");
});

test("requires an explicit no-sensitive-data confirmation", () => {
  assert.throws(
    () => createStructuredFeedbackRecord({ modelVersion: "v1" }),
    /no patient or production data/
  );
});
