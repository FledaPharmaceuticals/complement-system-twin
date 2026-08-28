# Literature Intelligence Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local, standalone literature-service foundation with SQLite persistence, auditable AI-cost accounting, a USD 50 monthly hard stop, and a visible service-status panel in the existing Complement System Digital Twin.

**Architecture:** A focused Python FastAPI service owns configuration, SQLite initialization, usage accounting, and health/budget APIs. The existing static JavaScript application talks to the service through a small client module and degrades cleanly when the service is offline. This phase intentionally excludes paper retrieval and AI calls; later phases consume the stable database and budget interfaces defined here.

**Tech Stack:** Python 3.9, FastAPI, Uvicorn, Pydantic 2, standard-library `sqlite3`, Pytest, browser-native JavaScript, HTML, and CSS.

**Spec:** `docs/superpowers/specs/2026-08-26-literature-intelligence-design.md`

## Global Constraints

- The system remains a standalone Fleda project.
- It must not connect to GN authentication, databases, APIs, customer data, or production data.
- AI review is represented as AI cross-validation, never expert review.
- Published evidence, AI-verified extraction, and model inference remain distinct.
- The monthly paid-AI budget defaults to exactly USD 50.00 and is a hard stop.
- No secret or API key may be committed to the project.
- Python 3.9.6 on the current machine must remain supported.
- SQLite is the only persistence dependency in Phase 1.
- The current complement simulation behavior must not change.

## File Structure

- Create `literature_service/__init__.py`: package marker and service version.
- Create `literature_service/config.py`: environment-backed immutable settings.
- Create `literature_service/database.py`: SQLite connection and schema lifecycle.
- Create `literature_service/budget.py`: usage recording and monthly hard-stop policy.
- Create `literature_service/schemas.py`: API response and usage request models.
- Create `literature_service/main.py`: FastAPI application and endpoints.
- Create `tests/conftest.py`: isolated temporary database fixtures.
- Create `tests/test_config.py`: configuration behavior.
- Create `tests/test_database.py`: schema and persistence behavior.
- Create `tests/test_budget.py`: budget arithmetic and hard-stop behavior.
- Create `tests/test_api.py`: health, budget, and usage endpoint contracts.
- Create `requirements-literature.txt`: bounded service/test dependencies.
- Create `.env.example`: non-secret configuration example.
- Create `run-literature-service.sh`: one-command local startup.
- Create `src/literatureService.js`: browser client with offline fallback.
- Modify `index.html`: Literature Intelligence foundation/status panel.
- Modify `src/app.js`: initialize and refresh the status panel.
- Modify `src/styles.css`: responsive status panel styling.
- Modify `README.md`: setup, run, boundaries, and Phase 1 behavior.

---

### Task 1: Configuration Contract

**Files:**
- Create: `literature_service/__init__.py`
- Create: `literature_service/config.py`
- Create: `tests/test_config.py`
- Create: `requirements-literature.txt`
- Create: `.env.example`

**Interfaces:**
- Consumes: environment variables `FLEDA_LITERATURE_DB`, `FLEDA_AI_MONTHLY_BUDGET_USD`, `FLEDA_LITERATURE_HOST`, and `FLEDA_LITERATURE_PORT`.
- Produces: `Settings.from_env() -> Settings` with `database_path: Path`, `monthly_budget_usd: Decimal`, `host: str`, `port: int`, and `cors_origins: tuple[str, ...]`.

- [x] **Step 1: Write configuration tests**

```python
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
    assert settings.cors_origins == ("http://127.0.0.1:8788", "http://localhost:8788")


def test_settings_reject_non_positive_budget(monkeypatch):
    monkeypatch.setenv("FLEDA_AI_MONTHLY_BUDGET_USD", "0")

    with pytest.raises(ValueError, match="greater than zero"):
        Settings.from_env()
```

- [x] **Step 2: Run the tests and verify the missing-module failure**

Run: `python3 -m pytest tests/test_config.py -v`

Expected: FAIL because `literature_service.config` does not exist.

- [x] **Step 3: Implement immutable environment-backed settings**

