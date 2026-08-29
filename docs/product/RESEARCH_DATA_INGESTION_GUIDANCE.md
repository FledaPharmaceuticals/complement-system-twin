# Fleda Digital Twin Research Data Ingestion Guidance

## Purpose

This guidance defines how the Fleda C3 Digital Twin and Complement System
Digital Twin should periodically acquire, organize, assess, and use public
scientific information. The objective is to progressively connect fragmented
complement research into a traceable systems model without treating automated
extraction as scientific validation.

The platform remains an independent Fleda project. It must not connect to GN
authentication, databases, APIs, customer data, production data, or private
clinical systems.

## Scientific Learning Loop

```text
Public sources
  -> scheduled retrieval
  -> immutable raw snapshots
  -> structured extraction
  -> evidence records
  -> AI and rule-based checks
  -> candidate calibration suggestions
  -> approved model version
```

The learning loop is intentionally staged. New information may create a
candidate hypothesis, but it must not silently overwrite the formal model.
Every accepted change must retain its source, extracted values, assumptions,
uncertainty, and model version.

## Recommended Public Sources

The first ingestion layer should prioritize stable, openly accessible sources:

- PubMed and Europe PMC for paper metadata, abstracts, and identifiers.
- Crossref for DOI and publication metadata.
- UniProt for protein identity, gene mapping, and functional annotation.
- Reactome for pathway membership and biological relationships.
- Gene Ontology for gene-function and process annotations.
- GEO for public gene-expression datasets where the sample context is usable.
- ClinicalTrials.gov for public trial metadata and intervention context.

Source adapters must record the provider, request date, query, response
identifier, license or access note, and a content hash when practical.

## Data Layers

The system must keep the following layers separate:

| Layer | Contents | Formal model use |
| --- | --- | --- |
| Raw | Source responses, abstracts, tables, and permitted files | Never directly |
| Normalized | Canonical names, units, entities, relationships, and conditions | No |
| Evidence | Claims, values, source identifiers, evidence level, and uncertainty | As traceable priors only |
| Candidate | AI or rule-generated parameter suggestions and conflict reports | No automatic use |
| Validated model | Approved parameters, mechanisms, and version record | Yes |

Recommended initial local layout:

```text
data/
  literature.db
  raw/
  normalized/
  evidence/
  candidates/
  snapshots/
```

SQLite is appropriate for the early standalone phase. If volume grows, use
PostgreSQL for structured records and object storage such as S3-compatible
storage for large source files. Keep source code, extraction rules, schemas,
and model configurations in Git; do not place a large paper archive in the
repository.

## Evidence Record Requirements

Every evidence record should include, where available:

- Stable source identifier such as PMID, DOI, accession, or database ID.
- Source URL or locator and retrieval date.
- Title, authors or provider, and publication year.
- Exact claim or extracted observation.
- Entity and disease links using canonical IDs.
- Numeric value, unit, reference range, and transformation history.
- Sample type, species, tissue, assay method, cohort size, disease stage, and
  intervention status.
- Evidence level such as mechanistic, in vitro, in vivo, biomarker, clinical,
  genetic, review, or hypothesis.
- Uncertainty and extraction method.

Missing metadata should remain explicitly missing. The pipeline must not infer
an experimental condition and present it as reported fact.

The current local validation prototype accepts only an explicit normalized
0-100 proxy scale. Species, tissue, assay, disease stage, and intervention
status may be recorded as context, but no unit conversion is attempted until a
validated assay-specific mapping is available.

## AI Review Responsibilities

AI may assist with:

- Entity and relationship extraction.
- Unit and terminology normalization.
- Duplicate and near-duplicate detection.
- Contradiction and outlier flagging.
- Comparison with existing evidence.
- Drafting candidate calibration suggestions.

AI must not:

- Invent a citation, value, unit, or experimental condition.
- Treat an association as causation.
- Merge incompatible assays or disease stages without marking the mismatch.
- Directly change a formal parameter.
- Present a hypothesis, proxy, or association as a diagnosis or validated fact.

Candidate suggestions must show the current value, proposed value or range,
direction, rationale, evidence IDs, evidence level, uncertainty, and model
version. Acceptance creates a new model version rather than editing history.

## Scheduling

The first automated schedule should be conservative:

