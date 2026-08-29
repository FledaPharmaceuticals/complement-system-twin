from decimal import Decimal

from literature_service.config import Settings
from literature_service.ingest import DEFAULT_QUERIES, run_ingestion


def test_default_queries_include_recent_and_lambris_priority_searches():
    assert any("2024:3000[dp]" in query for query in DEFAULT_QUERIES)
    assert any("Lambris JD[Author]" in query for query in DEFAULT_QUERIES)
    assert any("compstatin" in query and "2023:3000[dp]" in query for query in DEFAULT_QUERIES)


def test_run_ingestion_persists_records_and_snapshots(tmp_path):
    settings = Settings(
        database_path=tmp_path / "literature.db",
        monthly_budget_usd=Decimal("50.00"),
        host="127.0.0.1",
        port=8790,
        cors_origins=("null",),
    )

    def fake_search(query, retmax, **kwargs):
        kwargs["snapshot_sink"]({
            "content_hash": query,
            "source": "pubmed_esearch",
            "locator": "https://example.test",
            "query": query,
            "content_type": "application/json",
            "content": "{}",
        })
        return [{
            "id": f"pmid:{retmax}",
            "sourceLocator": "https://pubmed.ncbi.nlm.nih.gov/1/",
            "title": query,
            "evidenceLevel": "mechanistic",
            "uncertainty": "unknown",
        }]

    report = run_ingestion(settings, ["C3", "C5"], retmax=3, search_fn=fake_search)

    assert report["successful_queries"] == 2
    assert report["failed_queries"] == 0
    assert report["formal_model_changed"] is False


def test_run_ingestion_isolates_query_failures(tmp_path):
    settings = Settings(
        database_path=tmp_path / "literature.db",
        monthly_budget_usd=Decimal("50.00"),
        host="127.0.0.1",
        port=8790,
        cors_origins=("null",),
    )

    def fake_search(query, retmax, **kwargs):
        if query == "bad":
            raise RuntimeError("public source unavailable")
        return []

    report = run_ingestion(settings, ["bad", "good"], search_fn=fake_search)

    assert report["failed_queries"] == 1
    assert report["successful_queries"] == 1
    assert report["queries"][0]["status"] == "error"


def test_run_ingestion_can_cover_both_public_sources(tmp_path):
    settings = Settings(
        database_path=tmp_path / "literature.db",
        monthly_budget_usd=Decimal("50.00"),
        host="127.0.0.1",
        port=8790,
        cors_origins=("null",),
    )

    report = run_ingestion(settings, ["C3"], source="both", search_fn=lambda *args, **kwargs: [])

    assert report["query_count"] == 2
    assert {item["source"] for item in report["queries"]} == {"pubmed", "europe_pmc"}
