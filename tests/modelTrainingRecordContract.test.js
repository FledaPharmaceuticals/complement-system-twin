import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  requirePublicStatement,
  validatePublicStatementRegistry,
  validateTrainingRecordCollection,
  validateTrainingRecordDetail,
  validateTrainingRecordSnapshot,
  validateTrainingRecordSummary
} from "../src/modelTrainingRecords/validateTrainingRecord.js";
import {
  canonicalizeJcs,
  sha256Bytes,
  sha256Canonical
} from "../src/modelTrainingRecords/canonicalHash.js";
import {
  loadTrainingRecordSnapshot,
  verifySnapshotSignature
} from "../src/modelTrainingRecords/loadTrainingRecordSnapshot.js";

const ROOT = new URL("../", import.meta.url);
const CONTRACT = "contracts/model-training/";
const FIXTURE = "fixtures/model-training-snapshot/";
const P256_ORDER = BigInt("0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551");

const ARTIFACT_HASHES = {
  "contracts/model-training/public-model-training-record-1.1.0.schema.json": "b8e0aac4b4d2799d7f594cb08498469f9223e96bab10a4160c5026ca714f2c35",
  "contracts/model-training/public-model-training-record-summary-1.1.0.schema.json": "59deb36f169e94123530226f3259a74825dbf601af5e28e6dd8482d53ff3580b",
  "contracts/model-training/public-model-training-record-collection-1.1.0.schema.json": "da42bd208f21f1bb3bd7b377fc9dc9179cc832ac692025ef8e8591951e9ac4b6",
  "contracts/model-training/public-model-training-record-snapshot-1.1.0.schema.json": "f9de84e9ef0eb60d19b73a9db0ee8eac6e69c0310a1b800f19429404dc51b977",
  "contracts/model-training/model-training-snapshot-signature-1.0.0.schema.json": "5deb1006f7d64414b6b0507e11269fd3c317ea6061c8eec8fad7973182a1dd9a",
  "contracts/model-training/public-model-training-statement-registry-1.0.0.schema.json": "a92cfb9fc0abfb917404c5c8fc73f582dea7ff4b26fe47ca2d99b9c6a5e75fff",
  "contracts/model-training/public-model-training-statement-registry-1.0.0.json": "9fd3beadfff5aaa0e0bb28568e53e417942861a156872ea63614c31709c8f708",
  "contracts/model-training/public-model-training-statement-registry-vectors-1.0.0.json": "bc1f5b5ad3535eb2b913dd2453eef9e1be1c9ea4ac9f9bd00ad438e8c379e0fb",
  "contracts/model-training/model-training-jcs-vectors-1.1.0.json": "dab1adc12db5dd7e712ddf92634a21944030cb295908a88ad0f78c94f6dcb012",
  "contracts/model-training/model-training-signature-vectors-1.0.0.json": "381615da0205b302e9fdd4dff46a36972b0f52ceadae99ede613bb2c0d961221",
  "fixtures/model-training-snapshot/model-training-records-1.1.0.json": "70388a53cb682663fc819046d5bbdf2ef79bdd3fa2821f744014fe4445626ce2",
  "fixtures/model-training-snapshot/model-training-records-1.1.0.json.sha256": "9f814a714b157cffa607636705494334bae73e360f97c5e77243a6c73c0b5bb1",
  "fixtures/model-training-snapshot/model-training-records-1.1.0.sig.json": "4db3505377fad1954ec92f3c177bdfa6e6b6fb5dd6e9dff9324a00a643bfddad",
  "fixtures/model-training-snapshot/test-public-key.jwk.json": "3c6290da13883f8f7054a5b77bd72c7aef887f6c77be10c4c4c9b7e1b3c03269"
};

const STATUS_MESSAGES = {
  rejected: "Candidate did not pass; model knowledge and falsification results were retained.",
  candidate_only: "Candidate record retained; not approved for exploratory or formal model use.",
  supported_exploratory: "Supported for research exploration; not formally approved or clinically validated.",
  formally_approved: "Formally approved model record."
};

