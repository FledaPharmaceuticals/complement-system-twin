# Complement System Digital Twin

Complement System Digital Twin is a standalone Fleda project for exploring the
whole complement system as a knowledge twin and intervention simulation sandbox.
It is independent from the previous C3 Digital Twin application and does not use
C3 app code, GN systems, GN databases, GN auth, GN APIs, or customer data.

## V1 Scope

V1 is a **Knowledge Twin + Rule-Based Simulation**. It is designed to organize
complement biology and make pathway logic easier to inspect, explain, and
demonstrate.

V1 includes:

- Complement pathway map for classical, lectin, alternative, terminal, and regulatory systems.
- Knowledge graph explorer with proteins, fragments, complexes, receptors, regulators, diseases, drugs, and biomarkers.
- Rule-based simulation console for pathway activity, regulatory status, disease context, and drug-target inhibition.
- Disease context panel for PNH, aHUS, C3G, IgA nephropathy, AMD, lupus nephritis, sepsis, and cancer microenvironment.
- Drug intervention panel for C1s, MASP-2, C3, Factor B, Factor D, C5, and C5aR inhibition.
- Advanced Dynamics Explorer for optional low-level concentration/activity controls.
- AMD Disease Context Module focused on retina/macula/RPE/choroid risk visualization.
- Model Maturity and V2 Roadmap panel for platform development planning.
- Biomarker-Guided Initialization prototype for translating complement biomarkers into model priors.
- Literature Intelligence foundation with a standalone local service, SQLite
  persistence, service readiness display, and paid-AI budget protection.
- AI-style deterministic summary engine without external LLM calls.
- Placeholder API module and future QSP adapter.

## Shared Model Contract

The C3 and Complement System twins are being aligned around a provider-neutral
model contract in `src/modelContract.js`. A simulation context records the
disease context, normalized complement dynamics, optional drug intervention,
and evidence identifiers. Evidence records retain their source locator,
evidence level, uncertainty, linked entities, parameter priors, extraction
method, and model version. Simulation runs are explicitly labeled
`research_proxy` and `isClinicalPrediction: false`.

This contract is an in-memory V1 boundary for future file or service-backed
evidence integration. It does not add accounts, a database, patient data, or
production data collection. The API manifest exposes the current model version,
supported disease contexts, and signal keys without changing the existing
simulation output shape.

The opt-in `simulateVersioned()` wrapper in `src/versionedSimulation.js` now
attaches those records to an existing rule-based simulation. The legacy
`simulate()` API remains unchanged for the current UI, while new consumers can
use the versioned wrapper for evidence-aware runs.

## Candidate Calibration Layer

`src/calibrationCandidates.js` converts complete evidence records with valid
parameter ranges into reviewable calibration suggestions. Each suggestion
contains the current value, proposed median, allowed range, rationale, source
identifier, evidence level, uncertainty, and model version. Its status is
always `candidate`; it never mutates formal parameters or presents a hypothesis
as a validated fact. The API exposes this as `suggestCalibration()` for the
future review interface.

## Model Version Governance

`src/modelRegistry.js` provides append-only release metadata and candidate
change records. A candidate references its base model version and evidence
identifiers, but has no promoted version and cannot mutate the active release.
The API exposes the active release list through `getModelManifest()` and the
record constructor through `createModelChangeRecord()`. A future governed
review workflow must explicitly promote an accepted candidate into a new model
version.

`src/evidenceCatalog.js` normalizes the existing publication seed records into
the shared evidence contract and supports lookup by disease or complement
entity. Seed records use an explicit `seed://` locator and `curated_seed`
extraction method; they are not presented as PMID-verified sources. Future
publications with real URLs can pass through the same interface without
changing simulation consumers.

The catalog accepts future normalized public records through its
`externalRecords` input, keeping imported evidence and existing seed evidence
queryable through the same interface.

`src/appliedLiteratureCatalog.js` adds a public, PMID-linked applied literature
directory for the research interface. Its transparent priority score combines
publication recency, study or review design, curated recognition, direct
relevance to the selected disease/mechanism, and a small expert-source bonus
for publications involving John D. Lambris and collaborators. The author bonus
is visible and deliberately limited: it cannot outrank substantially stronger
evidence by itself. Each entry states exactly how it may guide a candidate
model assumption and always carries `formalModelChanged: false`.

