"""Typed API contracts for the literature service foundation."""

from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field

from .budget import BudgetStatus


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    version: str
    database: Literal["ready"]
    data_boundary: Literal["standalone_fleda_no_gn_connections"]


class BudgetResponse(BaseModel):
    billing_month: str
    limit_usd: str
    spent_usd: str
    remaining_usd: str
    percent_used: str
    allowed: bool

    @classmethod
    def from_status(cls, status: BudgetStatus) -> "BudgetResponse":
        return cls(
            billing_month=status.billing_month,
            limit_usd=f"{status.limit_usd:.2f}",
            spent_usd=f"{status.spent_usd:.6f}",
            remaining_usd=f"{status.remaining_usd:.6f}",
            percent_used=f"{status.percent_used:.2f}",
            allowed=status.allowed,
        )


class AuthorizationRequest(BaseModel):
    estimated_cost_usd: Decimal = Field(ge=0)


class UsageRequest(BaseModel):
    occurred_at: datetime
    provider: str = Field(min_length=1, max_length=80)
    model: str = Field(min_length=1, max_length=120)
    task_type: Literal["extract", "review", "embedding", "other"]
    document_id: Optional[str] = Field(default=None, max_length=160)
    input_tokens: int = Field(ge=0)
    output_tokens: int = Field(ge=0)
    cost_usd: Decimal = Field(ge=0)
    request_id: str = Field(min_length=1, max_length=160)


class PubMedSearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=240)
    retmax: int = Field(default=10, ge=1, le=20)
    save: bool = True
    include_abstract: bool = False
    source: Literal["pubmed", "europe_pmc"] = "pubmed"


class PubMedSearchResponse(BaseModel):
    query: str
    source: Literal["pubmed", "europe_pmc"]
    count: int
    saved: int
    records: list[dict]
    data_boundary: Literal[
        "public_pubmed_metadata_only",
        "public_pubmed_metadata_and_abstract",
    ]


class UniProtSearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=240)
    size: int = Field(default=10, ge=1, le=20)
    save: bool = True


class UniProtSearchResponse(BaseModel):
    query: str
    count: int
    saved: int
    records: list[dict]
    data_boundary: Literal["public_uniprot_annotations"]


class ReactomeEntryRequest(BaseModel):
    stable_id: str = Field(min_length=1, max_length=80)
    save: bool = True


class ReactomeEntryResponse(BaseModel):
    stable_id: str
    saved: int
    record: dict
    data_boundary: Literal["public_reactome_pathway_annotation"]
