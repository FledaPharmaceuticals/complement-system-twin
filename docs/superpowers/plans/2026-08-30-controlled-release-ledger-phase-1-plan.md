# Controlled Release And Public Ledger Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a local, reproducible dry-run of policy-controlled model release decisions and expose immutable, disclosure-safe Model Change Ledger records in the public GitHub Pages application without changing active parameters.

**Architecture:** Focused ES modules validate a versioned parameter policy, aggregate eligible evidence, enforce parameter envelopes and validation thresholds, and emit a dry-run policy decision. A separate projection module converts protected release data into public ledger records. The existing model history area renders these records while the active model remains unchanged.

**Tech Stack:** Browser-compatible JavaScript ES modules, Web Crypto SHA-256/JCS utilities already in the repository, Node test runner, static HTML/CSS, existing Fleda model release helpers.

**Spec:** `docs/superpowers/specs/2026-08-30-controlled-model-release-ledger-design.md`

## Phase Boundary

This plan implements specification sequence items 1 and 2 only: policy manifests, evidence aggregation, dry-run release evaluation, immutable public projections, and a read-only ledger UI. Fleda server persistence, protected snapshot encryption, atomic activation, rollback execution, magic-link accounts, and comment submission require separate server plans after this dry-run passes review.

## Global Constraints

- Keep Fleda standalone; never connect to GN authentication, databases, APIs, customers, or production data.
- The public repository contains synthetic fixtures and public projections only, never protected parameter snapshots or proprietary priors.
- Phase 1 never mutates `MODEL_RELEASES`, `MODEL_VERSION`, active simulation parameters, or formal model state.
- AI output, comments, publication count, or popularity cannot create a policy approval.
- An omitted gate is a failed gate; the evaluator never guesses missing evidence, metrics, units, or context.
- Local ocular, systemic, in vivo, ex vivo, in vitro, and clinical observations remain distinct unless a policy explicitly allows compatibility.
- Every dry-run output declares `formalModelChanged: false`.
- Use TDD for each production behavior and run the full JavaScript and Python suites before completion.

---

### Task 1: Versioned Parameter Change Policy

**Files:**
- Create: `src/controlledRelease/changePolicy.js`
- Create: `fixtures/controlled-release/policy-v1.json`
- Test: `tests/changePolicy.test.js`

**Interfaces:**
- Produces `validateChangePolicy(policy): { valid: boolean, errors: string[] }`.
- Produces `getParameterPolicy(policy, parameterId): object | null`.
- Policy entries contain `parameterId`, `moduleId`, `unit`, `contexts`, `lowerBound`, `upperBound`, `maxRelativeChange`, `maxCumulativeChange`, `trainingImprovementMinimum`, `holdoutImprovementMinimum`, `sentinelDegradationMaximum`, `sentinelEndpoints`, and `disclosureLevel`.

- [ ] **Step 1: Write the failing policy tests**

```js
test("accepts the versioned Fleda policy and returns a registered parameter", async () => {
  const policy = await fixture("fixtures/controlled-release/policy-v1.json");
  assert.deepEqual(validateChangePolicy(policy), { valid: true, errors: [] });
  assert.equal(getParameterPolicy(policy, "amd.retinalAlternativeAmplification").unit, "relative_multiplier");
});

test("rejects an unbounded or non-versioned automatic parameter", () => {
  const result = validateChangePolicy({ policyId: "x", parameters: [{ parameterId: "x" }] });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /version|bound|change/i);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/changePolicy.test.js`

Expected: module-not-found failure for `src/controlledRelease/changePolicy.js`.

- [ ] **Step 3: Add the minimal policy fixture**

Register only synthetic dry-run parameters:

