#!/usr/bin/env bash
# check-bots.sh — health check for the lala.la Telegram bots + API surface.
#
# Run this on Replit (where TELEGRAM_BOT_TOKEN_LALA / TELEGRAM_BOT_TOKEN_FAN_TWIN
# and the deployed URL live). It never prints token values — only bot identity,
# webhook wiring, and API reachability — so it is safe to paste the output back.
#
# Usage:
#   bash scripts/check-bots.sh
#   APP_URL=https://<your>.replit.app bash scripts/check-bots.sh   # also probes the API
#
# Exit code: 0 if every checked bot token is valid; 1 otherwise.

set -uo pipefail

fail=0

check_bot() {
  local name="$1" tok="$2"
  echo "=== ${name} ==="
  if [ -z "${tok}" ]; then
    echo "  token: MISSING (set the secret in Replit)"
    fail=1
    return
  fi

  # getMe — token valid + bot @username
  curl -s --max-time 10 "https://api.telegram.org/bot${tok}/getMe" \
  | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    print("  getMe: NO RESPONSE (network / curl failure)"); sys.exit(2)
if d.get("ok"):
    r = d["result"]
    print(f"  getMe: @{r.get(\"username\")} (id {r.get(\"id\")}) — token valid")
else:
    print("  getMe: INVALID TOKEN —", d.get("description")); sys.exit(2)
' || fail=1

  # getWebhookInfo — is it wired to a running server?
  curl -s --max-time 10 "https://api.telegram.org/bot${tok}/getWebhookInfo" \
  | python3 -c '
import sys, json
d = json.load(sys.stdin).get("result", {})
url = d.get("url") or ""
print("  webhook url:", url if url else "(none — long-poll dev mode or process not running)")
print("  pending updates:", d.get("pending_update_count", "?"),
      "| last error:", d.get("last_error_message", "none"))
if url and d.get("last_error_message"):
    print("  ⚠ webhook is set but the server returned an error — bot registered but endpoint is failing")
'
}

check_bot "Lala bot (Hermes — creator onboarding)" "${TELEGRAM_BOT_TOKEN_LALA:-}"
check_bot "Fan-twin bot (Claire's twin — fans)"     "${TELEGRAM_BOT_TOKEN_FAN_TWIN:-}"

# Optional: probe the API surface if APP_URL is provided.
if [ -n "${APP_URL:-}" ]; then
  echo "=== API surface (${APP_URL}) ==="
  for path in "/health" "/api/health"; do
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${APP_URL}${path}" 2>/dev/null)
    echo "  GET ${path} -> HTTP ${code}"
  done
fi

echo
if [ "${fail}" -eq 0 ]; then
  echo "✓ All checked bot tokens are valid. (A valid token ≠ the bot process is running — confirm via the webhook url + pending/last_error lines above.)"
else
  echo "✗ One or more bots have a missing/invalid token — fix the Replit secret and re-run."
fi
exit "${fail}"
