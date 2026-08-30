import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { canonicalizeJcs, createJcsResultId } from "../src/jcsResultHash.js";

const vectors = JSON.parse(await readFile(
  new URL("../contracts/c3-safe-result-hash-vectors-1.0.0.json", import.meta.url),
  "utf8"
));

for (const vector of vectors.vectors) {
  test(`matches the server JCS vector: ${vector.name}`, async () => {
    assert.equal(canonicalizeJcs(vector.payload), vector.canonical);
    assert.equal(await createJcsResultId(vector.payload), vector.resultId);
  });
}

test("rejects values that RFC8785 cannot canonicalize safely", () => {
  assert.throws(() => canonicalizeJcs({ value: Number.NaN }), /finite number/);
  assert.throws(() => canonicalizeJcs({ value: undefined }), /JSON value/);
  assert.throws(() => canonicalizeJcs({ value: 2n }), /JSON value/);
});
