import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { createJcsResultId } from "../src/jcsResultHash.js";
import { runComplementSimulation } from "../src/simulation.js";
import {
  isLegacyParityScenarioId,
  isPublicTeachingScenarioId,
  runDualSimulation
} from "../src/serverSimulationAdapter.js";

const fixture = JSON.parse(await readFile(
  new URL("../fixtures/c3-safe-simulation/normal-response.json", import.meta.url),
  "utf8"
));
const input = {
  classical: 35,
  lectin: 30,
  alternative: 45,
  terminal: 45,
  factorH: 80,
  factorI: 80,
  cd55: 85,
  cd59: 85,
  c1sInhibition: 0,
  masp2Inhibition: 0,
  c3Inhibition: 0,
  factorBInhibition: 0,
  factorDInhibition: 0,
  c5Inhibition: 0,
  c5aRInhibition: 0,
  diseaseContext: "normal"
};

test("runs JavaScript and API together and uses only a fully verified API result", async () => {
  let javascriptCalls = 0;
  let requestBody;
  const result = await runDualSimulation(input, {
    apiBaseUrl: "https://model.example",
    scenarioId: "normal",
    javascriptRunner: (value) => {
      javascriptCalls += 1;
      return runComplementSimulation(value);
    },
    fetchImpl: async (url, options) => {
      assert.equal(url, "https://model.example/v1/simulations");
      requestBody = JSON.parse(options.body);
      return jsonResponse(fixture);
    }
  });

  assert.equal(javascriptCalls, 1);
  assert.deepEqual(requestBody, { scenario_id: "normal", inputs: input });
  assert.equal(result.status, "api_verified");
  assert.equal(result.source, "api");
  assert.deepEqual(result.outputs, fixture.publicResult.outputs);
  assert.deepEqual(result.javascriptOutputs, fixture.outputs);
});

test("falls back to JavaScript for invalid schema, hash, and numerical mismatch", async () => {
  for (const [expectedReason, mutate] of [
    ["invalid_schema", (response) => { response.publicResult.extra = true; }],
    ["invalid_result_hash", (response) => { response.publicResult.resultId = `sha256:${"0".repeat(64)}`; }],
    ["result_mismatch", (response) => {
      response.outputs.c3Activation += 0.1;
      response.publicResult.outputs.c3Activation += 0.1;
    }]
  ]) {
    const response = structuredClone(fixture);
    mutate(response);
    if (expectedReason === "result_mismatch") {
      const hashPayload = structuredClone(response.publicResult);
      delete hashPayload.resultId;
      response.publicResult.resultId = await createJcsResultId(hashPayload);
    }
    const result = await runDualSimulation(input, {
      apiBaseUrl: "https://model.example",
      scenarioId: "normal",
      fetchImpl: async () => jsonResponse(response)
    });
    assert.equal(result.status, "javascript_fallback");
    assert.equal(result.fallbackReason, expectedReason);
    assert.deepEqual(result.outputs, runComplementSimulation(input));
  }
});

test("falls back for network errors, timeouts, and server 5xx", async () => {
  const cases = [
    ["network_error", async () => { throw new TypeError("offline"); }],
    ["timeout", async (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("timed out", "AbortError")));
    })],
    ["server_5xx", async () => jsonResponse({ detail: "unavailable" }, 503)]
  ];

  for (const [reason, fetchImpl] of cases) {
    const result = await runDualSimulation(input, {
      apiBaseUrl: "https://model.example",
      scenarioId: "normal",
      timeoutMs: 5,
      fetchImpl
    });
    assert.equal(result.status, "javascript_fallback");
    assert.equal(result.fallbackReason, reason);
  }
});

test("keeps the timeout active while the response body is being read", async () => {
  const execution = runDualSimulation(input, {
    apiBaseUrl: "https://model.example",
    scenarioId: "normal",
    timeoutMs: 5,
    fetchImpl: async (_url, { signal }) => ({
      status: 200,
      ok: true,
      json: () => new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("timed out", "AbortError")));
      })
    })
  });
  const result = await Promise.race([
    execution,
    new Promise((resolve) => setTimeout(() => resolve({ status: "test_timeout" }), 50))
  ]);

  assert.equal(result.status, "javascript_fallback");
  assert.equal(result.fallbackReason, "timeout");
  assert.deepEqual(result.outputs, runComplementSimulation(input));
});

