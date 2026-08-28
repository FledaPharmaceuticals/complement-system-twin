"""Local, repeatable public-literature ingestion runner for Fleda."""

from __future__ import annotations

import argparse
import json
from typing import Callable, Iterable, List, Optional

from .config import Settings
from .database import Database
from .europe_pmc import search_europe_pmc
from .pubmed import search_pubmed


DEFAULT_QUERIES = (
    "complement C3",
    "complement C5a MAC",
    "complement Factor H Factor I",
    "complement Factor B Factor D",
    "complement AMD retina",
    "complement PNH aHUS C3G",
)


def run_ingestion(
    settings: Settings,
    queries: Iterable[str] = DEFAULT_QUERIES,
    *,
    retmax: int = 10,
    include_abstract: bool = False,
    source: str = "pubmed",
    search_fn: Callable = None,
) -> dict:
    """Run independent queries and persist only public literature records."""
    database = Database(settings.database_path)
    database.initialize()
    if source not in {"pubmed", "europe_pmc", "both"}:
        raise ValueError("source must be pubmed, europe_pmc, or both")
    sources = ("pubmed", "europe_pmc") if source == "both" else (source,)
    results = []
    for query in queries:
        query = query.strip()
        if not query:
            continue
        for current_source in sources:
            snapshots = []
            try:
                current_search = search_fn or (search_pubmed if current_source == "pubmed" else search_europe_pmc)
                records = current_search(
                    query,
                    retmax,
                    include_abstract=include_abstract,
                    snapshot_sink=lambda snapshot: snapshots.append(snapshot),
                )
                saved = database.upsert_literature_records(records)
                for snapshot in snapshots:
                    database.save_raw_snapshot(**snapshot)
                results.append({
                    "source": current_source,
                    "query": query,
                    "status": "ok",
                    "records": len(records),
                    "saved": saved,
                    "snapshots": len(snapshots),
                })
            except Exception as exc:
                results.append({
                    "source": current_source,
                    "query": query,
                    "status": "error",
                    "records": 0,
                    "saved": 0,
                    "snapshots": len(snapshots),
                    "error": str(exc),
                })
    return {
        "runner": "fleda_public_literature_ingestion",
        "queries": results,
        "query_count": len(results),
        "successful_queries": sum(item["status"] == "ok" for item in results),
        "failed_queries": sum(item["status"] == "error" for item in results),
        "include_abstract": include_abstract,
        "source": source,
        "data_boundary": (
            "standalone_fleda_public_pubmed_metadata_and_abstract"
            if include_abstract
            else "standalone_fleda_public_pubmed_metadata"
        ),
        "formal_model_changed": False,
    }


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Ingest public PubMed records locally for Fleda.")
    parser.add_argument("--query", action="append", dest="queries", help="PubMed query; repeatable")
    parser.add_argument("--retmax", type=int, default=10)
    parser.add_argument("--include-abstract", action="store_true")
    parser.add_argument("--source", choices=("pubmed", "europe_pmc", "both"), default="pubmed")
    args = parser.parse_args(argv)
    report = run_ingestion(
        Settings.from_env(),
        args.queries or DEFAULT_QUERIES,
        retmax=args.retmax,
        include_abstract=args.include_abstract,
        source=args.source,
    )
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if report["failed_queries"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
