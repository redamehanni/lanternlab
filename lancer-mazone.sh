#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  MA ZONE — Lancement en 1 clic (pour débutant)
#  Double-cliquez ce fichier OU lancez : ./lancer-mazone.sh
# ═══════════════════════════════════════════════════════════════

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo ""
echo "════════════════════════════════════════"
echo "  MA ZONE — Démarrage automatique"
echo "════════════════════════════════════════"
echo ""

# 1. Vérifier Node
if ! command -v node &>/dev/null; then
  echo "❌ Node.js n'est pas installé."
  echo "   Installez-le sur https://nodejs.org puis relancez ce script."
  exit 1
fi
echo "✓ Node.js : $(node -v)"

# 2. Installer les dépendances si besoin
if [ ! -d "$ROOT/backend/node_modules" ]; then
  echo "→ Installation backend..."
  (cd "$ROOT/backend" && npm install)
fi
if [ ! -d "$ROOT/mobile/node_modules" ]; then
  echo "→ Installation mobile..."
  (cd "$ROOT/mobile" && npm install)
fi

# 3. Démarrer le backend
if curl -s http://localhost:4000/health >/dev/null 2>&1; then
  echo "✓ Backend déjà actif sur http://localhost:4000"
else
  echo "→ Démarrage du backend..."
  (cd "$ROOT/backend" && node src/index.js) &
  sleep 2
  if curl -s http://localhost:4000/health >/dev/null 2>&1; then
    echo "✓ Backend démarré sur http://localhost:4000"
  else
    echo "❌ Le backend n'a pas démarré. Vérifiez les erreurs ci-dessus."
    exit 1
  fi
fi

# 4. Lancer l'app (navigateur = le plus simple sans simulateur)
echo ""
echo "→ Lancement de l'application dans le navigateur..."
echo "  (Une fenêtre Chrome/Safari va s'ouvrir)"
echo ""
echo "  Pour arrêter : fermez cette fenêtre Terminal ou Ctrl+C"
echo ""

cd "$ROOT/mobile"
npx expo start --web --clear
