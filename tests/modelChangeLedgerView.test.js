import test from "node:test";
import assert from "node:assert/strict";

import { PUBLIC_LEDGER_ENTRIES } from "../src/publicLedgerData.js";
import { renderLedgerDetail, renderLedgerList } from "../src/modelChangeLedgerView.js";

test("renders selectable disclosure-safe ledger summaries", () => {
  const html = renderLedgerList(PUBLIC_LEDGER_ENTRIES, "ledger:synthetic-amd-v1.2");

  assert.match(html, /type="button"/);
  assert.match(html, /data-ledger-entry-id="ledger:synthetic-amd-v1\.2"/);
  assert.match(html, /Dry-run candidate/);
  assert.match(html, /Active/);
  assert.match(html, /Rejected/);
  assert.match(html, /aria-pressed="true"/);
});

test("renders status, evidence, policy, metrics, rollback, limitations, and comment boundary", () => {
  const entry = PUBLIC_LEDGER_ENTRIES.find((item) => item.status === "candidate");
  const html = renderLedgerDetail(entry);

  assert.match(html, /Dry-run candidate/);
  assert.match(html, /Policy 1\.0\.0/);
  assert.match(html, /Holdout improvement/);
  assert.match(html, /Rollback/);
  assert.match(html, /Synthetic evidence only/);
  assert.match(html, /Scientific comments become available with the independent Fleda Research Workspace/);
  assert.doesNotMatch(html, /parameterSnapshot|oldValue|newValue|solverConfiguration/);
});

test("escapes untrusted ledger text", () => {
  const unsafe = structuredClone(PUBLIC_LEDGER_ENTRIES[0]);
  unsafe.rationale = '<img src=x onerror="alert(1)">';
  unsafe.context.disease = "<script>alert(1)</script>";
  const html = `${renderLedgerList([unsafe])}${renderLedgerDetail(unsafe)}`;

  assert.doesNotMatch(html, /<script>|<img/);
  assert.match(html, /&lt;script&gt;|&lt;img/);
});

test("renders an explicit empty state", () => {
  assert.match(renderLedgerList([]), /No ledger entries match/i);
  assert.match(renderLedgerDetail(null), /Select a ledger entry/i);
});
