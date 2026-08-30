import copy
import json
from pathlib import Path

from literature_service.quantitative_observation_report import build_candidate_report


ROOT = Path(__file__).resolve().parents[1]


def fixture(name: str):
    return json.loads(
        (ROOT / "fixtures" / "quantitative-observations" / name).read_text(encoding="utf-8")
    )


def test_keeps_local_ex_vivo_and_systemic_clinical_amd_observations_separate():
    systemic = fixture("amd-systemic-clinical-valid.json")
    local = fixture("amd-local-ex-vivo-valid.json")

    report = build_candidate_report([systemic, local])

    assert report["observationCount"] == 2
    assert report["eligibleCount"] == 2
    assert report["knowledgeGraphOnlyCount"] == 0
    assert len(report["contextGroups"]) == 2
    assert sorted(group["spatialScope"] for group in report["contextGroups"]) == ["local_tissue", "systemic"]
    assert report["crossContextComparisons"] == []
    assert report["formalModelChanged"] is False


def test_reports_explicit_cross_context_comparison_without_merging_measurements():
    systemic = fixture("amd-systemic-clinical-valid.json")
    local = fixture("amd-local-ex-vivo-valid.json")
    local["experiment"]["comparisonId"] = systemic["experiment"]["comparisonId"]

    report = build_candidate_report([systemic, local])

    assert len(report["contextGroups"]) == 2
    assert report["crossContextComparisons"] == [{
        "comparisonId": "synthetic-amd-v-control",
        "observationIds": [systemic["observationId"], local["observationId"]],
    }]


def test_retains_conflicting_duplicate_identity_instead_of_overwriting():
    original = fixture("amd-systemic-clinical-valid.json")
    conflict = copy.deepcopy(original)
    conflict["measurement"]["value"] = 2.5
    conflict["measurement"]["reportedValueText"] = "2.5"

    report = build_candidate_report([original, conflict])

    assert report["observationCount"] == 2
    assert report["conflictCount"] == 1
    assert report["eligibleCount"] == 0
    assert report["knowledgeGraphOnlyCount"] == 2
