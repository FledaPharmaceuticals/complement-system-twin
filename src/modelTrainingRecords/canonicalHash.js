const HASH_PREFIX = "sha256:";

function assertValidUnicode(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new TypeError("JCS rejects lone Unicode surrogates");
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new TypeError("JCS rejects lone Unicode surrogates");
    }
  }
}

function serialize(value, ancestors) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") {
    assertValidUnicode(value);
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("JCS requires finite IEEE-754 numbers");
    if (Object.is(value, -0)) throw new TypeError("JCS rejects negative zero");
    return JSON.stringify(value);
  }
  if (typeof value !== "object") throw new TypeError(`JCS cannot serialize ${typeof value}`);
  if (ancestors.has(value)) throw new TypeError("JCS cannot serialize cyclic values");

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value.map((item) => serialize(item, ancestors)).join(",")}]`;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("JCS requires plain JSON objects");
    }
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => {
      assertValidUnicode(key);
      return `${JSON.stringify(key)}:${serialize(value[key], ancestors)}`;
    }).join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalizeJcs(value) {
  return serialize(value, new Set());
}

function asBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new TypeError("SHA-256 input must be exact bytes");
}

export async function sha256Bytes(value, { cryptoImpl = globalThis.crypto } = {}) {
  if (!cryptoImpl?.subtle) throw new Error("Web Crypto SHA-256 is unavailable");
  const digest = await cryptoImpl.subtle.digest("SHA-256", asBytes(value));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${HASH_PREFIX}${hex}`;
}

export function sha256Canonical(value, options) {
  return sha256Bytes(new TextEncoder().encode(canonicalizeJcs(value)), options);
}
