#!/usr/bin/env bash
#
# deploy-hostinger.sh — Build + upload automático dos dois frontends.
#
# Uso:
#   ./deploy-hostinger.sh              # builda + sobe admin + aluno
#   ./deploy-hostinger.sh admin        # só admin
#   ./deploy-hostinger.sh aluno        # só aluno
#   ./deploy-hostinger.sh --no-build   # sobe dist/ existente (pula build)
#
# Pré-requisitos: sshpass instalado (brew install hudochenkov/sshpass/sshpass)
# e credenciais em .env.deploy (copie .env.deploy.example).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ──────────────────────────────────────────────────────────────────
# Carrega credenciais
# ──────────────────────────────────────────────────────────────────
if [[ ! -f .env.deploy ]]; then
  echo "❌ .env.deploy não encontrado."
  echo "   Copie .env.deploy.example e preencha HOSTINGER_PASSWORD."
  exit 1
fi
# shellcheck disable=SC1091
set -a; source .env.deploy; set +a

: "${HOSTINGER_HOST:?Falta HOSTINGER_HOST em .env.deploy}"
: "${HOSTINGER_PORT:?Falta HOSTINGER_PORT}"
: "${HOSTINGER_USER:?Falta HOSTINGER_USER}"
: "${HOSTINGER_PASSWORD:?Falta HOSTINGER_PASSWORD}"
: "${HOSTINGER_REMOTE_ADMIN:?Falta HOSTINGER_REMOTE_ADMIN}"
: "${HOSTINGER_REMOTE_ALUNO:?Falta HOSTINGER_REMOTE_ALUNO}"

if ! command -v sshpass >/dev/null 2>&1; then
  echo "❌ sshpass não instalado."
  echo "   macOS: brew install hudochenkov/sshpass/sshpass"
  exit 1
fi

# ──────────────────────────────────────────────────────────────────
# Parâmetros
# ──────────────────────────────────────────────────────────────────
DO_BUILD=true
TARGET="both"

for arg in "$@"; do
  case "$arg" in
    --no-build) DO_BUILD=false ;;
    admin|aluno|both) TARGET="$arg" ;;
    *) echo "⚠️  Argumento desconhecido: $arg"; exit 1 ;;
  esac
done

# ──────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────
sshp()  { sshpass -p "$HOSTINGER_PASSWORD" ssh  -o StrictHostKeyChecking=accept-new -p "$HOSTINGER_PORT" "$HOSTINGER_USER@$HOSTINGER_HOST" "$@"; }
rsyncp() { sshpass -p "$HOSTINGER_PASSWORD" rsync -avz --delete -e "ssh -o StrictHostKeyChecking=accept-new -p $HOSTINGER_PORT" "$@"; }

build_admin() {
  echo "🔨 Build admin..."
  pnpm build >/dev/null
  echo "   ✓ $(du -sh dist | cut -f1) em ./dist"
}

build_aluno() {
  echo "🔨 Build aluno..."
  (cd aluno && pnpm build >/dev/null)
  echo "   ✓ $(du -sh aluno/dist | cut -f1) em ./aluno/dist"
}

deploy_admin() {
  echo "📤 Upload admin → $HOSTINGER_REMOTE_ADMIN"
  # --exclude aluno/ para não apagar o portal do aluno ao sincronizar a raiz
  rsyncp --exclude="aluno/" dist/ "$HOSTINGER_USER@$HOSTINGER_HOST:$HOSTINGER_REMOTE_ADMIN/"
  echo "   ✓ admin deployed"
}

deploy_aluno() {
  echo "📤 Upload aluno → $HOSTINGER_REMOTE_ALUNO"
  rsyncp aluno/dist/ "$HOSTINGER_USER@$HOSTINGER_HOST:$HOSTINGER_REMOTE_ALUNO/"
  echo "   ✓ aluno deployed"
}

verify() {
  local url="$1"
  local found
  found=$(curl -s "$url" | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1)
  echo "   🌐 $url serve: ${found:-?}"
}

# ──────────────────────────────────────────────────────────────────
# Execução
# ──────────────────────────────────────────────────────────────────
START=$(date +%s)

case "$TARGET" in
  admin)
    $DO_BUILD && build_admin
    deploy_admin
    verify "https://horariodeestudos.com/"
    ;;
  aluno)
    $DO_BUILD && build_aluno
    deploy_aluno
    verify "https://horariodeestudos.com/aluno/"
    ;;
  both)
    $DO_BUILD && build_admin
    $DO_BUILD && build_aluno
    deploy_admin
    deploy_aluno
    verify "https://horariodeestudos.com/"
    verify "https://horariodeestudos.com/aluno/"
    ;;
esac

ELAPSED=$(( $(date +%s) - START ))
echo "✅ Deploy completo em ${ELAPSED}s"
