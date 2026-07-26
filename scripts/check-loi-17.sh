#!/usr/bin/env bash
#
# Loi 17 — confinement du dialecte, jouable en local.
#
# Reprend, à l'identique, les trois contrôles d'intégration continue de l'étape 8. Existe
# pour une raison simple : une règle qu'on ne découvre qu'après un « push » est une règle
# qu'on contourne. Trois secondes ici valent mieux que quatre minutes d'attente.
#
#   ./scripts/check-loi-17.sh
#
set -uo pipefail

cd "$(dirname "$0")/.."

DIR=backend/src/lib/integration/connectors
violation=0

if [ ! -d "$DIR" ]; then
  echo "Aucun connecteur — rien à vérifier."
  exit 0
fi

strip() {
  sed -E 's:([^:])//.*:\1:' "$1" | sed -E '/^[[:space:]]*[*/]/d'
}

echo "── Loi 17 : le dialecte d'un éditeur reste dans son dossier ───────────────"
for path in "$DIR"/*/ ; do
  [ -d "$path" ] || continue
  editor=$(basename "$path")
  for file in $(find backend/src -name '*.js' | grep -v "^$DIR/$editor/") ; do
    code=$(strip "$file" | grep -vE "require\('\./$editor'\)" || true)
    if echo "$code" | grep -qi "$editor" ; then
      echo "  ✗ $file nomme « $editor » hors de connectors/$editor/"
      violation=1
    fi
  done
  echo "  · $editor"
done

echo "── Loi 17 : un connecteur ne touche ni la base, ni un organe, ni le coffre ─"
for file in $(find "$DIR" -name '*.js') ; do
  code=$(strip "$file")
  check() {
    if echo "$code" | grep -qE "$1" ; then
      echo "  ✗ $file $2"
      violation=1
    fi
  }
  check "require\('[^']*/db'\)" "importe la base"
  check "require\('[^']*lib/(orders|inventory|catalog|orchestration|kernel)" "importe un organe"
  check "require\('[^']*/secrets'\)" "ouvre le coffre lui-même"
  check "\bfetch[[:space:]]*\(|axios|node-fetch" "appelle le réseau directement"
done

echo "── Étape 8 : les identifiants tiers ne sortent pas du coffre ───────────────"
guard() {
  found=$(grep -rln "$1" backend/src --include='*.js' | grep -vE "$2" || true)
  if [ -n "$found" ]; then
    echo "  ✗ « $1 » apparaît hors du coffre : $found"
    violation=1
  fi
}
guard "integration_secrets" "integration/secrets\.js"
guard "createDecipheriv" "integration/secrets\.js"
guard "INTEGRATION_SECRET_KEY" "integration/secrets\.js|config/env\.js"

if [ "$violation" -eq 0 ]; then
  echo
  echo "Loi 17 respectée — le cœur ne connaît aucun éditeur."
else
  echo
  echo "Loi 17 violée. Le cœur de Ma Zone ne doit jamais évoluer pour un éditeur."
  exit 1
fi