async function bytes(path) {
  return new Uint8Array(await readFile(new URL(path, ROOT)));
}

async function json(path) {
  return JSON.parse(new TextDecoder().decode(await bytes(path)));
}

function clone(value) {
  return structuredClone(value);
}

function omit(value, field) {
  const copy = clone(value);
  delete copy[field];
  return copy;
}

function dataUrl(raw, type = "application/json") {
  return `data:${type};base64,${Buffer.from(raw).toString("base64")}`;
}

function p1363Signature(r, s) {
  const hex = (value) => value.toString(16).padStart(64, "0");
  return Buffer.from(`${hex(r)}${hex(s)}`, "hex").toString("base64url");
}

async function pinnedJwkWithCoordinates(template, x, y) {
  const pinned = clone(template);
  pinned.jwk.x = x;
  pinned.jwk.y = y;
  const fingerprint = await sha256Canonical({
    crv: pinned.jwk.crv,
    kty: pinned.jwk.kty,
    x,
    y
  });
  const keyId = `jwk-sha256:${fingerprint.slice(7)}`;
  pinned.jwkFingerprint = fingerprint;
  pinned.keyId = keyId;
  pinned.jwk.kid = keyId;
  return pinned;
}

async function productionRegistry() {
  const payload = await json(`${CONTRACT}public-model-training-statement-registry-1.0.0.json`);
  const vectors = await json(`${CONTRACT}public-model-training-statement-registry-vectors-1.0.0.json`);
  const release = vectors.registryRelease;
  const releasePin = {
    expectedSchemaVersion: release.expectedSchemaVersion,
    expectedRegistryHash: release.expectedRegistryHash,
    expectedReleaseCommit: release.expectedReleaseCommit
  };
  return { payload, releasePin, pinned: await validatePublicStatementRegistry(payload, releasePin) };
}

async function validSnapshot() {
  return json(`${FIXTURE}model-training-records-1.1.0.json`);
}

async function rehashDetail(detail) {
  detail.projectionHash = await sha256Canonical(omit(detail, "projectionHash"));
}

async function rehashSnapshot(snapshot) {
  snapshot.snapshotHash = await sha256Canonical(omit(snapshot, "snapshotHash"));
}

test("copies only the approved public and visibly test-only artifacts byte for byte", async () => {
  assert.deepEqual(Object.keys(ARTIFACT_HASHES).sort(), (await Promise.all(Object.keys(ARTIFACT_HASHES).map(async (path) => {
    assert.equal((await sha256Bytes(await bytes(path))).slice(7), ARTIFACT_HASHES[path], path);
    return path;
  }))).sort());
  assert.equal((await json(`${FIXTURE}test-public-key.jwk.json`)).purpose, "test_only_conformance");
});

test("keeps detail, summary, collection, snapshot, registry, and signature field sets closed", async () => {
  const schemas = await Promise.all([
    "public-model-training-record-1.1.0.schema.json",
    "public-model-training-record-summary-1.1.0.schema.json",
    "public-model-training-record-collection-1.1.0.schema.json",
    "public-model-training-record-snapshot-1.1.0.schema.json",
    "public-model-training-statement-registry-1.0.0.schema.json",
    "model-training-snapshot-signature-1.0.0.schema.json"
  ].map((name) => json(`${CONTRACT}${name}`)));
  assert.deepEqual(schemas.map((schema) => Object.keys(schema.properties).sort()), [
    ["architectureImplications", "candidateStatus", "formalModelChanged", "knowledgeAcquired", "limitations", "method", "missingMechanisms", "modelingConstraints", "observationCount", "projectionHash", "publicationCount", "publications", "recordId", "rejectionReasons", "schemaName", "schemaVersion", "supersedesRecordId", "trainingDate", "trainingRunType", "uncertaintySummary", "validationSummary"].sort(),
    ["candidateStatus", "formalModelChanged", "methodLabel", "observationCount", "publicationCount", "recordId", "statusMessage", "supersedesRecordId", "trainingDate", "trainingRunType"].sort(),
    ["collectionHash", "items", "nextCursor", "schemaName", "schemaVersion"].sort(),
    ["generatedFromCommit", "records", "schemaName", "schemaVersion", "snapshotHash"].sort(),
    ["registryHash", "schemaName", "schemaVersion", "statements"].sort(),
    ["algorithm", "keyId", "schemaName", "schemaVersion", "signature", "snapshotSha256"].sort()
  ]);
  assert.ok(schemas.every((schema) => schema.additionalProperties === false));
});

