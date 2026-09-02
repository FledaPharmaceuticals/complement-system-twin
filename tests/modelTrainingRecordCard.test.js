import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  createValidatedTrainingRecordView,
  bindSingleOpenTrainingRecord,
  renderModelTrainingRecordHistory,
  statusMessageFor
} from "../src/publicTrainingRecordView.js";
import {
  validatePublicStatementRegistry,
  validateTrainingRecordSnapshot
} from "../src/modelTrainingRecords/validateTrainingRecord.js";

const ROOT = new URL("../", import.meta.url);

async function json(path) {
  return JSON.parse(await readFile(new URL(path, ROOT), "utf8"));
}

async function validatedSnapshot() {
  const [snapshot, registry, vectors] = await Promise.all([
    json("fixtures/model-training-snapshot/model-training-records-1.1.0.json"),
    json("contracts/model-training/public-model-training-statement-registry-1.0.0.json"),
    json("contracts/model-training/public-model-training-statement-registry-vectors-1.0.0.json")
  ]);
  const { expectedSchemaVersion, expectedRegistryHash, expectedReleaseCommit } = vectors.registryRelease;
  const pinnedRegistry = await validatePublicStatementRegistry(registry, {
    expectedSchemaVersion,
    expectedRegistryHash,
    expectedReleaseCommit
  });
  return {
    pinnedRegistry,
    snapshot: await validateTrainingRecordSnapshot(snapshot, pinnedRegistry)
  };
}

test("renders only a validated frozen snapshot as a descending collapsed history", async () => {
  const { snapshot, pinnedRegistry } = await validatedSnapshot();
  const html = renderModelTrainingRecordHistory(await createValidatedTrainingRecordView(snapshot, pinnedRegistry));

  assert.match(html, /Model Training Record/);
  assert.equal((html.match(/class="model-training-record-row"/g) || []).length, 2);
  assert.equal((html.match(/<details class="model-training-record-row"/g) || []).length, 2);
  assert.doesNotMatch(html, /<details class="model-training-record-row"[^>]*\bopen\b/);
  assert.ok(html.indexOf("98 observations") < html.indexOf("70 observations"));
  assert.match(html, /3 publications/);
  assert.match(html, /independent biochemical compatibility check/);
  assert.match(html, /Formal model unchanged/);
  assert.match(html, /Candidate did not pass; model knowledge and falsification results were retained\./);
  assert.doesNotMatch(html, /candidateId|candidateVersion|sourceCommit|coefficient|formula|internalId|human_review/i);
});

test("renders full public-safe record detail with validated DOI links and exact status copy", async () => {
  const { snapshot, pinnedRegistry } = await validatedSnapshot();
  const html = renderModelTrainingRecordHistory(await createValidatedTrainingRecordView(snapshot, pinnedRegistry));

  for (const term of [
    "Publications", "Retained knowledge", "Modeling constraints", "Rejection reasons",
    "Uncertainty", "Limitations", "Missing mechanisms", "Architecture implications",
    "Formal model change", "weighted_lack_of_fit", "10.1021/acs.jmedchem.6c00832"
  ]) assert.match(html, new RegExp(term, "i"));
  assert.match(html, /href="https:\/\/doi\.org\/10\.1021\/acs\.jmedchem\.6c00832"/);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
  assert.equal(statusMessageFor("rejected"), "Candidate did not pass; model knowledge and falsification results were retained.");
  assert.equal(statusMessageFor("candidate_only"), "Candidate record retained; not approved for exploratory or formal model use.");
  assert.equal(statusMessageFor("supported_exploratory"), "Supported for research exploration; not formally approved or clinically validated.");
  assert.equal(statusMessageFor("formally_approved"), "Formally approved model record.");
});

test("renders unavailable instead of raw, stale, or hard-coded training content", () => {
  for (const value of [
    undefined,
    { status: "unavailable", snapshot: null },
    { status: "available", snapshot: { records: [] } },
    { status: "available", snapshot: { records: [{ candidateId: "must-not-render" }] } }
  ]) {
    const html = renderModelTrainingRecordHistory(value);
    assert.match(html, /Training record unavailable/i);
    assert.doesNotMatch(html, /must-not-render|Two-paper AMD|Cerniauskas/i);
  }
});

test("rejects an unvalidated frozen lookalike and accepts only a Task 10 validation result", async () => {
  const { snapshot, pinnedRegistry } = await validatedSnapshot();
  const lookalike = Object.freeze({ status: "available", snapshot });
  assert.match(renderModelTrainingRecordHistory(lookalike), /Training record unavailable/i);

  const validatedView = await createValidatedTrainingRecordView(snapshot, pinnedRegistry);
  assert.match(renderModelTrainingRecordHistory(validatedView), /98 observations/);
});

test("enforces a single open row without replacing native keyboard details behavior", () => {
  class FakeDetails extends EventTarget {
    constructor(open = false) {
      super();
      this.open = open;
    }
  }
  const first = new FakeDetails(true);
  const second = new FakeDetails(false);
  const root = { querySelectorAll: () => [first, second] };
  const dispose = bindSingleOpenTrainingRecord(root);

  second.open = true;
  second.dispatchEvent(new Event("toggle"));
  assert.equal(first.open, false);
  assert.equal(second.open, true);
  dispose();
});

test("escapes text and constructs DOI anchors only from validated DOI values", async () => {
  const { snapshot } = await validatedSnapshot();
  const unsafe = structuredClone(snapshot);
  unsafe.records[0].publications[0].title = '<img src=x onerror="alert(1)">';
  unsafe.records[0].publications[0].doi = '10.1002/<script>alert(1)</script>';
  unsafe.records[0].publications[0].doiUrl = 'https://doi.org/10.1002/" onclick="alert(1)';
  const html = renderModelTrainingRecordHistory(Object.freeze({ status: "available", snapshot: Object.freeze(unsafe) }));

  assert.match(html, /Training record unavailable/i);
  assert.doesNotMatch(html, /<img|<script|onclick=|alert\(1\)/i);
});
