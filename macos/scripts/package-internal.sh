#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
APP_NAME="XTRI Cronogramas"
APP_DIR="$DIST_DIR/$APP_NAME.app"
ZIP_PATH="$DIST_DIR/XTRI-Cronogramas-macOS-interno.zip"

cd "$ROOT_DIR"

"$ROOT_DIR/scripts/package-app.sh" release >/dev/null

rm -f "$ZIP_PATH"
ditto -c -k --keepParent "$APP_DIR" "$ZIP_PATH"

echo "$ZIP_PATH"
