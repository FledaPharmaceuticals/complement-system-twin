from literature_service.uniprot import parse_uniprot_records, search_uniprot


def test_parse_uniprot_record_keeps_annotation_provenance():
    records = parse_uniprot_records({
        "results": [{
            "primaryAccession": "P01024",
            "uniProtkbId": "CO3_HUMAN",
            "genes": [{"geneName": {"value": "C3"}}],
            "proteinDescription": {"recommendedName": {"fullName": {"value": "Complement C3"}}},
            "organism": {"scientificName": "Homo sapiens"},
            "comments": [{"commentType": "FUNCTION", "texts": [{"value": "Central complement component."}]}],
        }]
    })

    assert records[0]["id"] == "uniprot:P01024"
    assert records[0]["metadata"]["geneNames"] == ["C3"]
    assert records[0]["metadata"]["function"] == "Central complement component."
    assert records[0]["metadata"]["sourceProvider"] == "uniprotkb"
    assert records[0]["boundary"]["formalModelChanged"] is False


def test_search_uniprot_uses_public_endpoint_and_snapshot():
    calls = []
    snapshots = []

    def fake_json(url):
        calls.append(url)
        return {"results": []}

    assert search_uniprot("gene_exact:C3", fetch_json=fake_json, snapshot_sink=snapshots.append) == []
    assert "rest.uniprot.org/uniprotkb/search" in calls[0]
    assert "format=json" in calls[0]
    assert snapshots[0]["source"] == "uniprotkb_search"
