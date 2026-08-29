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

test("workspace uses the local parser and has no remote AI endpoint", async () => {
  const app = await readFile(new URL("src/app.js", root), "utf8");
  const parser = await readFile(new URL("src/experimentIntent.js", root), "utf8");
  assert.match(app, /parseExperimentIntent/);
  assert.match(app, /selectLiteratureForExperiment/);
  assert.doesNotMatch(`${app}\n${parser}`, /api\.openai\.com|anthropic\.com|generativelanguage\.googleapis\.com/i);
});

test("page exposes an applied literature catalog and controlled learning boundary", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  for (const id of ["applied-literature-catalog", "literature-catalog-list", "literature-catalog-filter"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /recent publications/i);
  assert.match(html, /Lambris/i);
  assert.match(html, /cannot automatically overwrite the active model/i);
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
  assert.match(html, /app\.js\?v=20260829-lambris-v1/);
});
