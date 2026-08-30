import test from "node:test";
import assert from "node:assert/strict";

import { createPublicLedgerEntry, filterLedgerEntries, validatePublicLedgerEntry } from "../src/modelChangeLedger.js";
import { PUBLIC_LEDGER_ENTRIES } from "../src/publicLedgerData.js";
import { readFile } from "node:fs/promises";

function input(disclosureLevel = "public_normalized") {
  return {
    releaseDecision: {
      status: "ready_for_auto_release",
      policyId: "fleda-complement-auto-release-policy",
      policyVersion: "1.0.0",
      parameterId: "amd.retinalAlternativeAmplification",
      baseVersion: "complement-twin-v1.1-contract",
      proposedVersion: "complement-twin-v1.2-dry-run",
      rollbackVersion: "complement-twin-v1.1-contract",
      activationPermitted: false,
      formalModelChanged: false,
      publicMetadata: {
        entryId: "ledger:synthetic-amd-v1.2",
        status: "candidate",
        releasedAt: null,
        disease: "AMD",
        tissue: "Retina / RPE / choroid",
        pathway: "Alternative pathway",
        rationale: "Synthetic dry-run tests a retina-centered calibration policy.",
        limitations: ["Synthetic evidence only", "No active model change"],
        releaseRoute: "policy_dry_run",
        commentCount: 0,
        synthetic: true
      }
    },
    parameterPolicy: {
      parameterId: "amd.retinalAlternativeAmplification",
      publicLabel: "Retinal alternative-pathway amplification",
      unit: "relative_multiplier",
      disclosureLevel
    },
    parameterChange: { oldValue: 1, newValue: 1.08, relativeChange: 0.08 },
    evidenceSummary: {
      publicationCount: 3,
      independentGroupCount: 2,
      publications: [{ publicationId: "synthetic:p1", doi: null, pmid: null, reviewStatus: "synthetic_supported" }]
    },
    validationSummary: {
      trainingImprovement: 0.15,
      holdoutImprovement: 0.08,
      sentinelDegradationMaximum: 0.01,
      uncertainty: "moderate"
    }
  };
}

test("public_normalized exposes direction and percent but not protected values", () => {
  const entry = createPublicLedgerEntry(input());

  assert.equal(entry.parameter.disclosureLevel, "public_normalized");
  assert.equal(entry.parameter.direction, "increase");
  assert.equal(entry.parameter.normalizedDeltaPercent, 8);
  assert.equal("oldValue" in entry.parameter, false);
  assert.equal("newValue" in entry.parameter, false);
  assert.equal("parameterSnapshot" in entry, false);
  assert.deepEqual(validatePublicLedgerEntry(entry), { valid: true, errors: [] });
});

test("applies exact and summary disclosure policies", () => {
  const exact = createPublicLedgerEntry(input("public_exact"));
  const summary = createPublicLedgerEntry(input("public_summary"));

  assert.equal(exact.parameter.oldValue, 1);
  assert.equal(exact.parameter.newValue, 1.08);
  assert.equal(exact.parameter.unit, "relative_multiplier");
  assert.equal("normalizedDeltaPercent" in summary.parameter, false);
  assert.equal(summary.parameter.direction, "increase");
});

test("projection is immutable and preserves evidence, metrics, limitations, policy, and rollback", () => {
  const source = input();
  const entry = createPublicLedgerEntry(source);
  source.releaseDecision.publicMetadata.rationale = "mutated";
  source.evidenceSummary.publications[0].publicationId = "mutated";

  assert.match(entry.rationale, /retina-centered/);
  assert.equal(entry.evidence.publications[0].publicationId, "synthetic:p1");
  assert.equal(entry.validation.holdoutImprovementPercent, 8);
  assert.deepEqual(entry.limitations, ["Synthetic evidence only", "No active model change"]);
  assert.equal(entry.policy.version, "1.0.0");
  assert.equal(entry.rollback.version, "complement-twin-v1.1-contract");
  assert.equal(Object.isFrozen(entry), true);
});

