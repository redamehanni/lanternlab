#!/bin/bash
# Lance Ma Zone sur le simulateur iPhone (Expo Go).
# Sur iOS 26+, localhost ne fonctionne pas depuis le simulateur :
# on utilise l'IP locale du Mac pour Metro ET pour le backend API.
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$ROOT/.." && pwd)"
cd "$ROOT"

IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
if [ -z "$IP" ]; then
  echo "❌ Impossible de détecter l'IP locale (Wi-Fi)."
  echo "   Connectez votre Mac au Wi-Fi puis relancez."
  exit 1
fi

export REACT_NATIVE_PACKAGER_HOSTNAME="$IP"
# Même hôte que Metro → login / register / sockets joignent le backend.
export EXPO_PUBLIC_API_URL="http://${IP}:4000"

echo ""
echo "→ IP locale : $IP"
echo "→ API       : $EXPO_PUBLIC_API_URL"

# Backend obligatoire pour auth (sinon « Connexion impossible »).
if ! curl -sf --connect-timeout 1 "http://127.0.0.1:4000/health" >/dev/null 2>&1; then
  echo "→ Backend arrêté — démarrage sur :4000…"
  (cd "$REPO/backend" && nohup node src/index.js > /tmp/mazone_backend.log 2>&1 &)
  for _ in $(seq 1 20); do
    if curl -sf --connect-timeout 1 "http://127.0.0.1:4000/health" >/dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done
  if ! curl -sf --connect-timeout 1 "http://127.0.0.1:4000/health" >/dev/null 2>&1; then
    echo "❌ Backend inaccessible. Voir /tmp/mazone_backend.log"
    exit 1
  fi
  echo "✓ Backend démarré"
else
  echo "✓ Backend déjà actif"
fi

# Vérifie aussi via l'IP LAN (chemin réel du simulateur).
if ! curl -sf --connect-timeout 2 "$EXPO_PUBLIC_API_URL/health" >/dev/null 2>&1; then
  echo "⚠️  Le Mac répond en 127.0.0.1 mais pas via $IP:4000."
  echo "   Vérifiez le pare-feu / que le backend écoute 0.0.0.0."
fi

echo "→ Démarrage du simulateur iPhone..."

xcrun simctl boot "iPhone 17 Pro" 2>/dev/null || true
open -a Simulator
sleep 2

echo "→ Lancement d'Expo (Metro sur http://$IP:8081)"
echo "   L'app s'ouvrira dans Expo Go sur le simulateur."
echo ""

npx expo start --clear &
EXPO_PID=$!

trap 'kill $EXPO_PID 2>/dev/null || true' EXIT INT TERM

for _ in $(seq 1 45); do
  if curl -sf "http://$IP:8081/status" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

sleep 2
xcrun simctl launch booted host.exp.Exponent 2>/dev/null || true
sleep 1
xcrun simctl openurl booted "exp://$IP:8081" 2>/dev/null || true

wait $EXPO_PID
