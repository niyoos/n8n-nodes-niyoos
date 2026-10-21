#!/usr/bin/env bash
# Run n8n's community-package scanner against a PUBLISHED version and decide
# from its OUTPUT, never its exit code.
#
# Why: measured 2026-10-21, `npx @n8n/scan-community-package` exits 0 even when
# it reports "❌ … has failed security checks". A step that trusted the exit code
# would be green on a package n8n will refuse. (It also cannot extract the
# attested source on Windows — run it on Linux.)
#
# Usage: scripts/scan-published.sh <package>[@<version>]
# Exit 0 only when the output carries a pass marker and no failure marker.
set -uo pipefail

target="${1:?usage: scan-published.sh <package>[@version]}"
out="$(mktemp)"

npx -y @n8n/scan-community-package "$target" 2>&1 | tee "$out"
echo "(scanner exit code, NOT used for the verdict: ${PIPESTATUS[0]})"

if grep -Eiq '❌|failed security checks|could not fetch|error' "$out"; then
  echo "::error::Scanner reported a failure for $target (see output above)."
  exit 1
fi
# The pass wording ("has passed" / "passed all") is INFERRED — no package of
# ours has passed yet. "Provenance check passed" alone is NOT a pass. Any
# output without an explicit pass marker is treated as a failure, not a pass.
if ! grep -Eiq 'has passed|passed all' "$out"; then
  echo "::error::Scanner output for $target has no pass marker; refusing to call it a pass."
  exit 1
fi
echo "Scanner passed for $target."
