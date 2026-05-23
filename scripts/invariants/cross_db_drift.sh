#!/usr/bin/env bash
# scripts/invariants/cross_db_drift.sh
#
# Detecta drift entre PRIMARY (operacional XTRI Cronogramas) e SIMULADO
# (fonte de verdade do sistema gabarito). Roda em schedule (cron). Exit 0
# se limpo, 1 se houver qualquer violacao.
#
# Invariantes V1:
#   A. Todo school em PRIMARY tem que existir em SIMULADO (mesmo id)
#   B. Para schools comuns, name + slug devem bater
#   C. PRIMARY.student_count NUNCA pode exceder SIMULADO.student_count
#      (PRIMARY e snapshot/subset de SIMULADO; mais e anomalia)
#
# Nao verifica (V2 futuro):
#   - Per-aluno field parity (name, matricula, turma)
#   - "Active mirror" check (counts iguais para schools mirroradas)
#
# Pre-req: SUPABASE_ACCESS_TOKEN no env.
# Uso: bash scripts/invariants/cross_db_drift.sh

set -euo pipefail

PRIMARY=comwcnmvnuzqqbypjtqn
SIMULADO=axtmozyrnsrhqrnktshz

# SUPABASE_ACCESS_TOKEN obrigatorio em CI; localmente o CLI usa keyring auth.
# Se faltar nos dois lugares, o `supabase link` abaixo falha barulhento.
if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "  (info) SUPABASE_ACCESS_TOKEN nao no env; assumindo auth via CLI keyring" >&2
fi

# Query unica usada nos dois DBs
QUERY="SELECT id::text, name, slug, (SELECT count(*) FROM students WHERE school_id=s.id) AS sc FROM schools s ORDER BY id;"

echo "Fetching PRIMARY ($PRIMARY)..."
npx supabase link --project-ref $PRIMARY > /dev/null
PRIMARY_JSON=$(npx supabase db query --linked --agent yes --output json "$QUERY")

echo "Fetching SIMULADO ($SIMULADO)..."
npx supabase link --project-ref $SIMULADO > /dev/null
SIMULADO_JSON=$(npx supabase db query --linked --agent yes --output json "$QUERY")

P_DATA="$PRIMARY_JSON" S_DATA="$SIMULADO_JSON" python3 <<'PY'
import json, os, sys

p = {r['id']: r for r in json.loads(os.environ['P_DATA'])['rows']}
s = {r['id']: r for r in json.loads(os.environ['S_DATA'])['rows']}

violations = []

# Inv A: schools em PRIMARY tem que existir em SIMULADO
for sid in p.keys() - s.keys():
    violations.append(('A_orphan_in_primary', p[sid]['name'], f'school existe em PRIMARY sem origem em SIMULADO (id={sid})'))

# Inv B: name + slug devem bater
for sid in p.keys() & s.keys():
    if p[sid]['name'] != s[sid]['name']:
        violations.append(('B_name_drift', p[sid]['name'], f'PRIMARY={p[sid]["name"]!r} vs SIMULADO={s[sid]["name"]!r}'))
    if p[sid]['slug'] != s[sid]['slug']:
        violations.append(('B_slug_drift', p[sid]['name'], f'PRIMARY={p[sid]["slug"]!r} vs SIMULADO={s[sid]["slug"]!r}'))

# Inv C: PRIMARY count nao pode exceder SIMULADO count
for sid in p.keys() & s.keys():
    if p[sid]['sc'] > s[sid]['sc']:
        violations.append(('C_primary_exceeds_simulado', p[sid]['name'], f'PRIMARY.students={p[sid]["sc"]} > SIMULADO.students={s[sid]["sc"]} (impossivel; investigar)'))

# Telemetria contextual (nao falha)
print(f'')
print(f'  PRIMARY schools:  {len(p)}')
print(f'  SIMULADO schools: {len(s)}')
print(f'  Common ids:       {len(p.keys() & s.keys())}')
print(f'')

if violations:
    print(f'FAIL: {len(violations)} violacao(oes) detectada(s)')
    print(f'')
    for kind, name, detail in violations:
        print(f'  [{kind:30}] {name:30}  {detail}')
    sys.exit(1)

print(f'PASS: nenhuma violacao em PRIMARY x SIMULADO')
sys.exit(0)
PY
