# Controlled Model Release And Public Change Ledger Design

**Status:** Approved in principle on 2026-08-30; written specification awaiting final review.

## 1. Purpose

Create a governed path by which quantitative observations extracted from
published complement literature can update formal Complement System Digital
Twin parameters without allowing a paper, extraction model, or AI reviewer to
overwrite the active model directly.

The same system publishes a human-readable Model Change Ledger. Researchers,
educators, and other users can understand why a version changed, inspect its
evidence chain, and submit structured scientific comments. Comments and AI
reviews never change parameters directly.

## 2. Product Boundary

- The GitHub Pages application remains a public research and education client.
- The independent Fleda Complement Model Server owns quantitative observations,
  protected parameter values, calibration jobs, validation datasets, release
  policy, approvals, comments, user accounts, and immutable audit events.
- No component connects to GN authentication, databases, APIs, customers, or
  production data.
- The product remains labelled research and education use, not diagnosis or
  patient-specific prediction.
- Patient identity, clinical production data, and unpublished institutional
  data are not accepted by this release workflow.

## 3. Design Decision

The system uses **controlled automatic release**, not unconditional automatic
overwrite.

An eligible evidence package may automatically start calibration. A candidate
may automatically progress through testing. It may become active only when all
requirements in a versioned Predetermined Model Change Policy are satisfied.
If a required policy, evidence property, validation dataset, behavior check, or
rollback artifact is absent, automatic activation is denied.

For compatibility with the existing release gate, successful evaluation creates
a signed `policy_approval` record containing the policy version, candidate hash,
check-result hashes, decision time, and workload identity. This is the only
approval type accepted for automatic activation. AI output, user comments,
popularity, and publication count alone cannot create this record.

The first policy is `fleda-complement-auto-release-policy/1.0.0`.

## 4. Lifecycle

Every proposed parameter change moves through these append-only states:

1. `evidence_accepted`: all observations pass the quantitative observation
   contract and deterministic calibration eligibility gates.
2. `calibration_running`: a reproducible job fits a candidate parameter
   snapshot while the active snapshot remains unchanged.
3. `candidate`: fit completed with evidence, software, data, and random-seed
   provenance.
4. `testing`: independent holdout and behavior/regression checks are running.
5. `ready_for_auto_release`: every predetermined gate passed.
6. `active`: an immutable new model version was activated atomically.
7. `blocked`: one or more required gates failed or could not be evaluated.
8. `rejected`: a governed decision concluded the candidate should not proceed.
9. `rolled_back`: the active version was replaced by its stored predecessor.

No state is edited in place. Corrections append a new event that references the
superseded event.

## 5. Predetermined Automatic Release Gates

Automatic activation requires all gates below. A manual reviewer cannot waive a
failed automatic gate; the candidate must instead receive a new policy-compliant
calibration run.

### 5.1 Evidence Gate

- At least three candidate-calibration-eligible publications.
- At least two independent research groups, determined from non-overlapping
  corresponding-author groups and affiliations.
- At least one eligible publication is reserved exclusively as holdout evidence
  and is not used for parameter fitting or threshold selection.
- Every observation has a permitted source, precise locator, analyte, units,
  assay, group identity, sample size, time context, spatial scope, experimental
  setting, and supported independent review.
- No unresolved duplicate, measurement fingerprint collision, retraction,
  expression of concern, or contradictory direction remains.
- Local ocular, systemic, in vivo, ex vivo, in vitro, and clinical observations
  are never pooled unless the policy contains an explicit compatibility rule.

### 5.2 Parameter Envelope Gate

Every automatically mutable parameter is registered in a policy manifest with:

- canonical parameter ID and model module;
- scientific meaning and unit;
- permitted disease, tissue, species, assay, and time contexts;
- lower and upper physiologic/model bounds;
- maximum relative change per release, initially 10%;
- permitted calibration objective and transformation;
- sentinel outputs that must not regress;
- public disclosure level.

An unregistered parameter cannot be changed automatically. A proposed value
outside its bounds or beyond the 10% release delta is blocked. Multiple small
releases cannot bypass the limit: cumulative change from the last manually
reviewed anchor version is capped at 20%.

### 5.3 Validation Gate

- The fitting objective improves by at least 10% on eligible training
  observations relative to the active model.
- The locked holdout objective improves by at least 5%.
- No registered sentinel endpoint degrades by more than 2%.
- Normal-baseline stability, non-negativity, mass-balance checks, disease
  ordering, known intervention directionality, reset/replay determinism, and
  numerical convergence all pass.
