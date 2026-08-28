# Complement Literature Intelligence V1 Design

## 1. Purpose

Complement Literature Intelligence V1 will extend the standalone Fleda
Complement System Digital Twin with a traceable evidence-integration pipeline.
Its purpose is to combine fragmented complement research into a shared,
context-aware knowledge system while preserving experimental conditions,
conflicts, uncertainty, and provenance.

V1 is an AMD alternative pathway pilot. It will process approximately 30-50
papers and connect published evidence to the existing knowledge graph and
dynamics simulator. The system is a research modeling tool, not a diagnostic or
treatment system.

## 2. Project Boundaries

- The system remains a standalone Fleda project.
- It must not connect to GN authentication, databases, APIs, customer data, or
  production data.
- Published evidence, AI-verified extraction, and model inference must remain
  visibly distinct.
- AI review is not represented as expert review.
- Model parameters are versioned candidates and are never silently overwritten.
- Automated full-text retrieval is limited to lawfully accessible open content.
- Non-open papers are processed from abstracts or user-uploaded lawful copies.
- Initial AI API spending is limited to USD 50 per month by a hard budget guard.

## 3. Recommended Approach

V1 uses a hybrid evidence pipeline:

1. Public literature services provide discovery, metadata, open full text, and
   biomedical entity annotations.
2. Local rules normalize identifiers, units, values, tissues, species, disease
   stages, and experimental context.
3. A first AI pass extracts structured claims from source text.
4. An independent second AI pass checks each claim against the source.
5. Local validation determines whether a claim can enter the knowledge graph or
   influence model calibration.

This approach is more capable than a rule-only extractor and more auditable
than an autonomous black-box research agent.

## 4. System Architecture

```text
PubMed / Europe PMC / PubTator
              |
              v
      Literature Collector
              |
              v
         Document Store
              |
              v
         AI Extractor
              |
              v
  Independent AI Evidence Reviewer
              |
              v
       Evidence Validator
              |
              v
         Evidence Store
              |
        +-----+------+
        |            |
        v            v
 Knowledge Graph   Parameter Priors
        |            |
        +-----+------+
              v
 Complement Dynamics Simulator
```

### 4.1 Local Literature Service

A standalone Python service will provide collection, document parsing,
extraction orchestration, validation, persistence, and a local API. It will use
SQLite in V1. The existing static frontend will call this service only on the
local machine.

### 4.2 Literature Collector

The collector will:

- Search by disease, component, tissue, mechanism, and intervention.
- Retrieve PubMed and Europe PMC metadata.
- Retrieve open full text when licensing permits.
- Import PubTator entity and relation annotations.
- Accept user-uploaded PDF documents.
- Deduplicate by PMID, PMCID, DOI, title, and document hash.
- Preserve publication version, retrieval date, source, and license status.

### 4.3 Document Store

Documents will be separated from extracted evidence. Stored records include
metadata, abstract, open full text or uploaded-file reference, normalized
sections, tables when extractable, document hash, and provenance.

### 4.4 AI Extractor

The first AI pass converts selected passages into structured evidence claims.
It must quote or locate the supporting passage, retain experimental context,
and return a schema-constrained result. It cannot directly edit the knowledge
graph or simulation parameters.

### 4.5 Independent AI Reviewer

The second AI pass receives the source passage and proposed claim. It returns:

- `supported`
- `partially_supported`
- `unsupported`
- `conflicted`

It also identifies omissions, causal overstatement, numerical mismatch, and
context loss. Its output is labeled AI cross-validation, not expert approval.

### 4.6 Evidence Validator

Local deterministic validation checks:

- Identifier normalization.
- Numeric parsing and unit compatibility.
- Direction and magnitude consistency.
- Species, tissue, compartment, sample, genotype, disease stage, dose, and time.
- Correlation-versus-causation wording.
- Duplicate and contradictory claims.
- Required fields for calibration eligibility.

### 4.7 Knowledge Graph

The graph will represent proteins, fragments, complexes, reactions, pathways,
tissues, compartments, diseases, phenotypes, biomarkers, variants, drugs,
experiments, publications, and evidence claims. Context is part of each edge;
opposing claims are retained instead of averaged away.

### 4.8 Calibration Engine

Only calibration-eligible quantitative claims may generate parameter priors.
The engine produces ranges and uncertainty rather than false precision. It
creates a candidate model version, runs regression comparisons, and records
which claims affected each parameter.

### 4.9 Inference Engine

The inference engine may propose missing relationships, plausible intermediate
mechanisms, sensitive parameters, and high-value experiments. Every output is
labeled as model inference and remains separate from published evidence.

### 4.10 Budget Guard

The service records model, token usage, cost estimate, paper, task, and date for
each AI request. It stops new paid extraction or review jobs when the configured
monthly total reaches USD 50. Retrying failed work also counts toward the
budget. Local and public-database operations remain available after the stop.

## 5. Evidence Claim Schema

Each evidence claim records at least:

- Subject, relation, object, direction, and magnitude.
- Uncertainty, distribution, or reported interval when available.
- Tissue, compartment, species, disease, subtype, stage, and genotype.
- Sample type, intervention, comparator, dose, duration, and time point.
- Sample size, statistical result, and experimental method.
- PMID, PMCID, DOI, source location, and supporting excerpt.
- Extraction model and prompt version.
- Reviewer model and review result.
- Rule-validation result, confidence score, and eligibility state.

