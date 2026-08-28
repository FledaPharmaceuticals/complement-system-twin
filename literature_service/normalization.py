"""Deterministic normalization for public literature records."""

from __future__ import annotations

from typing import Any, Dict
import re


DEFAULT_EVIDENCE_TERMS = (
    "complement", "c3", "c3a", "c3b", "c5", "c5a", "mac", "factor h",
    "factor i", "factor b", "factor d", "amd", "retina", "rpe", "choroid",
    "pnh", "ahus", "c3g", "sepsis",
)


def _clean_text(value: Any) -> str:
    return " ".join(str(value or "").split())


def extract_evidence_snippets(text: Any, terms=DEFAULT_EVIDENCE_TERMS, max_snippets: int = 8):
    """Keep exact abstract sentences containing explicit domain terms only."""
    cleaned = _clean_text(text)
    if not cleaned or max_snippets <= 0:
        return []
    normalized_terms = tuple(_clean_text(term).lower() for term in terms if _clean_text(term))
    snippets = []
    for sentence in re.split(r"(?<=[.!?])\s+", cleaned):
        if any(term in sentence.lower() for term in normalized_terms):
            snippets.append(sentence)
            if len(snippets) >= max_snippets:
                break
    return snippets


def normalize_public_record(record: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize formatting and identifiers without inferring scientific facts."""
    normalized = dict(record)
    normalized["title"] = _clean_text(record.get("title"))
    metadata = dict(record.get("metadata") or {})
    for key in ("abstract", "journal", "publicationDate"):
        if key in metadata and isinstance(metadata[key], str):
            metadata[key] = _clean_text(metadata[key])
    if metadata.get("abstractAvailable") or metadata.get("abstract"):
        metadata["abstractEvidenceSnippets"] = extract_evidence_snippets(metadata.get("abstract"))
        metadata["abstractExtractionMethod"] = "explicit_term_sentence_match"
    doi = _clean_text(metadata.get("doi")).lower()
    if doi.startswith("doi:"):
        doi = doi[4:].strip()
    doi = re.sub(r"^https?://doi\.org/", "", doi)
    if doi:
        metadata["doi"] = doi
    metadata["normalizationMethod"] = "deterministic_public_record_normalizer"
    metadata["scientificInferencePerformed"] = False
    normalized["metadata"] = metadata
    return normalized
