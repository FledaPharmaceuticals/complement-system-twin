import test from "node:test";
import assert from "node:assert/strict";
import { getKnowledgeRecords } from "../src/knowledgeService.js";

test("loads the unified public knowledge layer without changing model data", async () => {
  const result = await getKnowledgeRecords(async (url) => {
    assert.match(url, /\/api\/knowledge\/records\?limit=20$/);
    return { ok: true, json: async () => ({ count: 1, records: [{ knowledgeLayer: "pathway_annotation" }] }) };
  }, 20);

  assert.equal(result.count, 1);
  assert.equal(result.records[0].knowledgeLayer, "pathway_annotation");
});
