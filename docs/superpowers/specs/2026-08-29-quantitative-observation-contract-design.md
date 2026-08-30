# Quantitative Observation Contract Design

**Status:** Approved for implementation after cross-language compatibility review.

## 1. Purpose

Establish a versioned, lossless contract for quantitative observations extracted
from published complement literature. The contract will be shared by the public
Complement System Digital Twin repository and the private Fleda Complement Model
Server before either project implements bulk extraction or parameter calibration.

The first pilot is AMD. It must preserve the distinction between local retinal,
RPE, choroidal, drusen, aqueous, and vitreous evidence and systemic plasma or
serum evidence. No observation may directly change the formal model.

## 2. Product Boundary

- The GitHub Pages application remains a public research and education interface.
- The private Fleda server owns source documents, extracted observations,
  calibration parameters, review history, model releases, and protected jobs.
- The public repository may contain schemas, validators, synthetic fixtures, and
  public evidence summaries. It must not contain copyrighted paper archives,
  private annotations, unpublished data, or formal model parameters.
- The system never connects to GN authentication, databases, APIs, customer data,
  or production data.
- The contract supports candidate calibration only. Every record carries
  `formalModelChange: false` until a separate governed release process creates a
  new model version.

## 3. Contract Identity

The canonical object name is `FledaQuantitativeObservation`.

```json
{
  "schemaName": "FledaQuantitativeObservation",
  "schemaVersion": "1.0.0"
}
```

Minor versions may add optional fields. A major version is required to remove a
field, change its meaning, change a controlled vocabulary, or alter calibration
eligibility. Producers must preserve the original source record and declare the
exact schema version used for every extraction.

## 4. Observation Schema

### 4.1 Identity and Source

Each observation contains:

- `observationId`: stable UUID or content-derived identifier.
- `schemaName` and `schemaVersion`.
- `source.pmid`, `source.pmcid`, and `source.doi`, nullable but with at least one
  stable identifier required.
- `source.title`, `source.publicationYear`, and `source.sourceUrl`.
- `source.contentHash`: SHA-256 of the exact source bytes used, encoded as
  `sha256:<64 lowercase hex characters>`.
- `source.retrievedAt`: ISO 8601 UTC timestamp.
- `source.accessType`: `open_full_text`, `open_abstract`, `licensed_upload`, or
  `metadata_only`.
- `source.license`: reported license identifier or `unknown`.

`metadata_only` and `open_abstract` records cannot be calibration eligible unless
the complete quantitative observation and its supporting location are available
from an explicitly permitted public source.

### 4.2 Source Location

`locator` identifies where the value came from:

- `sourceKind`: `text`, `table`, `figure`, or `supplement`.
- `section`, `page`, `tableId`, `figureId`, `panel`, `rowLabel`, and
  `columnLabel`, nullable when not applicable.
- `caption`: exact source caption when available.
- `supportingExcerpt`: bounded supporting text when license permits.
- `boundingBox`: optional normalized `{x, y, width, height}` within a source
  image or page.
- `axis`: optional x/y labels, units, scales, limits, and transformations for
  digitized figures.

At least one precise locator is required. A citation without a table, figure,
section, page, row/column, or bounded excerpt is not calibration eligible.

### 4.3 Biological Context

`biologicalContext` contains:

- `analyte`: reported complement component, fragment, complex, biomarker, or
  phenotype.
- `canonicalEntityId`: Fleda canonical identifier when mapped.
- `matrix`: plasma, serum, whole blood, aqueous humor, vitreous, tissue lysate,
  cell supernatant, or another explicitly reported material.
- `tissue`, `compartment`, `species`, `strain`, `cellType`, and `genotype`.
- `disease`, `subtype`, `stage`, and `phenotype`.
- `spatialScope`: `local_tissue`, `systemic`, `mixed`, or `unknown`.
- `experimentalSetting`: `in_vivo`, `ex_vivo`, `in_vitro`, `clinical`, or
  `unknown`.

Missing context remains `null` or `unknown`; it is never inferred and presented
as a reported fact. In the AMD pilot, retina/RPE/choroid evidence cannot be
merged with plasma/serum evidence solely because the analyte name matches.
Spatial scope and experimental setting are independent dimensions: an ex vivo
retinal explant remains `local_tissue` and `ex_vivo`, while a clinical plasma
measurement remains `systemic` and `clinical`.

### 4.4 Experimental Context

`experiment` contains:

- `studyDesign` and `experimentalModel`.
- `assay`, `assayManufacturer`, `assayVersion`, and `lowerLimitOfQuantification`.
- `cohort`, `sampleSize`, `replicateType`, and `replicateCount`.
- `groupId`, `groupLabel`, and `groupRole`: structured identity for the group to
  which the observation belongs. `groupRole` is `case`, `healthy_control`,
  `vehicle_control`, `treated`, `untreated`, `reference`, `other`, or `unknown`.
