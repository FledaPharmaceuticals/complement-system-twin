"""Small UniProtKB adapter for public complement-protein annotations."""

from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
from typing import Any, Callable, Dict, List, Optional
from urllib.parse import urlencode
from urllib.request import Request, urlopen


UNIPROT_SEARCH_URL = "https://rest.uniprot.org/uniprotkb/search"
DEFAULT_USER_AGENT = "FledaComplementTwin/0.1 (public-protein-annotations)"
MODEL_VERSION = "complement-twin-v1.1-contract"


def _request_json(url: str, timeout: float = 10.0) -> Dict[str, Any]:
    request = Request(url, headers={"User-Agent": DEFAULT_USER_AGENT})
    with urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def _function_text(raw: Dict[str, Any]) -> str:
    values = []
    for comment in raw.get("comments") or []:
        if str(comment.get("commentType") or "").upper() != "FUNCTION":
            continue
        for text in comment.get("texts") or []:
            value = " ".join(str(text.get("value") or "").split())
            if value:
                values.append(value)
    return " ".join(values)


def _protein_name(raw: Dict[str, Any]) -> str:
    description = raw.get("proteinDescription") or {}
    recommended = description.get("recommendedName") or {}
    full_name = recommended.get("fullName") or {}
    return " ".join(str(full_name.get("value") or "").split())


def parse_uniprot_records(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Normalize explicit UniProtKB fields without biological inference."""
    records = []
    retrieved_at = datetime.now(timezone.utc).isoformat()
    for raw in payload.get("results") or []:
        if not isinstance(raw, dict):
            continue
        accession = str(raw.get("primaryAccession") or "").strip()
        if not accession:
            continue
        genes = [
            str(item.get("geneName", {}).get("value") or "").strip()
            for item in raw.get("genes") or []
            if item.get("geneName", {}).get("value")
        ]
        function = _function_text(raw)
        records.append({
            "id": f"uniprot:{accession}",
            "recordType": "fleda_public_protein_annotation",
            "sourceType": "database_annotation",
            "sourceLocator": f"https://www.uniprot.org/uniprotkb/{accession}/entry",
            "title": _protein_name(raw) or accession,
            "evidenceLevel": "curated" if raw.get("entryType") == "UniProtKB reviewed (Swiss-Prot)" else "annotation",
            "uncertainty": "unknown",
            "modelVersion": MODEL_VERSION,
            "metadata": {
                "accession": accession,
                "uniProtId": raw.get("uniProtkbId"),
                "geneNames": genes,
                "organism": (raw.get("organism") or {}).get("scientificName"),
                "function": function,
                "sourceProvider": "uniprotkb",
                "retrievedAt": retrieved_at,
                "normalizationMethod": "explicit_public_annotation_fields",
                "scientificInferencePerformed": False,
            },
            "boundary": {
                "publicSourceOnly": True,
                "formalModelChanged": False,
                "containsPatientData": False,
                "containsProductionData": False,
            },
        })
    return records


def search_uniprot(
    query: str,
    size: int = 10,
    fetch_json: Callable[[str], Dict[str, Any]] = _request_json,
    *,
    snapshot_sink: Optional[Callable[[Dict[str, Any]], None]] = None,
) -> List[Dict[str, Any]]:
    query = query.strip()
    if not query or len(query) > 240:
        raise ValueError("query must contain 1 to 240 characters")
    if not 1 <= size <= 20:
        raise ValueError("size must be between 1 and 20")
    locator = f"{UNIPROT_SEARCH_URL}?{urlencode({'query': query, 'format': 'json', 'size': size})}"
    payload = fetch_json(locator)
    if snapshot_sink:
        content = json.dumps(payload, sort_keys=True)
        snapshot_sink({
            "content_hash": hashlib.sha256(content.encode("utf-8")).hexdigest(),
            "source": "uniprotkb_search",
            "locator": locator,
            "query": query,
            "content_type": "application/json",
            "content": content,
        })
    return parse_uniprot_records(payload)
