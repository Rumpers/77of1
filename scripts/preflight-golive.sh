#!/usr/bin/env bash
# preflight-golive.sh — "are we ready to flip Claire live?" deploy checklist.
#
# Run on Replit AFTER: git pull → pnpm install --frozen-lockfile → restart.
# It is read-only: it inspects env presence (never prints secret values),
# the live DB schema, and bot health, then prints a GO / NO-GO summary mapped
# to the eval-gate + voice runbook (04-04-SUMMARY.md / 03-08-SUMMARY.md).
#
# Usage:
#   bash scripts/preflight-golive.sh
#   APP_URL=https://<your>.replit.app bash scripts/preflight-golive.sh
#
# Exit 0 = all required checks pass; 1 = at least one blocker.

set -uo pipefail
miss=0
ok()   { echo "  ✓ $1"; }
bad()  { echo "  ✗ $1"; miss=1; }
warn() { echo "  • $1"; }

have() { [ -n "${!1:-}" ]; }   # env var set & non-empty?

echo "════════════════════════════════════════════════"
echo " lala.la go-live preflight"
echo "════════════════════════════════════════════════"

echo "── Required secrets (presence only) ──"
# Core runtime
for v in DATABASE_URL REDIS_URL SESSION_SECRET HMAC_CONVERSATION_SECRET \
         GMI_API_KEY OPENAI_API_KEY \
         TELEGRAM_BOT_TOKEN_LALA TELEGRAM_BOT_TOKEN_FAN_TWIN; do
  have "$v" && ok "$v set" || bad "$v MISSING"
done
echo "── Eval-gate + voice secrets (this milestone) ──"
for v in ADMIN_API_TOKEN EVAL_CREATOR_ID VOICE_URL_SIGNING_SECRET \
         GMI_TTS_BASE_URL GMI_TTS_MODEL_ID; do
  have "$v" && ok "$v set" || bad "$v MISSING"
done
have GMI_TTS_FALLBACK_VOICE_ID && ok "GMI_TTS_FALLBACK_VOICE_ID set" \
  || warn "GMI_TTS_FALLBACK_VOICE_ID unset — voice clone falls back to provider default (clone Step A still stubbed)"

# Sanity on a couple of values (no secret leakage)
if have GMI_TTS_MODEL_ID && [ "${GMI_TTS_MODEL_ID}" != "minimax-tts-speech-2.6-hd" ]; then
  warn "GMI_TTS_MODEL_ID='${GMI_TTS_MODEL_ID}' (contract expects minimax-tts-speech-2.6-hd)"
fi
if have GMI_TTS_BASE_URL && ! echo "${GMI_TTS_BASE_URL}" | grep -q "console.gmicloud.ai"; then
  warn "GMI_TTS_BASE_URL='${GMI_TTS_BASE_URL}' (contract expects https://console.gmicloud.ai)"
fi

echo "── Live DB schema (this milestone's migrations) ──"
if have DATABASE_URL && command -v psql >/dev/null 2>&1; then
  q() { psql "${DATABASE_URL}" -tAc "$1" 2>/dev/null | tr -d '[:space:]'; }
  [ "$(q "SELECT to_regclass('public.eval_runs') IS NOT NULL;")" = "t" ] \
    && ok "eval_runs table exists" \
    || bad "eval_runs table MISSING — run: pnpm --filter @workspace/db run push  (migration 013)"
  [ "$(q "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='twins' AND column_name='voice_id');")" = "t" ] \
    && ok "twins.voice_id column exists" \
    || bad "twins.voice_id MISSING — run: pnpm --filter @workspace/db run push  (migration 014)"
  # Is Claire's eval creator present + does an eligible run exist?
  if have EVAL_CREATOR_ID; then
    cnt=$(q "SELECT count(*) FROM eval_runs WHERE creator_id='${EVAL_CREATOR_ID}' AND go_live_eligible=true;")
    [ "${cnt:-0}" -ge 1 ] 2>/dev/null \
      && ok "eligible eval_run found for EVAL_CREATOR_ID (twin can be activated)" \
      || warn "no go_live_eligible eval_run for EVAL_CREATOR_ID yet — run the eval CLI before activating"
  fi
else
  warn "skipping DB checks (psql or DATABASE_URL unavailable in this shell)"
fi

echo "── Bots ──"
if [ -f "$(dirname "$0")/check-bots.sh" ]; then
  bash "$(dirname "$0")/check-bots.sh" | sed 's/^/  /'
else
  warn "scripts/check-bots.sh not found — skip bot check"
fi

if [ -n "${APP_URL:-}" ]; then
  echo "── API surface (${APP_URL}) ──"
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${APP_URL}/health" 2>/dev/null)
  [ "${code}" = "200" ] && ok "GET /health -> 200" || warn "GET /health -> ${code} (check api-server is up on 8080)"
fi

echo "════════════════════════════════════════════════"
if [ "${miss}" -eq 0 ]; then
  cat <<'EOF'
GO: all required preflight checks passed.
Next, per the runbook:
  1. pnpm --filter @workspace/eval run eval        # run 30 cases vs Claire's twin
  2. confirm 100% on hard-limit + prompt-injection (goLiveEligible: true)
  3. POST /api/admin/twin/<EVAL_CREATOR_ID>/activate  (Bearer ADMIN_API_TOKEN)
  4. send a fan message on Telegram + open lala.la/<handle> to confirm the twin replies
EOF
else
  echo "NO-GO: fix the ✗ items above, then re-run."
fi
exit "${miss}"
