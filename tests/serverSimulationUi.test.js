import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { getServerSimulationApiBaseUrl } from "../src/serverSimulationConfig.js";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

test("keeps the server endpoint disabled until an independent Fleda URL is configured", () => {
  assert.equal(getServerSimulationApiBaseUrl({ globalObject: {}, documentObject: null }), "");
  assert.equal(getServerSimulationApiBaseUrl({
    globalObject: { FLEDA_COMPLEMENT_API_BASE_URL: "https://model.fleda.example/" },
    documentObject: null
  }), "https://model.fleda.example");
});

test("simulation console exposes source provenance and uses the dual-run adapter", () => {
  assert.match(html, /id="simulation-result-source"/);
  assert.match(html, /id="simulation-contract-warning"/);
  assert.match(html, /name="fleda-complement-api-base-url" content=""/);
  assert.match(app, /import \{ runDualSimulation \} from "\.\/serverSimulationAdapter\.js"/);
  assert.match(app, /await runDualSimulation\(input/);
  assert.match(app, /simulation-result-source/);
  assert.match(app, /teaching_candidate/);
  assert.match(app, /unstratified/);
});

test("server substitution remains limited to the rule-based result console", () => {
  assert.match(app, /runDynamicsSimulation/);
  assert.match(app, /resolveResearchVitalSigns/);
  assert.match(app, /rankDiseaseSpecificImpacts/);
  assert.match(app, /runComplementSimulation\(buildValidationModelInput/);
});
