# Quantitative Observation Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cross-language, versioned foundation for lossless quantitative observations extracted from complement literature, beginning with AMD fixtures and candidate-calibration safeguards.

**Architecture:** A public JSON Schema defines the exchange contract. Focused JavaScript and Python modules validate records, compute RFC 8785/JCS hashes and fingerprints, and apply the same deterministic calibration decision table. Synthetic fixtures prove parity without exposing copyrighted documents or protected model parameters.

**Tech Stack:** JSON Schema 2020-12, browser-compatible JavaScript ES modules, Python 3.12/Pydantic 2, Node test runner, pytest, SHA-256.

**Spec:** `docs/superpowers/specs/2026-08-29-quantitative-observation-contract-design.md`

## Global Constraints

- Keep Fleda standalone; do not connect to GN authentication, databases, APIs, customers, or production data.
- Public Git may contain schemas, validators, synthetic fixtures, and public evidence summaries only.
- Every record keeps `formalModelChange: false`; no observation automatically changes the formal model.
- AI review may block or downgrade a record but cannot independently approve calibration eligibility.
- Preserve `spatialScope` and `experimentalSetting` as independent dimensions.
- Use RFC 8785/JCS, UTF-8, SHA-256, and exclude only top-level `packageHash` when hashing a package.
- Use `moderate`, not `medium`, for the shared uncertainty vocabulary.

---

### Task 1: Public Schema And Synthetic AMD Fixtures

**Files:**
- Create: `schemas/fleda-quantitative-observation-1.0.0.schema.json`
- Create: `fixtures/quantitative-observations/amd-systemic-clinical-valid.json`
- Create: `fixtures/quantitative-observations/amd-local-ex-vivo-valid.json`
- Create: `fixtures/quantitative-observations/amd-invalid-missing-context.json`
- Test: `tests/quantitativeObservationSchema.test.js`

**Interfaces:**
- Consumes: approved contract field names and controlled vocabularies.
- Produces: immutable schema and fixtures consumed by both language validators.

- [x] Write tests asserting required fields, controlled vocabularies, independent spatial/experimental context, and `formalModelChange: false`.
- [x] Run `node --test tests/quantitativeObservationSchema.test.js` and verify failure because the schema and fixtures do not exist.
- [x] Add the schema and three synthetic fixtures with no copied paper text.
- [x] Run the focused test and confirm it passes.

### Task 2: Cross-Language JCS Hashing And Fingerprints

**Files:**
- Create: `src/quantitativeObservations/canonicalHash.js`
- Create: `literature_service/quantitative_observation_hash.py`
- Create: `fixtures/quantitative-observations/hash-vectors.json`
- Test: `tests/quantitativeObservationHash.test.js`
- Test: `tests/test_quantitative_observation_hash.py`

**Interfaces:**
- Produces JS `canonicalizeJcs(value)`, `computePackageHash(packageValue)`, `computeLocatorFingerprint(observation)`, and `computeMeasurementFingerprint(observation)`.
- Produces equivalent Python functions with snake_case names and identical outputs.

- [x] Write JS and Python parity tests for Unicode key ordering, number serialization, excluded `packageHash`, nullable fingerprint members, and changed-content detection.
- [x] Run both focused suites and verify failures because hash modules do not exist.
- [x] Implement finite binary64 validation, negative-zero rejection, JCS serialization, and SHA-256 fingerprints.
- [x] Run both focused suites and compare every shared hash vector.

### Task 3: Deterministic Validation And Calibration Eligibility

**Files:**
- Create: `src/quantitativeObservations/validateObservation.js`
- Create: `literature_service/quantitative_observation_validation.py`
- Test: `tests/quantitativeObservationValidation.test.js`
- Test: `tests/test_quantitative_observation_validation.py`

**Interfaces:**
- Produces JS `validateQuantitativeObservation(observation)` returning `{valid, issues, calibrationEligible, eligibilityReasons}`.
- Produces Python `validate_quantitative_observation(observation)` with equivalent keys and issue codes.

- [x] Write failing tests for source identity, locator precision, context, group identity, time anchoring, measurement units, censoring, normalization, rule validation, AI review, and conflicts.
- [x] Verify each focused suite fails for missing implementation.
- [x] Implement the deterministic decision table; AI may veto but never approve on its own.
- [x] Verify valid AMD fixtures qualify and context-limited fixtures remain knowledge-graph-only.

### Task 4: AMD Context Compatibility And Candidate Package Report

**Files:**
- Create: `src/quantitativeObservations/buildCandidateReport.js`
- Create: `literature_service/quantitative_observation_report.py`
- Test: `tests/quantitativeObservationReport.test.js`
- Test: `tests/test_quantitative_observation_report.py`
- Modify: `README.md`

**Interfaces:**
- Produces report fields `observationCount`, `eligibleCount`, `knowledgeGraphOnlyCount`, `conflictCount`, `contextGroups`, and `formalModelChanged: false`.

- [x] Write failing tests proving local ocular ex vivo evidence cannot merge with systemic clinical plasma evidence without an explicit comparison relationship.
- [x] Implement context grouping and candidate-readiness summaries without averaging or parameter promotion.
- [x] Add README usage commands and scientific/governance limitations.
- [x] Run JavaScript, Python, local verification, syntax, and diff checks.

### Task 5: Release Gate

**Files:**
- Modify only files from Tasks 1-4 if verification finds defects.

- [x] Run `npm test`.
- [x] Run the repository Python test suite.
- [x] Run `scripts/verify-local.sh`.
- [x] Run `git diff --check` and inspect `git status --short`.
- [x] Confirm fixtures contain no source-document excerpts, secrets, private paths, or formal parameters.
- [ ] Commit the quantitative observation foundation; do not push or deploy without the user's separate publication authorization.