```python
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
import os
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    database_path: Path
    monthly_budget_usd: Decimal
    host: str
    port: int
    cors_origins: tuple[str, ...]

    @classmethod
    def from_env(cls) -> "Settings":
        try:
            budget = Decimal(os.getenv("FLEDA_AI_MONTHLY_BUDGET_USD", "50.00"))
        except InvalidOperation as exc:
            raise ValueError("FLEDA_AI_MONTHLY_BUDGET_USD must be a decimal") from exc
        if budget <= 0:
            raise ValueError("FLEDA_AI_MONTHLY_BUDGET_USD must be greater than zero")
        port = int(os.getenv("FLEDA_LITERATURE_PORT", "8790"))
        if not 1 <= port <= 65535:
            raise ValueError("FLEDA_LITERATURE_PORT must be between 1 and 65535")
        return cls(
            database_path=Path(os.getenv("FLEDA_LITERATURE_DB", "data/literature.db")),
            monthly_budget_usd=budget.quantize(Decimal("0.01")),
            host=os.getenv("FLEDA_LITERATURE_HOST", "127.0.0.1"),
            port=port,
            cors_origins=("http://127.0.0.1:8788", "http://localhost:8788"),
        )
```

Set `__version__ = "0.1.0"` in `literature_service/__init__.py`. Add these bounded dependencies to `requirements-literature.txt`:

```text
fastapi>=0.115,<1
uvicorn>=0.30,<1
pydantic>=2.8,<3
pytest>=8,<9
httpx>=0.27,<1
```

Add only non-secret values to `.env.example`:

```text
FLEDA_LITERATURE_DB=data/literature.db
FLEDA_AI_MONTHLY_BUDGET_USD=50.00
FLEDA_LITERATURE_HOST=127.0.0.1
FLEDA_LITERATURE_PORT=8790
```

- [x] **Step 4: Run configuration tests**

Run: `python3 -m pytest tests/test_config.py -v`

Expected: 2 tests PASS.

- [x] **Step 5: Record the change**

Because the current project is not a Git repository, record completion by checking this task in the plan. If Git is initialized later, commit with `feat: add literature service configuration`.

---

### Task 2: SQLite Schema and Database Lifecycle

**Files:**
- Create: `literature_service/database.py`
- Create: `tests/conftest.py`
- Create: `tests/test_database.py`

**Interfaces:**
- Consumes: `Settings.database_path`.
- Produces: `Database(path: Path)`, `Database.initialize() -> None`, `Database.connect() -> sqlite3.Connection`, and schema version `1`.

- [x] **Step 1: Write schema lifecycle tests**

```python
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

    assert {"schema_version", "ai_usage_events", "service_events"} <= names
    assert version == 1


def test_initialize_is_idempotent(tmp_path):
    database = Database(tmp_path / "literature.db")
    database.initialize()
    database.initialize()

    with database.connect() as connection:
        count = connection.execute("SELECT COUNT(*) FROM schema_version").fetchone()[0]

    assert count == 1
```

- [x] **Step 2: Run database tests and verify failure**

Run: `python3 -m pytest tests/test_database.py -v`

Expected: FAIL because `literature_service.database` does not exist.

- [x] **Step 3: Implement transactional schema initialization**

Create a `Database` class that creates the parent directory, opens SQLite with `row_factory = sqlite3.Row`, enables foreign keys, and applies this version-1 schema inside a transaction:

```sql
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_usage_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    occurred_at TEXT NOT NULL,
    billing_month TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    task_type TEXT NOT NULL,
    document_id TEXT,
    input_tokens INTEGER NOT NULL CHECK (input_tokens >= 0),
    output_tokens INTEGER NOT NULL CHECK (output_tokens >= 0),
    cost_usd_micros INTEGER NOT NULL CHECK (cost_usd_micros >= 0),
    request_id TEXT UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_billing_month
ON ai_usage_events (billing_month);

CREATE TABLE IF NOT EXISTS service_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    occurred_at TEXT NOT NULL,
    level TEXT NOT NULL,
    event_type TEXT NOT NULL,
    message TEXT NOT NULL,
    details_json TEXT NOT NULL DEFAULT '{}'
);
```

Insert schema version `1` with `INSERT OR IGNORE`. Store timestamps as UTC ISO 8601 strings.

- [x] **Step 4: Run database tests**

Run: `python3 -m pytest tests/test_database.py -v`

Expected: 2 tests PASS.

- [x] **Step 5: Record the change**

Check this task in the plan. If Git is initialized later, commit with `feat: add literature database schema`.