test("validator recursively rejects protected data", () => {
  const entry = createPublicLedgerEntry(input());
  const unsafe = structuredClone(entry);
  unsafe.debug = { nested: { parameterSnapshot: { secret: 1 } } };

  const result = validatePublicLedgerEntry(unsafe);

  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /parameterSnapshot/);
});

test("filters ledger entries by disease, pathway, version, and status", () => {
  const amd = createPublicLedgerEntry(input());
  const other = structuredClone(amd);
  other.entryId = "ledger:other";
  other.context.disease = "PNH";
  other.context.pathway = "Terminal pathway";
  other.version = "complement-twin-v2";
  other.status = "rejected";
  const entries = [amd, other];

  assert.deepEqual(filterLedgerEntries(entries, { disease: "AMD" }).map((entry) => entry.entryId), [amd.entryId]);
  assert.deepEqual(filterLedgerEntries(entries, { pathway: "Terminal pathway", status: "rejected", version: "v2" }).map((entry) => entry.entryId), ["ledger:other"]);
});

test("static browser data matches the language-neutral public fixture", async () => {
  const fixture = JSON.parse(await readFile(new URL("../fixtures/controlled-release/public-ledger.json", import.meta.url), "utf8"));

  assert.deepEqual(PUBLIC_LEDGER_ENTRIES, fixture);
  assert.deepEqual(PUBLIC_LEDGER_ENTRIES.map((entry) => entry.status), ["active", "candidate", "rejected"]);
  assert.equal(PUBLIC_LEDGER_ENTRIES.every((entry) => validatePublicLedgerEntry(entry).valid), true);
  assert.equal(PUBLIC_LEDGER_ENTRIES[1].formalModelChanged, false);
  assert.equal(PUBLIC_LEDGER_ENTRIES[1].synthetic, true);
});

test("projection allowlists publication fields and validates disclosure-specific shape", () => {
  const source = input();
  source.evidenceSummary.publications[0].internalReviewNotes = "PROTECTED";
  source.evidenceSummary.publications[0].nested = { credentials: "secret" };
  const entry = createPublicLedgerEntry(source);

  assert.equal("internalReviewNotes" in entry.evidence.publications[0], false);
  assert.equal("nested" in entry.evidence.publications[0], false);

  const unsafe = structuredClone(entry);
  unsafe.parameter.oldValue = 1;
  assert.equal(validatePublicLedgerEntry(unsafe).valid, false);
});

test("projection rejects inconsistent delta and missing synthetic provenance", () => {
  const inconsistent = input();
  inconsistent.parameterChange.relativeChange = 0.99;
  assert.throws(() => createPublicLedgerEntry(inconsistent), /relative change/i);

  const unspecified = input();
  delete unspecified.releaseDecision.publicMetadata.synthetic;
  assert.throws(() => createPublicLedgerEntry(unspecified), /synthetic provenance/i);
});

test("projection accepts absolute envelope delta for a decreasing parameter", () => {
  const decrease = input();
  decrease.parameterChange = { oldValue: 1, newValue: 0.92, relativeChange: 0.08 };

  const entry = createPublicLedgerEntry(decrease);

  assert.equal(entry.parameter.direction, "decrease");
  assert.equal(entry.parameter.normalizedDeltaPercent, 8);
});

test("Phase 1 validator blocks formal mutation, comment submission, and exact bounds in normalized disclosure", () => {
  const base = createPublicLedgerEntry(input());
  const unsafe = structuredClone(base);
  unsafe.formalModelChanged = true;
  unsafe.comments.submissionEnabled = true;
  unsafe.parameter.normalizedLowerBoundPercent = 80;

  const result = validatePublicLedgerEntry(unsafe);

  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /formal model|comment submission|normalizedLowerBoundPercent/i);
});
