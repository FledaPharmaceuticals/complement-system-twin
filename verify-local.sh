#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

PYTHON=${PYTHON:-.venv/bin/python}
PYTHONPYCACHEPREFIX=${PYTHONPYCACHEPREFIX:-/tmp/fleda-pycache}
export PYTHONPYCACHEPREFIX

"$PYTHON" -m pytest tests -q
"$PYTHON" -m py_compile literature_service/*.py
"$PYTHON" -m json.tool docs/product/validation-intake-template.json >/dev/null

grep -q 'workflow_dispatch:' .github/workflows/public-literature-ingestion.yml
grep -q 'schedule:' .github/workflows/public-literature-ingestion.yml
grep -q 'contents: read' .github/workflows/public-literature-ingestion.yml
printf '%s\n' 'Fleda local verification passed.'
