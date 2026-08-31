const PUBLIC_API_BASE_URL = "https://api.twins.fledausa.com";

export function getServerSimulationApiBaseUrl({
  globalObject = globalThis,
  documentObject = globalThis.document,
  locationObject = globalThis.location
} = {}) {
  const trialMode = new URLSearchParams(locationObject?.search || "").get("fledaApi");
  if (trialMode !== "trial") return "";
  const configured = globalObject?.FLEDA_COMPLEMENT_API_BASE_URL
    || documentObject?.querySelector?.('meta[name="fleda-complement-api-base-url"]')?.content
    || "";
  const normalized = normalizeBaseUrl(configured);
  if (normalized === PUBLIC_API_BASE_URL) return normalized;
  if (isLoopbackSameOrigin(normalized, locationObject)) return normalized;
  return "";
}

function normalizeBaseUrl(value) {
  try {
    const url = new URL(String(value).trim());
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") return "";
    return url.origin;
  } catch {
    return "";
  }
}

function isLoopbackSameOrigin(baseUrl, locationObject) {
  if (!baseUrl || !locationObject?.origin) return false;
  try {
    const configured = new URL(baseUrl);
    const page = new URL(locationObject.origin);
    const loopback = new Set(["127.0.0.1", "localhost", "::1"]);
    return configured.origin === page.origin
      && loopback.has(configured.hostname)
      && loopback.has(page.hostname);
  } catch {
    return false;
  }
}
