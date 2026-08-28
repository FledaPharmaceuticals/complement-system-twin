import test from "node:test";
import assert from "node:assert/strict";

import { rankDiseaseSpecificImpacts } from "../src/modules/complement-system-twin/disease/diseaseOrganScoring.js";

test("PNH weighting keeps blood/RBC above a higher unweighted liver signal", () => {
  const ranked = rankDiseaseSpecificImpacts("PNH", [
    { id: "liver", name: "Liver", score: 90 },
    { id: "blood", name: "Blood / RBC", score: 40 },
    { id: "kidney", name: "Kidney", score: 45 }
  ]);

  assert.equal(ranked[0].id, "blood");
  assert.equal(ranked[0].weight, 10);
  assert.equal(ranked[0].score > ranked[1].score, true);
});

test("aHUS weighting prioritizes kidney and vessels and preserves descriptions", () => {
  const ranked = rankDiseaseSpecificImpacts("aHUS", [
    { id: "brain", name: "Brain / CNS", score: 90, description: "association" },
    { id: "kidney", name: "Kidney", score: 45, description: "renal signal" },
    { id: "vessels", name: "Vessels", score: 35, description: "endothelial signal" }
  ]);

  assert.deepEqual(ranked.slice(0, 2).map((item) => item.id), ["kidney", "vessels"]);
  assert.equal(ranked.find((item) => item.id === "kidney").description, "renal signal");
});

test("unknown contexts keep raw scores instead of applying an arbitrary disease weight", () => {
  const ranked = rankDiseaseSpecificImpacts("unknown", [
    { id: "liver", name: "Liver", score: 80 },
    { id: "kidney", name: "Kidney", score: 40 }
  ]);

  assert.equal(ranked[0].id, "liver");
  assert.equal(ranked[0].score, 80);
  assert.equal(ranked[0].weight, null);
});
