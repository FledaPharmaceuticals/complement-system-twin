from decimal import Decimal
from pathlib import Path

import pytest

from literature_service.config import Settings


def test_settings_use_safe_fleda_defaults(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    for name in (
        "FLEDA_LITERATURE_DB",
        "FLEDA_AI_MONTHLY_BUDGET_USD",
        "FLEDA_LITERATURE_HOST",
        "FLEDA_LITERATURE_PORT",
    ):
        monkeypatch.delenv(name, raising=False)

    settings = Settings.from_env()

    assert settings.database_path == Path("data/literature.db")
    assert settings.monthly_budget_usd == Decimal("50.00")
    assert settings.host == "127.0.0.1"
    assert settings.port == 8790
    assert settings.cors_origins == (
        "http://127.0.0.1:8788",
        "http://localhost:8788",
        "null",
    )


def test_settings_reject_non_positive_budget(monkeypatch):
    monkeypatch.setenv("FLEDA_AI_MONTHLY_BUDGET_USD", "0")

    with pytest.raises(ValueError, match="greater than zero"):
        Settings.from_env()
