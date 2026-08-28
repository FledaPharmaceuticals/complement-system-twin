"""Auditable paid-AI usage accounting and monthly budget enforcement."""

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from .database import Database


MICROS_PER_DOLLAR = Decimal("1000000")


class BudgetExceededError(RuntimeError):
    """Raised before a paid request would exceed the configured limit."""


@dataclass(frozen=True)
class UsageEvent:
    occurred_at: datetime
    provider: str
    model: str
    task_type: str
    document_id: Optional[str]
    input_tokens: int
    output_tokens: int
    cost_usd: Decimal
    request_id: str


@dataclass(frozen=True)
class BudgetStatus:
    billing_month: str
    limit_usd: Decimal
    spent_usd: Decimal
    remaining_usd: Decimal
    percent_used: Decimal
    allowed: bool


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("timestamp must include a timezone")
    return value.astimezone(timezone.utc)


def _to_micros(value: Decimal) -> int:
    return int((value * MICROS_PER_DOLLAR).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _from_micros(value: int) -> Decimal:
    return Decimal(value) / MICROS_PER_DOLLAR


class BudgetGuard:
    def __init__(self, database: Database, monthly_limit_usd: Decimal):
        if monthly_limit_usd <= 0:
            raise ValueError("monthly limit must be greater than zero")
        self.database = database
        self.monthly_limit_usd = Decimal(monthly_limit_usd)

    def get_status(self, at: Optional[datetime] = None) -> BudgetStatus:
        instant = _as_utc(at or datetime.now(timezone.utc))
        billing_month = instant.strftime("%Y-%m")
        with self.database.connect() as connection:
            row = connection.execute(
                "SELECT COALESCE(SUM(cost_usd_micros), 0) AS total "
                "FROM ai_usage_events WHERE billing_month = ?",
                (billing_month,),
            ).fetchone()

        spent = _from_micros(int(row["total"]))
        remaining = max(Decimal("0"), self.monthly_limit_usd - spent)
        percent = (
            (spent / self.monthly_limit_usd) * Decimal("100")
        ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return BudgetStatus(
            billing_month=billing_month,
            limit_usd=self.monthly_limit_usd,
            spent_usd=spent,
            remaining_usd=remaining,
            percent_used=percent,
            allowed=spent < self.monthly_limit_usd,
        )

    def authorize(
        self,
        estimated_cost_usd: Decimal,
        at: Optional[datetime] = None,
    ) -> BudgetStatus:
        estimate = Decimal(estimated_cost_usd)
        if estimate < 0:
            raise ValueError("estimated cost cannot be negative")
        status = self.get_status(at)
        if status.spent_usd + estimate > status.limit_usd:
            raise BudgetExceededError(
                "estimated request would exceed the monthly paid-AI budget"
            )
        return status

    def record_usage(self, event: UsageEvent) -> BudgetStatus:
        occurred_at = _as_utc(event.occurred_at)
        if event.input_tokens < 0 or event.output_tokens < 0:
            raise ValueError("token counts cannot be negative")
        if event.cost_usd < 0:
            raise ValueError("usage cost cannot be negative")

        billing_month = occurred_at.strftime("%Y-%m")
        with self.database.connect() as connection:
            connection.execute(
                """
                INSERT OR IGNORE INTO ai_usage_events (
                    occurred_at,
                    billing_month,
                    provider,
                    model,
                    task_type,
                    document_id,
                    input_tokens,
                    output_tokens,
                    cost_usd_micros,
                    request_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    occurred_at.isoformat(),
                    billing_month,
                    event.provider,
                    event.model,
                    event.task_type,
                    event.document_id,
                    event.input_tokens,
                    event.output_tokens,
                    _to_micros(event.cost_usd),
                    event.request_id,
                ),
            )
        return self.get_status(occurred_at)
