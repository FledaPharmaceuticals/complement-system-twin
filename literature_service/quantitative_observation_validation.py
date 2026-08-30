"""Deterministic eligibility gates for quantitative complement observations."""

from __future__ import annotations

import math
import re
from typing import Any


HASH_PATTERN = re.compile(r"^sha256:[0-9a-f]{64}$")
CONTROLLED_FIELDS = {
    "source.accessType": {"open_full_text", "open_abstract", "licensed_upload", "metadata_only"},
    "locator.sourceKind": {"text", "table", "figure", "supplement"},
    "biologicalContext.spatialScope": {"local_tissue", "systemic", "mixed", "unknown"},
    "biologicalContext.experimentalSetting": {"in_vivo", "ex_vivo", "in_vitro", "clinical", "unknown"},
    "experiment.groupRole": {"case", "healthy_control", "vehicle_control", "treated", "untreated", "reference", "other", "unknown"},
    "experiment.pairedDesign": {"paired", "unpaired", "mixed", "not_reported"},
    "experiment.baselineOrFollowup": {"baseline", "followup", "single_timepoint", "not_applicable"},
    "experiment.timepointAnchor": {"dose", "stimulation", "diagnosis", "enrollment", "collection", "baseline", "other", "unknown"},
    "measurement.valueQualifier": {"exact", "approximate", "less_than", "less_than_or_equal", "greater_than", "greater_than_or_equal", "not_reported"},
    "measurement.variabilityType": {"SD", "SEM", "CI", "IQR", "range", "none_reported", "not_applicable"},
    "measurement.axisScale": {"linear", "log10", "ln", "categorical"},
    "measurement.extractionOrigin": {"text", "table_cell", "author_data", "figure_digitization"},
    "provenance.reviewResult": {"supported", "partially_supported", "unsupported", "conflicted", "not_reviewed"},
    "provenance.ruleValidationResult": {"passed", "warning", "failed"},
    "governance.uncertainty": {"low", "moderate", "high", "unknown"},
}


