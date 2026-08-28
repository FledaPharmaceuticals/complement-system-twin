from literature_service.normalization import extract_evidence_snippets, normalize_public_record


def test_normalization_is_format_only():
    record = normalize_public_record({
        "title": "  C3   and   AMD ",
        "metadata": {"doi": "https://doi.org/10.1000/ABC", "abstract": " C3   signal "},
    })

    assert record["title"] == "C3 and AMD"
    assert record["metadata"]["doi"] == "10.1000/abc"
    assert record["metadata"]["abstract"] == "C3 signal"
    assert record["metadata"]["scientificInferencePerformed"] is False


def test_extract_evidence_snippets_keeps_only_explicit_term_sentences():
    snippets = extract_evidence_snippets(
        "Background unrelated text. C3 activation was measured in AMD retina. "
        "The result was exploratory. Factor H was also reported."
    )

    assert snippets == [
        "C3 activation was measured in AMD retina.",
        "Factor H was also reported.",
    ]


def test_normalization_marks_snippets_as_non_inferential():
    record = normalize_public_record({
        "title": "C3 study",
        "metadata": {"abstract": "C3 activation was measured in AMD retina."},
    })

    assert record["metadata"]["abstractEvidenceSnippets"] == [
        "C3 activation was measured in AMD retina."
    ]
    assert record["metadata"]["scientificInferencePerformed"] is False
