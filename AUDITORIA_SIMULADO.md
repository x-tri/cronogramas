# Auditoria: Funcionalidade de Análise de Simulado e Distribuição de Erros

**Data da Auditoria:** 13/02/2026  
**Última Atualização:** 13/02/2026 (Adicionada seleção de tópicos)  
**Sistema:** XTRI Cronogramas v2.0  
**Funcionalidade:** Busca de aluno por matrícula → Análise de erros do simulado → Distribuição nos dias da semana

---

## 📋 Sumário Executivo

A funcionalidade de análise de simulado e distribuição de erros está **implementada e funcional**. O sistema consegue:

1. ✅ Buscar aluno pelo número de matrícula no Supabase
2. ✅ Recuperar erros do simulado de múltiplas fontes de dados
3. ✅ Exibir resultados com estatísticas e tópicos para revisar
4. ✅ Distribuir automaticamente os tópicos nos dias disponíveis do cronograma
5. ✅ **Selecionar quais tópicos irão para o cronograma** (NOVO - checkboxes individuais)

---

## 🔍 Fluxo de Dados Identificado

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FLUXO DE ANÁLISE DE SIMULADO                         │
└─────────────────────────────────────────────────────────────────────────────┘

  USUÁRIO
     │
     │ Digita matrícula (ex: 214140291)
     ▼
┌──────────────────────┐
│  StudentSearch.tsx   │ ──▶ Validação de matrícula
│  (Componente UI)     │ ──▶ Chama repo.students.findByMatricula()
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ supabase-repository.ts│ ──▶ Busca em ALL_STUDENTS (mock)
│  ou mock-repository.ts│ ──▶ Fallback: getStudentByMatricula() no Supabase
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   students (table)   │ ──▶ Retorna dados do aluno
│   Supabase           │ ──▶ Inclui sheet_code para busca de respostas
└──────────┬───────────┘
           │
           ▼
  USUÁRIO clica em "Analisar Simulado"
           │
           ▼
┌──────────────────────┐
│ simulado-analyzer.tsx│ ──▶ Componente React
│  (Componente UI)     │ ──▶ Chama analyzeStudentSimulado(matricula)
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ simulado-analyzer.ts │ ──▶ FUNÇÃO PRINCIPAL DE ANÁLISE
│   (Service)          │
└──────────┬───────────┘
           │
           ├──▶ 1. getSimuladoFromProjetos(matricula)
           │           ├──▶ Busca na tabela 'projetos'
           │           ├──▶ Procura aluno na coluna students (JSONB)
           │           └──▶ Converte para SimuladoResult
           │
           ├──▶ 2. Se não encontrou, tenta matrícula normalizada
           │
           ├──▶ 3. getLatestSimuladoResult(matricula)
           │           ├──▶ Busca na tabela 'student_answers'
           │           ├──▶ Busca na tabela 'exams'
           │           ├──▶ Compara respostas com gabarito
           │           └──▶ Agrupa erros por tópico
           │
           ├──▶ 4. Se não encontrou, tenta pelo sheet_code do aluno
           │
           └──▶ Retorna SimuladoResult ou null
                       │
                       ▼
            ┌──────────────────────┐
            │  SimuladoResult      │
            │  ─ exam: Exam        │
            │  ─ studentAnswer     │
            │  ─ wrongQuestions[]  │
            │  ─ topicsSummary[]   │ ◄── Tópicos para revisar
            └──────────┬───────────┘
                       │
                       ▼
            USUÁRIO vê resultado e clica em "Distribuir"
                       │
                       ▼
            ┌──────────────────────┐
            │ handleDistribute()   │ ──▶ Componente SimuladoAnalyzer
            │   (Componente)       │
            └──────────┬───────────┘
                       │
                       ├──▶ getAvailableSlots()
                       │           └──▶ Retorna slots livres (não oficiais, sem blocos)
                       │
                       ├──▶ Ordena slots disponíveis
                       │
                       └──▶ Para cada tópico:
                                   ├──▶ Cria bloco de revisão
                                   ├──▶ Define cor baseada na área ENEM
                                   ├──▶ Define prioridade baseada na quantidade de erros
                                   └──▶ Chama addBlock() ──▶ Supabase