```json
{
  "policyId": "fleda-complement-auto-release-policy",
  "policyVersion": "1.0.0",
  "status": "dry_run",
  "minimumPublications": 3,
  "minimumIndependentGroups": 2,
  "holdoutRequired": true,
  "parameters": [{
    "parameterId": "amd.retinalAlternativeAmplification",
    "moduleId": "amd-cohort-model",
    "unit": "relative_multiplier",
    "contexts": [{ "disease": "AMD", "spatialScope": "local_tissue", "experimentalSetting": "ex_vivo" }],
    "lowerBound": 0.8,
    "upperBound": 1.5,
    "maxRelativeChange": 0.1,
    "maxCumulativeChange": 0.2,
    "trainingImprovementMinimum": 0.1,
    "holdoutImprovementMinimum": 0.05,
    "sentinelDegradationMaximum": 0.02,
    "sentinelEndpoints": ["normal_baseline_stability", "retina_signal_ordering"],
    "disclosureLevel": "public_normalized"
  }]
}
```

- [ ] **Step 4: Implement strict policy validation and immutable lookup**

The validator rejects missing IDs/versions, status other than `dry_run`, empty contexts/sentinels, non-finite or reversed bounds, relative limits outside `(0, 1]`, and disclosure values outside `public_exact`, `public_normalized`, or `public_summary`. `getParameterPolicy` returns a deep copy.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `node --test tests/changePolicy.test.js`

Expected: all policy tests pass.

### Task 2: Independent Evidence Gate

**Files:**
- Create: `src/controlledRelease/evidenceGate.js`
- Create: `fixtures/controlled-release/amd-evidence-set.json`
- Test: `tests/evidenceGate.test.js`

**Interfaces:**
- Consumes evidence summaries with `publicationId`, `researchGroupId`, `observationIds`, `calibrationEligible`, `assignment`, `contexts`, and `integrityStatus`.
- Produces `evaluateEvidenceGate({ policy, parameterPolicy, evidence }): { status, errors, trainingPublicationIds, holdoutPublicationIds, independentGroupCount, formalModelChanged }`.

- [ ] **Step 1: Write failing evidence-gate tests**

```js
test("accepts three eligible publications from two groups with a locked holdout", () => {
  const result = evaluateEvidenceGate({ policy, parameterPolicy, evidence });
  assert.equal(result.status, "passed");
  assert.equal(result.independentGroupCount, 2);
  assert.deepEqual(result.holdoutPublicationIds, ["pmid:synthetic-3"]);
  assert.equal(result.formalModelChanged, false);
});

test("blocks missing holdout, group independence, conflicts, and context mismatch", () => {
  const result = evaluateEvidenceGate({ policy, parameterPolicy, evidence: unsafeEvidence });
  assert.equal(result.status, "blocked");
  assert.match(result.errors.join(" "), /holdout|independent|conflict|context/i);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/evidenceGate.test.js`

Expected: missing-module failure.

- [ ] **Step 3: Create a clearly synthetic three-publication fixture**

Use IDs prefixed `synthetic:`. Include two training publications and one locked holdout, two distinct synthetic research groups, candidate-calibration eligibility, compatible AMD local/ex vivo context, and `integrityStatus: "clear"`. Do not attach real paper measurements.

- [ ] **Step 4: Implement fail-closed evidence aggregation**

Reject ineligible observations, fewer than policy minima, reused publication IDs, missing group IDs, no locked holdout, holdout records marked as training, `retracted`, `expression_of_concern`, `conflicted`, and contexts not permitted by the parameter policy. Return sorted unique IDs for reproducible output.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `node --test tests/evidenceGate.test.js`

Expected: all evidence tests pass.

### Task 3: Calibration Run Record And Parameter Envelope

**Files:**
- Create: `src/controlledRelease/calibrationRun.js`
- Create: `src/controlledRelease/parameterEnvelope.js`
- Test: `tests/calibrationRun.test.js`
- Test: `tests/parameterEnvelope.test.js`

**Interfaces:**
- Produces `createCalibrationRunRecord(input): object` with immutable provenance and `formalModelChanged: false`.
- Produces `evaluateParameterEnvelope({ parameterPolicy, anchorValue, activeValue, candidateValue }): { status, relativeChange, cumulativeChange, errors }`.

