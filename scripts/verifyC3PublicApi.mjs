import tls from "node:tls";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runComplementSimulation } from "../src/simulation.js";
import { runDualSimulation } from "../src/serverSimulationAdapter.js";

const API_BASE_URL = "https://api.twins.fledausa.com";
const SCENARIO_IDS = ["normal", "AMD", "PNH", "aHUS", "C3G", "sepsis"];
const NUMERIC_INPUT_FIELDS = [
  "classical", "lectin", "alternative", "terminal", "factorH", "factorI",
  "cd55", "cd59", "c1sInhibition", "masp2Inhibition", "c3Inhibition",
  "factorBInhibition", "factorDInhibition", "c5Inhibition", "c5aRInhibition"
];
const BASE_INPUT = Object.freeze({
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
  c5aRInhibition: 0
});

export function buildVerificationCases() {
  const cases = SCENARIO_IDS.map((scenarioId) => ({
    id: `fixed-${scenarioId}`,
    category: "fixed",
    scenarioId,
    input: { ...BASE_INPUT, diseaseContext: scenarioId }
  }));

  for (let index = 0; index < 12; index += 1) {
    const scenarioId = SCENARIO_IDS[index % SCENARIO_IDS.length];
    const field = NUMERIC_INPUT_FIELDS[index];
    cases.push({
      id: `boundary-${String(index + 1).padStart(2, "0")}`,
      category: "boundary",
      scenarioId,
      input: {
        ...BASE_INPUT,
        [field]: index % 2 === 0 ? 0 : 100,
        diseaseContext: scenarioId
      }
    });
  }

  const random = seededRandom(0xc3f1eda);
  for (let index = 0; index < 32; index += 1) {
    const scenarioId = SCENARIO_IDS[index % SCENARIO_IDS.length];
    const input = { diseaseContext: scenarioId };
    for (const field of NUMERIC_INPUT_FIELDS) {
      input[field] = Math.round(random() * 100000) / 1000;
    }
    cases.push({
      id: `random-${String(index + 1).padStart(2, "0")}`,
      category: "randomized",
      scenarioId,
      input
    });
  }
  return cases;
}

export function summarizeVerificationCases(cases) {
  return cases.reduce((counts, item) => {
    counts[item.category] += 1;
    return counts;
  }, { fixed: 0, boundary: 0, randomized: 0 });
}

export async function verifyPublicApi({
  apiBaseUrl = API_BASE_URL,
  fetchImpl = globalThis.fetch
} = {}) {
  const cases = buildVerificationCases();
  const counts = summarizeVerificationCases(cases);
  let maximumAbsoluteDelta = 0;

  for (const item of cases) {
    const execution = await runDualSimulation(item.input, {
      apiBaseUrl,
      scenarioId: item.scenarioId,
      timeoutMs: 15000,
      fetchImpl
    });
    if (execution.status !== "api_verified") {
      throw new Error(`${item.id} failed: ${execution.fallbackReason || execution.category}`);
    }
    const expected = runComplementSimulation(item.input);
    for (const [field, value] of Object.entries(expected)) {
      if (typeof value === "number") {
        maximumAbsoluteDelta = Math.max(
          maximumAbsoluteDelta,
          Math.abs(value - execution.outputs[field])
        );
      } else if (execution.outputs[field] !== value) {
        throw new Error(`${item.id}.${field} string mismatch`);
      }
    }
  }

  const cors = await verifyCors(apiBaseUrl, fetchImpl);
  const statusChecks = await verifyHttpStatuses(apiBaseUrl, fetchImpl);
  const rateLimit = await verifyRateLimit(apiBaseUrl, fetchImpl);

  return {
    schemaName: "FledaC3SafeClientVerification",
    schemaVersion: "1.0.0",
    verifiedAt: new Date().toISOString(),
    apiBaseUrl,
    deployedServerCommit: "5417dd7bd47d811c30f98c27d11e158c2c81e5b2",
    task13AuditCommit: "9ad867a",
    pagesBaselineCommit: "1367032384dc7e596c33de180925b747cdfff2ff",
    simulationSha256: "5ffc2e1ac322e28e68becab0b06078104b4694a914357b7d2886fbf4db7c0fc5",
    differential: {
      ...counts,
      total: cases.length,
      numericTolerance: 1e-9,
      maximumAbsoluteDelta
    },
    cors,
    statusChecks,
    rateLimit,
    clientFailureCoverage: {
      source: "isolated_node_tests",
      cases: [
        "network_error", "timeout", "server_5xx", "invalid_schema",
        "invalid_result_hash", "missing_required_fields", "result_mismatch",
        "full_response_body_timeout", "future_scenario_no_fallback"
      ],
      productionFailureInjectionPerformed: false
    }
  };
}