---

### Task 3: Auditable Budget Guard

**Files:**
- Create: `literature_service/budget.py`
- Create: `tests/test_budget.py`

**Interfaces:**
- Consumes: `Database`, monthly limit as `Decimal`, and UTC timestamps.
- Produces: `UsageEvent`, `BudgetStatus`, `BudgetExceededError`, `BudgetGuard.get_status(at=None)`, `BudgetGuard.authorize(estimated_cost_usd, at=None)`, and `BudgetGuard.record_usage(event)`.

- [x] **Step 1: Write budget behavior tests**

```python
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
    guard.record_usage(UsageEvent(
        occurred_at=NOW,
        provider="openai",
        model="extraction-model",
        task_type="extract",
        document_id="PMID:123",
        input_tokens=1000,
        output_tokens=200,
        cost_usd=Decimal("1.234567"),
        request_id="request-1",
    ))

    status = guard.get_status(NOW)

    assert status.spent_usd == Decimal("1.234567")
    assert status.remaining_usd == Decimal("48.765433")
    assert status.allowed is True


def test_authorize_blocks_request_that_would_cross_limit(tmp_path):
    guard = make_guard(tmp_path)
    guard.record_usage(UsageEvent(
        occurred_at=NOW,
        provider="openai",
        model="review-model",
        task_type="review",
        document_id="PMID:456",
        input_tokens=1000,
        output_tokens=200,
        cost_usd=Decimal("49.75"),
        request_id="request-2",
    ))

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
```

- [x] **Step 2: Run budget tests and verify failure**

Run: `python3 -m pytest tests/test_budget.py -v`

Expected: FAIL because `literature_service.budget` does not exist.

- [x] **Step 3: Implement the budget types and guard**

Use frozen dataclasses:

```python
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
```

Store cost as integer millionths of a dollar. Derive `billing_month` as UTC `YYYY-MM`. `authorize()` must reject negative estimates and raise `BudgetExceededError` when `spent + estimate > limit`. `record_usage()` must reject negative token counts or cost, use `INSERT OR IGNORE` on `request_id`, then return current status.

- [x] **Step 4: Run budget tests**

Run: `python3 -m pytest tests/test_budget.py -v`

Expected: 3 tests PASS.

- [x] **Step 5: Record the change**

Check this task in the plan. If Git is initialized later, commit with `feat: enforce literature AI budget`.

---

### Task 4: Health and Budget API

**Files:**
- Create: `literature_service/schemas.py`
- Create: `literature_service/main.py`
- Create: `tests/test_api.py`

**Interfaces:**
- Consumes: `Settings`, `Database`, `BudgetGuard`, and `UsageEvent`.
- Produces: `create_app(settings: Optional[Settings] = None) -> FastAPI` and endpoints `GET /api/health`, `GET /api/budget`, `POST /api/budget/authorize`, and `POST /api/usage`.

- [x] **Step 1: Write API contract tests**

```python
from decimal import Decimal

from fastapi.testclient import TestClient

from literature_service.config import Settings
from literature_service.main import create_app


def make_client(tmp_path):
    settings = Settings(
        database_path=tmp_path / "literature.db",
        monthly_budget_usd=Decimal("50.00"),
        host="127.0.0.1",
        port=8790,
        cors_origins=("http://127.0.0.1:8788",),
    )
    return TestClient(create_app(settings))


def test_health_reports_standalone_service(tmp_path):
    response = make_client(tmp_path).get("/api/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "fleda-complement-literature",
        "version": "0.1.0",
        "database": "ready",
        "data_boundary": "standalone_fleda_no_gn_connections",
    }


def test_budget_endpoint_reports_default_limit(tmp_path):
    response = make_client(tmp_path).get("/api/budget")

    assert response.status_code == 200
    body = response.json()
    assert body["limit_usd"] == "50.00"
    assert body["spent_usd"] == "0.000000"
    assert body["allowed"] is True


def test_authorize_returns_402_when_estimate_exceeds_limit(tmp_path):
    response = make_client(tmp_path).post(
        "/api/budget/authorize",
        json={"estimated_cost_usd": "50.01"},
    )

    assert response.status_code == 402
    assert response.json()["detail"]["code"] == "monthly_budget_exceeded"
```

- [x] **Step 2: Run API tests and verify failure**

