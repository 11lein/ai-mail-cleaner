#!/bin/sh
# Quick checks without Thunderbird (also run in CI):
#   - every script parses (node --check)
#   - src/manifest.json and package.json carry the same version
#   sh scripts/check.sh
set -e
cd "$(dirname "$0")/.."

for f in src/*.js src/ui/*.js scripts/i18n/*.mjs dev/*.js; do
  node --check "$f" || { echo "Syntax error: $f" >&2; exit 1; }
done

ver() { sed -n 's/^ *"version": *"\([^"]*\)".*/\1/p' "$1" | head -1; }
MV=$(ver src/manifest.json)
PV=$(ver package.json)
[ -n "$MV" ] && [ "$MV" = "$PV" ] || { echo "Version mismatch: src/manifest.json $MV, package.json $PV" >&2; exit 1; }

echo "OK – syntax, version $MV"
