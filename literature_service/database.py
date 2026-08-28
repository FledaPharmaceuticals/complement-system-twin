"""SQLite lifecycle for the standalone literature service."""

from datetime import datetime, timezone
from pathlib import Path
import sqlite3
import json

from .normalization import normalize_public_record


SCHEMA_VERSION = 4

SCHEMA_SQL = """
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

CREATE TABLE IF NOT EXISTS literature_records (
    id TEXT PRIMARY KEY,
    source_locator TEXT NOT NULL,
    title TEXT NOT NULL,
    evidence_level TEXT NOT NULL,
    uncertainty TEXT NOT NULL,
    record_json TEXT NOT NULL,
    saved_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_literature_source_locator
ON literature_records (source_locator);

CREATE TABLE IF NOT EXISTS raw_snapshots (
    content_hash TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    locator TEXT NOT NULL,
    query TEXT NOT NULL,
    content_type TEXT NOT NULL,
    content TEXT NOT NULL,
    fetched_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_raw_snapshots_source
ON raw_snapshots (source, fetched_at);

CREATE TABLE IF NOT EXISTS public_annotations (
    id TEXT PRIMARY KEY,
    source_locator TEXT NOT NULL,
    title TEXT NOT NULL,
    record_json TEXT NOT NULL,
    saved_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_public_annotations_source
ON public_annotations (source_locator);

CREATE TABLE IF NOT EXISTS pathway_annotations (
    id TEXT PRIMARY KEY,
    source_locator TEXT NOT NULL,
    title TEXT NOT NULL,
    record_json TEXT NOT NULL,
    saved_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pathway_annotations_source
ON pathway_annotations (source_locator);
"""


