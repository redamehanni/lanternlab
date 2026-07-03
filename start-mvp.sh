#!/bin/bash
# MA ZONE — Démarrage local (localhost, sans IP)
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║     MA ZONE — Test local (localhost)     ║"
echo "╚══════════════════════════════════════════╝"
echo ""

echo ">>> Backend sur http://localhost:4000"
cd "$ROOT/backend"
node src/index.js &
BACKEND_PID=$!
sleep 2

echo ""
echo ">>> App Expo (simulateur iPhone)"
echo ""
cd "$ROOT/mobile"
npm run ios

kill $BACKEND_PID 2>/dev/null || true
