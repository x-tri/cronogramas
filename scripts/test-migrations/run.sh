#!/usr/bin/env bash
# Validador isolado das migrations 015 e 016.
# Aplica: 00_fixtures.sql -> 015 -> 016 -> 90_assertions.sql contra o postgres local
# do Supabase (container supabase_db_home, porta 54322).
#
# Uso:
#   ./scripts/test-migrations/run.sh

set -euo pipefail

CONTAINER="supabase_db_home"
PSQL="docker exec -i ${CONTAINER} psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MIG_DIR="${ROOT}/supabase/migrations"
TEST_DIR="${ROOT}/scripts/test-migrations"

echo ">>> Container: ${CONTAINER}"
docker exec "${CONTAINER}" psql -U postgres -d postgres -c "SELECT now();" >/dev/null

echo ">>> [1/5] Applying fixtures (00_fixtures.sql)"
${PSQL} < "${TEST_DIR}/00_fixtures.sql"

echo ">>> [2/5] Applying 015_create_simulados_tables.sql"
${PSQL} < "${MIG_DIR}/015_create_simulados_tables.sql"

echo ">>> [3/5] Applying 016_simulados_rls.sql"
${PSQL} < "${MIG_DIR}/016_simulados_rls.sql"

echo ">>> [4/5] Applying 017_simulados_rpcs.sql"
${PSQL} < "${MIG_DIR}/017_simulados_rpcs.sql"

echo ">>> [5/5] Running assertions (90_assertions.sql + 91_rpc_assertions.sql)"
${PSQL} < "${TEST_DIR}/90_assertions.sql"
${PSQL} < "${TEST_DIR}/91_rpc_assertions.sql"

echo ""
echo "=== VALIDATION COMPLETE ==="
