import test from "node:test";
import assert from "node:assert/strict";

import { reviewCalibrationCandidates } from "../src/calibrationReview.js";

const candidate = (id, parameter, direction, min, max) => ({
  id,
  parameter,
  direction,
  suggestedRange: { min, max }
});

test("flags opposite directions and non-overlapping ranges", () => {
  const review = reviewCalibrationCandidates([
    candidate("a", "factorH", "increase", 1.1, 1.4),
    candidate("b", "factorH", "decrease", 0.5, 0.8)
  ]);

  assert.equal(review.conflicts.length, 1);
  assert.deepEqual(review.conflicts[0].reasons, ["opposite_direction", "non_overlapping_ranges"]);
  assert.equal(review.candidates[0].reviewStatus, "needs_review");
});

test("does not flag overlapping candidates with the same direction", () => {
  const review = reviewCalibrationCandidates([
    candidate("a", "alternative", "increase", 1.1, 1.4),
    candidate("b", "alternative", "increase", 1.2, 1.5)
  ]);

  assert.deepEqual(review.conflicts, []);
  assert.equal(review.candidates[1].reviewStatus, "no_conflict_detected");
});
