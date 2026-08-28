#!/bin/sh
set -eu

exec .venv/bin/python -m literature_service.ingest "$@"
