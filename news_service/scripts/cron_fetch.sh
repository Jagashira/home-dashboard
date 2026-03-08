#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
. ./.venv/bin/activate
python -m app.scheduler >> ./data/fetch.log 2>&1

