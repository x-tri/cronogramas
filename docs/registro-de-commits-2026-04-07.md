# Registro de Commits

Data-base: `07/04/2026`  
Escopo: motor do mentor, GLiNER Ops, fluxo de mentoria presencial, PDF e ajustes do admin.

## Observação importante

Este registro foi montado a partir do estado real do código no workspace.

Os hashes dos commits **não foram incluídos** porque o `git` local está bloqueado por licença pendente do Xcode neste ambiente:

```bash
sudo xcodebuild -license
```

Enquanto isso não for resolvido, este documento serve como referência de:

- blocos de mudança
- títulos de commit sugeridos
- arquivos principais impactados
- validação executada

## Commit 1

**Sugestão**

```text
feat(db): adiciona base do motor mentor-centric
```

**O que entra**

- migrations do módulo do mentor e taxonomia:
  - `008_create_mentor_intelligence_tables.sql`
  - `009_decouple_mentor_taxonomy_and_add_question_audit.sql`
  - `010_add_homologation_taxonomy_seed_support.sql`
- persistência de:
  - `mentor_plans`
  - `mentor_plan_items`
  - `mentor_analysis_runs`
  - `mentor_alerts`
  - `mentor_alert_feedback`
  - `content_topics`
  - `exam_question_topics`
- suporte a:
  - `generation_mode`
  - `taxonomy_source_kind`
  - seed de homologação
  - RPC transacional de apply/cleanup

**Arquivos principais**

- [008_create_mentor_intelligence_tables.sql](/Volumes/KINGSTON/apps/horario%20de%20estudos%202.0/cronogramas/supabase/migrations/008_create_mentor_intelligence_tables.sql)
- [009_decouple_mentor_taxonomy_and_add_question_audit.sql](/Volumes/KINGSTON/apps/horario%20de%20estudos%202.0/cronogramas/supabase/migrations/009_decouple_mentor_taxonomy_and_add_question_audit.sql)
- [010_add_homologation_taxonomy_seed_support.sql](/Volumes/KINGSTON/apps/horario%20de%20estudos%202.0/cronogramas/supabase/migrations/010_add_homologation_taxonomy_seed_support.sql)

## Commit 2

**Sugestão**

```text
feat(db): adiciona core semântico do GLiNER
```

**O que entra**

- criação da base semântica inicial do GLiNER:
  - `topic_edges`
  - `question_enrichment_runs`
  - `question_enrichments`
  - `question_enrichment_sources`
  - `question_enrichment_audits`
  - `question_enrichment_overrides`
- base para o app evoluir de taxonomia estática para motor de aprendizado

**Arquivos principais**

- [011_create_gliner_semantic_core.sql](/Volumes/KINGSTON/apps/horario%20de%20estudos%202.0/cronogramas/supabase/migrations/011_create_gliner_semantic_core.sql)
- [mentor-intelligence.ts](/Volumes/KINGSTON/apps/horario%20de%20estudos%202.0/cronogramas/src/services/mentor-intelligence.ts)
- [mentor-intelligence.ts](/Volumes/KINGSTON/apps/horario%20de%20estudos%202.0/cronogramas/src/types/mentor-intelligence.ts)

## Commit 3

**Sugestão**

```text
feat(db): adiciona seed persistente de homologação
```

**O que entra**

- seed real e reversível de taxonomia para destravar homologação
- caso-base validado:
  - aluno `101051`
  - projeto `6523aa55-175b-4832-a62c-054c50ba5167`
- cobertura esperada e validada:
  - `42.0%`
  - `42` mappings
  - `29` labels únicos

**Arquivos principais**

- [seed_mentor_taxonomy_from_project.py](/Volumes/KINGSTON/apps/horario%20de%20estudos%202.0/cronogramas/scripts/seed_mentor_taxonomy_from_project.py)
- [mentor-intelligence.ts](/Volumes/KINGSTON/apps/horario%20de%20estudos%202.0/cronogramas/src/services/mentor-intelligence.ts)

## Commit 4

**Sugestão**

```text
feat(ui): cria GLiNER Ops no admin
```

**O que entra**

- substituição do antigo conceito de `Content Mapping`
- nova leitura: GLiNER como motor semântico, não fila editorial
- visão operacional com:
  - cobertura
  - runs
  - auditoria
  - tópicos ativos
  - impacto no mentor

**Arquivos principais**

- [admin-gliner-ops.tsx](/Volumes/KINGSTON/apps/horario%20de%20estudos%202.0/cronogramas/src/components/admin/admin-gliner-ops.tsx)
- [admin-dashboard.tsx](/Volumes/KINGSTON/apps/horario%20de%20estudos%202.0/cronogramas/src/components/admin/admin-dashboard.tsx)
- [admin-sidebar.tsx](/Volumes/KINGSTON/apps/horario%20de%20estudos%202.0/cronogramas/src/components/admin/admin-sidebar.tsx)

## Commit 5

**Sugestão**

```text
refactor(ui): embute plano do mentor no relatório do simulado
```

**O que entra**