test("cancels a superseded API request without reclassifying it as a timeout", async () => {
  const controller = new AbortController();
  const execution = runDualSimulation(input, {
    apiBaseUrl: "https://model.example",
    scenarioId: "normal",
    signal: controller.signal,
    fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("cancelled", "AbortError")));
    })
  });

  controller.abort();
  const result = await execution;

  assert.equal(result.status, "javascript_fallback");
  assert.equal(result.fallbackReason, "request_cancelled");
});

test("preserves a known HTTP error when its response body times out", async () => {
  const result = await runDualSimulation(input, {
    apiBaseUrl: "https://model.example",
    scenarioId: "normal",
    timeoutMs: 5,
    fetchImpl: async (_url, { signal }) => ({
      status: 429,
      ok: false,
      headers: new Headers({ "Retry-After": "30" }),
      json: () => new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("timed out", "AbortError")));
      }),
      text: async () => ""
    })
  });

  assert.equal(result.status, "request_error");
  assert.equal(result.category, "service_limit");
  assert.equal(result.httpStatus, 429);
  assert.equal(result.retryAfter, "30");
  assert.equal(result.message, "Request failed with HTTP 429");
  assert.equal(result.outputs, null);
});

test("returns direct typed errors for input, validation, limit, and deployment responses", async () => {
  const cases = [
    [400, "input_error"],
    [422, "input_error"],
    [413, "service_limit"],
    [404, "deployment_error"]
  ];
  for (const [status, category] of cases) {
    const result = await runDualSimulation(input, {
      apiBaseUrl: "https://model.example",
      scenarioId: "normal",
      fetchImpl: async () => jsonResponse({ detail: `status ${status}` }, status)
    });
    assert.equal(result.status, "request_error");
    assert.equal(result.category, category);
    assert.equal(result.httpStatus, status);
    assert.equal(result.outputs, null);
  }
});

test("reads Retry-After for a 429 without falling back", async () => {
  const result = await runDualSimulation(input, {
    apiBaseUrl: "https://model.example",
    scenarioId: "normal",
    fetchImpl: async () => jsonResponse({ detail: "rate limited" }, 429, { "Retry-After": "30" })
  });

  assert.equal(result.status, "request_error");
  assert.equal(result.category, "service_limit");
  assert.equal(result.retryAfter, "30");
  assert.equal(result.outputs, null);
});

test("uses the existing JavaScript engine when no API endpoint is configured", async () => {
  const result = await runDualSimulation(input, { apiBaseUrl: "" });

  assert.equal(result.status, "javascript_default");
  assert.equal(result.fallbackReason, "api_not_configured");
  assert.deepEqual(result.outputs, runComplementSimulation(input));
});

test("does not send unsupported or future scenarios to the parity endpoint", async () => {
  let fetchCalls = 0;
  const result = await runDualSimulation({ ...input, diseaseContext: "future-mechanism" }, {
    apiBaseUrl: "https://model.example",
    scenarioId: "sim-11111111111111111111111111111111",
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error("must not be called");
    }
  });

  assert.equal(fetchCalls, 0);
  assert.equal(result.status, "unavailable_no_fallback");
  assert.equal(result.fallbackReason, "no_equivalent_javascript_fallback");
  assert.equal(result.outputs, null);
});

test("recognizes only the six differential-verified parity scenarios", () => {
  assert.equal(isLegacyParityScenarioId("normal"), true);
  assert.equal(isLegacyParityScenarioId("AMD"), true);
  assert.equal(isLegacyParityScenarioId("C3G"), true);
  assert.equal(isLegacyParityScenarioId("IgA nephropathy"), false);
  assert.equal(isLegacyParityScenarioId("sim-11111111111111111111111111111111"), false);
  assert.equal(isPublicTeachingScenarioId("IgA nephropathy"), true);
  assert.equal(isPublicTeachingScenarioId("future-mechanism"), false);
});

test("keeps an existing non-parity teaching scenario in JavaScript without an API request", async () => {
  let fetchCalls = 0;
  const result = await runDualSimulation({ ...input, diseaseContext: "IgA nephropathy" }, {
    apiBaseUrl: "https://model.example",
    scenarioId: "IgA nephropathy",
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error("must not be called");
    }
  });

  assert.equal(fetchCalls, 0);
  assert.equal(result.status, "javascript_default");
  assert.equal(result.fallbackReason, "api_scenario_not_supported");
  assert.equal(result.outputs.diseaseLabel, "IgA nephropathy");
});

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  });
}
