import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { canonicalizeJcs, createJcsResultId } from "../src/jcsResultHash.js";
import {
  PUBLIC_TRAINING_RECORD,
  findForbiddenTrainingRecordField,
  validatePublicTrainingRecord
} from "../src/publicTrainingRecord.js";

const reviewedSnapshot = JSON.parse(await readFile(
  new URL("../data/public-training-record-1.0.0.json", import.meta.url),
  "utf8"
));

test("accepts only the reviewed public-safe training record", async () => {
  const result = await validatePublicTrainingRecord(PUBLIC_TRAINING_RECORD);

  assert.equal(result.ok, true);
  assert.equal(result.value.schemaVersion, "1.0.0");
  assert.equal(result.value.method.machineLearning, false);
  assert.equal(result.value.method.formalModelChange, false);
  assert.equal(result.value.conclusion, "rejected");
});

test("keeps the immutable module record canonically equal to the audited JSON", () => {
  assert.equal(canonicalizeJcs(PUBLIC_TRAINING_RECORD), canonicalizeJcs(reviewedSnapshot));
  assert.equal(Object.isFrozen(PUBLIC_TRAINING_RECORD), true);
  assert.equal(Object.isFrozen(PUBLIC_TRAINING_RECORD.capabilities), true);
  assert.equal(Object.isFrozen(PUBLIC_TRAINING_RECORD.capabilities[0]), true);
  assert.throws(() => {
    PUBLIC_TRAINING_RECORD.capabilities[0].label = "changed";
  }, TypeError);
});

test("requires the RFC8785-JCS recordId and excludes recordId from its payload", async () => {
  const payload = structuredClone(PUBLIC_TRAINING_RECORD);
  const expectedRecordId = payload.recordId;
  delete payload.recordId;

  assert.equal(await createJcsResultId(payload), expectedRecordId);

  const changed = structuredClone(PUBLIC_TRAINING_RECORD);
  changed.warnings.push("changed");
  assert.equal((await validatePublicTrainingRecord(changed)).reason, "invalid_record_hash");
});

test("rejects private fields at any nesting depth", async () => {
  const payload = structuredClone(PUBLIC_TRAINING_RECORD);
  payload.capabilities[0].candidate_parameter_values = { hidden: 1 };

  assert.deepEqual(await validatePublicTrainingRecord(payload), {
    ok: false,
    reason: "forbidden_public_field",
    detail: "capabilities.0.candidate_parameter_values"
  });
  assert.equal(
    findForbiddenTrainingRecordField({ outer: [{ deeper: { human_review_records: [] } }] }),
    "outer.0.deeper.human_review_records"
  );
});

test("rejects unknown fields recursively even when they are not denylisted", async () => {
  for (const mutate of [
    (value) => { value.extra = true; },
    (value) => { value.method.notes = "not allowed"; },
    (value) => { value.publications[0].authors = []; },
    (value) => { value.parameterCategories[0].direction = "increase"; },
    (value) => { value.capabilities[0].detail = "hidden"; },
    (value) => { value.observationCounts.total = 70; },
    (value) => { value.applicability.scope = "AMD"; },
    (value) => { value.uncertainty.interval = [0, 1]; }
  ]) {
    const payload = structuredClone(PUBLIC_TRAINING_RECORD);
    mutate(payload);
    assert.equal((await validatePublicTrainingRecord(payload)).reason, "invalid_schema");
  }
});

test("requires finite non-negative integer counts", async () => {
  for (const invalid of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "13"]) {
    const payload = structuredClone(PUBLIC_TRAINING_RECORD);
    payload.observationCounts.train = invalid;
    assert.equal((await validatePublicTrainingRecord(payload)).reason, "invalid_schema");
  }
});

test("requires an exact ISO calendar date and HTTPS DOI links", async () => {
  for (const trainingDate of ["2026-8-31", "2026-02-30", "2026-08-31T00:00:00Z"]) {
    const payload = structuredClone(PUBLIC_TRAINING_RECORD);
    payload.trainingDate = trainingDate;
    assert.equal((await validatePublicTrainingRecord(payload)).reason, "invalid_schema");
  }

  for (const doiUrl of ["http://doi.org/10.1002/sctm.20-0211", "https://example.com/10.1002/sctm.20-0211"]) {
    const payload = structuredClone(PUBLIC_TRAINING_RECORD);
    payload.publications[0].doiUrl = doiUrl;
    assert.equal((await validatePublicTrainingRecord(payload)).reason, "invalid_schema");
  }
});

test("requires the approved enum values and exactly two publications", async () => {
  for (const mutate of [
    (value) => { value.method.label = "machine learning"; },
    (value) => { value.method.machineLearning = true; },
    (value) => { value.parameterCategories[0].status = "active"; },
    (value) => { value.capabilities[0].validationStatus = "validated"; },
    (value) => { value.applicability.status = "validated"; },
    (value) => { value.uncertainty.level = "low"; },
    (value) => { value.conclusion = "active"; },
    (value) => { value.publications.pop(); }
  ]) {
    const payload = structuredClone(PUBLIC_TRAINING_RECORD);
    mutate(payload);
    assert.equal((await validatePublicTrainingRecord(payload)).reason, "invalid_schema");
  }
});
