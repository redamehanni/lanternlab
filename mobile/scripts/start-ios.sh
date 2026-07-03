#!/bin/bash
# Lance Ma Zone sur le simulateur iPhone (Expo Go).
# Sur iOS 26+, localhost ne fonctionne pas depuis le simulateur :
# on utilise l'IP locale du Mac pour que Metro soit accessible.
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
if [ -z "$IP" ]; then
  echo "❌ Impossible de détecter l'IP locale (Wi-Fi)."
  echo "   Connectez votre Mac au Wi-Fi puis relancez."
  exit 1
fi

export REACT_NATIVE_PACKAGER_HOSTNAME="$IP"

echo ""
echo "→ IP locale : $IP"
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
