#!/bin/sh
# Baut das installierbare/hochladbare Paket: dist/ai-mail-cleaner-<version>.xpi
#   sh scripts/build.sh
# Die Version kommt aus src/manifest.json. Dev-Dateien (Mock, _dev.html) werden
# nicht mitgepackt.
set -e
cd "$(dirname "$0")/.."

VERSION=$(sed -n 's/^ *"version": *"\([^"]*\)".*/\1/p' src/manifest.json | head -1)
[ -n "$VERSION" ] || { echo "Version not found in src/manifest.json" >&2; exit 1; }
OUT="dist/ai-mail-cleaner-$VERSION.xpi"

# Pflicht-Icons vorhanden?
for s in 16 32 48 64 96 128; do
  [ -f "src/icons/icon-$s.png" ] || { echo "Missing: src/icons/icon-$s.png (see scripts/icons.sh)" >&2; exit 1; }
done

mkdir -p dist
rm -f "$OUT"
(cd src && zip -q -r -X "../$OUT" . \
  -x '*.DS_Store' -x 'ui/_dev.html' -x '*/.*' -x '.*')

echo "Built: $OUT"
unzip -l "$OUT" | tail -n +4 | sed '$d' | sed '$d' | awk '{print "  " $4}'
