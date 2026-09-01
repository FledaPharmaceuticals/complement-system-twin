# Two-Paper Training Record Handoff

Verification date: 2026-08-31  
C3 branch: `codex/c3-training-record-card`  
Verified implementation commit: `064d0f5d157e94481064972806c432a8ff4e06bd`  
Server implementation commit: `d323816cd1f421fa173352546c4078fcf3246ae0`

## Public Record Boundary

- Schema: `FledaPublicTrainingRecord 1.0.0`
- Candidate: `amd-cp40-two-paper-test-v0`
- Record ID: `sha256:88c547f9d3d014b87a1a7d3d3a5aef21f3107d0b971916c87629510edbb195bf`
- Static snapshot SHA-256: `51e1d8509453f88613c7ac48b25458c55c2b487a9a3e6f09f2787a17e7da4c11`
- Training date: `2026-08-31`
- Method: evidence-constrained candidate fitting, not machine learning.
- Conclusion: `rejected`; uncertainty `high`; formal model change `false`.
- Observation counts: 13 train, 49 holdout, 8 context-only.

The card exposes only the reviewed static summary: publication titles and DOI links, method, parameter categories without values, tested capabilities, observation counts, applicability, uncertainty, conclusion, and research warnings. Recursive exact-allowlist validation rejects fitted values, bounds, equations, coefficients, source coordinates or paths, raw evidence payloads, private dataset content, database IDs, prompts, and AI or human review records at any nesting depth.

The candidate is not active. The public teaching model and its JavaScript fallback are unchanged. No new API request or route was added for this card.

## Automated Verification

Command:

```text
/Users/johnmacpro/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/*.test.js
```

Result: `238 passed, 0 failed, 0 skipped, 0 todo`.

The server suite initially reported `401 passed, 1 skipped` because `node` was absent from that command's PATH. Mainline added the bundled Node directory to `PATH` and reran the exact skipped test, `tests/test_public_simulation_result.py::test_server_hash_matches_vendored_c3_jcs_and_sha_behavior`; it reported `1 passed`. There is no unexplained or unresolved skip.

The frozen public model file remains unchanged:

```text
5ffc2e1ac322e28e68becab0b06078104b4694a914357b7d2886fbf4db7c0fc5  src/simulation.js
```

The static C3 snapshot is byte-identical to the server public record. Tests cover the exact recursive allowlist, forbidden-field rejection, JCS record ID, immutable data, publication identity, card location, default-collapsed state, rejected conclusion, high uncertainty, research warning, and absence of numeric parameter disclosure.

## Browser Evidence

Local browser checks ran against `http://127.0.0.1:8791/` at 1440x900 and 390x844.

- The card appears immediately after Conversational Experiment Workspace and before Advanced Research Tools.
- It is collapsed on load and opens to the reviewed training date, two publications, method, candidate-only parameter categories, tested-not-qualified capabilities, counts, rejected conclusion, and high-uncertainty warning.
- Desktop and mobile checks found no horizontal scrolling, overflowing descendants, card overlap, or overlap with Advanced Research Tools.
- AMD experiment preparation and execution, simulation playback, heart rate, blood pressure, respiratory rate, Advanced Research Tools, and the JavaScript fallback remained usable.
- The visible result source was `Public teaching model - JavaScript`. Local HTTP logs showed static asset requests only and no `/v1` request.
- Browser automation could focus and pointer-toggle the native `<summary>`, but synthetic Enter/Space injection did not produce an observable toggle. This non-blocking tool limitation is recorded; native `<details>/<summary>` semantics remain intact. Mainline visually inspected the desktop and mobile screenshots and confirmed that the layout is clear with no evident overlap.

Screenshots are outside Git in `/private/tmp/fleda-training-record-browser-checks/`:

- `desktop-1440x900-card-expanded.png`
- `desktop-1440x900-collapsed.png`
- `desktop-1440x900-expanded.png`
- `mobile-390x844-card-expanded.png`
- `mobile-390x844-collapsed.png`
- `mobile-390x844-expanded.png`

## Release Hold

At verification time this branch was unmerged and undeployed. The handoff itself
performed no push, GitHub Pages deployment, API change, database or worker change,
DNS action, persistent-data change, or model activation. A later merge and Pages
deployment require separate approval and must preserve every boundary above.
