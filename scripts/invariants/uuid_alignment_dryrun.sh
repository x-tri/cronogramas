#!/usr/bin/env bash
# scripts/invariants/uuid_alignment_dryrun.sh
#
# DRY-RUN: analisa o que o plano E (alinhamento de UUIDs entre PRIMARY e
# SIMULADO) faria. NAO MUTA NADA. Output:
#   1. Stats agregados (qtd alunos, qtd FK refs, blockers)
#   2. Per-aluno preview (5 primeiros)
#   3. Arquivo SQL gerado em scripts/invariants/.generated_alignment_<school>.sql
#      contendo o plano completo, wrapped em BEGIN/COMMIT, para review manual
#
# Uso:
#   bash scripts/invariants/uuid_alignment_dryrun.sh <school_id>
#   ex: bash scripts/invariants/uuid_alignment_dryrun.sh 50c6894c-f97d-482f-b208-c8c35d3adea3
#
# Pre-req: supabase CLI auth (keyring local OU SUPABASE_ACCESS_TOKEN env)

set -euo pipefail

SCHOOL_ID="${1:-}"
if [ -z "$SCHOOL_ID" ]; then
  echo "Usage: $0 <school_id_uuid>" >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRIMARY=comwcnmvnuzqqbypjtqn
SIMULADO=axtmozyrnsrhqrnktshz

# ----- 1. Coletar dados das duas bases ----------------------------------------

echo "Fetching PRIMARY..."
npx supabase link --project-ref $PRIMARY > /dev/null
PRIMARY_QUERY="SELECT id::text, matricula, name, turma, profile_id::text, created_at::text, sheet_code, (SELECT count(*) FROM simulado_respostas WHERE student_id=s.id) AS n_sim, (SELECT count(*) FROM pdf_download_log WHERE student_id=s.id) AS n_pdf FROM students s WHERE school_id='$SCHOOL_ID';"
PRIMARY_JSON=$(npx supabase db query --linked --agent yes --output json "$PRIMARY_QUERY")

echo "Fetching SIMULADO..."
npx supabase link --project-ref $SIMULADO > /dev/null
SIMULADO_QUERY="SELECT id::text, matricula FROM students WHERE school_id='$SCHOOL_ID';"
SIMULADO_JSON=$(npx supabase db query --linked --agent yes --output json "$SIMULADO_QUERY")

# ----- 2. Analisar em python e emitir SQL plan --------------------------------

OUT_SQL="$SCRIPT_DIR/.generated_alignment_${SCHOOL_ID}.sql"

PRIMARY="$PRIMARY_JSON" SIMULADO="$SIMULADO_JSON" SCHOOL="$SCHOOL_ID" OUT="$OUT_SQL" python3 <<'PY'
import json, os, sys

p = {r['matricula']: r for r in json.loads(os.environ['PRIMARY'])['rows']}
s = {r['matricula']: r['id'] for r in json.loads(os.environ['SIMULADO'])['rows']}
school_id = os.environ['SCHOOL']
out_sql = os.environ['OUT']

# Categorias
common = p.keys() & s.keys()
matched   = [m for m in common if p[m]['id'] == s[m]]            # UUID iguais
mismatch  = [m for m in common if p[m]['id'] != s[m]]            # UUID diferentes
only_primary = p.keys() - s.keys()                                # phantoms PRIMARY

# Blockers para a migracao
primary_ids = {r['id'] for r in p.values()}
pk_collisions = [m for m in mismatch if s[m] in primary_ids]      # SIMULADO.id ja existe em PRIMARY como outra row

# Stats agregadas dos mismatch
total_sim_refs = sum(p[m]['n_sim'] for m in mismatch)
total_pdf_refs = sum(p[m]['n_pdf'] for m in mismatch)
with_profile   = sum(1 for m in mismatch if p[m]['profile_id'])

print()
print(f'=== Dry-run: alinhamento de UUIDs em school_id={school_id} ===')
print()
print(f'Total students em PRIMARY: {len(p)}')
print(f'Total students em SIMULADO: {len(s)}')
print()
print(f'Classificacao:')
print(f'  UUID matched (OK):                    {len(matched):>4}')
print(f'  UUID mismatched (target da migracao): {len(mismatch):>4}')
print(f'  So em PRIMARY (phantom):              {len(only_primary):>4}')
print()
print(f'FK refs em PRIMARY a migrar (dos mismatched):')
print(f'  simulado_respostas: {total_sim_refs}')
print(f'  pdf_download_log:   {total_pdf_refs}')
print(f'  com profile_id:     {with_profile}')
print()
print(f'Blockers:')
if pk_collisions:
    print(f'  CRITICO: {len(pk_collisions)} PK collisions (SIMULADO.id ja usado em PRIMARY por outra row)')
    for m in pk_collisions[:3]: print(f'    matricula {m}: SIMULADO.id={s[m][:8]} ja em PRIMARY como aluno {primary_ids[s[m]]}')
    print(f'  >>> NAO AVANCE; investigar antes')
