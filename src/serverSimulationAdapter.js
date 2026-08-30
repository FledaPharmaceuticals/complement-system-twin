import { runComplementSimulation } from "./simulation.js";
import { validatePublicSimulationResponse } from "./serverSimulationContract.js";

export async function runDualSimulation(input, {
  apiBaseUrl = "",
  scenarioId = `browser-${input?.diseaseContext || "normal"}`,
  timeoutMs = 5000,
  fetchImpl = globalThis.fetch,
  javascriptRunner = runComplementSimulation
} = {}) {
  const javascriptOutputs = javascriptRunner(input);
  const baseUrl = String(apiBaseUrl || "").trim().replace(/\/+$/, "");
  if (!baseUrl || typeof fetchImpl !== "function") {
    return fallback(javascriptOutputs, "api_not_configured");
  }

  const controller = new AbortController();
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
    const reason = error?.name === "AbortError" ? "timeout" : "network_error";
    return fallback(javascriptOutputs, reason);
  } finally {
    clearTimeout(timeout);
  }
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
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    try {
      const message = await response.text();
      if (message) return message;
    } catch (textError) {
      if (textError?.name === "AbortError") throw textError;
      // The status code remains the authoritative classification.
    }
  }
  return `Request failed with HTTP ${response.status}`;
}

function directError(response, message) {
  const categories = {
    400: "input_error",
    422: "validation_error",
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
