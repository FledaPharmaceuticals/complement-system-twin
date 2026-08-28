from literature_service.database import Database


def test_initialize_creates_phase_one_tables(tmp_path):
    database = Database(tmp_path / "literature.db")
    database.initialize()

    with database.connect() as connection:
        names = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
        }
        version = connection.execute(
            "SELECT version FROM schema_version"
        ).fetchone()[0]

    assert {"schema_version", "ai_usage_events", "service_events", "raw_snapshots"} <= names
    assert version == 4


def test_initialize_is_idempotent(tmp_path):
    database = Database(tmp_path / "literature.db")
    database.initialize()
    database.initialize()

    with database.connect() as connection:
        count = connection.execute(
            "SELECT COUNT(*) FROM schema_version"
        ).fetchone()[0]

    assert count == 1


def test_raw_snapshots_are_deduplicated_and_listed(tmp_path):
    database = Database(tmp_path / "literature.db")
    database.initialize()
    snapshot = {
        "content_hash": "abc",
        "source": "pubmed_esearch",
        "locator": "https://example.test",
        "query": "C3",
        "content_type": "application/json",
        "content": "{\"idlist\":[\"1\"]}",
    }

    assert database.save_raw_snapshot(**snapshot) is True
    assert database.save_raw_snapshot(**snapshot) is False
    assert database.list_raw_snapshots()[0]["content_hash"] == "abc"


def test_duplicate_public_records_preserve_both_source_providers(tmp_path):
    database = Database(tmp_path / "literature.db")
    database.initialize()
    base = {
        "id": "pmid:1",
        "sourceLocator": "https://pubmed.ncbi.nlm.nih.gov/1/",
        "title": "C3 study",
        "evidenceLevel": "mechanistic",
        "uncertainty": "unknown",
        "linkedEntities": ["C3"],
        "metadata": {"sourceProvider": "pubmed", "abstractAvailable": False, "abstract": ""},
    }
    alternate = {
        **base,
        "sourceLocator": "https://europepmc.org/article/MED/1",
        "metadata": {
            "sourceProvider": "europe_pmc",
            "abstractAvailable": True,
            "abstract": "C3 study abstract.",
        },
    }

    database.upsert_literature_records([base])
    database.upsert_literature_records([alternate])
    record = database.list_literature_records()[0]

    assert record["metadata"]["sourceProviders"] == ["europe_pmc", "pubmed"]
    assert len(record["metadata"]["sourceLocators"]) == 2
    assert record["metadata"]["abstractAvailable"] is True


def test_duplicate_records_can_match_by_doi_and_normalize_metadata(tmp_path):
    database = Database(tmp_path / "literature.db")
    database.initialize()
    first = {
        "id": "europepmc:abc",
        "sourceLocator": "https://europepmc.org/article/EXT/abc",
        "title": "  C3   study  ",
        "evidenceLevel": "mechanistic",
        "uncertainty": "unknown",
        "metadata": {"sourceProvider": "europe_pmc", "doi": "10.1000/EXAMPLE"},
    }
    second = {
        "id": "pmid:2",
        "sourceLocator": "https://pubmed.ncbi.nlm.nih.gov/2/",
        "title": "C3 study",
        "evidenceLevel": "mechanistic",
        "uncertainty": "unknown",
        "metadata": {"sourceProvider": "pubmed", "doi": "doi:10.1000/example"},
    }

    database.upsert_literature_records([first])
    database.upsert_literature_records([second])
    records = database.list_literature_records()

    assert len(records) == 1
    assert records[0]["id"] == "europepmc:abc"
    assert records[0]["title"] == "C3 study"
    assert records[0]["metadata"]["doi"] == "10.1000/example"
    assert records[0]["metadata"]["scientificInferencePerformed"] is False


def test_public_annotations_are_persisted_separately(tmp_path):
    database = Database(tmp_path / "literature.db")
    database.initialize()
    record = {
        "id": "uniprot:P01024",
        "sourceLocator": "https://www.uniprot.org/uniprotkb/P01024/entry",
        "title": "Complement C3",
        "metadata": {},
    }

    assert database.upsert_public_annotations([record]) == 1
    assert database.list_public_annotations()[0]["id"] == "uniprot:P01024"


def test_pathway_annotations_are_persisted_in_their_own_layer(tmp_path):
    database = Database(tmp_path / "literature.db")
    database.initialize()
    record = {
        "id": "reactome:R-HSA-168249",
        "sourceLocator": "https://reactome.org/content/detail/R-HSA-168249",
        "title": "Innate Immune System",
        "metadata": {"stableId": "R-HSA-168249"},
    }

    assert database.upsert_pathway_annotations([record]) == 1
    assert database.list_pathway_annotations()[0]["id"] == "reactome:R-HSA-168249"
    assert database.list_public_annotations() == []


def test_knowledge_layer_lists_sources_without_merging_record_types(tmp_path):
    database = Database(tmp_path / "literature.db")
    database.initialize()
    database.upsert_public_annotations([{
        "id": "uniprot:P1",
        "sourceLocator": "https://www.uniprot.org/uniprotkb/P1/entry",
        "title": "Protein P1",
        "recordType": "fleda_public_protein_annotation",
        "metadata": {},
    }])
    database.upsert_pathway_annotations([{
        "id": "reactome:R-HSA-1",
        "sourceLocator": "https://reactome.org/content/detail/R-HSA-1",
        "title": "Pathway 1",
        "recordType": "fleda_public_pathway_annotation",
        "metadata": {},
    }])

    records = database.list_knowledge_records()

    assert {record["knowledgeLayer"] for record in records} == {"protein_annotation", "pathway_annotation"}
    assert {record["recordType"] for record in records} == {
        "fleda_public_protein_annotation",
        "fleda_public_pathway_annotation",
    }