test("matches every shared JCS Unicode, numeric, order, array, null, and omission vector", async () => {
  const jcs = await json(`${CONTRACT}model-training-jcs-vectors-1.1.0.json`);
  for (const vector of jcs.vectors) {
    if (vector.operation.endsWith("_error")) {
      assert.throws(() => canonicalizeJcs(vector.payload), /Unicode|surrogate/i, vector.name);
      continue;
    }
    const payload = vector.omittedField ? omit(vector.payload, vector.omittedField) : vector.payload;
    assert.equal(canonicalizeJcs(payload), vector.expectedCanonical, vector.name);
    assert.equal(await sha256Canonical(payload), vector.expectedHash, vector.name);
  }
  assert.throws(() => canonicalizeJcs(-0), /negative zero/i);
  assert.throws(() => canonicalizeJcs(Number.POSITIVE_INFINITY), /finite/i);
});

test("matches registry parity vectors including unsigned ASCII prefix and punctuation order", async () => {
  const vectors = await json(`${CONTRACT}public-model-training-statement-registry-vectors-1.0.0.json`);
  for (const vector of vectors.jcsVectors) {
    assert.equal(canonicalizeJcs(vector.value), vector.expectedCanonicalJson, vector.name);
    assert.equal(await sha256Canonical(vector.value), vector.expectedSha256, vector.name);
  }
  for (const vector of vectors.statementIdOrderingVectors) {
    assert.deepEqual([...vector.input].sort(), vector.expected, vector.name);
  }
  assert.deepEqual(vectors.statementIdOrderingVectors, [
    { name: "shorter_exact_prefix_first", input: ["A.1", "A", "A.", "A.0"], expected: ["A", "A.", "A.0", "A.1"] },
    { name: "mixed_case_and_punctuation", input: ["a_", "A_", "a.", "A.", "a-", "A-", "a0", "A0"], expected: ["A-", "A.", "A0", "A_", "a-", "a.", "a0", "a_"] }
  ]);
});

test("requires a complete explicit release pin and returns an immutable registry", async () => {
  const { payload, releasePin, pinned } = await productionRegistry();
  assert.equal(Object.isFrozen(pinned), true);
  assert.equal(Object.isFrozen(pinned.releasePin), true);
  assert.equal(Object.isFrozen(pinned.registry.statements[0]), true);
  assert.equal(pinned.releasePin.expectedReleaseCommit, releasePin.expectedReleaseCommit);
  assert.equal(requirePublicStatement(pinned, "limitation", "No clinical validity is claimed.").statementId, "limitation.003");
  assert.throws(() => requirePublicStatement(pinned, "uncertainty", "No clinical validity is claimed."), /not approved/i);

  for (const field of ["expectedSchemaVersion", "expectedRegistryHash", "expectedReleaseCommit"]) {
    const missing = clone(releasePin);
    delete missing[field];
    await assert.rejects(validatePublicStatementRegistry(payload, missing), new RegExp(field, "i"));
  }
  await assert.rejects(validatePublicStatementRegistry(payload, { ...releasePin, expectedSchemaVersion: "9.9.9" }), /schemaVersion.*release pin/i);
  await assert.rejects(validatePublicStatementRegistry(payload, { ...releasePin, expectedRegistryHash: `sha256:${"0".repeat(64)}` }), /registryHash.*release pin/i);
  await assert.rejects(validatePublicStatementRegistry(payload, { ...releasePin, expectedReleaseCommit: "wrong-commit" }), /release commit/i);
});