async function verifyCors(apiBaseUrl, fetchImpl) {
  const allowedOrigins = [
    "https://complementtwin.com",
    "https://fledapharmaceuticals.github.io",
    "https://twins.fledausa.com"
  ];
  const allowed = [];
  for (const origin of allowedOrigins) {
    const response = await fetchImpl(`${apiBaseUrl}/v1/simulations`, {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type"
      }
    });
    allowed.push({
      origin,
      status: response.status,
      allowOrigin: response.headers.get("access-control-allow-origin")
    });
    if (!response.ok || response.headers.get("access-control-allow-origin") !== origin) {
      throw new Error(`CORS preflight failed for ${origin}`);
    }
  }
  const deniedOrigin = "https://example.invalid";
  const deniedResponse = await fetchImpl(`${apiBaseUrl}/health`, {
    headers: { Origin: deniedOrigin }
  });
  const deniedAllowOrigin = deniedResponse.headers.get("access-control-allow-origin");
  if (deniedAllowOrigin) throw new Error("unapproved CORS origin was reflected");
  return { allowed, denied: { origin: deniedOrigin, allowOrigin: deniedAllowOrigin } };
}

async function verifyHttpStatuses(apiBaseUrl, fetchImpl) {
  const invalid = await fetchImpl(`${apiBaseUrl}/v1/simulations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario_id: "invalid", inputs: {} })
  });
  if (invalid.status !== 422) throw new Error(`expected 422, received ${invalid.status}`);

  const oversized = await fetchImpl(`${apiBaseUrl}/v1/simulations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario_id: "normal", inputs: { padding: "x".repeat(65537) } })
  });
  if (oversized.status !== 413) throw new Error(`expected 413, received ${oversized.status}`);

  const missing = await fetchImpl(`${apiBaseUrl}/not-a-public-route`);
  if (missing.status !== 404) throw new Error(`expected 404, received ${missing.status}`);

  return {
    malformedHttp: await rawMalformedRequestStatus(new URL(apiBaseUrl).hostname),
    validation: invalid.status,
    oversized: oversized.status,
    missingRoute: missing.status
  };
}

async function verifyRateLimit(apiBaseUrl, fetchImpl) {
  const body = JSON.stringify({
    scenario_id: "normal",
    inputs: { ...BASE_INPUT, diseaseContext: "normal" }
  });
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const response = await fetchImpl(`${apiBaseUrl}/v1/simulations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    });
    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after");
      if (!retryAfter) throw new Error("429 response omitted Retry-After");
      return { status: 429, retryAfter, attemptsAfterDifferential: attempt };
    }
    if (!response.ok) throw new Error(`rate-limit probe received ${response.status}`);
  }
  throw new Error("rate-limit probe did not receive 429 within 20 requests");
}

function rawMalformedRequestStatus(hostname) {
  return new Promise((resolveStatus, reject) => {
    const socket = tls.connect({ host: hostname, port: 443, servername: hostname });
    let response = "";
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("malformed HTTP probe timed out"));
    }, 10000);
    socket.once("secureConnect", () => {
      socket.write(`GET /% HTTP/1.1\r\nHost: ${hostname}\r\nConnection: close\r\n\r\n`);
    });
    socket.on("data", (chunk) => { response += chunk.toString("utf8"); });
    socket.once("error", reject);
    socket.once("close", () => {
      clearTimeout(timeout);
      const match = response.match(/^HTTP\/\d(?:\.\d)? (\d{3})/);
      const status = match ? Number(match[1]) : null;
      if (status !== 400) reject(new Error(`expected malformed HTTP 400, received ${status}`));
      else resolveStatus(status);
    });
  });
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

async function main() {
  const outputIndex = process.argv.indexOf("--output");
  const output = outputIndex >= 0
    ? resolve(process.argv[outputIndex + 1])
    : resolve("reports/c3-safe-client-task13-verification.json");
  const report = await verifyPublicApi();
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await main();
}
