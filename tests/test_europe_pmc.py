from literature_service.europe_pmc import parse_europe_pmc_record, search_europe_pmc


def test_parse_europe_pmc_record_keeps_source_and_abstract_boundary():
    record = parse_europe_pmc_record({
        "id": "999",
        "pmid": "123",
        "title": "Complement C3 in AMD",
        "doi": "10.1000/example",
        "journalTitle": "Example Journal",
        "firstPublicationDate": "2025-01-01",
        "pubType": ["research-article"],
        "abstractText": "C3 is associated with retinal inflammation.",
    }, include_abstract=True)

    assert record["id"] == "pmid:123"
    assert record["sourceLocator"].endswith("/MED/123")
    assert record["metadata"]["doi"] == "10.1000/example"
    assert record["metadata"]["abstractAvailable"] is True
    assert record["extractionMethod"] == "public_database_metadata_and_abstract"


def test_search_europe_pmc_uses_lite_by_default_and_snapshots():
    calls = []
    snapshots = []

    def fake_json(url):
        calls.append(url)
        return {"resultList": {"result": [{"id": "1", "pmid": "1", "title": "C3"}]}}

    records = search_europe_pmc("complement C3", fetch_json=fake_json, snapshot_sink=snapshots.append)

    assert len(records) == 1
    assert "resultType=lite" in calls[0]
    assert len(snapshots) == 1
    assert snapshots[0]["source"] == "europe_pmc_search"
