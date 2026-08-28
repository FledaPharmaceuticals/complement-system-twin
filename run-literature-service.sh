#!/bin/sh
set -eu

exec .venv/bin/python -m uvicorn literature_service.main:app \
  --host "${FLEDA_LITERATURE_HOST:-127.0.0.1}" \
  --port "${FLEDA_LITERATURE_PORT:-8790}"