else:
    print(f'  Nenhum')
print()
print(f'Preview dos 5 primeiros mismatch:')
print(f'  {"matricula":12} {"primary_id":12} -> {"simulado_id":12} {"fks":>6} {"profile":>8}')
for m in sorted(mismatch)[:5]:
    row = p[m]
    print(f'  {m:12} {row["id"][:10]:12} -> {s[m][:10]:12} {row["n_sim"]+row["n_pdf"]:>6} {"sim" if row["profile_id"] else "nao":>8}')

# ----- gerar SQL plan ----------------------------------------------------------
if pk_collisions:
    print()
    print(f'SQL plan NAO gerado (blockers).')
    sys.exit(1)

with open(out_sql, 'w') as f:
    f.write(f'-- AUTO-GERADO por uuid_alignment_dryrun.sh em school_id={school_id}\n')
    f.write(f'-- NAO EDITAR. Regerar via dry-run apos qualquer mudanca.\n')
    f.write(f'-- Total de alunos a alinhar: {len(mismatch)}\n')
    f.write(f'-- FK refs a migrar: {total_sim_refs} simulado_respostas + {total_pdf_refs} pdf_download_log\n')
    f.write(f'--\n')
    f.write(f'-- Estrategia por aluno (matricula globalmente UNIQUE; on_update=NO ACTION):\n')
    f.write(f'--   1. UPDATE students SET matricula=placeholder WHERE id=primary_uuid\n')
    f.write(f'--   2. INSERT novo row com id=simulado_uuid, matricula original\n')
    f.write(f'--   3. UPDATE simulado_respostas e pdf_download_log para apontar pro simulado_uuid\n')
    f.write(f'--   4. DELETE row velho (FKs ja migradas)\n')
    f.write(f'--\n')
    f.write(f'-- Como executar (apos review):\n')
    f.write(f'--   npx supabase link --project-ref {os.environ.get("PRIMARY_REF","comwcnmvnuzqqbypjtqn")}\n')
    f.write(f'--   npx supabase db query --linked --agent yes -f {out_sql}\n')
    f.write(f'\nBEGIN;\n\n')

    for m in sorted(mismatch):
        row = p[m]
        pid = row['id']
        sid = s[m]
        # SQL-escape strings
        name_sql = (row['name'] or '').replace("'", "''")
        turma_sql = (row['turma'] or '').replace("'", "''")
        sheet_sql = (row['sheet_code'] or '').replace("'", "''") if row.get('sheet_code') else None
        profile_sql = f"'{row['profile_id']}'" if row['profile_id'] else 'NULL'
        sheet_clause = f"'{sheet_sql}'" if sheet_sql else 'NULL'

        f.write(f"-- aluno matricula={m} ({row['n_sim']} simulado_respostas, {row['n_pdf']} pdf_downloads)\n")
        f.write(f"UPDATE students SET matricula='__migrating__:{pid}' WHERE id='{pid}';\n")
        f.write(f"INSERT INTO students (id, school_id, matricula, name, turma, profile_id, created_at, sheet_code)\n")
        f.write(f"  VALUES ('{sid}', '{school_id}', '{m}', '{name_sql}', '{turma_sql}', {profile_sql}, '{row['created_at']}', {sheet_clause});\n")
        if row['n_sim'] > 0:
            f.write(f"UPDATE simulado_respostas SET student_id='{sid}' WHERE student_id='{pid}';\n")
        if row['n_pdf'] > 0:
            f.write(f"UPDATE pdf_download_log   SET student_id='{sid}' WHERE student_id='{pid}';\n")
        f.write(f"DELETE FROM students WHERE id='{pid}';\n\n")

    f.write(f'-- Validacao final (deve retornar contadores esperados ANTES de COMMIT):\n')
    f.write(f"SELECT count(*) AS students_after FROM students WHERE school_id='{school_id}';\n")
    f.write(f'\nCOMMIT;\n')

print()
print(f'SQL plan gerado: {out_sql}')
print(f'  Tamanho: {os.path.getsize(out_sql)} bytes')
print()
print(f'Proxima acao (manual, apos review do arquivo):')
print(f'  npx supabase link --project-ref comwcnmvnuzqqbypjtqn')
print(f'  npx supabase db query --linked --agent yes -f {out_sql}')
print()
print(f'Para testar em UM aluno primeiro (recomendado):')
print(f'  - Editar o .sql e manter so o primeiro bloco antes de COMMIT')
print(f'  - Rodar, validar visualmente no admin')
print(f'  - Se OK, restaurar o restante e rodar de novo')
PY
