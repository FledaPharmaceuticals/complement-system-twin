import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  canonicalizeJcs,
  computeLocatorFingerprint,
  computeMeasurementFingerprint,
  computePackageHash,
  sha256Jcs
} from "../src/quantitativeObservations/canonicalHash.js";

const ROOT = new URL("../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, ROOT), "utf8"));
}

test("canonicalizes shared RFC 8785 vectors and hashes UTF-8 bytes", async () => {
  const vectors = await readJson("fixtures/quantitative-observations/hash-vectors.json");

  for (const vector of vectors.canonicalization) {
    assert.equal(canonicalizeJcs(vector.value), vector.canonical, vector.name);
    if (vector.sha256) assert.equal(await sha256Jcs(vector.value), vector.sha256);
  }
});

test("rejects non-finite and negative-zero numeric inputs", () => {
  assert.throws(() => canonicalizeJcs(Number.NaN), /finite IEEE-754/);
  assert.throws(() => canonicalizeJcs(Number.POSITIVE_INFINITY), /finite IEEE-754/);
  assert.throws(() => canonicalizeJcs(-0), /negative zero/);
});

test("package hash excludes only the top-level packageHash", async () => {
  const packageValue = {
    packageType: "FledaQuantitativeObservationPackage",
    packageVersion: "1.0.0",
    createdAt: "2026-08-30T00:00:00Z",
    producer: { name: "fixture", version: "1" },
    dataBoundary: "standalone_fleda_public_literature_candidate_evidence",
    observations: [],
    packageHash: "sha256:old"
  };

  const first = await computePackageHash(packageValue);
  packageValue.packageHash = "sha256:different";
  const second = await computePackageHash(packageValue);
  packageValue.producer.version = "2";
  const changed = await computePackageHash(packageValue);

  assert.equal(first, second);
  assert.notEqual(first, changed);
});

test("locator and measurement fingerprints are stable and content-sensitive", async () => {
  const vectors = await readJson("fixtures/quantitative-observations/hash-vectors.json");
  const observation = await readJson("fixtures/quantitative-observations/amd-systemic-clinical-valid.json");
  const locator = await computeLocatorFingerprint(observation);
  const measurement = await computeMeasurementFingerprint(observation);
  const repeat = await computeMeasurementFingerprint(structuredClone(observation));

  assert.match(locator, /^sha256:[0-9a-f]{64}$/);
  assert.match(measurement, /^sha256:[0-9a-f]{64}$/);
  assert.equal(locator, vectors.amdSystemicFixture.locatorFingerprint);
  assert.equal(measurement, vectors.amdSystemicFixture.measurementFingerprint);
  assert.equal(measurement, repeat);

  observation.measurement.value = 1.26;
  assert.notEqual(await computeMeasurementFingerprint(observation), measurement);
});