- Validation is repeated from the recorded parameter snapshot, code commit,
  observation package hashes, policy version, software environment, and random
  seed.
- A candidate that used holdout results to alter its fit is blocked and requires
  a new independent holdout set.

These thresholds are policy values, not universal biological truths. Changing a
threshold requires a new policy version and cannot retroactively approve an old
candidate.

### 5.4 Release And Rollback Gate

- The new semantic model version is distinct from the active version.
- The complete protected parameter snapshot and previous snapshot are stored on
  the Fleda server.
- A rollback version, rollback command, and post-activation health checks exist.
- Activation is atomic: readers see either the complete old version or complete
  new version.
- Post-activation checks repeat the public baseline and sentinel simulations.
- Any failed post-activation check automatically restores the prior snapshot,
  records a `rolled_back` event, and disables further automatic attempts for the
  same candidate.

## 6. Calibration Reproducibility Record

Each run stores:

- calibration run ID and timestamps;
- active base model version and proposed version;
- parameter policy manifest hash;
- observation IDs, package hashes, locator fingerprints, and measurement
  fingerprints;
- train/holdout assignment and assignment seed;
- code commit, container image digest, dependency lock hash, solver and fitting
  configuration;
- initial, fitted, and constrained parameter snapshots;
- objective values and uncertainty before and after calibration;
- complete behavior-check results;
- release decision and rollback result.

The record is immutable. A retry creates a new run ID.

## 7. Public Model Change Ledger

The public application adds a `Model Change Ledger` view with a chronological
list and filters for disease, pathway, parameter family, version, status, and
date.

Each list record displays:

- model version and release date;
- status: `Candidate`, `Testing`, `Active`, `Rejected`, or `Rolled Back`;
- disease, tissue/compartment, and pathway context;
- parameter family and change direction;
- normalized percentage change when public disclosure is permitted;
- supporting publication count and research-group count;
- training and holdout metric changes;
- uncertainty, evidence grade, and policy version;
- automatic or manual release route;
- rollback version and current rollback status.

The detail view displays:

- a plain-language reason for the change;
- evidence table with PMID, PMCID, DOI, source location, context, assay, sample
  size, unit, and review status;
- before/after validation and sentinel results;
- limitations, conflicts, exclusions, and what did not change;
- release and rollback timeline;
- public scientific comments and response history.

### 7.1 Protected Parameter Disclosure

The public ledger never returns the complete protected parameter snapshot,
private solver configuration, credentials, local paths, proprietary priors, or
internal review notes.

Each parameter policy declares one disclosure level:

- `public_exact`: old value, new value, unit, and delta may be shown.
- `public_normalized`: parameter family, direction, normalized delta, and bounds
  category are shown; exact protected values remain server-only.
- `public_summary`: only the affected mechanism, direction, evidence, metrics,
  and model-output effect are shown.

The initial default is `public_normalized`. Exact disclosure requires an
explicit parameter-level policy decision.

## 8. Registered Scientific Comments

Anyone may read ledger entries and comments. Comment submission requires an
independent Fleda research account using email magic-link authentication. The
account stores only the minimum profile required for scientific discussion:
display name, email, optional affiliation, role, and conflict-of-interest
statement. It does not use GN authentication.

A comment contains:

- comment ID, ledger entry ID, author ID, created time, and amendment links;
- type: `support`, `question`, `disagree`, or `conflicting_evidence`;
- concise scientific rationale;
- optional PMID, PMCID, DOI, or permitted public dataset links;
- declared disease, tissue, assay, and endpoint context;
- conflict-of-interest declaration;
- moderation and AI-review status.

AI checks citation resolvability, obvious context mismatch, duplicate content,
sensitive information, unsupported factual claims, and abusive/spam content. AI
may flag or hold a comment but cannot alter its scientific position, approve a
model change, or delete an audit record. Moderation actions are logged.

Comments never enter calibration automatically. A supported comment may create
a new evidence-intake candidate that restarts the standard observation and
release process.

## 9. API Boundary

Public read-only endpoints:

- `GET /v1/model/version`
- `GET /v1/model/change-ledger`
- `GET /v1/model/change-ledger/{entryId}`
- `GET /v1/model/change-ledger/{entryId}/comments`

Registered Fleda account endpoints:

- `POST /v1/auth/magic-link/request`
- `POST /v1/auth/magic-link/verify`
- `POST /v1/model/change-ledger/{entryId}/comments`
- `POST /v1/model/change-ledger/comments/{commentId}/amend`

