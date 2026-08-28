import test from "node:test";
import assert from "node:assert/strict";

import { getLocalProteinAnnotations, searchUniProtAnnotations } from "../src/annotationService.js";

test("loads locally saved public protein annotations", async () => {
  const result = await getLocalProteinAnnotations(async () => ({
    ok: true,
    json: async () => ({ count: 1, records: [{ id: "uniprot:P01024" }] })
  }));

  assert.equal(result.count, 1);
  assert.equal(result.records[0].id, "uniprot:P01024");
});

test("searches UniProt through the standalone local service", async () => {
  let request;
  const result = await searchUniProtAnnotations("gene_exact:C3", 3, async (_url, options) => {
    request = JSON.parse(options.body);
    return { ok: true, json: async () => ({ count: 1, saved: 1, records: [] }) };
  });

  assert.deepEqual(request, { query: "gene_exact:C3", size: 3, save: true });
  assert.equal(result.saved, 1);
});

test("keeps the client on the standalone local service boundary", async () => {
  let url;
  await getLocalProteinAnnotations(async (requestUrl) => {
    url = requestUrl;
    return { ok: true, json: async () => ({ count: 0, records: [] }) };
  });

  assert.match(url, /^http:\/\/127\.0\.0\.1:8790\/api\/annotations\/uniprot\/records/);
});