- [ ] **Step 1: Write failing calibration provenance tests**

```js
test("records a reproducible dry-run without storing protected values in its public projection", () => {
  const run = createCalibrationRunRecord(input);
  assert.equal(run.status, "candidate");
  assert.equal(run.formalModelChanged, false);
  assert.equal(run.provenance.policyVersion, "1.0.0");
  assert.ok(run.provenance.observationPackageHashes.length);
  assert.equal(input.provenance.codeCommit, "1309c8e");
});
```

- [ ] **Step 2: Write failing parameter-envelope tests**

```js
test("passes an in-bounds 8 percent release change", () => {
  assert.equal(evaluateParameterEnvelope({ parameterPolicy, anchorValue: 1, activeValue: 1, candidateValue: 1.08 }).status, "passed");
});

test("blocks per-release, cumulative, and physiologic-bound violations", () => {
  assert.equal(evaluateParameterEnvelope({ parameterPolicy, anchorValue: 1, activeValue: 1.1, candidateValue: 1.25 }).status, "blocked");
});
```

- [ ] **Step 3: Run both tests and verify RED**

Run: `node --test tests/calibrationRun.test.js tests/parameterEnvelope.test.js`

Expected: both modules are missing.

- [ ] **Step 4: Implement the immutable run record**

Require run ID, base/proposed versions, parameter ID, evidence gate, code commit, environment hash, policy hash/version, observation package hashes, assignment seed, solver ID/version, objective configuration, before/after metrics, candidate snapshot hash, and rollback version. Deep-copy all inputs and reject `formalModelChanged: true`.

- [ ] **Step 5: Implement numeric envelope checks**

Compute `abs(candidate-active) / abs(active)` and `abs(candidate-anchor) / abs(anchor)`. Reject zero/non-finite bases, values outside registered bounds, release change above policy maximum, and cumulative change above policy maximum.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `node --test tests/calibrationRun.test.js tests/parameterEnvelope.test.js`

Expected: all tests pass.

### Task 4: Dry-Run Controlled Release Evaluator

**Files:**
- Create: `src/controlledRelease/releaseEvaluator.js`
- Create: `fixtures/controlled-release/amd-dry-run.json`
- Modify: `src/releaseValidation.js`
- Test: `tests/controlledReleaseEvaluator.test.js`
- Modify: `tests/releaseValidation.test.js`

**Interfaces:**
- Produces `evaluateControlledRelease({ policy, parameterPolicy, evidenceGate, envelope, calibrationRun, behaviorChecks }): object`.
- Produces `createPolicyApprovalRecord(decision): object` only for a complete `ready_for_auto_release` dry-run decision.
- Existing activation functions continue to reject policy approvals while policy status is `dry_run`.

- [ ] **Step 1: Write the failing end-to-end gate test**

```js
test("marks a fully compliant candidate ready for auto release without activating it", () => {
  const decision = evaluateControlledRelease(fixture);
  assert.equal(decision.status, "ready_for_auto_release");
  assert.equal(decision.formalModelChanged, false);
  assert.equal(decision.activationPermitted, false);
  assert.deepEqual(decision.errors, []);
});
```

- [ ] **Step 2: Write blocking tests for each metric family**

Cover training improvement below 10%, holdout improvement below 5%, sentinel degradation above 2%, failed baseline/numerical/determinism checks, missing hashes, invalid rollback, and a reused holdout. Each case returns `blocked` and a stable reason code.

- [ ] **Step 3: Run the focused tests and verify RED**

Run: `node --test tests/controlledReleaseEvaluator.test.js tests/releaseValidation.test.js`

Expected: evaluator missing; existing release tests remain green.

- [ ] **Step 4: Implement metric and behavior gates**

