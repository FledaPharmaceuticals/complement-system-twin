import { sha256Bytes, sha256Canonical } from "./canonicalHash.js";
import { validateTrainingRecordSnapshot } from "./validateTrainingRecord.js";

const P256_ORDER = BigInt("0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551");
const HASH = /^sha256:[0-9a-f]{64}$/;
const KEY_ID = /^jwk-sha256:[0-9a-f]{64}$/;
const B64URL = /^[A-Za-z0-9_-]+$/;
const UNAVAILABLE = Object.freeze({ status: "unavailable", snapshot: null });

function fail(message) {
  throw new TypeError(message);
}

function exactKeys(value, fields, name) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${name} must be an object`);
  const expected = new Set(fields);
  for (const field of fields) if (!Object.hasOwn(value, field)) fail(`${name}.${field} is required`);
  for (const field of Object.keys(value)) if (!expected.has(field)) fail(`${name}.${field} is an unknown field`);
}

function decodeBase64url(value, name) {
  if (typeof value !== "string" || !value || !B64URL.test(value) || value.includes("=")) fail(`${name} is malformed base64url`);
  let raw;
  try {
    const encoded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    raw = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
  } catch {
    fail(`${name} is malformed base64url`);
  }
  const canonical = btoa(String.fromCharCode(...raw)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  if (canonical !== value) fail(`${name} is not canonical base64url`);
  return raw;
}

function bytesToBigInt(value) {
  let result = 0n;
  for (const byte of value) result = (result << 8n) | BigInt(byte);
  return result;
}

function asBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  fail("snapshot must be exact bytes");
}

async function validatePinnedJwk(value) {
  exactKeys(value, ["schemaName", "schemaVersion", "purpose", "keyId", "jwkFingerprint", "jwk"], "pinnedPublicJwk");
  if (value.schemaName !== "FledaPinnedSnapshotPublicJwk" || value.schemaVersion !== "1.0.0") fail("pinned public JWK schema is invalid");
  if (!["snapshot_signature_verification", "test_only_conformance"].includes(value.purpose)) fail("pinned public JWK purpose is invalid");
  if (typeof value.keyId !== "string" || !KEY_ID.test(value.keyId)) fail("pinned public JWK keyId is invalid");
  if (typeof value.jwkFingerprint !== "string" || !HASH.test(value.jwkFingerprint)) fail("pinned public JWK fingerprint is invalid");
  exactKeys(value.jwk, ["kty", "crv", "x", "y", "alg", "key_ops", "kid", "use"], "pinnedPublicJwk.jwk");
  const jwk = value.jwk;
  if (jwk.kty !== "EC" || jwk.crv !== "P-256" || jwk.alg !== "ES256" || jwk.use !== "sig") fail("pinned public JWK algorithm is invalid");
  if (!Array.isArray(jwk.key_ops) || jwk.key_ops.length !== 1 || jwk.key_ops[0] !== "verify") fail("pinned public JWK key operations are invalid");
  if (typeof jwk.kid !== "string" || !KEY_ID.test(jwk.kid)) fail("pinned public JWK inner keyId is invalid");
  if (decodeBase64url(jwk.x, "pinnedPublicJwk.jwk.x").byteLength !== 32 || decodeBase64url(jwk.y, "pinnedPublicJwk.jwk.y").byteLength !== 32) fail("pinned public JWK coordinates are invalid");
  const fingerprint = await sha256Canonical({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y });
  if (value.jwkFingerprint !== fingerprint) fail("pinned JWK fingerprint does not match key");
  const expectedKeyId = `jwk-sha256:${fingerprint.slice(7)}`;
  if (value.keyId !== expectedKeyId || jwk.kid !== expectedKeyId) fail("pinned JWK keyId does not match fingerprint");
  return value;
}

function validateEnvelope(value) {
  exactKeys(value, ["schemaName", "schemaVersion", "keyId", "algorithm", "snapshotSha256", "signature"], "signature");
  if (value.schemaName !== "FledaModelTrainingSnapshotSignature" || value.schemaVersion !== "1.0.0") fail("signature envelope schema is invalid");
  if (typeof value.keyId !== "string" || !KEY_ID.test(value.keyId)) fail("signature keyId is invalid");
  if (value.algorithm !== "ECDSA-P256-SHA256-P1363") fail("signature algorithm is invalid");
  if (typeof value.snapshotSha256 !== "string" || !HASH.test(value.snapshotSha256)) fail("signature snapshotSha256 is invalid");
  if (typeof value.signature !== "string" || value.signature.length !== 86) fail("signature must be canonical 64-byte P1363 base64url");
  return value;
}

export async function verifySnapshotSignature(snapshot, signature, pinnedPublicJwk, { cryptoImpl = globalThis.crypto } = {}) {
  if (!cryptoImpl?.subtle) fail("Web Crypto signature verification is unavailable");
  const bytes = asBytes(snapshot);
  const pinned = await validatePinnedJwk(pinnedPublicJwk);
  const envelope = validateEnvelope(signature);
  if (envelope.keyId !== pinned.keyId) fail("signature keyId does not match pinned JWK");
  if (envelope.snapshotSha256 !== await sha256Bytes(bytes, { cryptoImpl })) fail("snapshot SHA-256 does not match envelope");
  const rawSignature = decodeBase64url(envelope.signature, "signature.signature");
  if (rawSignature.byteLength !== 64) fail("signature must be 64-byte IEEE-P1363");
  const r = bytesToBigInt(rawSignature.slice(0, 32));
  const s = bytesToBigInt(rawSignature.slice(32));
  if (r < 1n || r >= P256_ORDER || s < 1n || s >= P256_ORDER) fail("signature scalar is zero or out of range");
  if (s > P256_ORDER / 2n) fail("signature uses noncanonical high-s scalar");
  let key;
  try {
    key = await cryptoImpl.subtle.importKey("jwk", pinned.jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  } catch {
    fail("pinned public JWK point is invalid");
  }
  const verified = await cryptoImpl.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, rawSignature, bytes);
  if (!verified) fail("snapshot signature verification failed");
}

function sameReleasePin(registry, releasePin) {
  exactKeys(releasePin, ["expectedSchemaVersion", "expectedRegistryHash", "expectedReleaseCommit"], "releasePin");
  const expected = registry?.releasePin;
  if (!expected || expected.expectedSchemaVersion !== releasePin.expectedSchemaVersion
    || expected.expectedRegistryHash !== releasePin.expectedRegistryHash
    || expected.expectedReleaseCommit !== releasePin.expectedReleaseCommit) {
    fail("release pin does not match the pinned registry");
  }
}

async function fetchBytes(url, signal) {
  if (typeof url !== "string" || !url) fail("release URL is required");
  const response = await fetch(url, { signal, cache: "no-store", credentials: "omit" });
  if (!response.ok) fail("release artifact fetch failed");
  return new Uint8Array(await response.arrayBuffer());
}

export async function loadTrainingRecordSnapshot(url, options) {
  let timeout;
  try {
    exactKeys(options, ["signatureUrl", "publicJwkUrl", "publicJwkSha256", "registry", "releasePin", "timeoutMs"], "options");
    sameReleasePin(options.registry, options.releasePin);
    if (typeof options.publicJwkSha256 !== "string" || !HASH.test(options.publicJwkSha256)) fail("publicJwkSha256 is invalid");
    if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1 || options.timeoutMs > 60_000) fail("timeoutMs is invalid");
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), options.timeoutMs);
    const [snapshotBytes, signatureBytes, publicJwkBytes] = await Promise.all([
      fetchBytes(url, controller.signal),
      fetchBytes(options.signatureUrl, controller.signal),
      fetchBytes(options.publicJwkUrl, controller.signal)
    ]);
    if (await sha256Bytes(publicJwkBytes) !== options.publicJwkSha256) fail("public JWK SHA-256 does not match release pin");
    const signature = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(signatureBytes));
    const publicJwk = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(publicJwkBytes));
    await verifySnapshotSignature(snapshotBytes, signature, publicJwk);
    const snapshotPayload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(snapshotBytes));
    const snapshot = await validateTrainingRecordSnapshot(snapshotPayload, options.registry);
    return Object.freeze({ status: "available", snapshot });
  } catch {
    return UNAVAILABLE;
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}
