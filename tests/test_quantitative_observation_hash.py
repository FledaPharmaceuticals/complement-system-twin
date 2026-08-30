import copy
import json
from pathlib import Path

import pytest

from literature_service.quantitative_observation_hash import (
    canonicalize_jcs,
    compute_locator_fingerprint,
    compute_measurement_fingerprint,
    compute_package_hash,
    sha256_jcs,
)


ROOT = Path(__file__).resolve().parents[1]


def read_json(path: str):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def test_canonicalizes_shared_rfc8785_vectors_and_hashes_utf8_bytes():
    vectors = read_json("fixtures/quantitative-observations/hash-vectors.json")

    for vector in vectors["canonicalization"]:
        assert canonicalize_jcs(vector["value"]) == vector["canonical"], vector["name"]
        if "sha256" in vector:
            assert sha256_jcs(vector["value"]) == vector["sha256"]


def test_rejects_non_finite_and_negative_zero_numeric_inputs():
    with pytest.raises(ValueError, match="finite IEEE-754"):
        canonicalize_jcs(float("nan"))
    with pytest.raises(ValueError, match="finite IEEE-754"):
        canonicalize_jcs(float("inf"))
    with pytest.raises(ValueError, match="negative zero"):
        canonicalize_jcs(-0.0)


def test_package_hash_excludes_only_top_level_package_hash():
    package = {
        "packageType": "FledaQuantitativeObservationPackage",
        "packageVersion": "1.0.0",
        "createdAt": "2026-08-30T00:00:00Z",
        "producer": {"name": "fixture", "version": "1"},
        "dataBoundary": "standalone_fleda_public_literature_candidate_evidence",
        "observations": [],
        "packageHash": "sha256:old",
    }

    first = compute_package_hash(package)
    package["packageHash"] = "sha256:different"
    second = compute_package_hash(package)
    package["producer"]["version"] = "2"
    changed = compute_package_hash(package)

    assert first == second
    assert first != changed


def test_locator_and_measurement_fingerprints_are_stable_and_content_sensitive():
    vectors = read_json("fixtures/quantitative-observations/hash-vectors.json")
    observation = read_json("fixtures/quantitative-observations/amd-systemic-clinical-valid.json")
    locator = compute_locator_fingerprint(observation)
    measurement = compute_measurement_fingerprint(observation)

    assert locator.startswith("sha256:") and len(locator) == 71
    assert locator == vectors["amdSystemicFixture"]["locatorFingerprint"]
    assert measurement == vectors["amdSystemicFixture"]["measurementFingerprint"]
    assert measurement == compute_measurement_fingerprint(copy.deepcopy(observation))

    observation["measurement"]["value"] = 1.26
    assert compute_measurement_fingerprint(observation) != measurement