- `comparisonId`: shared identifier linking groups in one explicit comparison;
  nullable only when the endpoint is not comparative.
- `pairedDesign`: `paired`, `unpaired`, `mixed`, or `not_reported`.
- `baselineOrFollowup`: `baseline`, `followup`, `single_timepoint`, or
  `not_applicable`.
- `analysisSampleSize`: number of samples or participants actually included in
  the reported endpoint analysis, kept distinct from enrolled `sampleSize`.
- `intervention`, `comparator`, `dose`, `doseUnit`, and `route`.
- `duration`, `durationUnit`, `timepoint`, and `timeUnit`.
- `timepointAnchor`: `dose`, `stimulation`, `diagnosis`, `enrollment`,
  `collection`, `baseline`, `other`, or `unknown`.
- `preAnalyticalConditions`: collection, anticoagulant, storage, freeze-thaw,
  and processing details when reported.

An observation without a reported assay, sample size, and relevant time context
may guide a hypothesis but is not calibration eligible.

### 4.5 Measurement

`measurement` contains:

- `endpoint` and `reportedStatistic`.
- `value`, immutable `reportedValueText`, `reportedUnit`, and `unitCode`.
  `reportedUnit` preserves the source display exactly; `unitCode` uses the
  approved canonical unit vocabulary and remains `unknown` when no lossless
  mapping exists.
- `valueQualifier`: `exact`, `approximate`, `less_than`, `less_than_or_equal`,
  `greater_than`, `greater_than_or_equal`, or `not_reported`.
- `censored`: boolean, plus nullable `detectionLimit` and
  `detectionLimitUnitCode` for values limited by assay detection.
- `variabilityType`: `SD`, `SEM`, `CI`, `IQR`, `range`, `none_reported`, or
  `not_applicable`.
- `variabilityLower`, `variabilityUpper`, and `variabilityValue` as applicable.
- `pValue`, `effectEstimate`, and `effectEstimateType` when reported.
- `axisScale`: `linear`, `log10`, `ln`, or `categorical`.
- `extractionOrigin`: `text`, `table_cell`, `author_data`, or
  `figure_digitization`.
- `digitizationError`: nullable numeric estimate for figure-derived values.

Reported and normalized values are separate. The reported measurement is
immutable after import.

### 4.6 Normalization

`normalization` is optional and contains:

- `normalizedValue`, `normalizedUnit`, and `canonicalEndpoint`.
- `conversionRuleId` and `conversionRuleVersion`.
- `conversionInputs` and `conversionFormula`.
- `conversionStatus`: `not_required`, `validated`, `needs_review`, or
  `blocked`.

Every conversion is reversible from stored inputs. Assay-specific values are
not converted merely because their displayed units share a name.

### 4.7 Extraction and Review Provenance

`provenance` contains:

- `extractionMethod`: `deterministic_table`, `deterministic_text`,
  `figure_digitization`, `ai_extraction`, or `manual_import`.
- `extractorName`, `extractorVersion`, and `extractedAt`.
- `promptVersion`, nullable for deterministic extraction.
- `reviewerName`, `reviewerVersion`, and `reviewedAt`.
- `reviewResult`: `supported`, `partially_supported`, `unsupported`,
  `conflicted`, or `not_reviewed`.
- `ruleValidationResult`: `passed`, `warning`, or `failed`.
- `validationIssues`: structured issue codes and field paths.
- `sourceImageHash`: required for figure digitization.

AI review is an independent cross-check, not expert approval. It cannot add a
missing value, unit, assay, species, or condition as if reported by the paper.

### 4.8 Governance

`governance` contains:

- `workflowState`: `extracted`, `ai_reviewed`, `context_limited`, `conflicted`,
  `accepted_for_knowledge_graph`, `accepted_for_candidate_calibration`, or
  `rejected`.
- `uncertainty`: `low`, `moderate`, `high`, or `unknown`, matching the existing
  Fleda model contract vocabulary.
- `calibrationEligible`: boolean produced by deterministic validation.
- `eligibilityReasons`: machine-readable reason codes.
- `notApplicableReasons`: structured `{fieldPath, ruleId, reason}` entries for
  nullable fields that deterministic rules explicitly accept as not applicable.
- `evidenceLevel` and `studyQualitySignals`.
- `formalModelChange`: always `false` in this contract.
- `candidateModelVersion`: nullable target candidate version.

`accepted_for_candidate_calibration` does not mean validated, promoted, or
clinically useful. Promotion remains a separate server-side process.

## 5. Exchange Package

Offline exchange uses `FledaQuantitativeObservationPackage` version `1.0.0`:

