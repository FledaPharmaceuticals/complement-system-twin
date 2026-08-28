from literature_service.reactome import parse_reactome_entry


def test_parse_reactome_entry_preserves_pathway_provenance_and_boundaries():
    record = parse_reactome_entry(
        {
            "stId": "R-HSA-168249",
            "displayName": "Innate Immune System",
            "speciesName": "Homo sapiens",
            "schemaClass": "Pathway",
            "isInDisease": False,
            "hasEvent": [{"stId": "R-HSA-123", "displayName": "Complement activation"}],
            "literatureReference": [{"pubMedIdentifier": 123456}],
        }
    )

    assert record["id"] == "reactome:R-HSA-168249"
    assert record["recordType"] == "fleda_public_pathway_annotation"
    assert record["metadata"]["participantOrEventCount"] == 1
    assert record["metadata"]["literatureReferenceCount"] == 1
    assert record["dataBoundary"]["publicSourceOnly"] is True
    assert record["dataBoundary"]["formalModelChanged"] is False