```

---

## 📊 Estrutura de Dados

### 1. Tabelas do Supabase

#### Tabela: `students`
```sql
┌────────────────┬─────────────┬─────────────────────────────────────┐
│ Coluna         │ Tipo        │ Descrição                           │
├────────────────┼─────────────┼─────────────────────────────────────┤
│ id             │ uuid        │ ID único do aluno                   │
│ matricula      │ text        │ Número de matrícula (ex: 214140291) │
│ name           │ text        │ Nome do aluno                       │
│ turma          │ text        │ Turma (ex: 2A, 2B)                  │
│ sheet_code     │ text        │ Código para buscar respostas        │
│ school_id      │ uuid        │ ID da escola                        │
│ created_at     │ timestamp   │ Data de criação                     │
└────────────────┴─────────────┴─────────────────────────────────────┘
```

#### Tabela: `projetos` (Principal fonte de dados)
```sql
┌────────────────┬─────────────┬─────────────────────────────────────┐
│ Coluna         │ Tipo        │ Descrição                           │
├────────────────┼─────────────┼─────────────────────────────────────┤
│ id             │ uuid        │ ID do projeto/simulado              │
│ nome           │ text        │ Nome do projeto                     │
│ simulado_nome  │ text        │ Nome do simulado                    │
│ students       │ jsonb[]     │ ARRAY de objetos com dados dos      │
│                │             │ alunos (inclui erros, notas, etc)   │
│ created_at     │ timestamp   │ Data de criação                     │
└────────────────┴─────────────┴─────────────────────────────────────┘

-- Estrutura do objeto students:
{
  "id": "merged-214140291-1234567890",
  "matricula": "214140291",
  "studentName": "Nome do Aluno",
  "turma": "2A",
  "areaCorrectAnswers": { "LC": 35, "CH": 40, "CN": 38, "MT": 35 },
  "areaScores": { "LC": 650, "CH": 700, "CN": 800, "MT": 750 },
  "answers": ["A", "B", "C", ...]
}
```

#### Tabela: `student_answers` (Fallback - Tabelas antigas)
```sql
┌────────────────┬─────────────┬─────────────────────────────────────┐
│ Coluna         │ Tipo        │ Descrição                           │
├────────────────┼─────────────┼─────────────────────────────────────┤
│ id             │ uuid        │ ID da resposta                      │
│ exam_id        │ uuid        │ ID do exame/simulado                │
│ student_number │ text        │ Número do aluno (sheet_code)        │
│ answers        │ text[]      │ Array de respostas (A,B,C,D,E)      │
│ score          │ float       │ Pontuação geral                     │
│ correct_answers│ int         │ Quantidade de acertos               │
│ wrong_answers  │ int         │ Quantidade de erros                 │
│ created_at     │ timestamp   │ Data da resposta                    │
└────────────────┴─────────────┴─────────────────────────────────────┘
```

#### Tabela: `exams`
```sql
┌───────────────────┬─────────────┬─────────────────────────────────────┐
│ Coluna            │ Tipo        │ Descrição                           │
├───────────────────┼─────────────┼─────────────────────────────────────┤
│ id                │ uuid        │ ID do exame                         │
│ title             │ text        │ Título do simulado                  │
│ answer_key        │ text[]      │ Gabarito oficial                    │
│ question_contents │ jsonb[]     │ Array com conteúdo de cada questão  │
└───────────────────┴─────────────┴─────────────────────────────────────┘

-- Estrutura do question_contents:
{
  "questionNumber": 1,
  "answer": "A",
  "content": "Tópico da questão"
}
```

### 2. Tipos TypeScript

```typescript
// types/supabase.ts

interface SimuladoResult {
  exam: Exam                          // Dados do exame/simulado
  studentAnswer: StudentAnswer        // Dados do aluno
  wrongQuestions: WrongQuestion[]     // Questões erradas detalhadas
  topicsSummary: TopicSummary[]       // Resumo por tópico
}

interface WrongQuestion {
  questionNumber: number              // Número da questão (1-180)
  topic: string                       // Tópico/conteúdo
  studentAnswer: string               // Resposta do aluno
  correctAnswer: string               // Resposta correta
}

