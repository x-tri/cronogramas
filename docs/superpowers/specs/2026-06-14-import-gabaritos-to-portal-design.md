# Importador de provas escaneadas (gabaritos) → portal do aluno

Data: 2026-06-14
Status: aprovado (aguardando review da spec)

## Problema

O resultado de simulado no portal do aluno (`SimuladoResultado`) lê apenas da tabela
`simulado_respostas` no projeto Supabase **comwcnmvnuzqqbypjtqn** ("cronograma-de-estudos"),
populada quando o aluno **digita** as respostas de um simulado XTRI (Edge Function
`submit-simulado`).

As provas aplicadas pela escola são **escaneadas** (cartões OMR) e vivem em um projeto
Supabase separado, **axtmozyrnsrhqrnktshz** ("xtri-gabaritos"), nas tabelas `exams`
(answer_key + question_contents) e `student_answers` (1 linha por aluno, com TRI já calculado).
**O portal não lê esse banco** — não há ponte.

Consequência: alunos que fizeram a prova escaneada (e não digitaram um simulado XTRI) não têm
resultado no portal. Caso disparador: aluna **Nicole (matrícula 214140291)**, escola Marista
(`50c6894c-f97d-482f-b208-c8c35d3adea3`), fez a **"Prova 1 (Simulado 1)"** (gabaritos exam
`4c57585f-fc25-4a41-bcaf-c252578aff46`, 48/180 acertos, TRI 474.5) mas não tem linha em
`simulado_respostas` → tela vazia. São 176 alunos nessa situação só na Prova 1 da Marista.

Observação crítica: a "Prova 1" da escola e o simulado do portal "1º Simulado MENTORIA XTRI"
(`d3094a68…`) são **exames diferentes** (questões e gabaritos distintos). Não se deve misturar.

## Objetivo

Construir uma **ferramenta reutilizável** que importe um exame do gabaritos para o portal,
criando o simulado + itens + respostas dos alunos, de forma idempotente e validada. Primeira
execução: a Prova 1 da Marista (resolve a Nicole e os outros 175).

### Não-objetivos
- Não recalcular TRI (importa-se o TRI oficial do gabaritos).
- Não construir UI de administração nesta etapa (operação por script).
- Não tocar nos simulados XTRI digitados existentes.

## Decisões

| Tema | Decisão |
|------|---------|
| Fonte do TRI | **Importar como está** do gabaritos (`student_answers.tri_lc/ch/cn/mt`). `tri_method='gabaritos_import'`. |
| Escopo | **Ferramenta reutilizável** parametrizada por `exam_id` (gabaritos) + `school_id` (portal). |
| Operação | **Abordagem C**: módulo + runner; a 1ª execução (Prova 1) é rodada agora via MCP (dry-run → validação → escrita). Execuções futuras via script com service-role keys no env. |
| Status do simulado | **`closed`** (resultado visível, sem novas submissões). |
| Casamento de alunos | Por `matrícula` = `student_number`, dentro do mesmo `school_id` (mesmo UUID nos dois bancos). Sem-match são reportados, não inventados. |

## Arquitetura

Módulo puro e testável `src/services/simulado/import-from-gabaritos.ts` (mapeamento + validação,
sem I/O) + um runner que faz o I/O (ler gabaritos, escrever portal). Como o TRI é importado,
**o motor TRI não é usado** — é mapeamento de dados.

### Componentes (puros)

