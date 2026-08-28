import test from "node:test";
import assert from "node:assert/strict";
import { getLocalPathwayAnnotations, fetchReactomePathway } from "../src/pathwayService.js";

test("fetches a public Reactome pathway entry through the local service", async () => {
  const calls = [];
  const result = await fetchReactomePathway("R-HSA-168249", async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ saved: 1, record: { id: "reactome:R-HSA-168249" } }) };
  });

  assert.equal(result.saved, 1);
  assert.equal(calls[0].options.method, "POST");
  assert.match(calls[0].options.body, /R-HSA-168249/);
});

test("loads locally saved Reactome pathway annotations", async () => {
  const result = await getLocalPathwayAnnotations(async (url) => {
    assert.match(url, /\/api\/annotations\/reactome\/records\?limit=5$/);
    return { ok: true, json: async () => ({ count: 1, records: [] }) };
  }, 5);

  assert.equal(result.count, 1);
});