def _has_text(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _push_issue(issues: list[dict[str, str]], code: str, field_path: str) -> None:
    if not any(issue["code"] == code for issue in issues):
        issues.append({"code": code, "fieldPath": field_path})


def _finite(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _has_precise_locator(locator: dict[str, Any]) -> bool:
    text_fields = ("section", "page", "tableId", "figureId", "rowLabel", "columnLabel", "supportingExcerpt")
    return any(_has_text(locator.get(field)) for field in text_fields) or locator.get("boundingBox") is not None


def _has_not_applicable_reason(observation: dict[str, Any], field_path: str) -> bool:
    reasons = observation.get("governance", {}).get("notApplicableReasons", [])
    return any(
        reason.get("fieldPath") == field_path
        and _has_text(reason.get("ruleId"))
        and _has_text(reason.get("reason"))
        for reason in reasons
    )


def _field_at(observation: dict[str, Any], field_path: str) -> Any:
    value: Any = observation
    for key in field_path.split("."):
        if not isinstance(value, dict):
            return None
        value = value.get(key)
    return value


def validate_quantitative_observation(observation: dict[str, Any]) -> dict[str, Any]:
    issues: list[dict[str, str]] = []
    source = observation.get("source", {})
    locator = observation.get("locator", {})
    biology = observation.get("biologicalContext", {})
    experiment = observation.get("experiment", {})
    measurement = observation.get("measurement", {})
    provenance = observation.get("provenance", {})
    governance = observation.get("governance", {})

    for field_path, allowed in CONTROLLED_FIELDS.items():
        if _field_at(observation, field_path) not in allowed:
            _push_issue(issues, "CONTROLLED_VOCABULARY_INVALID", field_path)

    if observation.get("schemaName") != "FledaQuantitativeObservation" or observation.get("schemaVersion") != "1.0.0":
        _push_issue(issues, "SCHEMA_IDENTITY_INVALID", "schemaName")
    if governance.get("formalModelChange") is not False:
        _push_issue(issues, "FORMAL_MODEL_CHANGE_FORBIDDEN", "governance.formalModelChange")

    stable_id = any(_has_text(source.get(field)) for field in ("pmid", "pmcid", "doi"))
    source_complete = (
        stable_id
        and _has_text(source.get("sourceUrl"))
        and bool(HASH_PATTERN.fullmatch(source.get("contentHash", "")))
        and _has_text(source.get("retrievedAt"))
        and _has_text(source.get("accessType"))
        and _has_text(source.get("license"))
        and source.get("license") != "unknown"
    )
    if not source_complete:
        _push_issue(issues, "SOURCE_IDENTITY_INCOMPLETE", "source")
    if source.get("accessType") in {"metadata_only", "open_abstract"}:
        _push_issue(issues, "FULL_QUANTITATIVE_SOURCE_REQUIRED", "source.accessType")

    if not _has_precise_locator(locator):
        _push_issue(issues, "PRECISE_LOCATOR_REQUIRED", "locator")
    if locator.get("sourceKind") == "figure" and (
        not locator.get("axis") or not HASH_PATTERN.fullmatch(provenance.get("sourceImageHash", ""))
    ):
        _push_issue(issues, "FIGURE_PROVENANCE_INCOMPLETE", "locator.axis")

    biology_complete = (
        _has_text(biology.get("analyte"))
        and _has_text(biology.get("species"))
        and _has_text(biology.get("disease"))
        and (_has_text(biology.get("matrix")) or _has_text(biology.get("tissue")))
        and biology.get("spatialScope") in {"local_tissue", "systemic", "mixed"}
        and biology.get("experimentalSetting") in {"in_vivo", "ex_vivo", "in_vitro", "clinical"}
    )
    if not biology_complete:
        _push_issue(issues, "BIOLOGICAL_CONTEXT_INCOMPLETE", "biologicalContext")

    experiment_complete = (
        _has_text(experiment.get("studyDesign")) and experiment.get("studyDesign") != "not reported"
        and _has_text(experiment.get("experimentalModel")) and experiment.get("experimentalModel") != "not reported"
        and _has_text(experiment.get("assay")) and experiment.get("assay") != "not reported"
        and isinstance(experiment.get("sampleSize"), int) and experiment["sampleSize"] > 0
        and isinstance(experiment.get("analysisSampleSize"), int) and experiment["analysisSampleSize"] > 0
        and _has_text(experiment.get("groupId"))
        and _has_text(experiment.get("groupLabel"))
        and experiment.get("groupRole") != "unknown"
        and _finite(experiment.get("timepoint"))
        and _has_text(experiment.get("timeUnit"))
        and experiment.get("timepointAnchor") != "unknown"
    )
    if not experiment_complete:
        _push_issue(issues, "EXPERIMENT_CONTEXT_INCOMPLETE", "experiment")

    for field in ("intervention", "dose", "route"):
        if experiment.get(field) is None and not _has_not_applicable_reason(observation, f"experiment.{field}"):
            _push_issue(issues, "NOT_APPLICABLE_REASON_REQUIRED", f"experiment.{field}")

    value = measurement.get("value")
    measurement_complete = (
        _has_text(measurement.get("endpoint"))
        and _has_text(measurement.get("reportedStatistic"))
        and measurement.get("reportedStatistic") != "not reported"
        and _finite(value)
        and not (value == 0 and math.copysign(1.0, value) < 0)
        and _has_text(measurement.get("reportedValueText"))
        and _has_text(measurement.get("reportedUnit")) and measurement.get("reportedUnit") != "unknown"
        and _has_text(measurement.get("unitCode")) and measurement.get("unitCode") != "unknown"
        and measurement.get("valueQualifier") != "not_reported"
    )
    if not measurement_complete:
        _push_issue(issues, "MEASUREMENT_INCOMPLETE", "measurement")
    if measurement.get("censored") is True and not _finite(measurement.get("detectionLimit")):
        _push_issue(issues, "CENSORING_METADATA_INCOMPLETE", "measurement.detectionLimit")

    normalization = observation.get("normalization")
    if normalization and normalization.get("conversionStatus") not in {"not_required", "validated"}:
        _push_issue(issues, "NORMALIZATION_NOT_VALIDATED", "normalization.conversionStatus")
    if provenance.get("ruleValidationResult") != "passed":
        _push_issue(issues, "RULE_VALIDATION_NOT_PASSED", "provenance.ruleValidationResult")
    if provenance.get("reviewResult") != "supported":
        _push_issue(issues, "REVIEW_NOT_SUPPORTED", "provenance.reviewResult")
    if governance.get("workflowState") == "conflicted" or provenance.get("reviewResult") == "conflicted":
        _push_issue(issues, "UNRESOLVED_CONFLICT", "governance.workflowState")

    reason_codes = [issue["code"] for issue in issues]
    return {
        "valid": not issues,
        "issues": issues,
        "calibrationEligible": not issues,
        "eligibilityReasons": ["ALL_DETERMINISTIC_GATES_PASSED"] if not issues else reason_codes,
    }