Compare normalized fractional improvements to the parameter policy. Require named checks `normal_baseline_stability`, `non_negativity`, `mass_balance`, `disease_ordering`, `intervention_directionality`, `reset_replay_determinism`, and `numerical_convergence`, each with `passed: true` and a result hash.

- [ ] **Step 5: Emit a dry-run policy approval record**

The record contains `approvalType: "policy_approval"`, policy ID/version, candidate snapshot hash, evidence/calibration/check hashes, workload identity, decision timestamp, and `status: "dry_run_approved"`. It explicitly sets `activationPermitted: false` and `formalModelChanged: false`.

- [ ] **Step 6: Keep active release application blocked**

Extend `activateApprovedModelRelease` to reject `approvalType: "policy_approval"` unless `status === "approved"` and `activationPermitted === true`. Existing explicit human approval behavior remains unchanged.

- [ ] **Step 7: Run focused tests and verify GREEN**

Run: `node --test tests/controlledReleaseEvaluator.test.js tests/releaseValidation.test.js`

Expected: dry-run decision passes, failed gates block, and no test changes formal state.

### Task 5: Disclosure-Safe Model Change Ledger Projection

**Files:**
- Create: `src/modelChangeLedger.js`
- Create: `src/publicLedgerData.js`
- Create: `fixtures/controlled-release/public-ledger.json`
- Test: `tests/modelChangeLedger.test.js`

**Interfaces:**
- Produces `createPublicLedgerEntry({ releaseDecision, parameterPolicy, evidenceSummary, validationSummary }): object`.
- Produces `filterLedgerEntries(entries, filters): object[]`.
- Produces `validatePublicLedgerEntry(entry): { valid, errors }`.

- [ ] **Step 1: Write failing disclosure tests**

```js
test("public_normalized exposes direction and percent but not protected values", () => {
  const entry = createPublicLedgerEntry(input);
  assert.equal(entry.parameter.disclosureLevel, "public_normalized");
  assert.equal(entry.parameter.normalizedDeltaPercent, 8);
  assert.equal("oldValue" in entry.parameter, false);
  assert.equal("newValue" in entry.parameter, false);
  assert.equal("parameterSnapshot" in entry, false);
});
```

- [ ] **Step 2: Write immutability, status, filtering, and traceability tests**

Cover Candidate/Testing/Active/Rejected/Rolled Back labels, disease/pathway/version filters, DOI/PMID evidence summaries, metrics, limitations, policy ID/version, release route, rollback version, and comment counts. Mutating source input after projection must not alter the ledger entry.

- [ ] **Step 3: Run the focused test and verify RED**

Run: `node --test tests/modelChangeLedger.test.js`

Expected: projection module is missing.

- [ ] **Step 4: Implement the projection and validator**

Apply all three disclosure levels. Reject protected keys recursively: `parameterSnapshot`, `previousParameters`, `solverConfiguration`, `privateNotes`, `credentials`, `localPath`, and `proprietaryPrior`. Require plain-language rationale, evidence links, metric deltas, uncertainty, limitations, policy version, release route, and rollback metadata.

- [ ] **Step 5: Add synthetic public ledger fixtures**

Include one active historical contract record, one dry-run AMD candidate record, and one rejected synthetic record. Mark every synthetic item visibly; do not imply that an actual paper changed the live model.

Export the same disclosure-safe records as `PUBLIC_LEDGER_ENTRIES` from
`src/publicLedgerData.js` so the static application works when opened through
`file://`; the JSON file remains the language-neutral fixture used for contract
tests.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `node --test tests/modelChangeLedger.test.js`

Expected: all ledger tests pass.

### Task 6: Public Read-Only Ledger Interface

**Files:**
- Modify: `index.html`
- Modify: `src/app.js`
- Modify: `src/styles.css`
- Create: `src/modelChangeLedgerView.js`
- Test: `tests/modelChangeLedgerView.test.js`
- Modify: `tests/experimentWorkspace.test.js`