The Conversational Experiment Workspace uses this directory after parsing an
experiment description. It presents disease, focus, intervention, time scale,
missing information, assumptions, safety boundaries, and the most relevant
PubMed sources before enabling a simulation. Running the prepared plan updates
the existing main dynamics and organ-impact views. It does not call a remote AI
service, save the prompt, or modify model parameters.

Lambris Evidence Training V1 adds PubMed-verified records discovered through
the public Lambris publication catalog. Each priority record carries the
experimental context, source-specific mechanistic claims, directional
candidate effects, and explicit transfer limits. `src/evidenceGuidance.js`
combines only the records selected for the experiment and labels every output
as `candidate_review`. Disease-context compatibility prevents a mechanism from
one tissue or disease from being presented as primary calibration evidence for
an unrelated context. Candidate effects remain qualitative unless a later
review package establishes compatible units, exposure, assay, and validation.

`src/publicEvidenceAdapter.js` provides an offline adapter for PubMed-style
metadata. It preserves PMID/DOI provenance, infers a conservative evidence
level from publication type, links only explicitly supplied vocabulary terms,
and labels the extraction method as `public_database_metadata`. It does not
download papers, call an AI provider, or write to the formal model.

## Advanced Dynamics Explorer

The Advanced Dynamics Explorer is a lower-level dynamic systems-biology
visualization module. The main product experience now lives in the Live Dynamics
Window at the top of the app; this advanced explorer is retained as an optional
research console for users who need direct control over concentrations, pathway
activity, time step, and intervention timing.

The V1 module includes:

- C3 cleavage: `C3 -> C3a + C3b`.
- Alternative amplification: `C3b + Factor B + Factor D -> C3bBb`.
- C5 cleavage: `C5 -> C5a + C5b`.
- MAC formation: `C5b + C6/C7/C8/C9 -> MAC`.
- Factor H / Factor I regulation of C3b.
- CD59 regulation of MAC formation.
- Timed drug intervention events such as C5 inhibition at a selected time point.
- Interactive multi-curve Plotly chart with zoom, pan, hover tooltip, legend hide/show, reset zoom, and time range slider.
- Current time inspector and biological interpretation text.

V1 uses simplified Euler integration and rule-based kinetic rates. It is not a
real QSP model, does not represent validated patient prediction, and should not
be used for medical diagnosis. The code is intentionally commented so the rate
logic can later be replaced by QSP / ODE / SBML / COPASI models.

## AMD Disease Context Module

The AMD module models age-related macular degeneration as a retina-centered
disease context, not as a deterministic whole-body organ injury model. AMD
primarily affects the retina, macula, RPE, and choroid. Complement
dysregulation, especially alternative pathway activity and CFH/C3/CFB/CFI
associations, is represented as a key mechanism.

When AMD is selected, V1 increases alternative pathway tone, reduces Factor H
regulatory strength, and adds AMD-specific outputs:

- Retinal complement activity score.
- Drusen formation risk proxy.
- RPE stress score.
- Choroidal inflammation score.
- Geographic atrophy progression proxy.
- Neovascular signal proxy.
- Systemic inflammation association score.
- Kidney complement association score.
- Neuroinflammation association score.

Body-system effects are shown as associations and risk layers. Brain, kidney,
vascular, and immune signals should not be interpreted as direct AMD organ
damage. The AMD dashboard includes a research-use disclaimer and should later be
calibrated with retinal imaging, genetics, complement biomarkers, laboratory
data, and clinical outcomes.

Disease-specific organ mapping is required because the same complement
activation pattern can have different biological consequences in different
diseases. AMD should not be interpreted as a systemic complement storm. It is
modeled as a retina/macula/RPE/choroid-centered disease with secondary systemic
associations that are deliberately lower-weight and folded away by default.

AMD uses a chronic months-scale progression view in the Live Dynamics Window
instead of the acute minutes-scale reaction window used for PNH, aHUS, sepsis,
and other fast complement activation scenarios. AMD does not alter the heart
rate monitor in V1; heart rate stays at baseline because AMD is not modeled as
an acute systemic cardiovascular response.

### AMD Literature Calibration Layer

V1 includes a curated AMD literature calibration scaffold in
`src/modules/complement-system-twin/calibration/amdLiteratureCalibration.js`.
This layer stores structured evidence records and converts them into model
parameter priors such as:

- Alternative pathway activity range.
- Factor H regulatory range.
- Retinal tissue sensitivity range.
- Local MAC / sC5b-9 risk range.
- Drusen proxy weight range.