Run: `python3 -m pytest tests/test_api.py -v`

Expected: FAIL because `literature_service.main` does not exist.

- [x] **Step 3: Implement typed API schemas and application factory**

Use Pydantic models with decimal strings serialized exactly, not binary floats. Initialize the database in `create_app()`. Add CORS only for `settings.cors_origins`. Return HTTP 402 with structured detail when authorization fails. Reject usage records whose timestamp lacks a timezone or whose monetary/token fields are negative.

The usage request schema must contain:

```python
class UsageRequest(BaseModel):
    occurred_at: datetime
    provider: str = Field(min_length=1, max_length=80)
    model: str = Field(min_length=1, max_length=120)
    task_type: Literal["extract", "review", "embedding", "other"]
    document_id: str | None = Field(default=None, max_length=160)
    input_tokens: int = Field(ge=0)
    output_tokens: int = Field(ge=0)
    cost_usd: Decimal = Field(ge=0)
    request_id: str = Field(min_length=1, max_length=160)
```

Because Python 3.9 is required, use `Optional[str]` in executable code instead of the `str | None` example syntax.

- [x] **Step 4: Run API tests**

Run: `python3 -m pytest tests/test_api.py -v`

Expected: 3 tests PASS.

- [x] **Step 5: Run all backend tests**

Run: `python3 -m pytest tests -v`

Expected: 10 tests PASS.

- [x] **Step 6: Record the change**

Check this task in the plan. If Git is initialized later, commit with `feat: expose literature service health and budget API`.

---

### Task 5: One-Command Local Startup

**Files:**
- Create: `run-literature-service.sh`
- Modify: `.gitignore`
- Test: `tests/test_api.py`

**Interfaces:**
- Consumes: installed requirements and environment-backed `Settings`.
- Produces: executable startup command serving `literature_service.main:app` on the configured local host and port.

- [x] **Step 1: Add a startup-import test**

```python
def test_module_exposes_default_app():
    from literature_service.main import app

    assert app.title == "Fleda Complement Literature Service"
```

- [x] **Step 2: Run the import test**

Run: `python3 -m pytest tests/test_api.py::test_module_exposes_default_app -v`

Expected: PASS after Task 4, proving the command target exists.

- [x] **Step 3: Add the startup script**

```sh
#!/bin/sh
set -eu

exec python3 -m uvicorn literature_service.main:app \
  --host "${FLEDA_LITERATURE_HOST:-127.0.0.1}" \
  --port "${FLEDA_LITERATURE_PORT:-8790}"
```

Make it executable. Add these entries to `.gitignore` without removing existing rules:

```text
.env
.venv/
__pycache__/
.pytest_cache/
data/*.db
data/*.db-shm
data/*.db-wal
```

- [x] **Step 4: Start the service and inspect health**

Run: `./run-literature-service.sh`

In another terminal run: `curl -s http://127.0.0.1:8790/api/health`

Expected: JSON with `"status":"ok"`, `"database":"ready"`, and the standalone Fleda data boundary.

- [x] **Step 5: Record the change**

Check this task in the plan. If Git is initialized later, commit with `chore: add literature service launcher`.

---

### Task 6: Frontend Service and Budget Status Panel

**Files:**
- Create: `src/literatureService.js`
- Modify: `index.html`
- Modify: `src/app.js`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `GET http://127.0.0.1:8790/api/health` and `GET http://127.0.0.1:8790/api/budget`.
- Produces: `getLiteratureServiceStatus()` returning `{ online, health, budget, error }` and a non-blocking Literature Intelligence foundation panel.

- [x] **Step 1: Implement a browser client with an offline result**

```javascript
const SERVICE_BASE_URL = "http://127.0.0.1:8790";

export async function getLiteratureServiceStatus(fetchImpl = fetch) {
  try {
    const [healthResponse, budgetResponse] = await Promise.all([
      fetchImpl(`${SERVICE_BASE_URL}/api/health`),
      fetchImpl(`${SERVICE_BASE_URL}/api/budget`)
    ]);
    if (!healthResponse.ok || !budgetResponse.ok) {
      throw new Error("Literature service returned an error");
    }
    return {
      online: true,
      health: await healthResponse.json(),
      budget: await budgetResponse.json(),
      error: null
    };
  } catch (error) {
    return {
      online: false,
      health: null,
      budget: null,
      error: error instanceof Error ? error.message : "Service unavailable"
    };
  }
}
```

