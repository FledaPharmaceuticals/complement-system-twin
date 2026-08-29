"""Small PubMed adapter with optional public-abstract retrieval."""

from __future__ import annotations

from typing import Any, Callable, Dict, Iterable, List, Optional
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import json
import xml.etree.ElementTree as ET
import hashlib
from datetime import datetime, timezone


PUBMED_BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
DEFAULT_USER_AGENT = "FledaComplementTwin/0.1 (public-literature-metadata)"
MODEL_VERSION = "complement-twin-v1.1-contract"


def _doi(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    cleaned = value.strip()
    if cleaned.lower().startswith("doi:"):
        cleaned = cleaned[4:].strip()
    return cleaned or None


def parse_pubmed_summary(
    pmid: str,
    raw: Dict[str, Any],
    abstract_text: str = "",
) -> Dict[str, Any]:
    """Convert an ESummary record into the shared evidence shape."""
    title = str(raw.get("title", "")).strip()
    if not pmid or not title:
        raise ValueError("PubMed records require a PMID and title")
    publication_types = raw.get("pubtype") or []
    if isinstance(publication_types, str):
        publication_types = [publication_types]
    publication_types = [str(item) for item in publication_types]
    abstract_text = " ".join(str(abstract_text or "").split())
    metadata = {
        "pmid": str(pmid),
        "sourceProvider": "pubmed",
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "doi": _doi(raw.get("elocationid")),
        "journal": raw.get("fulljournalname") or raw.get("source"),
        "publicationDate": raw.get("pubdate"),
        "publicationTypes": publication_types,
        "abstract": abstract_text,
        "abstractAvailable": bool(abstract_text),
    }
    return {
        "id": f"pmid:{pmid}",
        "sourceType": "publication",
        "sourceLocator": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
        "title": title,
        "extractedClaim": (
            "Abstract available for local rule-based term linking."
            if abstract_text
            else "Abstract not provided; metadata-only record."
        ),
        "evidenceLevel": "curated" if any("review" in item.lower() for item in publication_types) else "mechanistic",
        "uncertainty": "unknown",
        "linkedEntities": [],
        "parameterPriors": {},
        "extractionMethod": "public_database_metadata",
        "modelVersion": MODEL_VERSION,
        "metadata": metadata,
    }


def normalize_pubmed_records(records: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    normalized = []
    for raw in records:
        if not isinstance(raw, dict):
            continue
        pmid = str(raw.get("uid") or raw.get("pmid") or "").strip()
        title = str(raw.get("title") or "").strip()
        if not pmid or not title:
            continue
        normalized.append(parse_pubmed_summary(pmid, raw))
    return normalized


def _request_json(url: str, timeout: float = 10.0) -> Dict[str, Any]:
    request = Request(url, headers={"User-Agent": DEFAULT_USER_AGENT})
    with urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def _request_text(url: str, timeout: float = 10.0) -> str:
    request = Request(url, headers={"User-Agent": DEFAULT_USER_AGENT})
    with urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8")


def parse_pubmed_abstract_xml(xml_text: str) -> Dict[str, str]:
    """Extract only PMID-to-abstract text from public EFetch XML."""
    if not isinstance(xml_text, str) or not xml_text.strip():
        return {}
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return {}

    abstracts: Dict[str, str] = {}
    for article in root.findall(".//PubmedArticle"):
        pmid_element = article.find(".//PMID")
        pmid = (pmid_element.text or "").strip() if pmid_element is not None else ""
        if not pmid:
            continue
        parts = []
        for abstract_part in article.findall(".//Abstract/AbstractText"):
            text = " ".join("".join(abstract_part.itertext()).split())
            if not text:
                continue
            label = (abstract_part.attrib.get("Label") or "").strip()
            parts.append(f"{label}: {text}" if label else text)
        if parts:
            abstracts[pmid] = " ".join(parts)
    return abstracts


def search_pubmed(
    query: str,
    retmax: int = 10,
    fetch_json: Callable[[str], Dict[str, Any]] = _request_json,
    *,
    include_abstract: bool = False,
    fetch_text: Callable[[str], str] = _request_text,
    snapshot_sink: Optional[Callable[[Dict[str, Any]], None]] = None,
) -> List[Dict[str, Any]]:
    """Search public PubMed summaries, optionally adding public abstracts."""
    query = query.strip()
    if not query or len(query) > 240:
        raise ValueError("query must contain 1 to 240 characters")
    if not 1 <= retmax <= 20:
        raise ValueError("retmax must be between 1 and 20")

    search_url = f"{PUBMED_BASE_URL}/esearch.fcgi?{urlencode({'db': 'pubmed', 'term': query, 'retmode': 'json', 'retmax': retmax, 'sort': 'pub date'})}"
    search_payload = fetch_json(search_url)
    if snapshot_sink:
        snapshot_sink(_snapshot("pubmed_esearch", search_url, query, "application/json", search_payload))
    ids = search_payload.get("esearchresult", {}).get("idlist", [])
    if not ids:
        return []

    summary_url = f"{PUBMED_BASE_URL}/esummary.fcgi?{urlencode({'db': 'pubmed', 'id': ','.join(ids), 'retmode': 'json'})}"
    summary_payload = fetch_json(summary_url)
    if snapshot_sink:
        snapshot_sink(_snapshot("pubmed_esummary", summary_url, query, "application/json", summary_payload))
    result = summary_payload.get("result", {})
    abstract_by_pmid: Dict[str, str] = {}
    if include_abstract:
        abstract_url = f"{PUBMED_BASE_URL}/efetch.fcgi?{urlencode({'db': 'pubmed', 'id': ','.join(ids), 'rettype': 'abstract', 'retmode': 'xml'})}"
        abstract_xml = fetch_text(abstract_url)
        if snapshot_sink:
            snapshot_sink(_snapshot("pubmed_efetch_abstract", abstract_url, query, "application/xml", abstract_xml))
        abstract_by_pmid = parse_pubmed_abstract_xml(abstract_xml)
    return [
        parse_pubmed_summary(pmid, result[pmid], abstract_by_pmid.get(str(pmid), ""))
        for pmid in ids
        if pmid in result
    ]


def _snapshot(source: str, locator: str, query: str, content_type: str, content: Any) -> Dict[str, Any]:
    serialized = content if isinstance(content, str) else json.dumps(content, sort_keys=True)
    return {
        "content_hash": hashlib.sha256(serialized.encode("utf-8")).hexdigest(),
        "source": source,
        "locator": locator,
        "query": query,
        "content_type": content_type,
        "content": serialized,
    }
