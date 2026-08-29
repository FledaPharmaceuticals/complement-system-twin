# Conversational Experiment Workspace Design

**Status:** Approved direction, V2 implementation preparation

## Goal

Make the Complement System Digital Twin easier for research and teaching users by placing a conversational experiment entry first, showing only the essential simulation result by default, and moving advanced tools into deliberate expandable sections.

## Product Structure

### 1. Conversational experiment entry

The first interaction surface will contain:

- A free-text experiment description.
- Optional structured fields for disease context, complement focus, intervention, and time scale.
- An `Analyze & Prepare Simulation` action.
- A structured interpretation preview showing detected intent, assumptions, missing information, and uncertainty.
- A `Run prepared simulation` action that uses the existing rule-based engine only after the plan is visible.

The V2 first pass is local-session only. It must not add login, cloud persistence, patient data collection, production data collection, or a remote AI API dependency.

### 2. Simplified result view

After a prepared simulation runs, the default result view shows:

- One main concentration/activity dynamics chart.
- The organ/tissue impact visualization.
- A concise disease-specific interpretation.
- Model version, evidence basis, assumptions, and uncertainty boundary.

Normal baseline playback must remain a baseline animation and must not create acute reaction events. Disease-specific and intervention modes continue to use the existing simulation engine.

### 3. Advanced Research Tools

The following areas become collapsed by default and remain available without being removed:

- Biomarker-guided initialization.
- Drug comparison.
- Validation dataset intake.
- Literature intelligence.
- Knowledge graph.
- Advanced dynamics explorer.
- Disease and drug reference panels.
- Evidence and model history.

The section labels must communicate research purpose without implying clinical diagnosis or validated patient prediction.

## Conversational Analysis Contract

The local intent parser accepts free text and returns a deterministic, reviewable object:

```js
{
  diseaseContext: "AMD" | "PNH" | "aHUS" | "C3G" | "sepsis" | "normal" | "unknown",
  focus: string[],
  intervention: string[],
  timeScale: "baseline" | "acute_hours" | "chronic_months" | "unknown",
  requestedComparison: boolean,
  assumptions: string[],
  missingInformation: string[],
  confidence: "high" | "medium" | "low",
  safetyNotes: string[]
}
```

The parser is a transparent keyword/rule layer in V2. It may identify hypotheses, proxies, and associations, but it must not claim diagnosis or clinical certainty. Unknown or incomplete descriptions must produce a clarification state rather than silently selecting a disease.

## Safety and Data Boundaries

- Public use remains research and education only.
- No patient identifiers, clinical case details, or production data are accepted.
- No external AI service is called in the first conversational V2 increment.
- A future account layer may save experiment records only after explicit registration and authorization.
- Saved records must preserve the experiment text, parsed plan, model version, assumptions, evidence basis, and uncertainty.
- Candidate scientific changes remain outside this UI and cannot modify the formal model.

## Acceptance Criteria

1. The first viewport presents the experiment entry before advanced panels.
2. A complete description produces a visible prepared simulation plan before execution.
3. An incomplete description displays missing information and does not invent a disease context.
4. Running a prepared plan updates the existing chart and organ impact view.
5. Advanced tools are collapsed by default and remain usable when expanded.
6. The page continues to show version, evidence, uncertainty, and research-use boundaries.
7. No account, database, GN integration, patient data, or production data is introduced.
8. Existing Complement simulation and literature tests remain passing, apart from any pre-existing unrelated failures documented during verification.