test("rejects duplicate, reordered, malformed, unapproved, hash-damaged, and unknown registry content", async () => {
  const { payload, releasePin } = await productionRegistry();
  const cases = [];
  const duplicateId = clone(payload);
  duplicateId.statements[1].statementId = duplicateId.statements[0].statementId;
  cases.push([duplicateId, /statementId.*unique/i]);
  const duplicateHash = clone(payload);
  duplicateHash.statements[1].statementHash = duplicateHash.statements[0].statementHash;
  cases.push([duplicateHash, /statementHash.*unique|statementHash.*match/i]);
  const reordered = clone(payload);
  reordered.statements.reverse();
  cases.push([reordered, /ASCII.*order/i]);
  const malformed = clone(payload);
  delete malformed.statements[0].category;
  cases.push([malformed, /category/i]);
  const unapproved = clone(payload);
  unapproved.statements[0].approvalStatus = "pending";
  cases.push([unapproved, /approvalStatus/i]);
  const damagedStatement = clone(payload);
  damagedStatement.statements[0].statementHash = `sha256:${"0".repeat(64)}`;
  cases.push([damagedStatement, /statementHash/i]);
  const damagedRegistry = clone(payload);
  damagedRegistry.registryHash = `sha256:${"0".repeat(64)}`;
  cases.push([damagedRegistry, /registryHash/i]);
  const unknown = clone(payload);
  unknown.extra = true;
  cases.push([unknown, /unknown field/i]);
  for (const [candidate, pattern] of cases) {
    await assert.rejects(validatePublicStatementRegistry(candidate, releasePin), pattern);
  }
});

test("preserves exact category and Unicode membership without normalization or repair", async () => {
  const { payload, releasePin } = await productionRegistry();
  const custom = clone(payload);
  const text = "Caf\u00e9 evidence remains uncertain.";
  const entry = {
    statementId: "zz.test.uncertainty",
    category: "uncertainty",
    text,
    statementHash: await sha256Canonical({ category: "uncertainty", text }),
    approvalStatus: "approved_for_public_release"
  };
  custom.statements.push(entry);
  custom.registryHash = await sha256Canonical(omit(custom, "registryHash"));
  const customPin = { ...releasePin, expectedRegistryHash: custom.registryHash };
  const pinned = await validatePublicStatementRegistry(custom, customPin);
  assert.equal(requirePublicStatement(pinned, "uncertainty", text).statementId, entry.statementId);
  assert.throws(() => requirePublicStatement(pinned, "limitation", text), /not approved/i);
  assert.throws(() => requirePublicStatement(pinned, "uncertainty", "Cafe\u0301 evidence remains uncertain."), /not approved/i);
  assert.throws(() => requirePublicStatement(pinned, "uncertainty", "Caf\u00e9 evidence remains uncertain!"), /not approved/i);
  await assert.rejects(validatePublicStatementRegistry(custom, releasePin), /registryHash.*release pin/i);
});

test("validates the signed snapshot detail records and all four summary statuses", async () => {
  const { pinned } = await productionRegistry();
  const snapshot = await validSnapshot();
  const validated = await validateTrainingRecordSnapshot(snapshot, pinned);
  assert.equal(validated.records.length, 2);
  assert.equal(Object.isFrozen(validated.records[0]), true);
  await validateTrainingRecordDetail(snapshot.records[0], pinned);

  const base = {
    recordId: snapshot.records[0].recordId,
    trainingDate: snapshot.records[0].trainingDate,
    trainingRunType: snapshot.records[0].trainingRunType,
    candidateStatus: "rejected",
    publicationCount: snapshot.records[0].publicationCount,
    observationCount: snapshot.records[0].observationCount,
    methodLabel: snapshot.records[0].method.label,
    formalModelChanged: false,
    supersedesRecordId: null,
    statusMessage: STATUS_MESSAGES.rejected
  };
  for (const status of Object.keys(STATUS_MESSAGES)) {
    await validateTrainingRecordSummary({ ...base, candidateStatus: status, statusMessage: STATUS_MESSAGES[status] }, pinned);
  }
  await assert.rejects(validateTrainingRecordSummary({ ...base, statusMessage: STATUS_MESSAGES.candidate_only }, pinned), /statusMessage/i);

  const collection = {
    schemaName: "FledaPublicModelTrainingRecordCollection",
    schemaVersion: "1.1.0",
    items: [base],
    nextCursor: null,
    collectionHash: `sha256:${"0".repeat(64)}`
  };
  collection.collectionHash = await sha256Canonical(omit(collection, "collectionHash"));
  await validateTrainingRecordCollection(collection, pinned);
});