- o mentor deixa de depender do dashboard admin para revisar/enviar plano
- o fluxo passa a ficar dentro do relatório do simulado
- nova experiência de sessão presencial:
  - montar plano da semana
  - ajustar foco por tópico
  - remover tópico
  - adicionar tópico manual
  - confirmar e enviar plano

**Arquivos principais**

- [relatorio-cirurgico.tsx](/Volumes/KINGSTON/apps/horario%20de%20estudos%202.0/cronogramas/src/components/simulado/relatorio-cirurgico.tsx)
- [mentor-intelligence.ts](/Volumes/KINGSTON/apps/horario%20de%20estudos%202.0/cronogramas/src/services/mentor-intelligence.ts)

## Commit 6

**Sugestão**

```text
refactor(auth): restringe admin ao super admin
```

**O que entra**

- mentor/coordinator sai do fluxo administrativo
- admin completo fica exclusivo do `super_admin`
- mentor passa a operar apenas:
  - busca do aluno
  - análise do simulado
  - cronograma
  - PDFs
  - plano da semana dentro da sessão

**Arquivos principais**

- [App.tsx](/Volumes/KINGSTON/apps/horario%20de%20estudos%202.0/cronogramas/src/App.tsx)
- [admin-dashboard.tsx](/Volumes/KINGSTON/apps/horario%20de%20estudos%202.0/cronogramas/src/components/admin/admin-dashboard.tsx)

## Commit 7

**Sugestão**

```text
fix(api): corrige mentor-gap-analysis e fallback local
```

**O que entra**

- correção dos imports da Edge Function
- publicação da função `mentor-gap-analysis`
- fallback local no cliente para evitar ruído desnecessário durante a sessão do mentor
- remoção de erro de CORS/401 no fluxo do coordenador

**Arquivos principais**

- [index.ts](/Volumes/KINGSTON/apps/horario%20de%20estudos%202.0/cronogramas/supabase/functions/mentor-gap-analysis/index.ts)
- [mentor-intelligence.ts](/Volumes/KINGSTON/apps/horario%20de%20estudos%202.0/cronogramas/src/services/mentor-intelligence.ts)

## Commit 8

**Sugestão**

```text
style(pdf): melhora leitura textual do relatório cirúrgico
```

**O que entra**

- PDF com menos cara de dashboard/export de tela
- estrutura mais textual e executiva
- redução de páginas e melhor aproveitamento do espaço

**Arquivos principais**

- [relatorio-cirurgico-pdf.tsx](/Volumes/KINGSTON/apps/horario%20de%20estudos%202.0/cronogramas/src/components/pdf/relatorio-cirurgico-pdf.tsx)

## Commit 9

**Sugestão**

```text
refactor(admin): equaliza menus e corrige consultas do super admin
```

**O que entra**

- menus renomeados para refletir a função real:
  - `Visão Geral` -> `Visão Executiva`
  - `Coordenadores` -> `Mentores & Acessos`
  - `Horários de Aula` -> `Grades Oficiais`
  - `Controle Cronogramas` -> `Cronogramas dos Alunos`
  - `Performance` -> `Planos & Mentoria`
  - `Histórico PDFs` -> `PDFs & Entregas`
  - `Auditoria` -> `Auditoria do Sistema`
  - `API & IA` -> `Monitor API & IA`
- remoção do ruído de `HEAD 400`
- correção da saúde por escola usando agregação real por `students + cronogramas + audit_log`

**Arquivos principais**

- [admin-sidebar.tsx](/Volumes/KINGSTON/apps/horario%20de%20estudos%202.0/cronogramas/src/components/admin/admin-sidebar.tsx)
- [admin-dashboard.tsx](/Volumes/KINGSTON/apps/horario%20de%20estudos%202.0/cronogramas/src/components/admin/admin-dashboard.tsx)
- [dashboard-home.tsx](/Volumes/KINGSTON/apps/horario%20de%20estudos%202.0/cronogramas/src/components/admin/dashboard-home.tsx)
- [api-monitor.tsx](/Volumes/KINGSTON/apps/horario%20de%20estudos%202.0/cronogramas/src/components/admin/api-monitor.tsx)

## Validação executada

Fonte dos testes:

- app local em `http://127.0.0.1:5173`
- Supabase real

N amostral principal:

- `1` aluno real para smoke do mentor: `101051`
- `1` usuário real `super_admin`: `XTRI01@xtri.online`

Checks já executados nesta sprint:

- `pnpm exec eslint ...`
- `pnpm build`
- smoke do fluxo do mentor em [tmp/smoke-101051/result.json](/Volumes/KINGSTON/apps/horario%20de%20estudos%202.0/cronogramas/tmp/smoke-101051/result.json)
- smoke do super admin em [tmp/smoke-super-admin/result.json](/Volumes/KINGSTON/apps/horario%20de%20estudos%202.0/cronogramas/tmp/smoke-super-admin/result.json)

## Próximo passo recomendado

Assim que o `git` local voltar a funcionar, o ideal é quebrar os commits exatamente nesses blocos para manter:

- histórico limpo
- rollback simples
- PR mais fácil de revisar
- rastreabilidade por domínio (`db`, `ui`, `auth`, `api`, `pdf`)
