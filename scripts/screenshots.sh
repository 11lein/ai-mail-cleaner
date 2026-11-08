#!/bin/sh
# Store screenshots (sample data from dev/mock-messenger.js only – no real mailboxes).
# Requires the dev server (sh scripts/dev.sh) and Google Chrome.
#   sh scripts/screenshots.sh               → store/screenshots/*.png (English UI)
#   LANG_UI=de sh scripts/screenshots.sh    → German UI, files with a -de suffix
set -e
cd "$(dirname "$0")/.."
PORT="${PORT:-8799}"
UI="${LANG_UI:-en}"
SUFFIX=""; [ "$UI" != "en" ] && SUFFIX="-$UI"
BASE="http://127.0.0.1:$PORT/src/ui/_dev.html"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
OUT=store/screenshots
mkdir -p "$OUT"

shot() { # name query [extra chrome flags]
  name=$1; query=$2; shift 2
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --no-first-run \
    --user-data-dir="$(mktemp -d)" --window-size=1280,800 --force-device-scale-factor=1 \
    --lang="$UI" --virtual-time-budget=8000 "$@" \
    --screenshot="$OUT/$name$SUFFIX.png" "$BASE?lang=$UI&$query" >/dev/null 2>&1
  echo "  $OUT/$name$SUFFIX.png"
}

echo "Screenshots ($UI):"
shot 01-overview     "n=60&shot=main"
shot 02-spam-filter  "n=60&shot=select"
shot 03-newsletter   "shot=newsletter"
shot 04-preview      "shot=preview"
shot 05-model-picker "shot=picker"
shot 06-ollama       "shot=ollama"
shot 07-scan-dialog  "n=300&shot=scan"
shot 08-dark         "n=60&shot=main" --force-dark-mode --blink-settings=preferredColorScheme=0
