"""Public Reactome pathway annotations for the standalone Fleda knowledge layer."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Optional
from urllib.parse import quote
from urllib.request import Request, urlopen


REACTOME_QUERY_URL = "https://reactome.org/ContentService/data/query"


def _request_json(url: str) -> Dict[str, Any]:
    request = Request(url, headers={"Accept": "application/json", "User-Agent": "FledaComplementTwin/0.1 (public-reactome)"})
    with urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def parse_reactome_entry(payload: Dict[str, Any]) -> Dict[str, Any]:
    stable_id = str(payload.get("stId") or payload.get("dbId") or "unknown")
    source_locator = f"https://reactome.org/content/detail/{quote(stable_id)}"
    events = payload.get("hasEvent") or payload.get("hasComponent") or []
    references = payload.get("literatureReference") or []
    return {
        "id": f"reactome:{stable_id}",
        "recordType": "fleda_public_pathway_annotation",
        "sourceType": "database_annotation",
        "sourceLocator": source_locator,
        "title": payload.get("displayName") or stable_id,
        "evidenceLevel": "curated" if payload.get("isInferred") is not True else "inferred",
        "uncertainty": "unknown",
        "metadata": {
            "stableId": stable_id,
            "species": payload.get("speciesName"),
            "schemaClass": payload.get("schemaClass"),
            "isInDisease": bool(payload.get("isInDisease", False)),
            "participantOrEventCount": len(events),
            "literatureReferenceCount": len(references),
            "sourceProvider": "reactome",
            "retrievedAt": datetime.now(timezone.utc).isoformat(),
            "normalizationMethod": "stable_id_and_public_pathway_metadata",
            "scientificInferencePerformed": False,
        },
        "dataBoundary": {
            "publicSourceOnly": True,
            "containsPatientData": False,
            "containsProductionData": False,
            "formalModelChanged": False,
        },
    }


def fetch_reactome_entry(
    stable_id: str,
    fetch_json: Callable[[str], Dict[str, Any]] = _request_json,
    snapshot_sink: Optional[Callable[[str, str, str, str], None]] = None,
) -> Dict[str, Any]:
    normalized_id = stable_id.strip()
    if not normalized_id:
        raise ValueError("Reactome stable ID is required")
    url = f"{REACTOME_QUERY_URL}/{quote(normalized_id)}"
    payload = fetch_json(url)
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    if snapshot_sink:
        snapshot_sink("reactome", normalized_id, raw, hashlib.sha256(raw.encode("utf-8")).hexdigest())
    return parse_reactome_entry(payload)
