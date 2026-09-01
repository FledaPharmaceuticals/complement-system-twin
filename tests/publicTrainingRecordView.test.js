import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { PUBLIC_TRAINING_RECORD } from "../src/publicTrainingRecord.js";
import { renderPublicTrainingRecord } from "../src/publicTrainingRecordView.js";

test("page cache-busts the app entrypoint for the training record release", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

  assert.match(html, /src="\.\/src\/app\.js\?v=20260831-training-record-v1"/);
});

test("view shows the reviewed training record without promoting the candidate", () => {
  const html = renderPublicTrainingRecord(PUBLIC_TRAINING_RECORD);

  for (const term of [
    "2026-08-31",
    "Lamers",
    "Cerniauskas",
    "10.1002/sctm.20-0211",
    "10.1038/s41467-022-33003-7",
    "evidence-constrained candidate fitting",
    "not machine learning",
    "Parameter categories",
    "Cp40 concentration-response shape",
    "local RPE response coupling",
    "Capabilities",
    "tested_not_qualified",
    "Train",
    "13",
    "Holdout",
    "49",
    "pipeline_feasibility_only",
    "high",
    "rejected",
    "Research and education only",
    "active model was not changed"
  ]) {
    assert.match(html, new RegExp(term, "i"));
  }

  assert.doesNotMatch(html, /cp40_half_max_um|coefficient|formula|source_paths/i);
  assert.match(html, /rel="noopener noreferrer"/g);
});

test("view associates each DOI with the correct publication author", () => {
  const html = renderPublicTrainingRecord(PUBLIC_TRAINING_RECORD);

  assert.match(
    html,
    /<li><strong>Cerniauskas et al\.<\/strong>[\s\S]*?10\.1002\/sctm\.20-0211[\s\S]*?<\/li>/
  );
  assert.match(
    html,
    /<li><strong>Lamers et al\.<\/strong>[\s\S]*?10\.1038\/s41467-022-33003-7[\s\S]*?<\/li>/
  );
});

test("view escapes public text and allows only the reviewed DOI URL shape", () => {
  const record = structuredClone(PUBLIC_TRAINING_RECORD);
  record.publications[0].title = '<img src=x onerror="alert(1)">';
  record.publications[0].doi = '10.1002/<script>alert(1)</script>';
  record.publications[0].doiUrl = 'https://doi.org/10.1002/\" onclick=\"alert(1)';
  record.capabilities[0].label = "<b>unsafe</b>";

  const html = renderPublicTrainingRecord(record);

  assert.doesNotMatch(html, /<img|<script|onclick=|<b>/i);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(html, /&lt;b&gt;unsafe&lt;\/b&gt;/);
  assert.doesNotMatch(html, /href="https:\/\/doi\.org\/10\.1002\/&quot;/);
});

test("view never renders numeric parameter values", () => {
  const record = structuredClone(PUBLIC_TRAINING_RECORD);
  record.parameterCategories[0].value = 0.0875135;
  record.parameterCategories[1].coefficient = 0.9189222;

  const html = renderPublicTrainingRecord(record);

  assert.doesNotMatch(html, /0\.0875135|0\.9189222|coefficient/i);
});
