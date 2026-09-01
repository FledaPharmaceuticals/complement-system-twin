import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("page exposes a local conversational experiment workflow", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  for (const id of ["experiment-description", "analyze-experiment", "experiment-plan", "run-prepared-simulation", "experiment-live-result"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /Do not enter patient identifiers/i);
  assert.match(html, /Research and education use only/i);
});

test("advanced research content is collapsed by default", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  assert.match(html, /<details id="advanced-research-tools"[^>]*>/);
  assert.doesNotMatch(html, /<details id="advanced-research-tools"[^>]*\sopen(?:\s|>)/);
  for (const id of ["model-roadmap", "literature-intelligence", "pathway-map", "dynamics", "knowledge", "simulation", "disease-panel", "drug-panel"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
});

test("training record is collapsed directly below the conversational workspace", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const workspace = html.indexOf('id="experiment-workspace"');
  const record = html.indexOf('id="model-training-record"');
  const advanced = html.indexOf('id="advanced-research-tools"');

  assert.ok(workspace >= 0 && workspace < record && record < advanced);
  assert.match(html, /<summary id="model-training-record-summary"/);
  assert.match(html, /<div id="model-training-record-content"/);
  assert.doesNotMatch(html.slice(record, html.indexOf(">", record)), /\sopen(?:\s|>)/);
});

test("advanced research area exposes a read-only Model Change Ledger", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  for (const id of ["model-change-ledger", "ledger-disease-filter", "ledger-pathway-filter", "ledger-parameter-filter", "ledger-status-filter", "ledger-version-filter", "ledger-date-filter", "model-change-ledger-list", "model-change-ledger-detail"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /Model Change Ledger/);
  assert.match(html, /Scientific comments become available with the independent Fleda Research Workspace/);
  assert.doesNotMatch(html, /id=["']advanced-research-tools["'][^>]*\sopen(?:\s|>)/);
});

test("workspace uses the local parser and has no remote AI endpoint", async () => {
  const app = await readFile(new URL("src/app.js", root), "utf8");
  const parser = await readFile(new URL("src/experimentIntent.js", root), "utf8");
  assert.match(app, /parseExperimentIntent/);
  assert.match(app, /selectLiteratureForExperiment/);
  assert.doesNotMatch(`${app}\n${parser}`, /api\.openai\.com|anthropic\.com|generativelanguage\.googleapis\.com/i);
});

test("page exposes an applied literature catalog and controlled learning boundary", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  for (const id of ["applied-literature-catalog", "literature-catalog-list", "literature-catalog-filter", "training-readiness-summary"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /recent publications/i);
  assert.match(html, /Lambris/i);
  assert.match(html, /cannot automatically overwrite the active model/i);
});

test("catalog renders an explicit quantitative training-readiness gate", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const app = await readFile(new URL("src/app.js", root), "utf8");

  assert.match(html, /Parameter calibration readiness/i);
  assert.match(app, /summarizeTrainingReadiness/);
  assert.match(app, /evidence-guided, not quantitatively trained/i);
  assert.match(app, /formal model unchanged/i);
});

test("hero reset clears scenario state and disease changes restart at zero", async () => {
  const app = await readFile(new URL("src/app.js", root), "utf8");

  assert.match(app, /createHeroResetSnapshot/);
  assert.match(app, /function resetHeroSimulation/);
  assert.match(app, /contextChanged:\s*true/);
  assert.match(app, /Object\.assign\(state\.heroPlayback,\s*reset\.playback\)/);
});

test("experiment override controls stay inside their sidebar at desktop widths", async () => {
  const css = await readFile(new URL("src/styles.css", root), "utf8");
  const labelRule = css.match(/\.experiment-dialog-controls label\s*\{([^}]*)\}/)?.[1] ?? "";
  const controlRule = css.match(/\.experiment-dialog-controls select,\s*\n?\.experiment-dialog-controls button\s*\{([^}]*)\}/)?.[1] ?? "";

  assert.match(labelRule, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(labelRule, /min-width:\s*0/);
  assert.match(controlRule, /max-width:\s*100%/);
  assert.match(controlRule, /min-width:\s*0/);
});

test("conversation renders Lambris evidence synthesis without promoting the model", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const app = await readFile(new URL("src/app.js", root), "utf8");

  assert.match(app, /buildEvidenceGuidance/);
  assert.match(app, /plan\.evidenceGuidance\s*=\s*buildEvidenceGuidance/);
  assert.match(app, /Candidate model effects/);
  assert.match(app, /Formal model unchanged/);
  assert.match(html, /app\.js\?v=20260830-amd-cohort-v2-1/);
  assert.match(html, /id="organ-blood-pressure">120\/80/);
  assert.match(html, /id="organ-respiratory-rate">16/);
});