The current records are seed priors for transparent research visualization, not
validated clinical calibration. Future versions should replace these seed
records with PMID-linked extraction records, retinal imaging features, genetics,
clinical outcomes, and complement biomarker datasets.

## Model Maturity

The current AMD module is labeled as a **Literature-calibrated prototype**. This
means it uses structured literature-derived priors and disease-specific logic,
but it is not yet biomarker-calibrated, experimentally validated, or clinical
research ready.

The intended maturity ladder is:

- Conceptual.
- Literature-calibrated prototype.
- Biomarker-calibrated research model.
- Experimentally validated model.
- Clinical research ready model.

The V2 roadmap prioritizes biomarker input, drug comparison, report export, and
validation datasets.

The drug comparison prototype runs the same active rule model against a
no-intervention baseline and selected C3, C5, Factor B, Factor D, and C5aR
interventions. It reports qualitative pathway and risk proxies side by side;
it does not estimate clinical efficacy or recommend treatment.

The report export prototype downloads a local JSON research record containing
the active model version, simulation inputs and outputs, linked evidence
summary, assumptions, and comparison rows. It is explicitly marked as
research-only and contains no patient or production data.

The validation dataset prototype accepts one or more anonymized aggregate
observations and compares them with model proxies using mean absolute error
and signed bias. It requires explicit no-patient/no-production declarations,
keeps the comparison local, and never promotes a calibration or changes the
formal model.

A saved validation JSON can be imported through the same panel using the local
file picker. The browser reads the file locally, checks its explicit safety
boundary, and compares every observation row against the selected disease
context; no file upload is performed.

Validation records carry an explicit `measurementScale` and
`experimentalContext` (for example species, tissue, assay, and disease stage).
The current comparison accepts only the declared `normalized_0_100_proxy` scale
and rejects out-of-range values; raw laboratory units remain deferred until a
validated conversion table and reference range are available.

Before comparison, `src/validationIntake.js` can run a local intake preflight.
It requires a traceable source record (`sourceType`, title, locator, and
retrieval date), an experimental context (assay, time scale, units, and
conditions), aggregate observations, and explicit no-patient/no-production
declarations. It returns `eligible_for_review` or `blocked` with machine-readable
reasons. The preflight does not upload or persist the submitted payload, and it
does not change the formal model. The first version also rejects common
patient, subject, medical-record, contact, customer, and production-batch field
names as a privacy safeguard.

Researchers can start from
`docs/product/validation-intake-template.json`. It is a blank format guide,
not a scientific dataset; replace its placeholders only with authorized,
aggregate observations and preserve the original source locator.

When a public abstract is available, the deterministic normalizer also keeps a
small list of exact sentences containing explicit complement or disease terms.
These `abstractEvidenceSnippets` are traceability aids only; they are not
claims, causal interpretations, or automatic calibration instructions.

The Literature Intelligence panel can expand these snippets in each saved
record, so a linked term remains inspectable at the source-text level.

## Biomarker-Guided Initialization

The V2 prototype includes a manual biomarker input panel for research
initialization. It accepts C3, C4, CH50, AH50, C3a, C5a, sC5b-9, Factor H,
Factor I, Factor B, and Factor D, then estimates:

- Classical pathway activity.
- Alternative pathway activity.
- Terminal pathway activity.
- Regulatory weakness.
- Inflammatory signal.
- Suggested disease relevance.

When applied, these estimates initialize the Live Dynamics Window as transparent
model priors. They are not diagnostic thresholds and should later be calibrated
with assay-specific reference ranges and real experimental or clinical datasets.

## Scientific Boundary

This V1 application is not a clinical diagnostic tool. It does not predict real
patient outcomes and does not replace laboratory data, clinical judgment,
experimental validation, or regulated medical software.

For citation, use the metadata in `CITATION.cff` and cite the exact model
version shown in each simulation or report.

The rule-based simulation is intentionally transparent and conservative. Scores
are 0-100 qualitative proxies, not calibrated clinical endpoints.

## Future Upgrade Path

Future versions can evolve toward:

- Literature extraction and evidence scoring.
- Postgres/Supabase persistence for entities, relationships, diseases, drugs, publications, and simulation runs.
- Python SciPy ODE / QSP service integration.
- Dynamic model integration through `src/modules/complement-system-twin/dynamics/odeAdapter.js`.
- SBML, COPASI, Julia DifferentialEquations, or MATLAB exported model integration.
- Patient-specific biomarker initialization.
- Lab-data calibration and uncertainty estimates.

