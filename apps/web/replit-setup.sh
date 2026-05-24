#!/usr/bin/env bash
# replit-setup.sh — run once inside the 7of1-web Replit workspace after first clone.
# Usage: bash apps/web/replit-setup.sh
# This script overwrites the root .replit so this workspace runs the web app,
# not Hermes (which is what the repo's default .replit starts).
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

echo "==> Writing web-app .replit config..."
cat > .replit <<'REPLIT'
run = "cd apps/web && pnpm install && pnpm build && pnpm start"
entrypoint = "apps/web/src/app/page.tsx"

[nix]
channel = "stable-23_11"

[[ports]]
localPort = 3000
externalPort = 80

[deployment]
run = ["sh", "-c", "cd apps/web && pnpm install && pnpm build && pnpm start"]
deploymentTarget = "cloudrun"
REPLIT

echo "==> Verifying required Replit Secrets..."
missing=0
for var in SESSION_SECRET SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY; do
  if [ -z "${!var:-}" ]; then
    echo "  MISSING: $var — set this in the Replit Secrets panel"
    missing=1
  else
    echo "  OK: $var"
  fi
done

if [ "$missing" -eq 1 ]; then
  echo ""
  echo "Set missing secrets in the Replit Secrets panel, then click Run."
  echo "REDIS_URL is optional — leave blank to disable queue features."
  exit 1
fi

echo ""
echo "==> Setup complete. Click Run (or press Cmd+Enter) to start the web app."
echo "    The public URL will be: https://<repl-name>.<username>.replit.app"
