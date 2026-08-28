"""Small Europe PMC adapter for public publication metadata and abstracts."""

from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import hashlib
import json
from datetime import datetime, timezone


EUROPE_PMC_URL = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"
DEFAULT_USER_AGENT = "FledaComplementTwin/0.1 (public-literature)"
MODEL_VERSION = "complement-twin-v1.1-contract"


def _request_json(url: str, timeout: float = 10.0) -> Dict[str, Any]:
    request = Request(url, headers={"User-Agent": DEFAULT_USER_AGENT})
    with urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def _doi(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    value = value.strip()
    return value[4:].strip() if value.lower().startswith("doi:") else value or None


def _evidence_level(publication_types: Any) -> str:
    values = publication_types if isinstance(publication_types, list) else [publication_types]
    return "curated" if any("review" in str(item).lower() for item in values) else "mechanistic"


def _locator(raw: Dict[str, Any]) -> str:
    pmid = str(raw.get("pmid") or "").strip()
    if pmid:
        return f"https://europepmc.org/article/MED/{pmid}"
    source = str(raw.get("source") or "EXT").strip()
    identifier = str(raw.get("id") or "").strip()
    return f"https://europepmc.org/article/{source}/{identifier}"


def parse_europe_pmc_record(raw: Dict[str, Any], *, include_abstract: bool = False) -> Optional[Dict[str, Any]]:
    if not isinstance(raw, dict):
        return None
    identifier = str(raw.get("pmid") or raw.get("id") or "").strip()
    title = " ".join(str(raw.get("title") or "").split())
    if not identifier or not title:
        return None
    abstract = " ".join(str(raw.get("abstractText") or "").split()) if include_abstract else ""
    publication_types = raw.get("pubTypeList") or raw.get("pubType") or []
    if isinstance(publication_types, str):
        publication_types = [publication_types]
    return {
        "id": f"pmid:{identifier}" if raw.get("pmid") else f"europepmc:{identifier}",
        "sourceType": "publication",
        "sourceLocator": _locator(raw),
        "title": title,
        "extractedClaim": (
            "Abstract available for local rule-based term linking."
            if abstract
            else "Abstract not provided; metadata-only record."
        ),
        "evidenceLevel": _evidence_level(publication_types),
        "uncertainty": "unknown",
        "linkedEntities": [],
        "parameterPriors": {},
        "extractionMethod": (
            "public_database_metadata_and_abstract"
            if abstract
            else "public_database_metadata"
        ),
        "modelVersion": MODEL_VERSION,
        "metadata": {
            "pmid": str(raw.get("pmid") or "") or None,
            "sourceProvider": "europe_pmc",
            "retrievedAt": datetime.now(timezone.utc).isoformat(),
            "pmcid": str(raw.get("pmcid") or "") or None,
            "doi": _doi(raw.get("doi")),
            "journal": raw.get("journalTitle"),
            "publicationDate": raw.get("firstPublicationDate") or raw.get("pubYear"),
            "publicationTypes": [str(item) for item in publication_types],
            "abstract": abstract,
            "abstractAvailable": bool(abstract),
        },
    }


def _snapshot(query: str, locator: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    content = json.dumps(payload, sort_keys=True)
    return {
        "content_hash": hashlib.sha256(content.encode("utf-8")).hexdigest(),
        "source": "europe_pmc_search",
        "locator": locator,
        "query": query,
        "content_type": "application/json",
        "content": content,
    }


def search_europe_pmc(
    query: str,
    retmax: int = 10,
    fetch_json: Callable[[str], Dict[str, Any]] = _request_json,
    *,
    include_abstract: bool = False,
    snapshot_sink: Optional[Callable[[Dict[str, Any]], None]] = None,
) -> List[Dict[str, Any]]:
    query = query.strip()
    if not query or len(query) > 240:
        raise ValueError("query must contain 1 to 240 characters")
    if not 1 <= retmax <= 20:
        raise ValueError("retmax must be between 1 and 20")
    locator = f"{EUROPE_PMC_URL}?{urlencode({'query': query, 'format': 'json', 'pageSize': retmax, 'resultType': 'core' if include_abstract else 'lite'})}"
    payload = fetch_json(locator)
    if snapshot_sink:
        snapshot_sink(_snapshot(query, locator, payload))
    results = payload.get("resultList", {}).get("result", [])
    return [
        record
        for record in (
            parse_europe_pmc_record(raw, include_abstract=include_abstract)
            for raw in results
        )
        if record is not None
    ]