- [x] **Step 2: Add the Literature Intelligence foundation panel**

Place a new full-width section after `#model-roadmap`. It contains:

- Eyebrow: `LITERATURE INTELLIGENCE V1`
- Heading: `Evidence integration foundation`
- Service status value with id `literature-service-status`
- Database status value with id `literature-database-status`
- Monthly usage value with id `literature-budget-usage`
- Budget progress bar with id `literature-budget-progress`
- Boundary value: `Standalone Fleda service · No GN connections`
- Refresh icon button with id `refresh-literature-status`, accessible label, and tooltip
- Explanatory copy that Phase 1 provides infrastructure and does not yet import papers

- [x] **Step 3: Initialize panel state from `src/app.js`**

Import `getLiteratureServiceStatus`. Add `initLiteratureServicePanel()` that renders `Checking...`, fetches status, and then renders either:

- Online: `Online`, database `Ready`, `$spent / $limit`, and progress width clamped to 100 percent.
- Offline: `Offline`, database `Unavailable`, `$0.00 / $50.00`, zero progress, and a short message to start the local literature service.

The refresh button calls the same function. Failure must not interrupt the existing simulation initialization.

- [x] **Step 4: Add responsive styles**

Use the existing dark scientific UI vocabulary. Implement a four-column status grid on wide screens and one column below 760px. Use a restrained green status dot for online, amber for offline, and red only when the budget is blocked. Keep card radius at 8px or less and do not nest cards.

- [x] **Step 5: Bust the application module cache**

Change the module query string in `index.html` from `v=20260602-biomarker2` to `v=20260826-literature-phase1`.

- [x] **Step 6: Verify both frontend states**

With the service stopped, load `http://127.0.0.1:8788` and confirm the panel says Offline while all existing simulations still work.

With the service running, refresh the status and confirm Online, Ready, `$0.00 / $50.00`, and a zero-width usage bar.

- [x] **Step 7: Record the change**

Check this task in the plan. If Git is initialized later, commit with `feat: show literature service readiness`.

---

### Task 7: Documentation and Phase 1 Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-08-26-literature-intelligence-phase-1.md`

**Interfaces:**
- Consumes: all Phase 1 commands and public interfaces.
- Produces: reproducible local setup instructions and a completed verification record.

- [x] **Step 1: Document setup and operation**

Add a `Literature Intelligence Service` section to `README.md` containing these commands:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-literature.txt
./run-literature-service.sh
```

Document the API URL `http://127.0.0.1:8790`, the USD 50 default hard limit, local SQLite path, `.env.example`, offline frontend behavior, and the fact that Phase 1 does not yet retrieve papers or call an AI API.

- [x] **Step 2: Run the complete backend suite**

Run: `.venv/bin/python -m pytest tests -v`

Expected: all 11 tests PASS, including the startup-import test.

- [x] **Step 3: Run syntax checks for changed browser modules**

Run: `node --check src/app.js`

Run: `node --check src/literatureService.js`

Expected: both commands exit successfully with no output.

- [x] **Step 4: Verify service APIs manually**

Run: `curl -s http://127.0.0.1:8790/api/health`

Run: `curl -s http://127.0.0.1:8790/api/budget`

Expected: health reports ready and budget reports limit `50.00`, zero spend, and `allowed: true`.

- [x] **Step 5: Verify the application visually**

Open `http://127.0.0.1:8788`, inspect desktop and mobile widths, and verify that the status panel has no overlap, the refresh control works, and the Live Dynamics Window remains functional.

- [x] **Step 6: Complete the plan checklist**

Check every completed step in this file. Record any intentionally deferred item with its reason; do not mark an unverified item complete.

## Phase 1 Exit Criteria

- The local service starts on `127.0.0.1:8790`.
- SQLite schema version 1 initializes idempotently.
- AI usage costs are stored as integer micro-dollars.
- Duplicate request IDs cannot double-charge the budget.
- Requests that would exceed USD 50 in the current UTC month are rejected.
- Health and budget APIs are typed and tested.
- The existing frontend shows online and offline states without breaking simulations.
- No GN system or data connection exists.
- No AI provider is called and no API key is required in Phase 1.
