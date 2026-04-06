#!/usr/bin/env bash
# Redeploy Web app deployments (authenticator + token broker): push → version → deploy.
#
# Same profile as **clasp-cc** (`clasp -A ~/.clasp/cc.clasprc.json`). Uses
# **scripts/clasp-cc** so non-interactive shells (no alias) still match clasp-cc.
#
# Usage (from Token Triangle repo root):
#   ./scripts/redeploy-web-apps.sh "short description"
#
# Or run the same **clasp-cc** steps by hand under apps/authenticator and apps/token-broker.
# Requires: python3, scripts/tt-deploy-ids.json

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IDS="$ROOT/scripts/tt-deploy-ids.json"
CC="$ROOT/scripts/clasp-cc"
MSG="${1:-redeploy web apps}"

if [[ ! -x "$CC" ]]; then
  echo "Missing or not executable: $CC" >&2
  exit 1
fi
if [[ ! -f "$IDS" ]]; then
  echo "Missing $IDS — copy scripts/tt-deploy-ids.example.json and fill ids." >&2
  exit 1
fi

AUTH_ID="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['authenticatorDeploymentId'])" "$IDS")"
BROKER_ID="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['tokenBrokerDeploymentId'])" "$IDS")"

redeploy_one() {
  local label=$1 dir=$2 dep=$3
  echo ""
  echo "=== $label ($dir) ==="
  (cd "$ROOT/$dir" && "$CC" push --force)
  local out ver
  out="$(cd "$ROOT/$dir" && "$CC" version "$MSG" 2>&1)"
  printf '%s\n' "$out"
  ver="$(printf '%s' "$out" | sed -n 's/.*Created version \([0-9][0-9]*\).*/\1/p')"
  if [[ -z "$ver" ]]; then
    echo "Could not parse Created version N from clasp output" >&2
    exit 1
  fi
  (cd "$ROOT/$dir" && "$CC" deploy -i "$dep" -V "$ver" -d "$MSG")
  echo "$label — deployed Web app @ version $ver"
}

redeploy_one "Authenticator" "apps/authenticator" "$AUTH_ID"
redeploy_one "Token broker" "apps/token-broker" "$BROKER_ID"
echo ""
echo "Done."