## Literature Intelligence Service

Phase 1 adds a local Python service for the future evidence-integration
pipeline. It initializes a standalone SQLite database, exposes health and
budget APIs, records auditable paid-AI usage events, and blocks a request before
it would exceed the configured monthly limit.

Create the isolated environment and install the service dependencies:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-literature.txt
```

Start the local service:

```bash
./run-literature-service.sh
```

The service runs at `http://127.0.0.1:8790`. The application status panel calls:

- `GET /api/health`
- `GET /api/budget`
- `POST /api/budget/authorize`
- `POST /api/usage`

The next local-only literature step is available through:

- `POST /api/pubmed/search` with `{"query":"complement C3","retmax":10,"save":true}`
- `GET /api/literature/records?limit=100`
- `GET /api/literature/snapshots?limit=100`

The same search endpoint accepts `"source":"europe_pmc"` for the public
Europe PMC API. The ingestion runner accepts `--source pubmed`,
`--source europe_pmc`, or `--source both` for lightweight cross-source
collection.

PubMed search is metadata-only by default. The request may opt in to
`"include_abstract":true`, which retrieves public abstracts through NCBI
EFetch for local rule-based entity linking. It does not retrieve full text,
does not call a paid AI provider, and marks the response boundary as
`public_pubmed_metadata_and_abstract`.

Each search also stores an immutable local snapshot of the public E-utilities
response with source, query, retrieval time, content type, and SHA-256 hash.
Snapshots are deduplicated by content hash and can be inspected through the
snapshots endpoint; they are not uploaded to a public service.

When PubMed and Europe PMC return the same PMID, the local record is merged
instead of overwritten. Its metadata retains both source providers and source
locators, while any available abstract is retained for conservative local
entity linking.

Before persistence, public records receive deterministic formatting and DOI
normalization only. Records are matched by PMID or normalized DOI when
available; this is identity hygiene, not a biological inference step.

The Complement System Digital Twin page also exposes the same search through
the Literature Intelligence panel for non-programmer use, with a choice of
PubMed or Europe PMC.

The same panel exposes saved UniProtKB protein annotations for inspection;
these remain a separate knowledge-layer record type and are not mixed with
publication evidence.

Imported records are linked conservatively by explicit term matches against the
local disease and complement vocabulary. The linker records matched terms and
does not infer an unmentioned disease, mechanism, or parameter change.

The Literature Intelligence panel reports an evidence audit with accepted
metadata, records needing review, entity-link coverage, and unlinked records.

Phase 1 also includes an optional anonymous research feedback form. It creates a
local JSON file containing structured prediction/observation differences,
missing mechanisms, and literature links. It does not upload feedback, collect
identity information, or accept patient and production data.

For AMD, explicit local literature terms can generate high-uncertainty parameter
review candidates. These candidates are hypotheses with conservative ranges;
they never overwrite active model parameters or become a new release automatically.
Candidate ranges and directions are compared per parameter; opposite directions
or non-overlapping ranges are marked `needs_review` rather than merged.
The AMD panel can download a JSON calibration review package containing the
model version, candidates, conflicts, and evidence records for team review.

The PubMed adapter uses NCBI's public E-utilities metadata endpoints. It stores
canonical evidence records locally with PMID/source links, publication metadata,
conservative evidence level, and unknown uncertainty. It does not retrieve full
text, send documents to a paid AI provider, alter the formal model, or accept
patient or production data. Set `save` to `false` for a query-only response.

The default SQLite location is `data/literature.db`. The default paid-AI limit
is USD 50.00 per UTC calendar month and can be changed with
`FLEDA_AI_MONTHLY_BUDGET_USD`. See `.env.example` for non-secret configuration
values. Store future API keys only in a local `.env` or operating-system secret
store; `.env` is ignored by Git.

For repeatable local collection, run `./run-literature-ingestion.sh`. With no
arguments it searches a small Fleda complement watchlist, a recent-publication
window, and a Lambris author watch; use repeated
`--query` flags to provide a narrower set, and add `--include-abstract` only
when public abstracts are needed for local term linking. The runner continues
after an individual query error and prints a JSON report. A scheduler may call
this local command later; it never publishes data or changes the formal model.