```json
{
  "packageType": "FledaQuantitativeObservationPackage",
  "packageVersion": "1.0.0",
  "createdAt": "2026-08-29T00:00:00Z",
  "producer": {
    "name": "fleda-complement-system-twin",
    "version": "45e90cb"
  },
  "dataBoundary": "standalone_fleda_public_literature_candidate_evidence",
  "observations": [],
  "packageHash": "sha256:<64 lowercase hex characters>"
}
```

The package hash uses RFC 8785 JSON Canonicalization Scheme (JCS). The producer
removes only the top-level `packageHash` member, canonicalizes the remaining
package, encodes the canonical text as UTF-8 without a BOM, computes SHA-256,
and stores lowercase hexadecimal as `sha256:<64 hex characters>`. All numeric
fields must be finite IEEE-754 binary64 values and serialize using the RFC 8785
ECMAScript number rules. `NaN`, infinities, negative zero, and implementation-
specific decimal encodings are rejected. Exact source formatting is preserved
separately in fields such as `reportedValueText` and `reportedUnit`.

The `locatorFingerprint` is SHA-256/JCS over exactly:
`source.contentHash`, `locator.sourceKind`, `section`, `page`, `tableId`,
`figureId`, `panel`, `rowLabel`, `columnLabel`, `boundingBox`, and `axis`.
The `measurementFingerprint` is SHA-256/JCS over exactly:
`locatorFingerprint`, `biologicalContext.analyte`, `canonicalEntityId`, `matrix`,
`tissue`, `compartment`, `disease`, `subtype`, `spatialScope`,
`experimentalSetting`, `experiment.groupId`, `comparisonId`, `intervention`,
`dose`, `doseUnit`, `timepoint`, `timeUnit`, `timepointAnchor`,
`measurement.endpoint`, `reportedStatistic`, `value`, `reportedValueText`,
`reportedUnit`, `unitCode`, `valueQualifier`, and `censored`. Nullable members
remain present as JSON `null`; arrays retain source-significant order. Import is
idempotent by observation ID, source content hash, and these fingerprints. A
conflicting repeat is retained as a conflict and never silently overwrites the
earlier observation.

## 6. Server Interface

The public API remains limited to research-safe summaries:

- `GET /v1/evidence/catalog`
- `GET /v1/model/version`
- `POST /v1/simulations`
- `GET /health`

The quantitative import surface is private and administrative:

- `POST /v1/admin/evidence/observation-packages/validate`
- `POST /v1/admin/evidence/observation-packages/import`
- `GET /v1/admin/evidence/observations/{observationId}`
- `GET /v1/admin/evidence/extraction-jobs/{jobId}`

Administrative endpoints require Fleda server authentication, are not enabled
for GitHub Pages CORS, and are not exposed until the server project separately
approves and implements them. The public catalog may expose counts, PMID/DOI,
context summaries, uncertainty, review state, and model version. It must not
return raw documents, source images, full excerpts, prompts, embeddings,
private reviewer notes, formal parameters, database IDs, local paths, secrets,
or internal audit events.

## 7. Source and Copyright Policy

The first automated pilot uses Europe PMC open full text and other explicitly
licensed public sources. Source license and retrieval URL are mandatory.

User-provided or institutionally licensed PDFs are deferred until private
object storage, access control, retention, encrypted offsite backup, and restore
testing are approved. Such files never enter Git, GitHub Actions artifacts, or
the public API. The system does not bypass paywalls or redistribute source
content.

## 8. AMD Pilot

The first pilot processes one open-access AMD paper with a quantitative
complement endpoint. Selection requires:

- A stable PMID or PMCID and explicit reuse/access status.
- A quantitative table or figure with a precise source location.
- Reported tissue or matrix, assay, sample size, unit, and disease context.
- A result relevant to retina, RPE, choroid, drusen, aqueous/vitreous, or a
  clearly labeled systemic comparator.

The pilot produces a source record, at least one observation package, a
validation report, and a candidate-readiness report. It does not alter the
public simulator or private model parameters.

## 9. Validation and Failure Handling

Validation occurs in this order:

1. JSON Schema and type validation.
2. Stable identifier and content-hash checks.
3. Locator completeness and source-license checks.
4. Numeric parsing, finite-value, unit, time, and variability checks.
5. Biological and experimental context checks.
6. Local-versus-systemic compatibility checks.
7. Duplicate and conflict detection.
8. Independent AI review result.
9. Calibration eligibility decision.

Failed records remain inspectable with issue codes. They are not discarded,
promoted, normalized, or averaged into accepted records. Network and extraction
failures are retryable and cannot mark a source as completely processed.

### 9.1 Deterministic Calibration Eligibility

`calibrationEligible` is computed only by the deterministic validator after all
preceding checks. AI review can add issues, block eligibility, or downgrade a
record to knowledge-graph use, but AI review cannot set eligibility to `true`
and cannot waive a required field.

