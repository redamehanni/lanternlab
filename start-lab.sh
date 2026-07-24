#!/bin/bash
# Ma Zone — démarre backend + admin-web (Laboratoire) de façon durable.
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   MA ZONE — Laboratoire (backend+web)    ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Backend
NODE_BIN="$(command -v node)"
if curl -sf --connect-timeout 1 http://127.0.0.1:4000/health >/dev/null 2>&1; then
  echo "✓ Backend déjà actif (:4000)"
else
  echo "→ Démarrage backend…"
  (cd "$ROOT/backend" && nohup "$NODE_BIN" src/index.js >> /tmp/mazone_backend.log 2>&1 &)
  for _ in $(seq 1 30); do
    curl -sf --connect-timeout 1 http://127.0.0.1:4000/health >/dev/null 2>&1 && break
    sleep 0.3
  done
  if curl -sf --connect-timeout 1 http://127.0.0.1:4000/health >/dev/null 2>&1; then
    echo "✓ Backend : http://localhost:4000"
  else
    echo "❌ Backend KO — voir /tmp/mazone_backend.log"
    exit 1
  fi
fi

# Admin credentials (dev)
(cd "$ROOT/backend" && node scripts/create-admin.js --reset admin@mazone.local admin1234 "Admin Ma Zone" >/dev/null)

# Admin-web
if curl -sf --connect-timeout 1 http://127.0.0.1:5174/ >/dev/null 2>&1; then
  echo "✓ Laboratoire déjà actif (:5174)"
else
  echo "→ Démarrage Laboratoire…"
  (cd "$ROOT/admin-web" && nohup npm run dev -- --host 127.0.0.1 --port 5174 >> /tmp/mazone_admin.log 2>&1 &)
  for _ in $(seq 1 40); do
    curl -sf --connect-timeout 1 http://127.0.0.1:5174/ >/dev/null 2>&1 && break
    sleep 0.4
  done
  echo "✓ Laboratoire : http://localhost:5174"
fi

echo ""
echo "Connexion Laboratoire :"
echo "  email    : admin@mazone.local"
echo "  password : admin1234"
echo ""
echo "Pour Xcode : garde aussi Metro (cd mobile && npx expo start)"
echo ""