interface TopicSummary {
  topic: string                       // Nome do tópico
  count: number                       // Quantidade de erros
  questions: number[]                 // Números das questões
}
```

---

## 🎯 Cálculo de Erros por Área do ENEM

O sistema mapeia as questões do ENEM conforme a divisão oficial:

```
┌────────────────────────────────────────────────────────────────┐
│                    MAPEAMENTO ENEM 180 QUESTÕES                 │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Q1 ─────── Q45  │  Linguagens, Códigos e suas Tecnologias     │
│        LC        │  • Leitura e interpretação de textos        │
│                  │  • Gramática                                  │
│                  │  • Literatura                                 │
│                  │  • Redação (competências)                     │
│                  │  COR: #3B82F6 (Azul)                          │
│                  │                                               │
│  Q46 ────── Q90  │  Ciências Humanas e suas Tecnologias        │
│        CH        │  • História                                   │
│                  │  • Geografia                                  │
│                  │  • Filosofia                                  │
│                  │  • Sociologia                                 │
│                  │  COR: #F97316 (Laranja)                       │
│                  │                                               │
│  Q91 ───── Q135  │  Ciências da Natureza e suas Tecnologias    │
│        CN        │  • Biologia                                   │
│                  │  • Química                                    │
│                  │  • Física                                     │
│                  │  COR: #10B981 (Verde)                         │
│                  │                                               │
│  Q136 ──── Q180  │  Matemática e suas Tecnologias              │
│        MT        │  • Matemática                                 │
│                  │  • Estatística                                │
│                  │  COR: #EF4444 (Vermelho)                      │
│                  │                                               │
└────────────────────────────────────────────────────────────────┘
```

### Cálculo de Erros

```typescript
// Para cada área: erros = 45 - acertos

const areaCorrectAnswers = {
  LC: 35,  // Linguagens: 45 - 35 = 10 erros
  CH: 40,  // Humanas: 45 - 40 = 5 erros
  CN: 38,  // Natureza: 45 - 38 = 7 erros
  MT: 35   // Matemática: 45 - 35 = 10 erros
}

// Gera tópicos:
// "Linguagens - 10 erros para revisar"
// "Humanas - 5 erros para revisar"
// "Natureza - 7 erros para revisar"
// "Matemática - 10 erros para revisar"
```

---

## 🎨 Cores e Prioridades

### Cores por Área (ENEM)
```typescript
CORES_AREAS = {
  linguagens:  '#3B82F6',  // Azul
  humanas:     '#F97316',  // Laranja
  natureza:    '#10B981',  // Verde
  matematica:  '#EF4444',  // Vermelho
  outros:      '#8B5CF6',  // Roxo
}
```

### Prioridades dos Blocos
```typescript
// Baseada na quantidade de erros no tópico
count >= 3  → prioridade: 2  // Urgente  (Vermelho)
count >= 2  → prioridade: 1  // Alta     (Amarelo)
count <  2  → prioridade: 0  // Normal   (Cinza)
```

---

## 📁 Arquivos Principais

| Arquivo | Função | Linhas |
|---------|--------|--------|
| `src/services/simulado-analyzer.ts` | Lógica de análise de simulado | 857 |
| `src/components/simulado/simulado-analyzer.tsx` | Componente UI | 282 |
| `src/components/student/student-search.tsx` | Busca por matrícula | 159 |
| `src/types/supabase.ts` | Tipos do Supabase | 263 |
| `src/stores/cronograma-store.ts` | Gerenciamento de estado | 380 |
| `src/constants/colors.ts` | Cores e detecção de área | 190 |

---

## ✅ Testes Criados

### Testes Unitários: `src/services/simulado-analyzer.test.ts`
- ✅ Busca de aluno por matrícula (exata e normalizada)
- ✅ Recuperação de resultado do simulado
- ✅ Cálculo de erros por área do ENEM
- ✅ Fallback entre múltiplas fontes de dados
- ✅ Tratamento de erros do Supabase

### Testes de Componente: `src/components/simulado/simulado-analyzer.test.tsx`
- ✅ Renderização do componente
- ✅ Análise de simulado
- ✅ Exibição de resultados
- ✅ Distribuição de tópicos
- ✅ Prioridades e cores dos blocos
- ✅ Tratamento de erros

### Testes E2E: `test-simulado-analyzer.spec.ts`
- ✅ Fluxo completo: busca → análise → distribuição
- ✅ Validações de edge cases
- ✅ Múltiplas análises seguidas
- ✅ Diagnóstico e logs

---

## 🚀 Como Executar os Testes

```bash
# Entrar no diretório do projeto
cd "/Volumes/1T/backup/apps/Horários de estudo 1.0/xtri-cronogramas"

# Instalar dependências (se necessário)
pnpm install

# Executar testes unitários
pnpm test

# Executar testes em modo watch
pnpm test:watch

# Executar testes com cobertura
pnpm test:coverage

