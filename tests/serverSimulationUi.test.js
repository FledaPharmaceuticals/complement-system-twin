import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { getServerSimulationApiBaseUrl } from "../src/serverSimulationConfig.js";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

test("keeps the server endpoint disabled unless the explicit trial query is present", () => {
  const documentObject = {
    querySelector: () => ({ content: "https://api.twins.fledausa.com" })
  };
  assert.equal(getServerSimulationApiBaseUrl({
    globalObject: {},
    documentObject,
    locationObject: { search: "" }
  }), "");
  assert.equal(getServerSimulationApiBaseUrl({
    globalObject: {},
    documentObject,
    locationObject: { search: "?fledaApi=on" }
  }), "");
  assert.equal(getServerSimulationApiBaseUrl({
    globalObject: {},
    documentObject,
    locationObject: { search: "?fledaApi=trial" }
  }), "https://api.twins.fledausa.com");
  assert.equal(getServerSimulationApiBaseUrl({
    globalObject: { FLEDA_COMPLEMENT_API_BASE_URL: "https://evil.example" },
    documentObject,
    locationObject: {
      search: "?fledaApi=trial",
      hostname: "fledapharmaceuticals.github.io",
      origin: "https://fledapharmaceuticals.github.io"
    }
  }), "");
  assert.equal(getServerSimulationApiBaseUrl({
    globalObject: { FLEDA_COMPLEMENT_API_BASE_URL: "http://127.0.0.1:8766" },
    documentObject: null,
    locationObject: {
      search: "?fledaApi=trial",
      hostname: "127.0.0.1",
      origin: "http://127.0.0.1:8766"
    }
  }), "http://127.0.0.1:8766");
});

test("simulation console exposes source provenance and uses the dual-run adapter", () => {
  assert.match(html, /id="simulation-result-source"/);
  assert.match(html, /id="simulation-contract-warning"/);
  assert.match(html, /name="fleda-complement-api-base-url" content="https:\/\/api\.twins\.fledausa\.com"/);
  assert.match(html, /connect-src 'self' https:\/\/api\.twins\.fledausa\.com/);
  assert.match(html, /http:\/\/127\.0\.0\.1:8790/);
  assert.match(app, /isPublicTeachingScenarioId/);
  assert.match(app, /isLegacyParityScenarioId/);
  assert.match(app, /await runDualSimulation\(input/);
  assert.match(app, /const scenarioId = input\.diseaseContext/);
  assert.match(app, /scheduleSimulationRender/);
  assert.match(app, /simulationRequestController\?\.abort/);
  assert.match(app, /signal: requestController\?\.signal/);
  assert.match(app, /execution\.status === "unavailable_no_fallback"/);
  assert.match(app, /execution\.status === "api_verified"[\s\S]*execution\.model\.version/);
  assert.match(app, /simulation-result-source/);
  assert.match(app, /teaching_candidate/);
  assert.match(app, /unstratified/);
  assert.doesNotMatch(app, /serverWarnings\.join/);
});

test("server substitution remains limited to the rule-based result console", () => {
  assert.match(app, /runDynamicsSimulation/);
  assert.match(app, /resolveResearchVitalSigns/);
  assert.match(app, /rankDiseaseSpecificImpacts/);
  assert.match(app, /runComplementSimulation\(buildValidationModelInput/);
});
