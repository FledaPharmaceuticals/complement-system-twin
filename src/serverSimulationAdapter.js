import { runComplementSimulation } from "./simulation.js";
import { validatePublicSimulationResponse } from "./serverSimulationContract.js";

export const LEGACY_PARITY_SCENARIO_IDS = Object.freeze([
  "normal", "AMD", "PNH", "aHUS", "C3G", "sepsis"
]);

const LEGACY_PARITY_SCENARIO_ID_SET = new Set(LEGACY_PARITY_SCENARIO_IDS);
const PUBLIC_TEACHING_SCENARIO_ID_SET = new Set([
  ...LEGACY_PARITY_SCENARIO_IDS,
  "IgA nephropathy",
  "lupus nephritis",
  "cancer microenvironment"
]);

export function isLegacyParityScenarioId(scenarioId) {
  return LEGACY_PARITY_SCENARIO_ID_SET.has(scenarioId);
}

export function isPublicTeachingScenarioId(scenarioId) {
  return PUBLIC_TEACHING_SCENARIO_ID_SET.has(scenarioId);
}

export async function runDualSimulation(input, {
  apiBaseUrl = "",
  scenarioId = input?.diseaseContext || "normal",
  timeoutMs = 5000,
  fetchImpl = globalThis.fetch,
  javascriptRunner = runComplementSimulation,
  signal = null
} = {}) {
  const baseUrl = String(apiBaseUrl || "").trim().replace(/\/+$/, "");
  if (!isPublicTeachingScenarioId(scenarioId)) {
    return {
      status: "unavailable_no_fallback",
      source: "unavailable",
      outputs: null,
      javascriptOutputs: null,
      fallbackReason: "no_equivalent_javascript_fallback",
      detail: null
    };
  }
  if (!baseUrl) {
    return javascriptDefault(javascriptRunner(input), "api_not_configured");
  }
  if (!isLegacyParityScenarioId(scenarioId)) {
    return javascriptDefault(javascriptRunner(input), "api_scenario_not_supported");
  }
  const javascriptOutputs = javascriptRunner(input);
  if (typeof fetchImpl !== "function") {
    return fallback(javascriptOutputs, "network_error");
  }

  const controller = new AbortController();
  const cancelRequest = () => controller.abort();
  signal?.addEventListener?.("abort", cancelRequest, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
  try {
    const response = await fetchImpl(`${baseUrl}/v1/simulations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario_id: scenarioId, inputs: input }),
      signal: controller.signal
    });

    if (response.status >= 500 && response.status <= 599) {
      return fallback(javascriptOutputs, "server_5xx");
    }
    if (!response.ok) {
      return directError(response, await readErrorMessage(response));
    }

    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      return fallback(javascriptOutputs, "invalid_schema");
    }
    const validation = await validatePublicSimulationResponse(payload, {
      expectedScenarioId: scenarioId,
      diseaseContext: input?.diseaseContext,
      javascriptOutputs
    });
    if (!validation.ok) {
      return fallback(javascriptOutputs, validation.reason, validation.detail);
    }

    return {
      status: "api_verified",
      source: "api",
      outputs: validation.outputs,
      javascriptOutputs: structuredClone(javascriptOutputs),
      resultId: validation.resultId,
      model: validation.model,
      warnings: validation.warnings
    };
  } catch (error) {
    const reason = error?.name === "AbortError"
      ? signal?.aborted ? "request_cancelled" : "timeout"
      : "network_error";
    return fallback(javascriptOutputs, reason);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener?.("abort", cancelRequest);
  }
}

function javascriptDefault(javascriptOutputs, reason) {
  return {
    status: "javascript_default",
    source: "javascript",
    outputs: structuredClone(javascriptOutputs),
    javascriptOutputs: structuredClone(javascriptOutputs),
    fallbackReason: reason,
    detail: null
  };
}

function fallback(javascriptOutputs, fallbackReason, detail = null) {
  return {
    status: "javascript_fallback",
    source: "javascript",
    outputs: structuredClone(javascriptOutputs),
    javascriptOutputs: structuredClone(javascriptOutputs),
    fallbackReason,
    detail
  };
}

async function readErrorMessage(response) {
  try {
    const payload = await response.json();
    if (typeof payload?.detail === "string") return payload.detail;
    if (payload?.detail) return JSON.stringify(payload.detail);
  } catch {
    try {
      const message = await response.text();
      if (message) return message;
    } catch {
      // The status code remains the authoritative classification.
    }
  }
  return `Request failed with HTTP ${response.status}`;
}

function directError(response, message) {
  const categories = {
    400: "input_error",
    422: "input_error",
    413: "service_limit",
    429: "service_limit",
    404: "deployment_error"
  };
  return {
    status: "request_error",
    category: categories[response.status] ?? "request_error",
    httpStatus: response.status,
    message,
    retryAfter: response.status === 429 ? response.headers.get("Retry-After") : null,
    outputs: null
  };
}
