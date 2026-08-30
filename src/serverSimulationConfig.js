export function getServerSimulationApiBaseUrl({
  globalObject = globalThis,
  documentObject = globalThis.document
} = {}) {
  const configured = globalObject?.FLEDA_COMPLEMENT_API_BASE_URL
    || documentObject?.querySelector?.('meta[name="fleda-complement-api-base-url"]')?.content
    || "";
  return String(configured).trim().replace(/\/+$/, "");
}