| Gate | Candidate-calibration requirement | `not_applicable` policy |
| --- | --- | --- |
| Source identity | At least one PMID, PMCID, or DOI; permitted source URL, access type, license, content hash, and retrieval time | Never allowed |
| Precise locator | Source kind plus a resolvable table/figure/section/page/row-column or bounded excerpt; figure values also require image hash and axis metadata | Never allowed |
| Biological context | Analyte, matrix or tissue, species, disease/reference context, `spatialScope`, and `experimentalSetting` must be explicit and non-`unknown` where they affect interpretation | `not_applicable` only for fields that genuinely do not exist, with a structured reason code |
| Experimental identity | Study design, experimental model, assay, `groupId`, non-`unknown` `groupRole`, sample size, `analysisSampleSize`, and relevant time context | Comparator, intervention, dose, route, and `comparisonId` may be `not_applicable` only for a non-comparative/non-interventional endpoint and must carry a reason code |
| Measurement | Endpoint, statistic, finite value, source-preserved value text and unit, canonical unit code, qualifier/censoring state, and applicable variability | Variability may be `none_reported` or `not_applicable`; neither is invented, and the eligibility rule may still reject it for an endpoint requiring uncertainty |
| Normalization | No conversion is required, or conversion status is `validated` with a reversible versioned rule | A blocked or review-needed conversion is never eligible |
| Rule validation | `ruleValidationResult` is `passed` with no blocking issue codes | Never allowed |
| Review | `reviewResult` is `supported` | `partially_supported`, `unsupported`, `conflicted`, and `not_reviewed` are not calibration eligible |
| Duplicate/conflict | No unresolved conflicting observation or fingerprint collision | Never allowed |

Fields accepted as not applicable remain JSON `null` and require a matching
`governance.notApplicableReasons` entry; literal string substitutions are not
used. `unknown`, missing, and `not_reported` are not aliases for not applicable.
Records failing any gate may remain available for traceable knowledge-graph
guidance, but cannot enter a candidate calibration set.

## 10. Testing

- JSON Schema accepts a complete synthetic AMD observation.
- Schema rejects missing source identity, invalid hashes, non-finite values,
  missing units, missing sample size, and invalid controlled vocabulary values.
- Deterministic eligibility tests distinguish knowledge-graph guidance from
  candidate calibration readiness.
- RFC 8785 package hashing and both fingerprints produce identical fixtures in
  JavaScript and Python and detect changed content.
- Import round-trip preserves every reported field and source locator.
- Duplicate import is idempotent; conflicting import is retained as a conflict.
- AMD compatibility tests prevent local ocular and systemic observations from
  being merged without an explicit comparison relationship.
- Context tests preserve independent `spatialScope` and `experimentalSetting`
  combinations, including local ex vivo retina and systemic clinical plasma.
- Group tests distinguish case/control, treated/untreated, and paired
  baseline/follow-up observations and reject unknown group roles for calibration.
- Censoring tests preserve approximate and detection-limited values without
  silently converting them to exact measurements.
- Eligibility-table tests prove AI can block or downgrade but cannot approve a
  record, and that unsupported, conflicted, partially supported, or unreviewed
  records remain ineligible.
- Public serialization tests prove protected fields cannot be returned.
- Existing JavaScript and Python suites remain passing.

## 11. Cross-Repository Handoff

The public repository first delivers:

1. JSON Schema for observation and package version `1.0.0`.
2. JavaScript and Python validators with matching fixtures.
3. One complete synthetic AMD fixture and invalid boundary fixtures.
4. Canonical hashing and package export.
5. A contract conformance report.

The server repository then mirrors the Pydantic types, private PostgreSQL
tables, and administrative validate/import endpoints. Before integration it
must update its recorded Pages baseline from `3801ee6` to the verified deployed
successor `45e90cb`, including the current app resource version and hashes.

## 12. Acceptance Criteria

- The same valid fixture passes JavaScript, Python, and future server Pydantic
  validation without field loss.
- JavaScript and Python generate identical RFC 8785 package, locator, and
  measurement hashes for every conformance fixture.
- Invalid or incomplete records cannot become calibration eligible.
- Every numeric value has traceable source location and immutable provenance.
- AMD local tissue evidence remains distinct from systemic evidence, and
  experimental setting remains independent from spatial scope.
- Group identity, comparison linkage, pairing, analysis sample size, and time
  anchor survive round-trip serialization.
- Approximate, censored, and detection-limited values retain their qualifiers,
  source display units, and canonical unit codes.
- Only deterministically valid records with `supported` review may become
  candidate-calibration eligible; AI alone can never approve one.
- Public serialization contains no raw source assets, protected parameters, or
  administrative metadata.
- Import and review never change the formal model.
- No GN connection, data, authentication, or infrastructure is introduced.