**Interfaces:**
- Produces `renderLedgerList(entries)` and `renderLedgerDetail(entry)` using escaped content.
- Reuses the existing `Versioned Model History` area as the initial ledger surface rather than adding another always-expanded page section.

- [ ] **Step 1: Write failing view tests**

```js
test("renders status, version, evidence, policy, metrics, rollback, and limitations", () => {
  const html = renderLedgerDetail(entry);
  assert.match(html, /Dry-run candidate/);
  assert.match(html, /Policy 1\.0\.0/);
  assert.match(html, /Holdout improvement/);
  assert.match(html, /Rollback/);
  assert.doesNotMatch(html, /parameterSnapshot|oldValue|newValue/);
});
```

- [ ] **Step 2: Add DOM tests for a collapsed ledger and filters**

Assert that the existing advanced research section contains `Model Change Ledger`, disease/status/version filter controls, an entry list, a detail panel, and read-only comment count. The ledger remains collapsed with the surrounding advanced area by default.

- [ ] **Step 3: Run focused tests and verify RED**

Run: `node --test tests/modelChangeLedgerView.test.js tests/experimentWorkspace.test.js`

Expected: missing view module and DOM labels.

- [ ] **Step 4: Implement escaped list and detail rendering**

Use buttons for selectable ledger entries, badges for status, a table for evidence/metrics, and a disclosure notice. Selecting an entry updates the detail region in place without scrolling to another section.

- [ ] **Step 5: Wire filters and synthetic records in `src/app.js`**

Import `PUBLIC_LEDGER_ENTRIES` from `src/publicLedgerData.js`. Preserve offline operation. Do not fetch the JSON fixture at runtime and do not create login, submission, or remote mutation controls in Phase 1. Show: `Scientific comments become available with the independent Fleda Research Workspace.`

- [ ] **Step 6: Add responsive styles**

Use a two-column ledger list/detail layout above 900px and a single column below it. Keep buttons and fields within their containers, preserve the existing palette, and use `cursor: pointer` for selectable entries.

- [ ] **Step 7: Run focused tests and verify GREEN**

Run: `node --test tests/modelChangeLedgerView.test.js tests/experimentWorkspace.test.js`

Expected: all UI contract tests pass.

### Task 7: Documentation And Full Verification

**Files:**
- Modify: `README.md`
- Modify: `DEPLOYMENT.md` if present
- Modify only prior task files if verification finds defects.

- [ ] **Step 1: Document the dry-run boundary**

State that the public ledger is a disclosure-safe projection, policy status is `dry_run`, synthetic candidates do not change the active model, and server activation/comments are later phases.

- [ ] **Step 2: Run the entire JavaScript suite**

Run: `node --test tests/*.test.js`

Expected: all tests pass.

- [ ] **Step 3: Run the entire Python suite**

Run: `./.venv/bin/python -m pytest tests -q`

Expected: all tests pass.

- [ ] **Step 4: Run repository verification**

Run: `scripts/verify-local.sh`

Expected: `Fleda local verification passed.`

- [ ] **Step 5: Run syntax, diff, and protected-data checks**

Run:

```bash
node --check src/controlledRelease/releaseEvaluator.js
git diff --check
rg -n "parameterSnapshot|previousParameters|credentials|localPath|proprietaryPrior" fixtures/controlled-release/public-ledger.json
```

Expected: syntax/diff checks pass; protected-data scan has no matches.

- [ ] **Step 6: Verify locally in desktop and mobile viewports**

Start the existing local static server, open the application, expand Advanced Research Tools, inspect the ledger list/detail interaction at 1280px and 390px widths, and confirm there is no horizontal overflow or protected parameter disclosure.

- [ ] **Step 7: Commit Phase 1**

```bash
git add README.md index.html src fixtures tests docs/superpowers/plans/2026-08-30-controlled-release-ledger-phase-1-plan.md
git commit -m "Build controlled release dry run and public ledger"
```

Do not push or deploy without separate publication authorization.
