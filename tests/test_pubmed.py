from literature_service.pubmed import (
    normalize_pubmed_records,
    parse_pubmed_abstract_xml,
    parse_pubmed_summary,
    search_pubmed,
)


def test_parse_pubmed_summary_returns_canonical_metadata():
    record = parse_pubmed_summary(
        "12345",
        {
            "uid": "12345",
            "title": "Complement C3 activation in retinal disease",
            "fulljournalname": "Journal of Complement Biology",
            "pubdate": "2024 Jan",
            "elocationid": "doi: 10.1000/example",
            "pubtype": ["Journal Article"],
        },
    )

    assert record["id"] == "pmid:12345"
    assert record["sourceType"] == "publication"
    assert record["sourceLocator"] == "https://pubmed.ncbi.nlm.nih.gov/12345/"
    assert record["metadata"]["doi"] == "10.1000/example"
    assert record["uncertainty"] == "unknown"
    assert record["parameterPriors"] == {}
    assert record["modelVersion"] == "complement-twin-v1.1-contract"
    assert record["metadata"]["abstractAvailable"] is False
    assert isinstance(record["extractedClaim"], str)


def test_parse_pubmed_abstract_xml_keeps_section_labels():
    xml = """
    <PubmedArticleSet><PubmedArticle><MedlineCitation><PMID>123</PMID>
    <Article><Abstract><AbstractText Label="BACKGROUND">C3 is relevant.</AbstractText>
    <AbstractText>RPE stress is discussed.</AbstractText></Abstract></Article>
    </MedlineCitation></PubmedArticle></PubmedArticleSet>
    """
    assert parse_pubmed_abstract_xml(xml) == {
        "123": "BACKGROUND: C3 is relevant. RPE stress is discussed."
    }


def test_search_pubmed_default_does_not_fetch_abstracts():
    calls = []
    payloads = [
        {"esearchresult": {"idlist": ["1"]}},
        {"result": {"1": {"uid": "1", "title": "C3 study"}}},
    ]

    def fake_json(url):
        calls.append(url)
        return payloads.pop(0)

    records = search_pubmed("complement", fetch_json=fake_json)

    assert len(records) == 1
    assert len(calls) == 2
    assert records[0]["metadata"]["abstractAvailable"] is False


def test_search_pubmed_can_attach_public_abstract():
    payloads = [
        {"esearchresult": {"idlist": ["1"]}},
        {"result": {"1": {"uid": "1", "title": "C3 study"}}},
    ]
    fetched = []

    def fake_json(url):
        return payloads.pop(0)

    def fake_text(url):
        fetched.append(url)
        return "<PubmedArticleSet><PubmedArticle><MedlineCitation><PMID>1</PMID><Article><Abstract><AbstractText>C3 and AMD.</AbstractText></Abstract></Article></MedlineCitation></PubmedArticle></PubmedArticleSet>"

    records = search_pubmed("complement", fetch_json=fake_json, include_abstract=True, fetch_text=fake_text)

    assert len(fetched) == 1
    assert records[0]["metadata"]["abstract"] == "C3 and AMD."
    assert records[0]["metadata"]["abstractAvailable"] is True


def test_search_pubmed_emits_deduplicable_raw_snapshots():
    payloads = [
        {"esearchresult": {"idlist": ["1"]}},
        {"result": {"1": {"uid": "1", "title": "C3 study"}}},
    ]
    snapshots = []

    records = search_pubmed(
        "complement",
        fetch_json=lambda _url: payloads.pop(0),
        snapshot_sink=snapshots.append,
    )

    assert len(records) == 1
    assert [item["source"] for item in snapshots] == ["pubmed_esearch", "pubmed_esummary"]
    assert all(len(item["content_hash"]) == 64 for item in snapshots)


def test_normalize_pubmed_records_skips_incomplete_records():
    records = normalize_pubmed_records([
        {"uid": "1", "title": "Valid record"},
        {"uid": "2"},
        None,
    ])

    assert [record["id"] for record in records] == ["pmid:1"]
