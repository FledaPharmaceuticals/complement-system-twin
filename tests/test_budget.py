from datetime import datetime, timezone
from decimal import Decimal

import pytest

from literature_service.budget import BudgetExceededError, BudgetGuard, UsageEvent
from literature_service.database import Database


NOW = datetime(2026, 8, 26, 12, 0, tzinfo=timezone.utc)


def make_guard(tmp_path):
    database = Database(tmp_path / "literature.db")
    database.initialize()
    return BudgetGuard(database, Decimal("50.00"))


def test_usage_is_recorded_in_integer_micros(tmp_path):
    guard = make_guard(tmp_path)
    guard.record_usage(
        UsageEvent(
            occurred_at=NOW,
            provider="openai",
            model="extraction-model",
            task_type="extract",
            document_id="PMID:123",
            input_tokens=1000,
            output_tokens=200,
            cost_usd=Decimal("1.234567"),
            request_id="request-1",
        )
    )

    status = guard.get_status(NOW)

    assert status.spent_usd == Decimal("1.234567")
    assert status.remaining_usd == Decimal("48.765433")
    assert status.allowed is True


def test_authorize_blocks_request_that_would_cross_limit(tmp_path):
    guard = make_guard(tmp_path)
    guard.record_usage(
        UsageEvent(
            occurred_at=NOW,
            provider="openai",
            model="review-model",
            task_type="review",
            document_id="PMID:456",
            input_tokens=1000,
            output_tokens=200,
            cost_usd=Decimal("49.75"),
            request_id="request-2",
        )
    )

    with pytest.raises(BudgetExceededError):
        guard.authorize(Decimal("0.26"), NOW)


def test_duplicate_request_id_is_idempotent(tmp_path):
    guard = make_guard(tmp_path)
    event = UsageEvent(
        occurred_at=NOW,
        provider="openai",
        model="review-model",
        task_type="review",
        document_id=None,
        input_tokens=10,
        output_tokens=5,
        cost_usd=Decimal("0.01"),
        request_id="same-request",
    )
    guard.record_usage(event)
    guard.record_usage(event)

    assert guard.get_status(NOW).spent_usd == Decimal("0.010000")