test("rejects malformed DOI/hash, missing and unknown fields, and damaged projection or snapshot hashes", async () => {
  const { pinned } = await productionRegistry();
  const mutations = [
    [async (value) => { value.records[0].publications[0].doi = "not-a-doi"; }, /DOI/i],
    [async (value) => { value.records[0].recordId = "sha256:bad"; }, /recordId|hash/i],
    [async (value) => { delete value.records[0].trainingDate; }, /trainingDate/i],
    [async (value) => { value.records[0].method.unknown = true; }, /unknown field/i],
    [async (value) => { value.records[0].projectionHash = `sha256:${"0".repeat(64)}`; }, /projectionHash/i],
    [async (value) => { value.snapshotHash = `sha256:${"0".repeat(64)}`; }, /snapshotHash/i]
  ];
  for (const [mutate, pattern] of mutations) {
    const candidate = await validSnapshot();
    await mutate(candidate);
    await assert.rejects(validateTrainingRecordSnapshot(candidate, pinned), pattern);
  }
});

test("rejects forbidden nested fields, explicit private values, decoded XSS, and raw DOI URLs", async () => {
  const { pinned } = await productionRegistry();
  const mutations = [
    [async (value) => { value.records[0].knowledgeAcquired[0].candidateParameterValue = 8.75; }, /forbidden|unknown field/i],
    [async (value) => { value.records[0].publications[0].accessStatement = "sourcePath: /Users/private/report.json"; await rehashDetail(value.records[0]); await rehashSnapshot(value); }, /forbidden/i],
    [async (value) => { value.records[0].publications[0].title = "%253Cscript%253Ealert(1)%253C/script%253E"; await rehashDetail(value.records[0]); await rehashSnapshot(value); }, /forbidden|script/i],
    [async (value) => { value.records[0].publications[0].doiUrl = "https://example.com/raw"; await rehashDetail(value.records[0]); await rehashSnapshot(value); }, /doiUrl/i]
  ];
  for (const [mutate, pattern] of mutations) {
    const candidate = await validSnapshot();
    await mutate(candidate);
    await assert.rejects(validateTrainingRecordSnapshot(candidate, pinned), pattern);
  }
});

test("rejects numeric HTML entities without semicolons after decoded-XSS inspection", async () => {
  const { pinned } = await productionRegistry();
  for (const encodedTitle of [
    "&#x3cscript&#x3ealert(1)&#x3c/script&#x3e",
    "&#60script&#62alert(1)&#60/script&#62"
  ]) {
    const candidate = await validSnapshot();
    candidate.records[0].publications[0].title = encodedTitle;
    await rehashDetail(candidate.records[0]);
    await rehashSnapshot(candidate);
    await assert.rejects(
      validateTrainingRecordSnapshot(candidate, pinned),
      /forbidden|script/i
    );
  }
});

test("accepts exact SHA-1 or SHA-256 snapshot commit IDs and rejects other lengths", async () => {
  const { pinned } = await productionRegistry();
  const sha256Snapshot = await validSnapshot();
  sha256Snapshot.generatedFromCommit = "a".repeat(64);
  await rehashSnapshot(sha256Snapshot);
  await validateTrainingRecordSnapshot(sha256Snapshot, pinned);

  for (const length of [39, 41, 63, 65]) {
    const candidate = await validSnapshot();
    candidate.generatedFromCommit = "a".repeat(length);
    await rehashSnapshot(candidate);
    await assert.rejects(
      validateTrainingRecordSnapshot(candidate, pinned),
      /Git object ID/i
    );
  }
});

