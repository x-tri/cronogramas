#!/usr/bin/env bash
# scripts/invariants/cross_db_drift.sh
#
# Detecta drift entre PRIMARY (operacional XTRI Cronogramas) e SIMULADO
# (fonte de verdade do sistema gabarito). Roda em schedule (cron). Exit 0
# se limpo, 1 se houver qualquer violacao.
#
# Invariantes (pass/fail):
#   A. Todo school em PRIMARY tem que existir em SIMULADO (mesmo id)
#   B. Para schools comuns, name + slug devem bater
#
# Telemetria (NAO falha o gate): overlap de alunos por matricula entre os DBs.
#   Nao existe invariante de subset de alunos em direcao alguma — os dois DBs
#   servem populacoes parcialmente sobrepostas: escolas "operacionais" tem
#   alunos no PRIMARY; escolas "so-simulado" tem roster so no SIMULADO. Matricula
#   = ID do user. Ex.: PHYSICS/OVER tem 0 alunos no PRIMARY e centenas no
#   SIMULADO (esperado). So reportamos as contagens para monitorar.
#
# Nao verifica (futuro):
#   - Per-aluno field parity (name, turma) para alunos presentes nos dois DBs
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

# Query unica usada nos dois DBs. Traz as matriculas por school para a telemetria
# de overlap de alunos. jsonb_agg garante array JSON na saida; FILTER tira nulos;
# COALESCE devolve [] para schools sem alunos.
QUERY="SELECT s.id::text AS id, s.name AS name, s.slug AS slug, COALESCE(jsonb_agg(st.matricula::text) FILTER (WHERE st.matricula IS NOT NULL), '[]'::jsonb) AS matriculas FROM schools s LEFT JOIN students st ON st.school_id = s.id GROUP BY s.id, s.name, s.slug ORDER BY s.id;"

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


def mats(row):
    """Set de matriculas (str) de uma school. Robusto ao formato de saida do
    jsonb: lista JSON, string '[...]' ou literal Postgres '{...}'."""
    v = row.get('matriculas')
    if v is None:
        return set()
    if isinstance(v, list):
        return {str(x) for x in v}
    v = str(v).strip()
    if v.startswith('['):
        return {str(x) for x in json.loads(v)}
    v = v.strip('{}')
    return {x.strip().strip('"') for x in v.split(',') if x.strip()}


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

# Overlap de alunos (matricula = ID do user) — TELEMETRIA, nao falha o gate.
# Nao ha subset valido em direcao alguma: ver cabecalho.
alunos_so_primary = 0
alunos_so_simulado = 0
alunos_ambos = 0
schools_so_simulado = []  # schools comuns com alunos no SIMULADO e 0 no PRIMARY
for sid in p.keys() & s.keys():
    p_mats = mats(p[sid])
    s_mats = mats(s[sid])
    alunos_so_primary += len(p_mats - s_mats)
    alunos_so_simulado += len(s_mats - p_mats)
    alunos_ambos += len(p_mats & s_mats)
    if s_mats and not p_mats:
        schools_so_simulado.append((s[sid]['name'], len(s_mats)))

# Telemetria contextual (nao falha)
print(f'')
print(f'  PRIMARY schools:  {len(p)}')
print(f'  SIMULADO schools: {len(s)}')
print(f'  Common ids:       {len(p.keys() & s.keys())}')
print(f'  Alunos por matricula — em ambos: {alunos_ambos} | so PRIMARY: {alunos_so_primary} | so SIMULADO: {alunos_so_simulado}')
if schools_so_simulado:
    detalhe = ', '.join(f'{n}={c}' for n, c in sorted(schools_so_simulado, key=lambda x: -x[1]))
    print(f'  Schools comuns so-simulado (0 no PRIMARY): {detalhe}')
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
