#!/usr/bin/env bash
# scripts/eval/run_gold_set.sh
#
# Roda 01_validate_student_scoring.sql para cada caso em gold-set.json e
# verifica que o status == PASS para todos. Exita 0 se 100% PASS, 1 caso
# contrario. Pensado para rodar em CI.
#
# Pre-requisito: o repo precisa estar linkado ao SIMULADO
# (npx supabase link --project-ref axtmozyrnsrhqrnktshz).
#
# Uso: pnpm eval  (ou: bash scripts/eval/run_gold_set.sh)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SQL_FILE="$SCRIPT_DIR/01_validate_student_scoring.sql"
GOLD_FILE="$SCRIPT_DIR/gold-set.json"

cd "$REPO_ROOT"

# Guarda: precisa estar linkado a SIMULADO
LINKED=$(cat supabase/.temp/project-ref 2>/dev/null || echo "")
if [ "$LINKED" != "axtmozyrnsrhqrnktshz" ]; then
  echo "ERRO: repo nao esta linkado ao SIMULADO (esta em: ${LINKED:-vazio})." >&2
  echo "Rode: npx supabase link --project-ref axtmozyrnsrhqrnktshz" >&2
  exit 2
fi

# Itera casos do gold-set.json
TOTAL=0
PASS=0
FAIL=0
NOT_FOUND=0

while IFS=$'\t' read -r LABEL PROJECT_ID MATRICULA EXP_CORRECT EXP_WRONG EXP_BLANK EXP_LC EXP_CH EXP_CN EXP_MT; do
  TOTAL=$((TOTAL+1))

  RESULT_JSON=$(sed -e "s/{{PROJECT_ID}}/$PROJECT_ID/" -e "s/{{MATRICULA}}/$MATRICULA/" "$SQL_FILE" \
    | npx supabase db query --linked --agent yes --output json -f /dev/stdin)

  STATUS=$(echo "$RESULT_JSON" | python3 -c "
import json,sys
d = json.load(sys.stdin)
r = d['rows'][0] if d['rows'] else None
if not r:
    print('NO_ROW'); sys.exit()
# Validacao dupla: status do SQL + match contra expected do gold-set
status = r['status']
if status == 'PASS':
    expected = {'correct': $EXP_CORRECT, 'wrong': $EXP_WRONG, 'blank': $EXP_BLANK, 'lc': $EXP_LC, 'ch': $EXP_CH, 'cn': $EXP_CN, 'mt': $EXP_MT}
    calc = {'correct': r['calc_correct'], 'wrong': r['calc_wrong'], 'blank': r['calc_blank'], 'lc': r['calc_lc'], 'ch': r['calc_ch'], 'cn': r['calc_cn'], 'mt': r['calc_mt']}
    if expected != calc:
        diff = {k: (expected[k], calc[k]) for k in expected if expected[k] != calc[k]}
        print(f'DRIFT_VS_GOLD {diff}')
        sys.exit()
print(status)
")

  case "$STATUS" in
    PASS)
      PASS=$((PASS+1))
      printf "  \033[32mPASS\033[0m  %-40s %s\n" "$LABEL" "$MATRICULA"
      ;;
    NOT_FOUND)
      NOT_FOUND=$((NOT_FOUND+1))
      printf "  \033[33mMISS\033[0m  %-40s %s (aluno nao existe no projeto)\n" "$LABEL" "$MATRICULA"
      ;;
    *)
      FAIL=$((FAIL+1))
      printf "  \033[31mFAIL\033[0m  %-40s %s -> %s\n" "$LABEL" "$MATRICULA" "$STATUS"
      ;;
  esac
done < <(python3 -c "
import json
with open('$GOLD_FILE') as f:
    d = json.load(f)
for c in d['cases']:
    e = c['expected']
    print('\t'.join([
        c['label'], c['project_id'], c['matricula'],
        str(e['correct']), str(e['wrong']), str(e['blank']),
        str(e['lc']), str(e['ch']), str(e['cn']), str(e['mt'])
    ]))
")

echo ""
echo "  Gold-set:  $TOTAL casos | PASS: $PASS | FAIL: $FAIL | NOT_FOUND: $NOT_FOUND"

# ---------------------------------------------------------------------------
# Check 2: validação ampla (todos os projetos modernos)
# Roda uma SQL agregada que valida sys==calc para todo students de todo
# projeto que se qualifica como "ENEM 180 moderno" (~1400 students).
# ---------------------------------------------------------------------------

echo ""
echo "  Rodando 02_validate_all_projetos (todos os projetos modernos)..."

ALL_JSON=$(npx supabase db query --linked --agent yes --output json -f "$SCRIPT_DIR/02_validate_all_projetos.sql")

ALL_STATUS=$(echo "$ALL_JSON" | python3 -c "
import json,sys
d = json.load(sys.stdin)
r = d['rows'][0] if d['rows'] else None
if not r:
    print('NO_ROW'); sys.exit()
status = r['status']
print(f\"{status}|{r['total_projetos']}|{r['alunos_validados']}|{r['divergentes']}|{r['divergent_projetos']}|{json.dumps(r['sample'], ensure_ascii=False)}\")
")

IFS='|' read -r ST TPROJ TALUN DIV DPROJ SAMPLE <<< "$ALL_STATUS"

case "$ST" in
  PASS)
    printf "  \033[32mPASS\033[0m  all-projetos: %s projetos / %s alunos consistentes\n" "$TPROJ" "$TALUN"
    ALL_OK=1
    ;;
  FAIL)
    printf "  \033[31mFAIL\033[0m  all-projetos: %s divergentes em %s projetos (de %s alunos validados)\n" "$DIV" "$DPROJ" "$TALUN"
    echo "  primeiros divergentes:"
    echo "$SAMPLE" | python3 -m json.tool 2>/dev/null | sed 's/^/    /'
    ALL_OK=0
    ;;
  *)
    printf "  \033[31mFAIL\033[0m  all-projetos: status inesperado '%s'\n" "$ST"
    ALL_OK=0
    ;;
esac

echo ""
echo "  Resumo final:"
echo "    - Gold-set drift:           $PASS/$TOTAL PASS"
echo "    - All-projetos consistency: $TPROJ projetos, $TALUN alunos, $DIV divergentes"

if [ "$FAIL" -gt 0 ] || [ "$NOT_FOUND" -gt 0 ] || [ "${ALL_OK:-0}" -ne 1 ]; then
  exit 1
fi
exit 0