- Weekly: retrieve newly indexed papers for C3, C3a, C3b, C5a, MAC, Factor H,
  Factor I, Factor B, Factor D, CD55, CD59, AMD, PNH, aHUS, C3G, and sepsis.
- Monthly: refresh public annotations and produce an evidence-change report.
- On demand: reprocess a source after a schema or extraction-rule update.

Each run should be idempotent: the same source identifier and content hash must
not create duplicate evidence records. Failed requests should be logged and
retried without marking a source as processed.

GitHub Actions can run public-source metadata retrieval without secrets. A
local scheduled Python service is suitable when source files, larger parsing
jobs, or private research workspaces are introduced. No schedule should upload
patient or production data.

## Calibration and Model Governance

The ingestion system should produce a report containing:

1. New and changed source records.
2. Newly extracted entities and relationships.
3. Unit or condition conflicts.
4. Candidate parameter changes.
5. Evidence strength and uncertainty.
6. Records requiring human or expert review when that capability becomes
   available.

Until expert review is available, the platform should remain transparent about
the limitation. AI cross-checking can reduce clerical error, but it does not
replace domain validation. Candidate records may be displayed in the research
interface, while formal simulations continue using the last validated model
version.

## Cost and Operations

Keep public metadata retrieval free where possible. Use paid AI only for bounded
extraction or conflict analysis, protect it with a monthly budget, cache
results, and record usage. The existing initial budget target is USD 50 per
month, subject to later review.

## Safety and Interpretation

All outputs must carry the model version and an evidence or uncertainty label.
The platform is for research and education, not diagnosis or treatment
decisions. AMD must remain retina-centered; systemic cards are association or
pathway-relevance layers rather than deterministic multi-organ injury. No
public ingestion result should imply that a disease has been clinically
validated by the Digital Twin.

## Implementation Order

1. Finish source and evidence schemas in the standalone local service.
2. Add one public source adapter, preferably Europe PMC or PubMed metadata.
3. Store immutable raw snapshots and deduplicate by source identifier/hash.
4. Normalize complement entities, diseases, units, and experimental context.
5. Run deterministic checks before any AI review.
6. Generate candidate calibration records without changing formal parameters.
7. Add a candidate review view and model-version export.
8. Expand to additional databases and approved research datasets.

This order keeps the first useful version inexpensive, inspectable, and
reversible while leaving a clear path toward a collaborative research platform.

The current PubMed adapter implements the first snapshot slice: ESearch,
ESummary, and optional EFetch abstract responses are stored locally with a
content hash and are never treated as formal model parameters.
Europe PMC is also available as a second public adapter. Duplicate PMID
records are merged locally with both source providers and locators retained;
normalized DOI matching covers records without a shared PMID. Formatting and
identifier normalization are deterministic and do not infer scientific claims.
The UniProtKB adapter stores protein annotations separately from publication
evidence, preserving accession, gene, organism, function text, and retrieval
time without promoting annotations into model parameters.
## Applied Literature and Controlled Model Learning

The Complement System Digital Twin maintains an applied literature catalog in
addition to raw ingestion snapshots. Catalog records must include a PMID or
equivalent public source locator, title, authors, publication year, evidence
design, linked disease/components, intended candidate model use, and an
explicit statement that the formal model was not changed.

Ranking is transparent and reproducible:

1. Recent publications receive a recency contribution.
2. Randomized trials, consensus records, and comprehensive reviews receive
   stronger evidence-design contributions than narrative commentary.
3. Recognized sources receive a bounded curator score.
4. Direct disease and mechanism matches receive a relevance contribution.
5. Work involving Dr. John D. Lambris and collaborators receives a small,
   visible expert-source contribution because of its importance to complement
   biology and C3 therapeutics. This contribution never substitutes for study
   design, independent replication, or direct relevance.

The conversational workspace may use ranked sources to explain or propose:

- pathway topology and regulatory relationships;
- disease-specific tissue weights;
- intervention targets and directions of effect;
- plausible parameter ranges with units and experimental context;
- conflicts, missing measurements, and validation needs.

The automated learning loop stops at a candidate review package:

`public source -> normalized evidence -> rule/AI extraction -> conflict and unit checks -> candidate calibration -> validation -> versioned release`

No publication, author priority, automated extraction, or conversational
instruction can directly overwrite the active model. Every accepted change
must retain the evidence identifiers, parameter difference, validation result,
review decision, uncertainty, and released model version.
