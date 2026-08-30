const HASH_PREFIX = "sha256:";

function assertValidUnicode(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new TypeError("JCS rejects lone Unicode surrogates");
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new TypeError("JCS rejects lone Unicode surrogates");
    }
  }
}

export function canonicalizeJcs(value) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") {
    assertValidUnicode(value);
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("JCS requires finite IEEE-754 numbers");
    if (Object.is(value, -0)) throw new TypeError("JCS input must not contain negative zero");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalizeJcs).join(",")}]`;
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => {
      assertValidUnicode(key);
      const member = value[key];
      if (member === undefined || typeof member === "function" || typeof member === "symbol" || typeof member === "bigint") {
        throw new TypeError(`JCS cannot serialize member ${key}`);
      }
      return `${JSON.stringify(key)}:${canonicalizeJcs(member)}`;
    }).join(",")}}`;
  }
  throw new TypeError(`JCS cannot serialize ${typeof value}`);
}

async function sha256Utf8(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return `${HASH_PREFIX}${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function sha256Jcs(value) {
  return sha256Utf8(canonicalizeJcs(value));
}

export function computePackageHash(packageValue) {
  const { packageHash: _excluded, ...hashable } = packageValue;
  return sha256Jcs(hashable);
}

function valueAt(object, path) {
  return path.reduce((value, key) => value?.[key], object) ?? null;
}

export function buildLocatorFingerprintInput(observation) {
  return {
    contentHash: valueAt(observation, ["source", "contentHash"]),
    sourceKind: valueAt(observation, ["locator", "sourceKind"]),
    section: valueAt(observation, ["locator", "section"]),
    page: valueAt(observation, ["locator", "page"]),
    tableId: valueAt(observation, ["locator", "tableId"]),
    figureId: valueAt(observation, ["locator", "figureId"]),
    panel: valueAt(observation, ["locator", "panel"]),
    rowLabel: valueAt(observation, ["locator", "rowLabel"]),
    columnLabel: valueAt(observation, ["locator", "columnLabel"]),
    boundingBox: valueAt(observation, ["locator", "boundingBox"]),
    axis: valueAt(observation, ["locator", "axis"])
  };
}

export function computeLocatorFingerprint(observation) {
  return sha256Jcs(buildLocatorFingerprintInput(observation));
}

export async function buildMeasurementFingerprintInput(observation) {
  return {
    locatorFingerprint: await computeLocatorFingerprint(observation),
    analyte: valueAt(observation, ["biologicalContext", "analyte"]),
    canonicalEntityId: valueAt(observation, ["biologicalContext", "canonicalEntityId"]),
    matrix: valueAt(observation, ["biologicalContext", "matrix"]),
    tissue: valueAt(observation, ["biologicalContext", "tissue"]),
    compartment: valueAt(observation, ["biologicalContext", "compartment"]),
    disease: valueAt(observation, ["biologicalContext", "disease"]),
    subtype: valueAt(observation, ["biologicalContext", "subtype"]),
    spatialScope: valueAt(observation, ["biologicalContext", "spatialScope"]),
    experimentalSetting: valueAt(observation, ["biologicalContext", "experimentalSetting"]),
    groupId: valueAt(observation, ["experiment", "groupId"]),
    comparisonId: valueAt(observation, ["experiment", "comparisonId"]),
    intervention: valueAt(observation, ["experiment", "intervention"]),
    dose: valueAt(observation, ["experiment", "dose"]),
    doseUnit: valueAt(observation, ["experiment", "doseUnit"]),
    timepoint: valueAt(observation, ["experiment", "timepoint"]),
    timeUnit: valueAt(observation, ["experiment", "timeUnit"]),
    timepointAnchor: valueAt(observation, ["experiment", "timepointAnchor"]),
    endpoint: valueAt(observation, ["measurement", "endpoint"]),
    reportedStatistic: valueAt(observation, ["measurement", "reportedStatistic"]),
    value: valueAt(observation, ["measurement", "value"]),
    reportedValueText: valueAt(observation, ["measurement", "reportedValueText"]),
    reportedUnit: valueAt(observation, ["measurement", "reportedUnit"]),
    unitCode: valueAt(observation, ["measurement", "unitCode"]),
    valueQualifier: valueAt(observation, ["measurement", "valueQualifier"]),
    censored: valueAt(observation, ["measurement", "censored"])
  };
}

export async function computeMeasurementFingerprint(observation) {
  return sha256Jcs(await buildMeasurementFingerprintInput(observation));
}