# Executar testes E2E (requer servidor rodando)
npx playwright test test-simulado-analyzer.spec.ts

# Executar testes E2E com UI
npx playwright test --ui
```

---

## 🔧 Configuração Necessária

### Variáveis de Ambiente (.env.local)
```env
# Supabase Configuration
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_KEY=sua-chave-anon

# Repository Mode: 'supabase' | 'mock' | 'auto'
VITE_REPOSITORY_MODE=auto
```

### Banco de Dados
Certifique-se de que as tabelas existem no Supabase:
- `students` - Dados dos alunos
- `projetos` - Projetos com resultados de simulados
- `student_answers` - Respostas dos alunos (fallback)
- `exams` - Dados dos exames (fallback)
- `cronogramas` - Cronogramas dos alunos
- `blocos_cronograma` - Blocos de estudo

---

## 📊 Status da Implementação

| Funcionalidade | Status | Observações |
|----------------|--------|-------------|
| Busca por matrícula | ✅ OK | Com fallback para matrícula normalizada |
| Integração com Supabase | ✅ OK | Busca em múltiplas tabelas |
| Cálculo de erros | ✅ OK | Baseado nos acertos por área |
| Agrupamento por tópico | ✅ OK | Usa areaCorrectAnswers |
| Exibição de resultados | ✅ OK | Com gráficos de notas TRI |
| Distribuição automática | ✅ OK | Distribui em slots disponíveis |
| Cores por área | ✅ OK | Segue padrão ENEM |
| Prioridades | ✅ OK | Baseada na quantidade de erros |
| Tratamento de erros | ✅ OK | Múltiplos fallbacks implementados |
| **Seleção de tópicos** | ✅ **NOVO** | Checkboxes para escolher quais distribuir |

---

## ✨ NOVA FUNCIONALIDADE: Seleção de Tópicos

Adicionada em 13/02/2026 - Permite ao usuário escolher quais tópicos serão distribuídos no cronograma.

### Como Funciona

```
┌─────────────────────────────────────────────────────────────────┐
│  Selecione os tópicos para revisar    3 de 4 selecionados       │
├─────────────────────────────────────────────────────────────────┤
│  [Selecionar todos] | [Limpar seleção]                          │
├─────────────────────────────────────────────────────────────────┤
│  ☑ Linguagens - 10 erros para revisar        [10 erros]        │
│  ☐ Matemática - 10 erros para revisar        [10 erros]        │  ← Desmarcado
│  ☑ Natureza - 5 erros para revisar            [5 erros]        │
│  ☑ Humanas - 8 erros para revisar             [8 erros]        │
└─────────────────────────────────────────────────────────────────┘
```

### Funcionalidades

| Recurso | Descrição |
|---------|-----------|
| **Checkboxes** | Cada tópico tem seu próprio checkbox |
| **Selecionar todos** | Marca todos os tópicos de uma vez |
| **Limpar seleção** | Desmarca todos os tópicos |
| **Contador** | Mostra "X de Y selecionados" em tempo real |
| **Visual destacado** | Itens selecionados têm fundo azul |
| **Validação** | Botão distribuir fica desabilitado se nenhum selecionado |
| **Contador no botão** | Mostra "Distribuir (3)" com a quantidade |

### Fluxo Atualizado

```
1. Buscar aluno por matrícula
        ↓
2. Analisar simulado
        ↓
3. Exibir tópicos (todos selecionados por padrão)
        ↓
4. USUÁRIO seleciona/deseleciona tópicos desejados
        ↓
5. Clicar em "Distribuir (X)"
        ↓
6. Sistema distribui APENAS os tópicos selecionados
```

---

## 🐛 Pontos de Atenção

1. **Dados Mock vs Supabase**: O sistema atualmente usa dados mock para alunos MARISTA. Certifique-se de que a integração com Supabase está configurada corretamente.

2. **Formato dos Dados na Tabela `projetos`**: A coluna `students` deve ser um array JSONB com a estrutura esperada.

3. **Normalização de Matrícula**: O sistema tenta buscar com e sem zeros à esquerda. Verifique se seus dados seguem um padrão consistente.

4. **Slots Disponíveis**: A distribuição só ocorre em slots que não são aulas oficiais e não têm blocos. Verifique se há slots livres.

---

## 📞 Contato

**XTRI EdTech**  
Natal/RN - Brasil  
contato@xtri.online

---

*Relatório gerado automaticamente durante auditoria de código.*
