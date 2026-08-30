export function canonicalizeJcs(value) {
  return serialize(value, new Set());
}

export async function createJcsResultId(value, { cryptoImpl = globalThis.crypto } = {}) {
  if (!cryptoImpl?.subtle) throw new Error("Web Crypto SHA-256 is unavailable");
  const bytes = new TextEncoder().encode(canonicalizeJcs(value));
  const digest = await cryptoImpl.subtle.digest("SHA-256", bytes);
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function serialize(value, ancestors) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") {
    if (hasLoneSurrogate(value)) throw new TypeError("RFC8785 requires valid Unicode strings");
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("RFC8785 requires a finite number");
    return JSON.stringify(value);
  }
  if (typeof value !== "object") throw new TypeError("RFC8785 requires a JSON value");
  if (ancestors.has(value)) throw new TypeError("RFC8785 cannot canonicalize a cyclic JSON value");

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value.map((item) => serialize(item, ancestors)).join(",")}]`;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("RFC8785 requires a plain JSON object");
    }
    const entries = Object.keys(value).sort().map((key) => {
      if (hasLoneSurrogate(key)) throw new TypeError("RFC8785 requires valid Unicode object keys");
      return `${JSON.stringify(key)}:${serialize(value[key], ancestors)}`;
    });
    return `{${entries.join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

function hasLoneSurrogate(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}
