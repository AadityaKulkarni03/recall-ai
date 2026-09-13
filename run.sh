#!/usr/bin/env bash
# Loads credentials from .env and runs the query script inside the venv.
# Usage: ./run.sh "your query here"
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
  echo "Missing .env (expected MOSS_PROJECT_ID and MOSS_PROJECT_KEY)." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

exec .venv/bin/python query_index.py "$@"
