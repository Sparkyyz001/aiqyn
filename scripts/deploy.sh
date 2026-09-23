#!/usr/bin/env bash
# Выкладка в production и перенос адреса aiqyn-aktau.vercel.app на новый деплой
set -uo pipefail
log=$(mktemp)
if ! vercel deploy --prod --yes >"$log" 2>&1; then
  grep -iE "error|failed" "$log" | head -20
  exit 1
fi
url=$(grep -o 'https://aiqyn-[a-z0-9]*-[^" ]*vercel\.app' "$log" | head -1)
vercel alias set "$url" aiqyn-aktau.vercel.app >/dev/null
echo "https://aiqyn-aktau.vercel.app → $url"
