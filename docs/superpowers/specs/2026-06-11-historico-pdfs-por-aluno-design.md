# Histórico de documentos PDF por aluno (Listas e Planos)

**Data:** 2026-06-11 · **Status:** aprovado pelo usuário (opção A nas duas decisões de escopo)

## Problema

Na aba "Listas e Planos" (componente `AdminPdfs`), o mentor vê uma lista plana de
PDFs gerados. Não há visão consolidada por aluno: para auditar tudo que foi
distribuído para uma aluna (cronogramas semanais, relatórios de desempenho,
cadernos de questões), o mentor precisa varrer a tabela linha a linha.

## Decisões de escopo (aprovadas)

1. **"Baixar tudo" = downloads individuais em sequência** (sem zip, sem PDF
   combinado — zero dependência nova).
2. **Só documentos PDF já gerados** (`pdf_history`). Cronogramas sem PDF
   exportado ficam fora desta entrega.

## Design

### Interação

- O nome do aluno em qualquer linha da tabela vira botão.
- Clicar abre um **drawer/modal** (mesmo padrão visual do
  `student-tri-history-drawer.tsx`) com o histórico completo daquele aluno.
- Fecha no X, no Esc ou clicando no overlay.

### Conteúdo do drawer

- Cabeçalho: nome, turma, matrícula, contadores (N documentos, X baixados).
- Botão **"Baixar tudo (N)"** com progresso ("Baixando 2/5...").
- Lista cronológica (mais recente primeiro): tipo (Cronograma semanal /
  Relatório de desempenho / Caderno de questões), data, tamanho, badge
  Baixou/Não baixou, ações baixar + copiar link.

### Dados

- Sem query nova: o drawer recebe os `records` já carregados pelo `AdminPdfs`
  (histórico completo da escola, sem filtros) e filtra por `aluno_id`.
- RLS inalterada: `pdf_history` já limita o mentor à própria escola.

### Componentes

- `src/components/admin/pdf-types.ts` — `PdfRecord`, `PDF_TYPE_LABELS`,
  `formatFileSize` extraídos de `admin-pdfs.tsx` (evita import circular).
- `src/components/admin/pdf-student-history-drawer.tsx` — drawer + helpers puros:
  - `selectStudentHistory(records, alunoId)` — filtra e ordena desc por data.
  - `downloadAllSequential(items, deps)` — download sequencial com delay
    injetável, callback de progresso e contagem de falhas (continua se um falhar).
- `getSignedPdfUrl` ganha parâmetro opcional `downloadAs` →
  `createSignedUrl(path, ttl, { download: filename })` para o navegador baixar
  em vez de abrir.

### Erros

- URL assinada falhou em um item do "Baixar tudo": pula, continua, reporta
  "N de M baixados (K falharam)" ao final.
- Aluno sem documentos: estado vazio com mensagem.

### Testes

- Unit: `selectStudentHistory` (filtro + ordenação), `downloadAllSequential`
  (sequência, progresso, falha parcial) com mocks.
- Render: drawer com os 3 tipos de documento e badges de download.
