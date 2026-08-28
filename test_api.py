from decimal import Decimal

from fastapi.testclient import TestClient

from literature_service.config import Settings
from literature_service.main import create_app


def make_client(tmp_path):
    settings = Settings(
        database_path=tmp_path / "literature.db",
        monthly_budget_usd=Decimal("50.00"),
        host="127.0.0.1",
        port=8790,
        cors_origins=("http://127.0.0.1:8788", "null"),
    )
    return TestClient(create_app(settings))


def test_health_reports_standalone_service(tmp_path):
    response = make_client(tmp_path).get("/api/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "fleda-complement-literature",
        "version": "0.1.0",
        "database": "ready",
        "data_boundary": "standalone_fleda_no_gn_connections",
    }


def test_budget_endpoint_reports_default_limit(tmp_path):
    response = make_client(tmp_path).get("/api/budget")

    assert response.status_code == 200
    body = response.json()
    assert body["limit_usd"] == "50.00"
    assert body["spent_usd"] == "0.000000"
    assert body["allowed"] is True


def test_authorize_returns_402_when_estimate_exceeds_limit(tmp_path):
    response = make_client(tmp_path).post(
        "/api/budget/authorize",
        json={"estimated_cost_usd": "50.01"},
    )

    assert response.status_code == 402
    assert response.json()["detail"]["code"] == "monthly_budget_exceeded"


def test_module_exposes_default_app():
    from literature_service.main import app

    assert app.title == "Fleda Complement Literature Service"


def test_pubmed_search_saves_public_metadata(monkeypatch, tmp_path):
    records = [{
        "id": "pmid:123",
        "sourceType": "publication",
        "sourceLocator": "https://pubmed.ncbi.nlm.nih.gov/123/",
        "title": "Complement overview",
        "evidenceLevel": "curated",
        "uncertainty": "unknown",
        "linkedEntities": [],
        "parameterPriors": {},
        "extractionMethod": "public_database_metadata",
        "metadata": {"pmid": "123"},
        "extractedClaim": None,
    }]
    monkeypatch.setattr("literature_service.main.search_pubmed", lambda query, retmax, **kwargs: records)

    client = make_client(tmp_path)
    response = client.post("/api/pubmed/search", json={"query": "complement C3", "retmax": 5})

    assert response.status_code == 200
    assert response.json()["saved"] == 1
    saved = client.get("/api/literature/records").json()
    assert saved["records"][0]["id"] == "pmid:123"
    assert saved["data_boundary"] == "standalone_fleda_local_records"


def test_pubmed_search_can_skip_local_save(monkeypatch, tmp_path):
    monkeypatch.setattr("literature_service.main.search_pubmed", lambda query, retmax, **kwargs: [])

    response = make_client(tmp_path).post(
        "/api/pubmed/search",
        json={"query": "complement", "save": False},
    )

    assert response.status_code == 200
    assert response.json()["saved"] == 0
    assert response.json()["data_boundary"] == "public_pubmed_metadata_only"


def test_pubmed_search_reports_abstract_boundary(monkeypatch, tmp_path):
    captured = {}

    def fake_search(query, retmax, **kwargs):
        captured.update(kwargs)
        return []

    monkeypatch.setattr("literature_service.main.search_pubmed", fake_search)
    response = make_client(tmp_path).post(
        "/api/pubmed/search",
        json={"query": "AMD", "include_abstract": True, "save": False},
    )

    assert response.status_code == 200
    assert captured["include_abstract"] is True
    assert response.json()["data_boundary"] == "public_pubmed_metadata_and_abstract"


def test_europe_pmc_search_is_exposed_with_source_boundary(monkeypatch, tmp_path):
    monkeypatch.setattr("literature_service.main.search_europe_pmc", lambda query, retmax, **kwargs: [])

    response = make_client(tmp_path).post(
        "/api/pubmed/search",
        json={"query": "AMD", "source": "europe_pmc", "save": False},
    )

    assert response.status_code == 200
    assert response.json()["source"] == "europe_pmc"
    assert response.json()["data_boundary"] == "public_pubmed_metadata_only"


def test_uniprot_search_saves_public_annotations(monkeypatch, tmp_path):
    monkeypatch.setattr("literature_service.main.search_uniprot", lambda query, size, **kwargs: [{
        "id": "uniprot:P1",
        "sourceLocator": "https://www.uniprot.org/uniprotkb/P1/entry",
        "title": "Complement protein",
        "evidenceLevel": "annotation",
        "uncertainty": "unknown",
        "metadata": {},
    }])

    client = make_client(tmp_path)
    response = client.post("/api/annotations/uniprot/search", json={"query": "gene_exact:C3"})

    assert response.status_code == 200
    assert response.json()["saved"] == 1
    assert client.get("/api/annotations/uniprot/records").json()["count"] == 1


def test_reactome_entry_saves_public_pathway_annotation(monkeypatch, tmp_path):
    monkeypatch.setattr("literature_service.main.fetch_reactome_entry", lambda stable_id, **kwargs: {
        "id": "reactome:R-HSA-168249",
        "sourceLocator": "https://reactome.org/content/detail/R-HSA-168249",
        "title": "Innate Immune System",
        "recordType": "fleda_public_pathway_annotation",
        "evidenceLevel": "curated",
        "uncertainty": "unknown",
        "metadata": {"stableId": "R-HSA-168249"},
    })

    client = make_client(tmp_path)
    response = client.post("/api/annotations/reactome", json={"stable_id": "R-HSA-168249"})

    assert response.status_code == 200
    assert response.json()["saved"] == 1
    assert client.get("/api/annotations/reactome/records").json()["count"] == 1


def test_knowledge_records_expose_separate_public_layers(tmp_path):
    client = make_client(tmp_path)
    response = client.get("/api/knowledge/records")

    assert response.status_code == 200
    assert response.json() == {
        "count": 0,
        "records": [],
        "data_boundary": "standalone_fleda_public_knowledge_layer",
    }


def test_pubmed_response_exposes_deterministic_abstract_snippets(monkeypatch, tmp_path):
    monkeypatch.setattr("literature_service.main.search_pubmed", lambda query, retmax, **kwargs: [{
        "id": "pmid:9",
        "sourceLocator": "https://pubmed.ncbi.nlm.nih.gov/9/",
        "title": "C3 study",
        "evidenceLevel": "mechanistic",
        "uncertainty": "unknown",
        "metadata": {"abstract": "C3 activation was measured in AMD retina."},
    }])

    response = make_client(tmp_path).post(
        "/api/pubmed/search",
        json={"query": "AMD", "save": False},
    )

    assert response.status_code == 200
    body = response.json()["records"][0]
    assert body["metadata"]["abstractEvidenceSnippets"] == [
        "C3 activation was measured in AMD retina."
    ]


def test_file_origin_can_read_local_service(tmp_path):
    response = make_client(tmp_path).options(
        "/api/literature/records",
        headers={
            "Origin": "null",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "null"


def test_public_snapshot_endpoint_is_local_and_metadata_only(tmp_path):
    response = make_client(tmp_path).get("/api/literature/snapshots")

    assert response.status_code == 200
    assert response.json() == {
        "count": 0,
        "snapshots": [],
        "data_boundary": "standalone_fleda_public_source_snapshots",
    }
