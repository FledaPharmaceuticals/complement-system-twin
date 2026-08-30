"""RFC 8785 compatible hashes for quantitative observation exchange."""

from __future__ import annotations

from decimal import Decimal
import hashlib
import json
import math
from typing import Any


HASH_PREFIX = "sha256:"


def _assert_valid_unicode(value: str) -> None:
    if any(0xD800 <= ord(character) <= 0xDFFF for character in value):
        raise ValueError("JCS rejects lone Unicode surrogates")


def _serialize_number(value: int | float) -> str:
    number = float(value)
    if not math.isfinite(number):
        raise ValueError("JCS requires finite IEEE-754 numbers")
    if number == 0 and math.copysign(1.0, number) < 0:
        raise ValueError("JCS input must not contain negative zero")
    if isinstance(value, int) and int(number) != value:
        raise ValueError("integer is not losslessly representable as IEEE-754 binary64")
    if number == 0:
        return "0"

    rendered = repr(number).lower()
    magnitude = abs(number)
    if 1e-6 <= magnitude < 1e21:
        if "e" in rendered:
            rendered = format(Decimal(rendered), "f")
        if "." in rendered:
            rendered = rendered.rstrip("0").rstrip(".")
        return rendered

    if "e" not in rendered:
        rendered = format(number, ".15e")
    mantissa, exponent_text = rendered.split("e", 1)
    mantissa = mantissa.rstrip("0").rstrip(".")
    exponent = int(exponent_text)
    sign = "+" if exponent >= 0 else ""
    return f"{mantissa}e{sign}{exponent}"


def canonicalize_jcs(value: Any) -> str:
    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, str):
        _assert_valid_unicode(value)
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if isinstance(value, (int, float)):
        return _serialize_number(value)
    if isinstance(value, list):
        return "[" + ",".join(canonicalize_jcs(item) for item in value) + "]"
    if isinstance(value, dict):
        for key in value:
            if not isinstance(key, str):
                raise TypeError("JCS object keys must be strings")
            _assert_valid_unicode(key)
        keys = sorted(value, key=lambda key: key.encode("utf-16-be", "surrogatepass"))
        members = (
            f"{json.dumps(key, ensure_ascii=False)}:{canonicalize_jcs(value[key])}"
            for key in keys
        )
        return "{" + ",".join(members) + "}"
    raise TypeError(f"JCS cannot serialize {type(value).__name__}")


def sha256_jcs(value: Any) -> str:
    canonical = canonicalize_jcs(value).encode("utf-8")
    return HASH_PREFIX + hashlib.sha256(canonical).hexdigest()


def compute_package_hash(package_value: dict[str, Any]) -> str:
    hashable = {key: value for key, value in package_value.items() if key != "packageHash"}
    return sha256_jcs(hashable)


def _at(value: dict[str, Any], *path: str) -> Any:
    current: Any = value
    for key in path:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def build_locator_fingerprint_input(observation: dict[str, Any]) -> dict[str, Any]:
    return {
        "contentHash": _at(observation, "source", "contentHash"),
        "sourceKind": _at(observation, "locator", "sourceKind"),
        "section": _at(observation, "locator", "section"),
        "page": _at(observation, "locator", "page"),
        "tableId": _at(observation, "locator", "tableId"),
        "figureId": _at(observation, "locator", "figureId"),
        "panel": _at(observation, "locator", "panel"),
        "rowLabel": _at(observation, "locator", "rowLabel"),
        "columnLabel": _at(observation, "locator", "columnLabel"),
        "boundingBox": _at(observation, "locator", "boundingBox"),
        "axis": _at(observation, "locator", "axis"),
    }


def compute_locator_fingerprint(observation: dict[str, Any]) -> str:
    return sha256_jcs(build_locator_fingerprint_input(observation))


def build_measurement_fingerprint_input(observation: dict[str, Any]) -> dict[str, Any]:
    return {
        "locatorFingerprint": compute_locator_fingerprint(observation),
        "analyte": _at(observation, "biologicalContext", "analyte"),
        "canonicalEntityId": _at(observation, "biologicalContext", "canonicalEntityId"),
        "matrix": _at(observation, "biologicalContext", "matrix"),
        "tissue": _at(observation, "biologicalContext", "tissue"),
        "compartment": _at(observation, "biologicalContext", "compartment"),
        "disease": _at(observation, "biologicalContext", "disease"),
        "subtype": _at(observation, "biologicalContext", "subtype"),
        "spatialScope": _at(observation, "biologicalContext", "spatialScope"),
        "experimentalSetting": _at(observation, "biologicalContext", "experimentalSetting"),
        "groupId": _at(observation, "experiment", "groupId"),
        "comparisonId": _at(observation, "experiment", "comparisonId"),
        "intervention": _at(observation, "experiment", "intervention"),
        "dose": _at(observation, "experiment", "dose"),
        "doseUnit": _at(observation, "experiment", "doseUnit"),
        "timepoint": _at(observation, "experiment", "timepoint"),
        "timeUnit": _at(observation, "experiment", "timeUnit"),
        "timepointAnchor": _at(observation, "experiment", "timepointAnchor"),
        "endpoint": _at(observation, "measurement", "endpoint"),
        "reportedStatistic": _at(observation, "measurement", "reportedStatistic"),
        "value": _at(observation, "measurement", "value"),
        "reportedValueText": _at(observation, "measurement", "reportedValueText"),
        "reportedUnit": _at(observation, "measurement", "reportedUnit"),
        "unitCode": _at(observation, "measurement", "unitCode"),
        "valueQualifier": _at(observation, "measurement", "valueQualifier"),
        "censored": _at(observation, "measurement", "censored"),
    }


def compute_measurement_fingerprint(observation: dict[str, Any]) -> str:
    return sha256_jcs(build_measurement_fingerprint_input(observation))
