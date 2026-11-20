#!/bin/sh
# Runs the Thunderbird add-on linter (github.com/thunderbird/webext-linter) on the built package –
# the automated review that the ATN reviewers run and recommend before submitting. It finds what
# Mozilla's addons-linter can't: unused permissions and files, Thunderbird API misuse, unsafe HTML,
# cleartext transmission, plus ESLint code-sanity checks (--eslint).
#   sh scripts/build.sh && sh scripts/tb-lint.sh            # dist/ai-mail-cleaner-<version>.xpi
#   sh scripts/tb-lint.sh path/to/other.xpi
# Exit code: 0 ok · 1 a finding that would reject or hold the review (warnings count, see
# --warnings-as-errors) · 2 tool failure. Hints ("information") and items for the reviewer's manual
# review are printed but don't fail.
#
# The linter is not on npm: it is cloned at a fixed commit into .cache/ (git-ignored) and its
# dependencies are installed from its lock file without install scripts. Update the commit on
# purpose (and read the linter's changelog): WEBEXT_LINTER_REF below.
set -e
cd "$(dirname "$0")/.."
ROOT=$(pwd)

WEBEXT_LINTER_REPO=https://github.com/thunderbird/webext-linter
WEBEXT_LINTER_REF=ca17816036445997a55ba89452bc6517b49c02a4 # 2.7.2, 2026-11-17

VERSION=$(sed -n 's/^ *"version": *"\([^"]*\)".*/\1/p' src/manifest.json | head -1)
XPI=${1:-dist/ai-mail-cleaner-$VERSION.xpi}
[ -f "$XPI" ] || { echo "Not found: $XPI – run 'npm run build' first" >&2; exit 2; }
XPI=$(cd "$(dirname "$XPI")" && pwd)/$(basename "$XPI")

CACHE=$ROOT/.cache
LINTER=$CACHE/webext-linter
mkdir -p "$CACHE"
if [ ! -d "$LINTER/.git" ]; then
  echo "Fetching webext-linter …"
  git -c advice.detachedHead=false clone --quiet --filter=blob:none "$WEBEXT_LINTER_REPO" "$LINTER"
fi
if [ "$(git -C "$LINTER" rev-parse HEAD)" != "$WEBEXT_LINTER_REF" ]; then
  git -C "$LINTER" fetch --quiet origin
  git -C "$LINTER" -c advice.detachedHead=false checkout --quiet "$WEBEXT_LINTER_REF"
  rm -rf "$LINTER/node_modules"
fi
if [ ! -d "$LINTER/node_modules" ]; then
  echo "Installing webext-linter dependencies (no install scripts) …"
  (cd "$LINTER" && npm ci --ignore-scripts --omit=dev --no-audit --no-fund --loglevel=error)
fi

# The linter unpacks the package next to it and keeps its download cache in the working folder:
# lint a copy in .cache/review/ (a real file – it refuses symlinks), so both stay out of dist/.
REVIEW=$CACHE/review
rm -rf "$REVIEW"
mkdir -p "$REVIEW"
cp "$XPI" "$REVIEW/"
cd "$CACHE"
REPORT=$CACHE/tb-lint-report.txt
STATUS=0
# --cdn-lib-lookup false: the add-on bundles no libraries, so no need to ask jsDelivr
node "$LINTER/verify.js" "$REVIEW/$(basename "$XPI")" --eslint --warnings-as-errors --cdn-lib-lookup false > "$REPORT" 2>&1 || STATUS=$?

# What concerns this add-on: the verdict, the items flagged for a closer look, the counts. Left
# out: the per-check log and the generic checklists every review goes through (in the report).
findings() {
  sed -n '/^── Found Issues ──/,/^── Standard Code Review ──/p' "$REPORT" | sed '$d'
  sed -n '/^── Summary ──/,$p' "$REPORT"
}
if grep -q '^── Found Issues ──' "$REPORT"; then findings; else cat "$REPORT"; fi
echo
echo "Full report: $REPORT"

if [ -n "$GITHUB_STEP_SUMMARY" ]; then
  {
    echo "### Thunderbird add-on linter (webext-linter)"
    echo
    echo '```'
    if grep -q '^── Found Issues ──' "$REPORT"; then findings; else tail -40 "$REPORT"; fi
    echo '```'
    echo
    echo "Full report incl. the reviewers' manual checklist: artifact *webext-linter-report*."
  } >> "$GITHUB_STEP_SUMMARY"
fi

case $STATUS in
  0) echo "OK – webext-linter: nothing that would reject the review" ;;
  1) echo "webext-linter: findings that would reject the review (see above)" >&2 ;;
  *) echo "webext-linter failed (exit $STATUS)" >&2 ;;
esac
exit $STATUS