class Database:
    def __init__(self, path: Path):
        self.path = Path(path)

    def connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(str(self.path))
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def initialize(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        applied_at = datetime.now(timezone.utc).isoformat()
        with self.connect() as connection:
            connection.executescript(SCHEMA_SQL)
            connection.execute(
                "INSERT OR IGNORE INTO schema_version (version, applied_at) "
                "VALUES (?, ?)",
                (SCHEMA_VERSION, applied_at),
            )

    def upsert_literature_records(self, records) -> int:
        """Persist public evidence metadata without changing model parameters."""
        saved_at = datetime.now(timezone.utc).isoformat()
        with self.connect() as connection:
            for record in records:
                record = normalize_public_record(record)
                existing_row = connection.execute(
                    "SELECT record_json FROM literature_records WHERE id = ?",
                    (record["id"],),
                ).fetchone() or self._find_duplicate_by_identifier(connection, record)
                if existing_row:
                    record = self._merge_literature_records(
                        json.loads(existing_row["record_json"]), record
                    )
                connection.execute(
                    """
                    INSERT INTO literature_records (
                        id, source_locator, title, evidence_level,
                        uncertainty, record_json, saved_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        source_locator=excluded.source_locator,
                        title=excluded.title,
                        evidence_level=excluded.evidence_level,
                        uncertainty=excluded.uncertainty,
                        record_json=excluded.record_json,
                        saved_at=excluded.saved_at
                    """,
                    (
                        record["id"],
                        record["sourceLocator"],
                        record["title"],
                        record["evidenceLevel"],
                        record["uncertainty"],
                        json.dumps(record, sort_keys=True),
                        saved_at,
                    ),
                )
        return len(records)

    @staticmethod
    def _find_duplicate_by_identifier(connection, record):
        incoming_metadata = record.get("metadata") or {}
        incoming_pmid = str(incoming_metadata.get("pmid") or "").strip()
        incoming_doi = str(incoming_metadata.get("doi") or "").strip().lower()
        if not incoming_pmid and not incoming_doi:
            return None
        rows = connection.execute("SELECT record_json FROM literature_records").fetchall()
        for row in rows:
            existing = json.loads(row["record_json"])
            metadata = existing.get("metadata") or {}
            existing_pmid = str(metadata.get("pmid") or "").strip()
            existing_doi = str(metadata.get("doi") or "").strip().lower()
            if (incoming_pmid and incoming_pmid == existing_pmid) or (
                incoming_doi and incoming_doi == existing_doi
            ):
                return row
        return None

    @staticmethod
    def _merge_literature_records(existing, incoming):
        """Merge duplicate public records while preserving source provenance."""
        merged = dict(existing)
        incoming_metadata = dict(incoming.get("metadata") or {})
        existing_metadata = dict(existing.get("metadata") or {})
        providers = set(existing_metadata.get("sourceProviders") or [])
        providers.update(
            item for item in (
                existing_metadata.get("sourceProvider"),
                incoming_metadata.get("sourceProvider"),
            ) if item
        )
        locators = set(existing_metadata.get("sourceLocators") or [])
        locators.update(
            item for item in (
                existing.get("sourceLocator"),
                incoming.get("sourceLocator"),
            ) if item
        )
        merged_metadata = {**existing_metadata, **incoming_metadata}
        if providers:
            merged_metadata["sourceProviders"] = sorted(providers)
        if locators:
            merged_metadata["sourceLocators"] = sorted(locators)
        if existing_metadata.get("abstractAvailable") and not incoming_metadata.get("abstractAvailable"):
            for key in ("abstract", "abstractAvailable"):
                if key in existing_metadata:
                    merged_metadata[key] = existing_metadata[key]
        merged["metadata"] = merged_metadata
        for key, value in incoming.items():
            if value not in (None, "", [], {}):
                merged[key] = value
        merged["id"] = existing.get("id") or incoming.get("id")
        merged["metadata"] = merged_metadata
        merged["linkedEntities"] = sorted({
            *(existing.get("linkedEntities") or []),
            *(incoming.get("linkedEntities") or []),
        })
        return merged

    def list_literature_records(self, limit: int = 100):
        with self.connect() as connection:
            rows = connection.execute(
                "SELECT record_json FROM literature_records ORDER BY saved_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [json.loads(row["record_json"]) for row in rows]

    def save_raw_snapshot(
        self,
        *,
        content_hash: str,
        source: str,
        locator: str,
        query: str,
        content_type: str,
        content: str,
        fetched_at: str = None,
    ) -> bool:
        """Store an immutable public-source response once per content hash."""
        saved_at = fetched_at or datetime.now(timezone.utc).isoformat()
        with self.connect() as connection:
            cursor = connection.execute(
                """
                INSERT OR IGNORE INTO raw_snapshots (
                    content_hash, source, locator, query, content_type,
                    content, fetched_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (content_hash, source, locator, query, content_type, content, saved_at),
            )
        return cursor.rowcount == 1

    def list_raw_snapshots(self, limit: int = 100):
        with self.connect() as connection:
            rows = connection.execute(
                """
                SELECT content_hash, source, locator, query, content_type, fetched_at
                FROM raw_snapshots ORDER BY fetched_at DESC LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [dict(row) for row in rows]

    def upsert_public_annotations(self, records) -> int:
        saved_at = datetime.now(timezone.utc).isoformat()
        with self.connect() as connection:
            for record in records:
                record = normalize_public_record(record)
                connection.execute(
                    """
                    INSERT INTO public_annotations (id, source_locator, title, record_json, saved_at)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        source_locator=excluded.source_locator,
                        title=excluded.title,
                        record_json=excluded.record_json,
                        saved_at=excluded.saved_at
                    """,
                    (
                        record["id"],
                        record["sourceLocator"],
                        record["title"],
                        json.dumps(record, sort_keys=True),
                        saved_at,
                    ),
                )
        return len(records)

    def list_public_annotations(self, limit: int = 100):
        with self.connect() as connection:
            rows = connection.execute(
                "SELECT record_json FROM public_annotations ORDER BY saved_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [json.loads(row["record_json"]) for row in rows]

    def upsert_pathway_annotations(self, records) -> int:
        saved_at = datetime.now(timezone.utc).isoformat()
        with self.connect() as connection:
            for record in records:
                record = normalize_public_record(record)
                connection.execute(
                    """
                    INSERT INTO pathway_annotations (id, source_locator, title, record_json, saved_at)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        source_locator=excluded.source_locator,
                        title=excluded.title,
                        record_json=excluded.record_json,
                        saved_at=excluded.saved_at
                    """,
                    (
                        record["id"],
                        record["sourceLocator"],
                        record["title"],
                        json.dumps(record, sort_keys=True),
                        saved_at,
                    ),
                )
        return len(records)

    def list_pathway_annotations(self, limit: int = 100):
        with self.connect() as connection:
            rows = connection.execute(
                "SELECT record_json FROM pathway_annotations ORDER BY saved_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [json.loads(row["record_json"]) for row in rows]

    def list_knowledge_records(self, limit: int = 100):
        """Read public knowledge layers together while preserving each record type."""
        with self.connect() as connection:
            rows = connection.execute(
                """
                SELECT 'literature' AS knowledge_layer, record_json, saved_at
                FROM literature_records
                UNION ALL
                SELECT 'protein_annotation' AS knowledge_layer, record_json, saved_at
                FROM public_annotations
                UNION ALL
                SELECT 'pathway_annotation' AS knowledge_layer, record_json, saved_at
                FROM pathway_annotations
                ORDER BY saved_at DESC LIMIT ?
                """,
                (limit,),
            ).fetchall()
        records = []
        for row in rows:
            record = json.loads(row["record_json"])
            record["knowledgeLayer"] = row["knowledge_layer"]
            records.append(record)
        return records