Claims have one of these workflow states:

- `accepted_for_knowledge_graph`
- `accepted_for_calibration`
- `context_limited`
- `conflicted`
- `hypothesis_only`
- `rejected_extraction`

## 6. Evidence Scoring

The initial confidence score is composed of:

- Source-text support: 30 percent.
- Independent AI-review agreement: 20 percent.
- Experimental-context completeness: 15 percent.
- Numeric and unit verifiability: 10 percent.
- Human and target-tissue relevance: 10 percent.
- Independent replication: 10 percent.
- Study-design quality signals: 5 percent.

An AI confidence statement alone never raises the score. Calibration requires a
supporting source location, successful independent review, required context,
valid numeric representation, threshold confidence, and no unresolved severe
conflict.

## 7. Conflict Handling

Contradictory findings are retained as separate claims. The system first tests
whether disagreement can be explained by species, tissue, compartment, sample,
genotype, disease stage, method, dose, or time. Remaining disagreement is
represented as an unresolved conflict and excluded from automatic calibration
unless a context-specific model can separate the findings.

## 8. AMD Alternative Pathway Pilot

The pilot corpus will focus on C3, C3a, C3b, Ba, Bb, Factor B, Factor D, Factor
H, Factor I, properdin, C5a, and sC5b-9 across plasma, serum, aqueous humor,
retina, macula, RPE, Bruch's membrane, choroid, and drusen.

The pilot must distinguish local ocular activity from systemic activity and
preserve AMD subtype, stage, genotype, sample source, and timescale. It must not
interpret AMD as a systemic complement storm.

## 9. User Experience

The existing application will add a Literature Intelligence workspace with:

### 9.1 Literature Queue

Search, import, deduplication, full-text availability, processing status,
estimated cost, and actual cost.

### 9.2 Evidence Review

Source text beside extracted claims, source locations, both AI decisions, rule
checks, confidence, context, and workflow state.

### 9.3 Complement Knowledge Map

Evidence-backed connections among complement components, tissues, diseases,
biomarkers, drugs, and publications.

### 9.4 Conflicts and Gaps

Unresolved disagreements, unsupported reactions, missing parameters, and
suggested literature or experiments.

### 9.5 Model Calibration

Current parameter, evidence-supported candidate range, evidence count,
uncertainty, affected outputs, and before/after model comparison.

## 10. Model Update Workflow

```text
Current model
    |
    v
Candidate parameter version
    |
    v
Baseline and disease regression simulations
    |
    v
Curve, organ-signal, and drug-response comparison
    |
    v
Versioned acceptance or rejection
```

Each model version records its evidence claims, parameter changes, simulation
results, AI and prompt versions, cost, timestamps, and decision rationale.

## 11. Failure Handling

- API outages leave jobs retryable without corrupting evidence state.
- Rate limits use bounded backoff and resumable queues.
- Invalid AI output is rejected by schema validation and may be retried once.
- Budget exhaustion pauses paid jobs before issuing another request.
- Missing full text falls back to abstract-only processing and is labeled.
- PDF parsing failures retain the source record and expose the failure reason.
- Database writes use transactions so a partial paper cannot appear complete.

## 12. Testing Strategy

- Unit tests for normalization, units, scoring, eligibility, conflicts, budget,
  and deduplication.
- Contract tests for PubMed, Europe PMC, PubTator, and AI response schemas.
- Fixture-based extraction tests using known AMD passages and expected claims.
- Adversarial tests for negation, correlation, species mismatch, and conflicting
  values.
- Integration tests from paper import through evidence persistence.
- Regression tests showing that unapproved claims cannot change simulations.
- Browser tests for the literature queue, evidence trace, conflicts, and model
  comparison.

## 13. Implementation Phases

1. Local Python service, SQLite schema, configuration, and budget guard.
2. PubMed, Europe PMC, PubTator collection and deduplication.
3. AI extraction, independent AI review, rule validation, and scoring.
4. Literature Intelligence frontend and provenance views.
5. AMD alternative pathway 30-50 paper pilot.
6. Knowledge-graph integration, candidate priors, and model version comparison.
7. Quality review followed by expansion to PNH, aHUS, and C3G.

## 14. Acceptance Criteria

- Search and import AMD alternative pathway literature.
- Process open full text, abstracts, and uploaded lawful PDFs.
- Trace every claim to a paper and source location.
- Prevent disagreeing AI outputs from entering calibration automatically.
- Preserve tissue, species, stage, numeric values, units, and context.
- Retain and visibly mark conflicting claims.
- Generate evidence-backed graph entities and relationships.
- Generate candidate parameter versions without silently changing the model.
- Stop paid AI work at the USD 50 monthly limit.
- Distinguish published evidence, AI-verified extraction, and model inference.
- Remain independent from every GN system and dataset.
- Display research-use and non-diagnostic boundaries.

## 15. Deferred Scope

- Clinical prediction or treatment recommendation.
- Autonomous acceptance of AI-generated biological claims.
- Full paywalled-corpus acquisition.
- Multi-tenant cloud deployment and user authentication.
- Production-scale vector search.
- Automatic expansion beyond AMD before pilot quality is measured.
