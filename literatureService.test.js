import test from "node:test";
import assert from "node:assert/strict";

import { getLiteratureServiceStatus, getLocalLiteratureRecords, searchPublicPubMed } from "../src/literatureService.js";
import { readFile } from "node:fs/promises";


test("returns health and budget when both service requests succeed", async () => {
  const responses = [
    { status: "ok", database: "ready" },
    { limit_usd: "50.00", spent_usd: "1.000000", allowed: true }
  ];
  const fetchImpl = async () => ({
    ok: true,
    json: async () => responses.shift()
  });

  const result = await getLiteratureServiceStatus(fetchImpl);

  assert.equal(result.online, true);
  assert.equal(result.health.database, "ready");
  assert.equal(result.budget.spent_usd, "1.000000");
  assert.equal(result.error, null);
});


test("returns an offline result instead of throwing", async () => {
  const fetchImpl = async () => {
    throw new Error("connection refused");
  };

  const result = await getLiteratureServiceStatus(fetchImpl);

  assert.deepEqual(result, {
    online: false,
    health: null,
    budget: null,
    error: "connection refused"
  });
});

test("loads locally saved public literature records", async () => {
  const result = await getLocalLiteratureRecords(async () => ({
    ok: true,
    json: async () => ({ count: 1, records: [{ id: "pmid:1" }] })
  }));

  assert.equal(result.count, 1);
  assert.equal(result.records[0].id, "pmid:1");
  assert.equal(result.dataBoundary, "standalone_fleda_local_records");
});

test("searches public PubMed metadata without changing the request boundary", async () => {
  let request;
  const result = await searchPublicPubMed("complement C3", 5, async (_url, options) => {
    request = options;
    return {
      ok: true,
      json: async () => ({ count: 1, saved: 1, records: [{ id: "pmid:1" }], data_boundary: "public_pubmed_metadata_only" })
    };
  });

  assert.equal(request.method, "POST");
  assert.deepEqual(JSON.parse(request.body), { query: "complement C3", retmax: 5, save: true, include_abstract: false, source: "pubmed" });
  assert.equal(result.data_boundary, "public_pubmed_metadata_only");
});

test("can request public abstracts explicitly", async () => {
  let request;
  await searchPublicPubMed("AMD", 3, async (_url, options) => {
    request = options;
    return { ok: true, json: async () => ({ data_boundary: "public_pubmed_metadata_and_abstract" }) };
  }, true, "europe_pmc");

  assert.equal(JSON.parse(request.body).include_abstract, true);
  assert.equal(JSON.parse(request.body).source, "europe_pmc");
});

test("simulation console reserves traceability fields", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

  assert.match(html, /simulation-model-version/);
  assert.match(html, /simulation-evidence-basis/);
  assert.match(html, /simulation-uncertainty/);
});

test("literature UI exposes the public source selector", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

  assert.match(html, /id="pubmed-search-source"/);
  assert.match(html, /value="europe_pmc"/);
});
