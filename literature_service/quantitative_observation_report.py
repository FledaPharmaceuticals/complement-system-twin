"""Candidate-readiness summaries that never promote formal model parameters."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from .quantitative_observation_hash import compute_measurement_fingerprint
from .quantitative_observation_validation import validate_quantitative_observation


def _context_key(observation: dict[str, Any]) -> tuple[Any, ...]:
    context = observation.get("biologicalContext", {})
    return (
        context.get("spatialScope", "unknown"),
        context.get("experimentalSetting", "unknown"),
        context.get("matrix") or "no-matrix",
        context.get("tissue") or "no-tissue",
    )


def build_candidate_report(observations: list[dict[str, Any]]) -> dict[str, Any]:
    entries = [
        {
            "observation": observation,
            "validation": validate_quantitative_observation(observation),
            "fingerprint": compute_measurement_fingerprint(observation),
            "contextKey": _context_key(observation),
        }
        for observation in observations
    ]

    identities: dict[str, set[str]] = defaultdict(set)
    for entry in entries:
        identities[entry["observation"]["observationId"]].add(entry["fingerprint"])
    conflicting_ids = {identity for identity, fingerprints in identities.items() if len(fingerprints) > 1}

    groups: dict[tuple[Any, ...], dict[str, Any]] = {}
    for entry in entries:
        key = entry["contextKey"]
        context = entry["observation"].get("biologicalContext", {})
        if key not in groups:
            groups[key] = {
                "spatialScope": context.get("spatialScope", "unknown"),
                "experimentalSetting": context.get("experimentalSetting", "unknown"),
                "matrix": context.get("matrix"),
                "tissue": context.get("tissue"),
                "observationIds": [],
            }
        groups[key]["observationIds"].append(entry["observation"]["observationId"])

    comparisons: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for entry in entries:
        comparison_id = entry["observation"].get("experiment", {}).get("comparisonId")
        if comparison_id:
            comparisons[comparison_id].append(entry)
    cross_context_comparisons = [
        {
            "comparisonId": comparison_id,
            "observationIds": [entry["observation"]["observationId"] for entry in compared],
        }
        for comparison_id, compared in comparisons.items()
        if len(compared) > 1 and len({entry["contextKey"] for entry in compared}) > 1
    ]

    eligible_count = sum(
        entry["validation"]["calibrationEligible"]
        and entry["observation"]["observationId"] not in conflicting_ids
        for entry in entries
    )
    return {
        "observationCount": len(entries),
        "eligibleCount": eligible_count,
        "knowledgeGraphOnlyCount": len(entries) - eligible_count,
        "conflictCount": len(conflicting_ids),
        "contextGroups": list(groups.values()),
        "crossContextComparisons": cross_context_comparisons,
        "formalModelChanged": False,
    }