test("accepts exact ISO calendar dates for years 0001 through 9999", async () => {
  const { pinned } = await productionRegistry();
  const candidate = await validSnapshot();
  candidate.records[0].trainingDate = "0001-01-01";
  await rehashDetail(candidate.records[0]);
  await rehashSnapshot(candidate);
  await validateTrainingRecordSnapshot(candidate, pinned);
});

test("rejects wrong category, one-character, NFC/NFD, and unknown public statements before hashes", async () => {
  const { pinned } = await productionRegistry();
  const base = await validSnapshot();
  const cases = [
    ["method", (value) => { value.records[0].method.label = value.records[0].limitations[0]; }],
    ["one-character", (value) => { value.records[0].limitations[0] += "!"; }],
    ["normalization", (value) => { value.records[0].limitations[0] = value.records[0].limitations[0].normalize("NFD"); value.records[0].limitations[0] += "\u0301"; }],
    ["unknown", (value) => { value.records[0].uncertaintySummary.summary = "Unknown approved-looking statement."; }]
  ];
  for (const [name, mutate] of cases) {
    const candidate = clone(base);
    mutate(candidate);
    await rehashDetail(candidate.records[0]);
    await rehashSnapshot(candidate);
    await assert.rejects(validateTrainingRecordSnapshot(candidate, pinned), /not approved/i, name);
  }
});

test("verifies shared and fixture P-256 P1363 low-s signatures and rejects tampering", async () => {
  const vectors = await json(`${CONTRACT}model-training-signature-vectors-1.0.0.json`);
  const vector = vectors.vectors[0];
  const message = Uint8Array.from(Buffer.from(vector.message, "base64url"));
  await verifySnapshotSignature(message, vector.signatureEnvelope, vector.pinnedPublicJwk);

  const snapshotBytes = await bytes(`${FIXTURE}model-training-records-1.1.0.json`);
  const envelope = await json(`${FIXTURE}model-training-records-1.1.0.sig.json`);
  const key = await json(`${FIXTURE}test-public-key.jwk.json`);
  await verifySnapshotSignature(snapshotBytes, envelope, key);
  await assert.rejects(verifySnapshotSignature(Uint8Array.from([...snapshotBytes, 32]), envelope, key), /SHA-256|verification/i);
  await assert.rejects(verifySnapshotSignature(snapshotBytes, { ...envelope, signature: envelope.signature.slice(1) }, key), /signature|base64url/i);
  await assert.rejects(verifySnapshotSignature(snapshotBytes, { ...envelope, signature: `${envelope.signature.slice(0, -1)}A` }, key), /verification|canonical/i);
  await assert.rejects(verifySnapshotSignature(snapshotBytes, envelope, { ...key, keyId: `jwk-sha256:${"0".repeat(64)}` }), /keyId/i);

  const raw = Buffer.from(envelope.signature, "base64url");
  const s = BigInt(`0x${raw.subarray(32).toString("hex")}`);
  const highS = P256_ORDER - s;
  const high = Buffer.concat([raw.subarray(0, 32), Buffer.from(highS.toString(16).padStart(64, "0"), "hex")]).toString("base64url");
  await assert.rejects(verifySnapshotSignature(snapshotBytes, { ...envelope, signature: high }, key), /high-s/i);
});

test("rejects zero and out-of-range P-256 signature scalars", async () => {
  const snapshotBytes = await bytes(`${FIXTURE}model-training-records-1.1.0.json`);
  const envelope = await json(`${FIXTURE}model-training-records-1.1.0.sig.json`);
  const key = await json(`${FIXTURE}test-public-key.jwk.json`);
  const raw = Buffer.from(envelope.signature, "base64url");
  const r = BigInt(`0x${raw.subarray(0, 32).toString("hex")}`);
  const s = BigInt(`0x${raw.subarray(32).toString("hex")}`);

  for (const [name, signature] of [
    ["zero r", p1363Signature(0n, s)],
    ["zero s", p1363Signature(r, 0n)],
    ["out-of-range r", p1363Signature(P256_ORDER, s)],
    ["out-of-range s", p1363Signature(r, P256_ORDER)]
  ]) {
    await assert.rejects(
      verifySnapshotSignature(snapshotBytes, { ...envelope, signature }, key),
      /zero|out of range/i,
      name
    );
  }
});

