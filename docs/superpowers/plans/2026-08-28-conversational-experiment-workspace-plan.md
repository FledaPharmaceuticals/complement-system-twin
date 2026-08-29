# Conversational Experiment Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local, transparent conversational experiment workflow and simplify the Complement System Digital Twin page into an essential result view with collapsed advanced research tools.

**Architecture:** Add a pure intent parser module that converts user text and optional structured choices into a reviewable simulation plan. Add a compact workspace shell in the existing static page, connect confirmed plans to the current simulation controls, and wrap existing research sections in collapsed details containers without removing their functionality.

**Tech Stack:** Vanilla JavaScript ES modules, static HTML/CSS, Plotly, Node test runner, existing rule-based Complement simulation engine.

**Spec:** `docs/superpowers/specs/2026-08-28-conversational-experiment-workspace-design.md`

## Global Constraints

- Keep Fleda independent; do not add GN auth, GN DB, GN API, customer data, or production data.
- Do not add accounts, cloud persistence, or external AI API calls in this increment.
- Preserve research and education use language, proxy/association wording, model version, evidence, and uncertainty.
- Preserve the existing simulation engine and disease-specific AMD mapping.
- Normal baseline playback must remain baseline-only and must not create acute reaction events.
- Do not add pandas or a new frontend framework.

### Task 1: Add the transparent intent parser

**Files:**
- Create: `src/experimentIntent.js`
- Test: `tests/experimentIntent.test.js`

**Interfaces:**
- Produces `parseExperimentIntent(text, options)`, returning the exact contract in the design spec.
- Consumes only user-provided text and optional values; it must not call a network service.

- [x] **Step 1: Write tests for complete AMD, incomplete, and normal baseline descriptions.**
- [x] **Step 2: Run `node --test tests/experimentIntent.test.js` and confirm the new tests fail.**
- [x] **Step 3: Implement deterministic disease, focus, intervention, time-scale, confidence, assumption, and safety extraction.**
- [x] **Step 4: Run the focused test and confirm it passes.**
- [ ] **Step 5: Commit with `git add src/experimentIntent.js tests/experimentIntent.test.js && git commit -m "Add transparent experiment intent parser"`.**

### Task 2: Add the experiment workspace UI

**Files:**
- Modify: `index.html`
- Modify: `src/styles.css`
- Modify: `src/app.js`
- Test: `tests/experimentWorkspace.test.js`

**Interfaces:**
- Consumes `parseExperimentIntent` from Task 1.
- Produces a visible `Experiment Workspace` with `experiment-description`, `analyze-experiment`, `experiment-plan`, and `run-prepared-simulation` elements.

- [x] **Step 1: Add markup for the description, optional selectors, analysis state, and prepared-plan confirmation.**
- [x] **Step 2: Add responsive styles that keep the entry compact and above the advanced tools.**
- [x] **Step 3: Add event handlers that show detected intent, assumptions, missing information, confidence, and safety notes.**
- [x] **Step 4: Connect only confirmed plans to the existing disease/intervention controls and dynamics renderer.**
- [x] **Step 5: Add tests for required labels, research boundary copy, and no remote AI endpoint.**
- [x] **Step 6: Run the focused tests and fix any markup or state failures.**
- [ ] **Step 7: Commit with `git add index.html src/styles.css src/app.js tests/experimentWorkspace.test.js && git commit -m "Add conversational experiment workspace"`.**

### Task 3: Simplify the page with collapsed advanced tools

**Files:**
- Modify: `index.html`
- Modify: `src/styles.css`
- Modify: `tests/experimentWorkspace.test.js`

**Interfaces:**
- Keeps all existing IDs used by `src/app.js` intact.
- Produces collapsed-by-default groups for Biomarker Initialization, Drug Comparison, Validation, Literature Intelligence, Knowledge Graph, Advanced Dynamics, and reference panels.

- [x] **Step 1: Add a single `Advanced Research Tools` details wrapper and nested labeled details groups around existing panels.**
- [x] **Step 2: Ensure the main dynamics chart, organ impact view, and interpretation remain outside the collapsed wrapper.**
- [x] **Step 3: Add tests that verify advanced groups are collapsed by default and existing IDs remain present.**
- [x] **Step 4: Run focused and full JavaScript tests.**
- [ ] **Step 5: Commit with `git add index.html src/styles.css tests/experimentWorkspace.test.js && git commit -m "Collapse advanced Complement research tools"`.**

### Task 4: Verify and publish the V2 workspace shell

**Files:**
- Modify: `README.md`
- Modify: `docs/product/FLEDA_DIGITAL_TWIN_RESEARCH_PLATFORM_GUIDE.md`

- [x] **Step 1: Document the local conversational workflow and future account boundary.**
- [x] **Step 2: Run `node --test tests/*.test.js`, `git diff --check`, and the available Python checks.**
- [x] **Step 3: Start the static site and verify the complete flow: describe experiment, analyze, review plan, run simulation, expand advanced tools.**
- [x] **Step 4: Review for missing safety boundary, accidental GN reference, or sensitive-data input.**
- [ ] **Step 5: Commit the documentation and verification changes.**
- [ ] **Step 6: Push through the existing Fleda GitHub credentials and verify the public Complement Pages deployment.**