Private administrative endpoints:

- `POST /v1/admin/calibrations`
- `GET /v1/admin/calibrations/{runId}`
- `POST /v1/admin/calibrations/{runId}/evaluate-release`
- `POST /v1/admin/releases/{version}/activate`
- `POST /v1/admin/releases/{version}/rollback`
- `POST /v1/admin/comments/{commentId}/moderate`

Administrative endpoints require Fleda server authentication and are not
enabled for GitHub Pages CORS. Automatic jobs use short-lived workload
credentials and cannot call account-management endpoints.

## 10. Storage Model

The private Fleda server uses append-only records for:

- parameter policies and policy versions;
- calibration runs and train/holdout assignments;
- protected parameter snapshots;
- validation and sentinel results;
- release and rollback events;
- public ledger projections;
- Fleda research accounts, sessions, comments, amendments, moderation, and audit
  events.

Protected snapshots are encrypted at rest and excluded from public API logs,
Git, GitHub Actions artifacts, browser storage, and analytics. Public ledger
records are projections generated from release events, not the source of truth.

## 11. Failure Handling

- Source retrieval or extraction failure is retryable and never marks a paper as
  completely processed.
- Validation uncertainty, missing fields, incompatible context, or unavailable
  holdout evidence produces `blocked`, not a guessed value.
- Conflicting studies remain visible and cannot be silently averaged.
- An unavailable Fleda server leaves the public teaching model operational and
  shows the ledger as temporarily unavailable.
- A failed activation automatically rolls back and emits a public rollback
  ledger entry after protected diagnostics are recorded.
- Comment moderation or authentication failure cannot affect simulation or
  release operations.

## 12. Testing And Acceptance

### 12.1 Automatic Release

- An eligible multi-publication package can create a candidate but cannot mutate
  the active snapshot during calibration or testing.
- Fewer than three publications, fewer than two independent groups, no locked
  holdout, an incompatible context, or an unresolved conflict blocks release.
- An unregistered parameter, out-of-envelope value, greater than 10% per-release
  change, or greater than 20% cumulative change blocks release.
- Training, holdout, sentinel, numerical, baseline, or provenance failure blocks
  release.
- A fully compliant candidate creates a distinct active version atomically.
- Post-activation failure restores the previous version and records rollback.
- Replaying a run from hashes, code version, environment, and seed reproduces
  its decision.

### 12.2 Ledger

- Every active, rejected, and rolled-back version has an immutable ledger entry.
- Public records expose the correct disclosure level and never expose protected
  snapshots or internal configuration.
- Evidence links, metrics, uncertainty, limitations, policy, and rollback state
  are understandable and traceable.
- Public readers can filter and inspect entries without an account.

### 12.3 Comments

- Only verified Fleda accounts can submit comments.
- Comments require type, rationale, context, and conflict-of-interest status.
- Amendments preserve the original comment.
- AI review and moderation cannot change parameters or release status.
- A comment can create a new evidence-intake candidate but cannot bypass
  quantitative observation eligibility.

## 13. Implementation Sequence

1. Implement the policy manifest, evidence aggregation, calibration-run record,
   and dry-run release evaluator locally with synthetic fixtures.
2. Implement immutable public ledger projections and a read-only GitHub Pages
   view using synthetic/released records.
3. Implement Fleda server persistence, protected snapshots, atomic activation,
   rollback, and public ledger APIs.
4. Implement Fleda magic-link accounts, structured comments, AI checks, and
   moderation audit.
5. Run the first AMD calibration only in dry-run mode. Review the generated
   ledger record and validation report before enabling policy-controlled
   activation.
6. Enable controlled automatic activation for explicitly registered parameters
   only after the dry-run acceptance suite passes.

## 14. External Governance Basis

The design follows the principles of predetermined modifications, evidence-based
validation, transparency, monitoring, and rollback described by the FDA,
Health Canada, and MHRA for machine-learning change control. It also follows EMA
guidance to preserve train/validation/test separation, prevent leakage, maintain
traceable development records, and freeze models where the context requires it.
NIST AI RMF concepts inform continuous governance, measurement, monitoring,
override, incident response, recovery, and change management.

References:

- https://www.fda.gov/medical-devices/software-medical-device-samd/predetermined-change-control-plans-machine-learning-enabled-medical-devices-guiding-principles
- https://www.ema.europa.eu/en/use-artificial-intelligence-ai-medicinal-product-lifecycle-scientific-guideline
- https://airc.nist.gov/airmf-resources/airmf/5-sec-core/
