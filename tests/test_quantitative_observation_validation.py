import copy
import json
from pathlib import Path

from literature_service.quantitative_observation_validation import (
    validate_quantitative_observation,
)


ROOT = Path(__file__).resolve().parents[1]


def fixture(name: str):
    return json.loads(
        (ROOT / "fixtures" / "quantitative-observations" / name).read_text(encoding="utf-8")
    )


def test_qualifies_complete_supported_amd_observation_through_deterministic_gates():
    result = validate_quantitative_observation(fixture("amd-systemic-clinical-valid.json"))

    assert result == {
        "valid": True,
        "issues": [],
        "calibrationEligible": True,
        "eligibilityReasons": ["ALL_DETERMINISTIC_GATES_PASSED"],
    }


def test_keeps_context_limited_evidence_available_but_ineligible():
    result = validate_quantitative_observation(fixture("amd-invalid-missing-context.json"))

    assert result["valid"] is False
    assert result["calibrationEligible"] is False
    assert "PRECISE_LOCATOR_REQUIRED" in result["eligibilityReasons"]
    assert "BIOLOGICAL_CONTEXT_INCOMPLETE" in result["eligibilityReasons"]
    assert "REVIEW_NOT_SUPPORTED" in result["eligibilityReasons"]


def test_ai_support_cannot_waive_missing_deterministic_context():
    observation = fixture("amd-invalid-missing-context.json")
    observation["provenance"]["reviewResult"] = "supported"
    observation["provenance"]["ruleValidationResult"] = "passed"

    result = validate_quantitative_observation(observation)

    assert result["calibrationEligible"] is False
    assert "BIOLOGICAL_CONTEXT_INCOMPLETE" in result["eligibilityReasons"]


def test_blocks_unsupported_review_unresolved_conversion_and_conflicts():
    observation = fixture("amd-systemic-clinical-valid.json")
    observation["provenance"]["reviewResult"] = "partially_supported"
    observation["normalization"]["conversionStatus"] = "needs_review"
    observation["governance"]["workflowState"] = "conflicted"

    result = validate_quantitative_observation(observation)

    assert result["calibrationEligible"] is False
    assert "REVIEW_NOT_SUPPORTED" in result["eligibilityReasons"]
    assert "NORMALIZATION_NOT_VALIDATED" in result["eligibilityReasons"]
    assert "UNRESOLVED_CONFLICT" in result["eligibilityReasons"]


def test_requires_figure_source_hash_and_axis_metadata():
    observation = copy.deepcopy(fixture("amd-local-ex-vivo-valid.json"))
    observation["provenance"]["sourceImageHash"] = None
    observation["locator"]["axis"] = None

    result = validate_quantitative_observation(observation)

    assert result["calibrationEligible"] is False
    assert "FIGURE_PROVENANCE_INCOMPLETE" in result["eligibilityReasons"]


def test_rejects_values_outside_contract_controlled_vocabularies():
    observation = fixture("amd-systemic-clinical-valid.json")
    observation["experiment"]["groupRole"] = "experimental-case"
    observation["measurement"]["valueQualifier"] = "estimated-ish"

    result = validate_quantitative_observation(observation)

    assert result["calibrationEligible"] is False
    assert "CONTROLLED_VOCABULARY_INVALID" in result["eligibilityReasons"]
