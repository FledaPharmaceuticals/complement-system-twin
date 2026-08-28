import test from "node:test";
import assert from "node:assert/strict";

import { promoteValidatedModelChange } from "../src/modelPromotion.js";

const baseChange = {
  id: "change:complement-twin-v1.1-contract:candidate-1",
  baseVersion: "complement-twin-v1.1-contract",
  candidateId: "candidate-1",
  summary: "Review alternative pathway prior",
  evidenceIds: ["pmid:123"],
  status: "candidate",
  promotedVersion: null,
  formalModelChange: false
};

test("refuses to promote an unvalidated candidate", () => {
  assert.throws(
    () => promoteValidatedModelChange({ changeRecord: baseChange, validation: { status: "candidate" }, nextVersion: "complement-twin-v1.2" }),
    /validated/i
  );
});

test("promotes only a validated candidate with an auditable evidence chain", () => {
  const promoted = promoteValidatedModelChange({
    changeRecord: baseChange,
    validation: { status: "validated", validatedBy: "research-review", validationRecordId: "validation:1" },
    nextVersion: "complement-twin-v1.2",
    additionalEvidenceIds: ["reactome:R-HSA-168249"]
  });

  assert.equal(promoted.status, "promoted");
  assert.equal(promoted.promotedVersion, "complement-twin-v1.2");
  assert.equal(promoted.formalModelChange, true);
  assert.deepEqual(promoted.evidenceIds, ["pmid:123", "reactome:R-HSA-168249"]);
  assert.equal(promoted.validation.validationRecordId, "validation:1");
});
