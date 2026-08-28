import test from "node:test";
import assert from "node:assert/strict";

import { renderModelHistory } from "../src/modelHistoryView.js";

test("renders active model version and its change summary", () => {
  const html = renderModelHistory([{
    version: "complement-twin-v1.1-contract",
    status: "active",
    releasedAt: "2026-08-27",
    summary: "Traceability contract",
    formalModelChange: false,
    evidenceIds: []
  }]);

  assert.match(html, /complement-twin-v1\.1-contract/);
  assert.match(html, /Active/);
  assert.match(html, /Traceability contract/);
  assert.match(html, /Formal model change: no/i);
});

test("renders an empty state without inventing model history", () => {
  assert.match(renderModelHistory([]), /No model releases recorded/i);
});
