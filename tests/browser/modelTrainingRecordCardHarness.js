import { loadTrainingRecordSnapshot } from "../../src/modelTrainingRecords/loadTrainingRecordSnapshot.js";
import { validatePublicStatementRegistry } from "../../src/modelTrainingRecords/validateTrainingRecord.js";
import { createValidatedTrainingRecordView } from "../../src/publicTrainingRecord.js";
import { initPublicTrainingRecord } from "../../src/publicTrainingRecordView.js";

async function json(path) {
  const response = await fetch(path, { cache: "no-store", credentials: "omit" });
  if (!response.ok) throw new Error(`Unable to load ${path}`);
  return response.json();
}

async function loadVerifiedFixture() {
  const [registryPayload, registryVectors] = await Promise.all([
    json("../../contracts/model-training/public-model-training-statement-registry-1.0.0.json"),
    json("../../contracts/model-training/public-model-training-statement-registry-vectors-1.0.0.json")
  ]);
  const release = registryVectors.registryRelease;
  const releasePin = {
    expectedSchemaVersion: release.expectedSchemaVersion,
    expectedRegistryHash: release.expectedRegistryHash,
    expectedReleaseCommit: release.expectedReleaseCommit
  };
  const registry = await validatePublicStatementRegistry(registryPayload, releasePin);
  const loaded = await loadTrainingRecordSnapshot("../../fixtures/model-training-snapshot/model-training-records-1.1.0.json", {
    signatureUrl: "../../fixtures/model-training-snapshot/model-training-records-1.1.0.sig.json",
    publicJwkUrl: "../../fixtures/model-training-snapshot/test-public-key.jwk.json",
    publicJwkSha256: "sha256:3c6290da13883f8f7054a5b77bd72c7aef887f6c77be10c4c4c9b7e1b3c03269",
    registry,
    releasePin,
    timeoutMs: 5_000
  });
  if (loaded.status !== "available") throw new Error("Signed Task 10 fixture did not validate");
  return createValidatedTrainingRecordView(loaded.snapshot, registry);
}

try {
  const view = await loadVerifiedFixture();
  initPublicTrainingRecord(view);
  document.documentElement.dataset.trainingRecordFixture = "verified";
} catch (error) {
  document.documentElement.dataset.trainingRecordFixture = "rejected";
  document.getElementById("model-training-record-content").textContent = "Fixture validation failed.";
  console.error(error);
}