test("rejects coherent wrong keys, malformed coordinates, and invalid P-256 points", async () => {
  const snapshotBytes = await bytes(`${FIXTURE}model-training-records-1.1.0.json`);
  const envelope = await json(`${FIXTURE}model-training-records-1.1.0.sig.json`);
  const key = await json(`${FIXTURE}test-public-key.jwk.json`);
  const keyPair = await globalThis.crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  const wrongCoordinates = await globalThis.crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const coherentWrongKey = await pinnedJwkWithCoordinates(
    key,
    wrongCoordinates.x,
    wrongCoordinates.y
  );
  await assert.rejects(
    verifySnapshotSignature(
      snapshotBytes,
      { ...envelope, keyId: coherentWrongKey.keyId },
      coherentWrongKey
    ),
    /verification/i
  );

  const malformedCoordinates = clone(key);
  malformedCoordinates.jwk.x = "AA";
  await assert.rejects(
    verifySnapshotSignature(snapshotBytes, envelope, malformedCoordinates),
    /coordinates/i
  );

  const zeroCoordinate = Buffer.alloc(32).toString("base64url");
  const invalidPoint = await pinnedJwkWithCoordinates(
    key,
    zeroCoordinate,
    zeroCoordinate
  );
  await assert.rejects(
    verifySnapshotSignature(
      snapshotBytes,
      { ...envelope, keyId: invalidPoint.keyId },
      invalidPoint
    ),
    /point is invalid/i
  );
});

test("verifies signatures in a browser runtime without Node Buffer", async () => {
  const vectors = await json(`${CONTRACT}model-training-signature-vectors-1.0.0.json`);
  const vector = vectors.vectors[0];
  const message = Uint8Array.from(Buffer.from(vector.message, "base64url"));
  const originalBuffer = globalThis.Buffer;
  try {
    globalThis.Buffer = undefined;
    await verifySnapshotSignature(message, vector.signatureEnvelope, vector.pinnedPublicJwk);
  } finally {
    globalThis.Buffer = originalBuffer;
  }
});

test("loads only signature-verified bytes and returns unavailable without stale content", async (t) => {
  const { pinned, releasePin } = await productionRegistry();
  const snapshotBytes = await bytes(`${FIXTURE}model-training-records-1.1.0.json`);
  const signatureBytes = await bytes(`${FIXTURE}model-training-records-1.1.0.sig.json`);
  const keyBytes = await bytes(`${FIXTURE}test-public-key.jwk.json`);
  const options = {
    signatureUrl: dataUrl(signatureBytes),
    publicJwkUrl: dataUrl(keyBytes),
    publicJwkSha256: "sha256:3c6290da13883f8f7054a5b77bd72c7aef887f6c77be10c4c4c9b7e1b3c03269",
    registry: pinned,
    releasePin,
    timeoutMs: 1000
  };
  const loaded = await loadTrainingRecordSnapshot(dataUrl(snapshotBytes), options);
  assert.equal(loaded.status, "available");
  assert.equal(loaded.snapshot.records.length, 2);

  const malformed = await loadTrainingRecordSnapshot(dataUrl(snapshotBytes), { ...options, signatureUrl: dataUrl(new TextEncoder().encode("{}")) });
  assert.deepEqual(malformed, { status: "unavailable", snapshot: null });
  const missing = await loadTrainingRecordSnapshot(dataUrl(snapshotBytes), { ...options, signatureUrl: undefined });
  assert.deepEqual(missing, { status: "unavailable", snapshot: null });
  const network = await loadTrainingRecordSnapshot("http://127.0.0.1:1/model-training.json", options);
  assert.deepEqual(network, { status: "unavailable", snapshot: null });

  t.mock.method(globalThis, "fetch", (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  }));
  const timeout = await loadTrainingRecordSnapshot("https://example.invalid/snapshot", { ...options, timeoutMs: 20 });
  assert.deepEqual(timeout, { status: "unavailable", snapshot: null });
});
