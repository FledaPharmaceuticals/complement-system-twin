"""Environment-backed configuration for the local literature service."""

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
import os
from pathlib import Path
from typing import Tuple


@dataclass(frozen=True)
class Settings:
    database_path: Path
    monthly_budget_usd: Decimal
    host: str
    port: int
    cors_origins: Tuple[str, ...]

    @classmethod
    def from_env(cls) -> "Settings":
        try:
            budget = Decimal(os.getenv("FLEDA_AI_MONTHLY_BUDGET_USD", "50.00"))
        except InvalidOperation as exc:
            raise ValueError(
                "FLEDA_AI_MONTHLY_BUDGET_USD must be a decimal"
            ) from exc
        if budget <= 0:
            raise ValueError(
                "FLEDA_AI_MONTHLY_BUDGET_USD must be greater than zero"
            )

        port = int(os.getenv("FLEDA_LITERATURE_PORT", "8790"))
        if not 1 <= port <= 65535:
            raise ValueError("FLEDA_LITERATURE_PORT must be between 1 and 65535")

        return cls(
            database_path=Path(
                os.getenv("FLEDA_LITERATURE_DB", "data/literature.db")
            ),
            monthly_budget_usd=budget.quantize(Decimal("0.01")),
            host=os.getenv("FLEDA_LITERATURE_HOST", "127.0.0.1"),
            port=port,
            cors_origins=(
                "http://127.0.0.1:8788",
                "http://localhost:8788",
                # Browser file:// pages send the literal `null` origin.
                "null",
            ),
        )
