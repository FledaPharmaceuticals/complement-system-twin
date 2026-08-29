import test from "node:test";
import assert from "node:assert/strict";

import { getTissueImageRecord, tissueImageCatalog } from "../src/tissueImageCatalog.js";

test("every systemic organ has a literature-informed tissue image record", () => {
  for (const id of ["brain", "retina", "kidney", "lung", "blood", "liver", "vessels", "skin"]) {
    const record = tissueImageCatalog[id];
    assert.match(record.image, /^\.\.\/assets\/tissue-models\/.+\.jpg$/);
    assert.ok(record.normal.length > 30);
    assert.ok(record.impact.length > 30);
    assert.ok(record.evidence.length >= 1);
    assert.ok(record.uncertainty.length > 20);
  }
});

test("AMD tissue signals share the retina-centered tissue model", () => {
  for (const id of ["rpe", "choroid", "drusen", "retinal-complement", "geographic-atrophy", "neovascular-signal"]) {
    assert.equal(getTissueImageRecord(id), tissueImageCatalog.retina);
  }
});

test("complement dysregulation uses the endothelial tissue model", () => {
  assert.equal(getTissueImageRecord("complement-dysregulation"), tissueImageCatalog.vessels);
});

test("unknown disease endpoints do not fall back to an unrelated tissue model", () => {
  assert.equal(getTissueImageRecord("tumor-immune"), null);
  assert.equal(getTissueImageRecord("dc-migration"), null);
});