```
validateExam(exam): { ok: true } | { ok: false, reasons: string[] }
  - answer_key.length === 180
  - layout ENEM: índice 0-44 LC, 45-89 CH, 90-134 CN, 135-179 MT
  - toda chave ∈ {A,B,C,D,E}
  - question_contents alinhado (mesmo answer por número), 180 entradas

buildItens(exam): SimuladoItemInsert[180]
  - numero = i+1
  - area = areaPorPosicao(numero)            // satisfaz numero_area_consistency
  - gabarito = answer_key[i]
  - dificuldade = 3                           // placeholder NOT NULL (1-5); não afeta nota
  - topico = question_contents[i].content ?? null

buildResposta(sa, gabarito): SimuladoRespostaInsert
  - answers = { "1": letra, ... } a partir do array de 180 (vazio = branco)
  - por área: acertos/erros/branco (cada área soma 45 — invariante do schema)
  - tri_lc/ch/cn/mt = sa.tri_* (validar escala 200-1000; fora → null + log)
  - erros_por_topico = { [topico]: { area, n } } (contagem dos erros)
  - erros_por_habilidade = {}                 // gabaritos não tem habilidade
  - areas_realizadas = áreas com ≥1 resposta
  - confidence_level = confidenceFromAreas(porArea)  // reusa a função pura de item-audit.ts
  - correction_status = 'computed'            // valor permitido pelo CHECK
  - tri_method = 'gabaritos_import', tri_version = '1'

matchByMatricula(student_number, portalStudentsByMatricula): student_id | null
```

### Runner / orquestração
1. Ler exam (gabaritos) + validar. Abortar se inválido.
2. Ler `student_answers` do exam + `students` do portal (school_id) → mapa por matrícula.
3. Criar/achar o `simulado`: buscar por (`school_id`, `title`); se existir, reusar o `id`;
   senão, inserir (status `closed`). Assim re-rodar não cria um simulado duplicado.
4. Upsert 180 `simulado_itens` `ON CONFLICT (simulado_id, numero) DO NOTHING`.
5. Para cada aluno casado: insert `simulado_respostas` `ON CONFLICT (simulado_id, student_id) DO NOTHING`.
6. Relatório: importados, já-existentes (pulados), sem-match, fora-de-escala.

## Validação e invariantes (schema)
- `simulado_itens`: area ∈ {LC,CH,CN,MT}; dificuldade 1-5 NOT NULL; gabarito A-E;
  `numero_area_consistency` (área por faixa de número); UNIQUE(simulado_id, numero).
- `simulado_respostas`: (acertos+erros+branco)=45 por área; tri null ou 200-1000;
  confidence_level ∈ lista; correction_status ∈ {computed,recomputed,blocked_review,manual_reviewed};
  UNIQUE(simulado_id, student_id).

## Idempotência & segurança
- `ON CONFLICT DO NOTHING` em itens e respostas: re-rodar não duplica nem sobrescreve.
- **Dry-run** computa tudo e reporta (incl. a linha da Nicole) sem escrever.
- **Gate**: contra o gabarito correto (Prova 1), os acertos da Nicole = **48** e TRI = **474.5**.
  Se não bater, abortar.
- Escrita em produção só após aprovação explícita do dry-run.

## Plano de testes
- Unit (vitest) nas funções puras: validateExam (rejeita não-180 / fora do layout / chave inválida);
  buildItens (área por posição, gabarito, dificuldade); buildResposta (invariante 45/área,
  branco, TRI fora de escala → null, erros_por_topico); matchByMatricula.
- Dry-run da Prova 1 validando a Nicole (48 acertos, TRI 474.5) e o total de matches (~176).
- Pós-escrita: query confirmando a linha da Nicole e o total de respostas.

## Primeira execução (Prova 1 / Marista)
- `exam_id = 4c57585f-fc25-4a41-bcaf-c252578aff46`, `school_id = 50c6894c-f97d-482f-b208-c8c35d3adea3`.
- Título do simulado: default = título do exame no gabaritos ("Prova 1 (Simulado 1)"); parametrizável.
- dry-run → revisão → escrita via MCP → verificação.

## Riscos / casos de borda
- Aluno sem match por matrícula (avulso, formatação): reportar, não importar.
- `answer_key` length ≠ 180 ou layout não-ENEM: rejeitar o exame inteiro.
- TRI do gabaritos null/fora de 200-1000 numa área: importar null naquela área + log.
- `total_questions` no gabaritos diz 90 mas há 180 itens: confiar no length de answer_key/question_contents.
- Status `closed`: confirmar que a tela do aluno exibe resultado de simulado fechado (os 51 do XTRI são `closed` e funcionam).