The default PubMed query is sorted by publication date. Display priority is
then recalculated locally using the auditable score above. Automatic ingestion
means "discover and propose", not "self-modify": all extracted claims and
parameter suggestions remain in the candidate layer until provenance, units,
experimental context, conflicts, and validation have been reviewed and a new
model version is explicitly released.

Run `./scripts/verify-local.sh` before reviewing or publishing changes. It
checks the full Python test suite, literature-service compilation, the blank
validation template, and the read-only public-ingestion workflow safeguards.

`.github/workflows/public-literature-ingestion.yml` is a prepared weekly
workflow for public metadata and abstract snapshots. It uses a temporary
database, uploads only a time-limited run artifact, and grants read-only
repository access. It does not publish records into the active model; the
workflow must be reviewed and explicitly enabled in the Fleda repository
before it can run on GitHub.

If the local service is stopped, the Literature Intelligence panel reports
`Offline` while the existing complement simulations remain available.

When `index.html` is opened directly from disk, the service permits the browser's
local `null` origin so saved records can still be displayed. This permission is
limited to the local service and does not expose any public or GN-connected data.

Phase 1 does not parse PDFs or call an AI provider. Full-text extraction and AI
cross-validation remain later, gated phases after the persistence, provenance,
and budget interfaces are stable. The service is independent from all GN systems,
authentication, databases, APIs, and customer data.

## Run Locally

Open `index.html` directly in a browser.

No build step and no external package installation are required for V1.

## Suggested API Shape

- `GET /api/complement-system-twin/entities`
- `GET /api/complement-system-twin/relationships`
- `GET /api/complement-system-twin/pathways`
- `GET /api/complement-system-twin/diseases`
- `GET /api/complement-system-twin/drugs`
- `POST /api/complement-system-twin/simulate`
- `POST /api/complement-system-twin/publications`

The static V1 contains this structure as `src/api.js` so it can later migrate to
Next.js route handlers or another backend.

## Public Protein Annotation Layer

The local service exposes UniProtKB annotation endpoints:

- `POST /api/annotations/uniprot/search` with `{"query":"gene_exact:C3","size":10,"save":true}`
- `GET /api/annotations/uniprot/records?limit=100`

These records are kept in a separate annotation table from publications. They
retain accession, gene, organism, function text, source URL, and retrieval
time. UniProt annotations enrich the knowledge layer only; they do not become
kinetic parameters, clinical claims, or automatic model changes.

The same local panel can load a public Reactome pathway entry by stable ID:

- `POST /api/annotations/reactome` with `{"stable_id":"R-HSA-168249","save":true}`
- `GET /api/annotations/reactome/records?limit=100`

Reactome pathway annotations are stored in their own layer and retain stable ID,
species, event/participant counts, literature-reference counts, source URL, and
retrieval time. They provide pathway context only; they do not automatically
change simulation parameters or formal model versions.

Validation comparisons can produce high-uncertainty calibration directions when
there are enough anonymous observations and a material proxy bias. These are
shown in the validation result and model audit summary as reviewable candidates;
they are exported with the comparison record but are never applied
automatically.

## Model Promotion Gate

Calibration candidates remain hypotheses until an explicit validation record
marks them `validated`. The `promoteValidatedModelChange` helper then requires a
new model version and at least one evidence ID before producing a promoted
change record. It preserves the validation record and evidence chain; importing
public literature, UniProt, or Reactome data alone never changes the formal
model.

After validation, a promoted change can be converted into a `proposed` release
record with `createProposedModelRelease`. The record carries the new version,
validation record ID, change record ID, and evidence IDs, but it is not active
until a separate release decision is made.

Proposed releases also carry a deep-copied parameter snapshot and a distinct
rollback version. This makes a future release reviewable and reversible without
mutating the active in-memory model.

Before activation, `preflightProposedModelRelease` checks provenance and any
declared behavior/regression checks. Activation requires a passed preflight plus
an explicit approval record; the activation helper returns a new active release
object and does not mutate the existing release or model registry.

`applyApprovedModelRelease` produces a new parameter state only after the same
preflight and approval checks. It preserves the previous version and previous
parameters for rollback; the active application state is never mutated by the
helper itself.

`createReleaseReviewBundle` packages a ready proposed release, preflight result,
validation comparisons, candidate changes, and deduplicated evidence IDs into a
`review_only` record. It is intended for scientific review and citation; it
does not activate a release or claim that a calibration is clinically valid.
Validation comparisons entering the bundle must explicitly declare the
validation record type, contain no patient or production data, and declare that
the formal model was unchanged.
