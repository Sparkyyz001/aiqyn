#!/usr/bin/env bash
# Выкладка в production и перенос адреса aiqyn-aktau.vercel.app на новый деплой
set -euo pipefail
url=$(vercel deploy --prod --yes 2>/dev/null | grep -o 'https://aiqyn-[a-z0-9]*-[^" ]*vercel\.app' | head -1)
echo "deploy: $url"
vercel alias set "$url" aiqyn-aktau.vercel.app >/dev/null
echo "https://aiqyn-aktau.vercel.app → $url"
