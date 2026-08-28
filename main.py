"""Local API for Fleda Complement Literature Intelligence."""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .budget import BudgetExceededError, BudgetGuard, UsageEvent
from .config import Settings
from .database import Database
from .europe_pmc import search_europe_pmc
from .normalization import normalize_public_record
from .reactome import fetch_reactome_entry
from .schemas import UniProtSearchRequest, UniProtSearchResponse, ReactomeEntryRequest, ReactomeEntryResponse
from .uniprot import search_uniprot
from .pubmed import search_pubmed
from .schemas import (
    AuthorizationRequest,
    BudgetResponse,
    HealthResponse,
    UsageRequest,
    PubMedSearchRequest,
    PubMedSearchResponse,
)


def create_app(settings: Settings = None) -> FastAPI:
    resolved_settings = settings or Settings.from_env()
    database = Database(resolved_settings.database_path)
    database.initialize()
    budget_guard = BudgetGuard(database, resolved_settings.monthly_budget_usd)

    service = FastAPI(
        title="Fleda Complement Literature Service",
        version=__version__,
    )
    service.add_middleware(
        CORSMiddleware,
        allow_origins=list(resolved_settings.cors_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )
    service.state.settings = resolved_settings
    service.state.database = database
    service.state.budget_guard = budget_guard

    @service.get("/api/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse(
            status="ok",
            service="fleda-complement-literature",
            version=__version__,
            database="ready",
            data_boundary="standalone_fleda_no_gn_connections",
        )

    @service.get("/api/budget", response_model=BudgetResponse)
    def budget() -> BudgetResponse:
        return BudgetResponse.from_status(budget_guard.get_status())

    @service.post("/api/budget/authorize", response_model=BudgetResponse)
    def authorize(request: AuthorizationRequest) -> BudgetResponse:
        try:
            status = budget_guard.authorize(request.estimated_cost_usd)
        except BudgetExceededError as exc:
            current = budget_guard.get_status()
            raise HTTPException(
                status_code=402,
                detail={
                    "code": "monthly_budget_exceeded",
                    "message": str(exc),
                    "budget": BudgetResponse.from_status(current).model_dump(),
                },
            ) from exc
        return BudgetResponse.from_status(status)

    @service.post("/api/usage", response_model=BudgetResponse)
    def record_usage(request: UsageRequest) -> BudgetResponse:
        if request.occurred_at.tzinfo is None or request.occurred_at.utcoffset() is None:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "timezone_required",
                    "message": "occurred_at must include a timezone",
                },
            )
        status = budget_guard.record_usage(
            UsageEvent(
                occurred_at=request.occurred_at,
                provider=request.provider,
                model=request.model,
                task_type=request.task_type,
                document_id=request.document_id,
                input_tokens=request.input_tokens,
                output_tokens=request.output_tokens,
                cost_usd=request.cost_usd,
                request_id=request.request_id,
            )
        )
        return BudgetResponse.from_status(status)

    @service.post("/api/pubmed/search", response_model=PubMedSearchResponse)
    def pubmed_search(request: PubMedSearchRequest) -> PubMedSearchResponse:
        try:
            search_fn = search_pubmed if request.source == "pubmed" else search_europe_pmc
            records = [normalize_public_record(record) for record in search_fn(
                request.query,
                request.retmax,
                include_abstract=request.include_abstract,
                snapshot_sink=lambda snapshot: database.save_raw_snapshot(**snapshot),
            )]
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail={
                    "code": "pubmed_unavailable",
                    "message": "Public PubMed metadata could not be retrieved.",
                },
            ) from exc
        saved = database.upsert_literature_records(records) if request.save else 0
        return PubMedSearchResponse(
            query=request.query,
            source=request.source,
            count=len(records),
            saved=saved,
            records=records,
            data_boundary=(
                "public_pubmed_metadata_and_abstract"
                if request.include_abstract
                else "public_pubmed_metadata_only"
            ),
        )

    @service.get("/api/literature/records")
    def literature_records(limit: int = 100):
        if not 1 <= limit <= 100:
            raise HTTPException(status_code=422, detail="limit must be between 1 and 100")
        records = database.list_literature_records(limit)
        return {
            "count": len(records),
            "records": records,
            "data_boundary": "standalone_fleda_local_records",
        }

    @service.post("/api/annotations/uniprot/search", response_model=UniProtSearchResponse)
    def uniprot_search(request: UniProtSearchRequest) -> UniProtSearchResponse:
        try:
            records = search_uniprot(
                request.query,
                request.size,
                snapshot_sink=lambda snapshot: database.save_raw_snapshot(**snapshot),
            )
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail={"code": "uniprot_unavailable", "message": "Public UniProt annotations could not be retrieved."},
            ) from exc
        records = [normalize_public_record(record) for record in records]
        saved = database.upsert_public_annotations(records) if request.save else 0
        return UniProtSearchResponse(
            query=request.query,
            count=len(records),
            saved=saved,
            records=records,
            data_boundary="public_uniprot_annotations",
        )

    @service.get("/api/annotations/uniprot/records")
    def uniprot_records(limit: int = 100):
        if not 1 <= limit <= 100:
            raise HTTPException(status_code=422, detail="limit must be between 1 and 100")
        records = database.list_public_annotations(limit)
        return {"count": len(records), "records": records, "data_boundary": "standalone_fleda_public_annotations"}

    @service.post("/api/annotations/reactome", response_model=ReactomeEntryResponse)
    def reactome_entry(request: ReactomeEntryRequest) -> ReactomeEntryResponse:
        try:
            record = fetch_reactome_entry(
                request.stable_id,
                snapshot_sink=lambda source, query, content, content_hash: database.save_raw_snapshot(
                    content_hash=content_hash,
                    source=source,
                    locator=f"https://reactome.org/ContentService/data/query/{query}",
                    query=query,
                    content_type="application/json",
                    content=content,
                ),
            )
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail={"code": "reactome_unavailable", "message": "Public Reactome pathway data could not be retrieved."},
            ) from exc
        record = normalize_public_record(record)
        saved = database.upsert_pathway_annotations([record]) if request.save else 0
        return ReactomeEntryResponse(
            stable_id=request.stable_id.strip(),
            saved=saved,
            record=record,
            data_boundary="public_reactome_pathway_annotation",
        )

    @service.get("/api/annotations/reactome/records")
    def reactome_records(limit: int = 100):
        if not 1 <= limit <= 100:
            raise HTTPException(status_code=422, detail="limit must be between 1 and 100")
        records = database.list_pathway_annotations(limit)
        return {"count": len(records), "records": records, "data_boundary": "standalone_fleda_pathway_annotations"}

    @service.get("/api/knowledge/records")
    def knowledge_records(limit: int = 100):
        if not 1 <= limit <= 100:
            raise HTTPException(status_code=422, detail="limit must be between 1 and 100")
        records = database.list_knowledge_records(limit)
        return {
            "count": len(records),
            "records": records,
            "data_boundary": "standalone_fleda_public_knowledge_layer",
        }

    @service.get("/api/literature/snapshots")
    def literature_snapshots(limit: int = 100):
        if not 1 <= limit <= 100:
            raise HTTPException(status_code=422, detail="limit must be between 1 and 100")
        snapshots = database.list_raw_snapshots(limit)
        return {
            "count": len(snapshots),
            "snapshots": snapshots,
            "data_boundary": "standalone_fleda_public_source_snapshots",
        }

    return service


app = create_app()
