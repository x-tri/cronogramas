# AGENTS.md - XTRI Cronogramas

Este arquivo fornece orientações precisas para agentes de IA que trabalham no projeto XTRI Cronogramas.

---

## Visão Geral do Projeto

**XTRI Cronogramas** é um sistema web de gestão de cronogramas de estudo personalizados para alunos do Pré-Vestibular do Colégio Marista de Natal. O sistema apresenta uma interface Kanban moderna com design inspirado no Apple/Notion, integrando horários oficiais de aula com planejamento personalizado baseado em análise de desempenho em simulados.

### Funcionalidades Principais

- Busca de alunos por matrícula (Colégio Marista ou Escola XTRI)
- Cadastro de alunos avulsos (XTRI)
- Visualização Kanban da semana (Segunda a Domingo)
- Integração com horários oficiais de aula por turma
- Sistema de drag-and-drop para organizar blocos de estudo
- Análise de desempenho em simulados (integração com banco de questões)
- Exportação de PDF do cronograma
- Histórico de versões de cronogramas
- Sistema de autenticação de usuários
- Persistência dual: Supabase (produção) ou localStorage (mock)

---

## Stack Tecnológica

| Camada | Tecnologia | Versão |
|--------|------------|--------|
| Framework | React | ^19.2.0 |
| Linguagem | TypeScript | ~5.9.3 |
| Build Tool | Vite | ^7.2.4 |
| Estilização | Tailwind CSS | ^4.1.18 |
| State Management | Zustand | ^5.0.10 |
| Server Cache | TanStack Query | ^5.90.20 |
| Drag & Drop | @dnd-kit/core | ^6.3.1 |
| Backend/DB | Supabase | ^2.93.3 |
| PDF Generation | @react-pdf/renderer | ^4.3.2 |
| Validação | Zod | ^4.3.6 |
| Testes Unitários | Vitest | ^4.0.18 |
| Testes E2E | Playwright | ^1.58.1 |

---

## Estrutura do Projeto

```
xtri-cronogramas/
├── src/
│   ├── components/           # Componentes React organizados por feature
│   │   ├── blocks/          # Blocos do cronograma (cards, editor, seletores)
│   │   ├── cronograma/      # Componentes de cronograma (histórico, versões, reset)
│   │   ├── export/          # Exportação (PDF, email)
│   │   ├── kanban/          # Board Kanban, colunas, células
│   │   ├── pdf/             # Componentes de geração de PDF
│   │   ├── simulado/        # Análise de simulados
│   │   ├── student/         # Busca e card do aluno
│   │   ├── ui/              # Componentes UI reutilizáveis (Button, Input, Modal, Select)
│   │   └── week-selector.tsx # Seletor de semana
│   ├── config/              # Configurações (repository-config.ts)
│   ├── constants/           # Constantes (cores, time-slots, disciplinas)
│   │   ├── colors.ts        # Cores por área do ENEM, tipos de bloco, prioridades
│   │   └── time-slots.ts    # Configuração de turnos e slots horários
│   ├── data/                # Camada de dados (Repository Pattern)
│   │   ├── mock-data/       # Dados mock (alunos, horários, disciplinas)
│   │   ├── mock-repository.ts
│   │   ├── supabase-repository.ts
│   │   ├── factory.tsx      # Factory para criar repositórios + React Context
│   │   └── repository.ts    # Interfaces dos repositórios
│   ├── hooks/               # Custom React hooks
│   │   ├── use-cronograma.ts
│   │   ├── use-kanban-optimizations.ts
│   │   └── use-student.ts
│   ├── lib/                 # Bibliotecas/utilitários
│   │   ├── local-storage.ts
│   │   ├── query-client.ts
│   │   └── supabase.ts
│   ├── services/            # Serviços de negócio
│   │   ├── cronograma-service.ts
│   │   ├── errors.ts        # Classes de erro da aplicação
│   │   ├── exam-linker.ts   # Linker de questões de simulado
│   │   ├── result.ts        # Tipo Result para error handling funcional
│   │   ├── simulado-analyzer.ts
│   │   └── student-service.ts
│   ├── stores/              # Zustand stores
│   │   └── cronograma-store.ts
│   ├── styles/              # Estilos CSS adicionais
│   │   ├── theme-apple.css  # Tema Apple (em uso)
│   │   ├── theme-notion.css # Tema Notion
│   │   └── theme-professional.css # Tema alternativo
│   ├── test/                # Configuração de testes
│   │   └── setup.ts         # Mocks globais (localStorage, matchMedia, ResizeObserver)
│   ├── types/               # Tipos TypeScript
│   │   ├── domain.ts        # Tipos de domínio principais
│   │   └── supabase.ts      # Tipos do Supabase
│   ├── validation/          # Schemas de validação Zod
│   │   └── schemas.ts
│   ├── App.tsx              # Componente raiz (AppContent)
│   ├── AppRouter.tsx        # Roteamento baseado em autenticação
│   ├── index.css            # Estilos globais (Tailwind + custom)
│   └── main.tsx             # Entry point
├── supabase/
│   ├── migrations/          # Migrações SQL do Supabase
│   │   ├── 001_create_cronograma_tables.sql
│   │   ├── 002_create_horarios_oficiais.sql
│   │   └── 003_create_alunos_xtris.sql
│   └── functions/           # Edge Functions
├── public/                  # Assets estáticos
├── dist/                    # Build output
├── test-*.spec.ts           # Testes E2E Playwright
├── package.json
├── vite.config.ts
├── vitest.config.ts
├── tsconfig.json            # Referência para tsconfig.app.json e tsconfig.node.json
├── tsconfig.app.json        # Config TypeScript da aplicação
├── tsconfig.node.json       # Config TypeScript do Node/Vite
├── eslint.config.js
├── vercel.json              # Configuração de deploy na Vercel
├── Dockerfile               # Container Docker multi-stage
├── docker-compose.yml       # Orquestração Docker
└── nginx.conf               # Configuração Nginx para produção
```

---

## Comandos de Build e Desenvolvimento

```bash
# Instalar dependências (usando pnpm)
pnpm install

# Desenvolvimento local
pnpm dev              # Inicia servidor na porta 5173

# Build para produção
pnpm build            # TypeScript check + Vite build

# Preview do build
pnpm preview

# Lint
pnpm lint

# Testes Unitários
pnpm test             # Executar todos os testes (Vitest)
pnpm test:watch       # Modo watch
pnpm test:ui          # UI do Vitest
pnpm test:coverage    # Cobertura de testes

# Testes E2E (Playwright)
npx playwright test
npx playwright test --ui
```

---

## Padrões de Código

### Estilo e Formatação

- **TypeScript**: Modo estrito (`strict: true`)
- **ESLint**: Configuração recomendada do TypeScript + React Hooks + React Refresh
- **Tailwind CSS v4**: Usa `@import "tailwindcss"` e plugin `@tailwindcss/vite`
- **Fonte**: Inter (Google Fonts) e SF Pro (system fonts)

### Convenções de Nomenclatura

- **Componentes**: PascalCase (`StudentSearch.tsx`, `KanbanBoard.tsx`)
- **Hooks**: camelCase com prefixo `use` (`useCronograma.ts`)
- **Stores**: camelCase com sufixo `Store` (`cronograma-store.ts`)
- **Tipos/Interfaces**: PascalCase (`Aluno`, `Cronograma`, `BlocoCronograma`)
- **Constants**: UPPER_SNAKE_CASE (`DIAS_SEMANA`, `TURNOS_CONFIG`, `CORES_AREAS`)
- **Arquivos**: kebab-case para arquivos não-componente

### Estrutura de Tipos (domain.ts)

```typescript
// Enums como const arrays
export const DIAS_SEMANA = ['segunda', 'terca', ...] as const
export type DiaSemana = (typeof DIAS_SEMANA)[number]

// Entidades com timestamps
export type Aluno = {
  id: string
  matricula: string
  nome: string
  turma: string
  email: string | null
  escola: Escola
  fotoFilename: string | null
  createdAt: Date
}
```

### Organização de Imports

```typescript
// 1. React/imports de biblioteca
import { useState } from 'react'
import { DndContext } from '@dnd-kit/core'

// 2. Imports absolutos (@/)
import { useCronogramaStore } from '@/stores/cronograma-store'
import { DIAS_SEMANA } from '@/types/domain'

// 3. Imports relativos
import { KanbanColumn } from './kanban-column'
import type { KanbanBoardProps } from './types'
```

### Error Handling

O projeto usa um padrão funcional de error handling baseado no tipo `Result<T, E>`:

```typescript
import { type Result, ok, err, tryCatch } from '@/services/result'
import { AppError } from '@/services/errors'

// Em serviços
async findByMatricula(matricula: string): Promise<Result<Aluno, AppError>> {
  const result = await tryCatch(
    () => repository.students.findByMatricula(matricula),
    mapError
  )
  
  if (!result.success) {
    return result // Propaga erro
  }
  
  if (!result.data) {
    return err(AppError.studentNotFound(matricula))
  }
  
  return ok(result.data)
}
```

---

## Padrão Repository

O projeto utiliza o padrão Repository para abstrair a camada de dados:

### Modos de Operação

Configure via `VITE_REPOSITORY_MODE` no `.env.local`:

- **`supabase`**: Usa Supabase como backend (requer `VITE_SUPABASE_URL` e `VITE_SUPABASE_KEY`)
- **`mock`**: Usa dados em memória com persistência no localStorage
- **`auto`** (padrão): Tenta Supabase primeiro, fallback para mock

### Interface Repository

```typescript
// src/data/repository.ts
export type DataRepository = {
  students: StudentRepository
  schedules: ScheduleRepository
  cronogramas: CronogramaRepository
  blocos: BlocoRepository
  subjects: SubjectRepository
}
```

### Uso

```typescript
import { useRepository } from '@/data/factory'

const repo = useRepository()
const aluno = await repo.students.findByMatricula('214150129')
```

### Dados Mock

Os dados mock incluem:
- **66 alunos**: Turmas 2A (34) e 2B (32)
- **Disciplinas**: Todas as disciplinas do pré-vestibular com áreas do ENEM
- **Horários**: Grade completa por turma

---

## State Management

### Zustand Store Principal

A store `cronograma-store.ts` gerencia:
- Dados do aluno atual (`currentStudent`)
- Horários oficiais (`officialSchedule`)
- Cronograma e blocos ativos (`cronograma`, `blocks`)
- Semana selecionada (`selectedWeek`)
- Versões históricas (`cronogramaVersions`)
- Estados de loading e erro

```typescript
import { useCronogramaStore } from '@/stores/cronograma-store'

// No componente
const currentStudent = useCronogramaStore((state) => state.currentStudent)
const addBlock = useCronogramaStore((state) => state.addBlock)
```

### React Query

Usado para cache de dados do servidor:
- Configurado em `src/lib/query-client.ts`
- DevTools disponíveis em desenvolvimento

---

## Testes

### Configuração

- **Framework**: Vitest
- **Ambiente**: jsdom
- **Testing Library**: @testing-library/react + @testing-library/jest-dom
- **Setup**: `src/test/setup.ts`

### Mocks Globais (setup.ts)

```typescript
// localStorage mock
// matchMedia mock
// ResizeObserver mock
```

### Tipos de Testes

1. **Unit Tests**: Testes de funções puras e hooks (`*.test.ts`)
2. **Component Tests**: Testes de renderização e interação (`*.test.tsx`)
3. **E2E Tests**: Playwright (`test-*.spec.ts` na raiz do projeto)

### Executando Testes

```bash
# Unit tests
pnpm test
pnpm test:watch
pnpm test:coverage

# E2E tests
npx playwright test
npx playwright test --ui
```

---

## Banco de Dados (Supabase)

### Tabelas Principais

```sql
-- Cronogramas
CREATE TABLE cronogramas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id TEXT NOT NULL,
  semana_inicio DATE NOT NULL,
  semana_fim DATE NOT NULL,
  observacoes TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Blocos do Cronograma
CREATE TABLE blocos_cronograma (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cronograma_id UUID NOT NULL REFERENCES cronogramas(id) ON DELETE CASCADE,
  dia_semana TEXT NOT NULL,
  horario_inicio TEXT NOT NULL,
  horario_fim TEXT NOT NULL,
  turno TEXT NOT NULL,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  disciplina_codigo TEXT,
  cor TEXT,
  prioridade INTEGER NOT NULL DEFAULT 0,
  concluido BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Horários Oficiais
CREATE TABLE horarios_oficiais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turma TEXT NOT NULL,
  dia_semana TEXT NOT NULL,
  horario_inicio TEXT NOT NULL,
  horario_fim TEXT NOT NULL,
  turno TEXT NOT NULL,
  disciplina TEXT NOT NULL,
  professor TEXT
);

-- Alunos XTRI (avulsos)
CREATE TABLE alunos_xtris (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matricula TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabelas de Simulado (integração existente)
CREATE TABLE students (...)
CREATE TABLE exams (...)
CREATE TABLE student_answers (...)
```

### Migrações

Localizadas em `supabase/migrations/`. Execute no SQL Editor do Supabase:

1. `001_create_cronograma_tables.sql`
2. `002_create_horarios_oficiais.sql`
3. `003_create_alunos_xtris.sql`

---

## Variáveis de Ambiente

Arquivo `.env.local` (nunca commitar!):

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_KEY=sua-chave-anon

# Repository Mode: 'supabase' | 'mock' | 'auto'
VITE_REPOSITORY_MODE=auto

# Opcional: chave para persistência mock no localStorage
VITE_LOCAL_STORAGE_KEY=xtri-cronogramas-data

# Debug mode
VITE_DEBUG=false
```

---

## Configuração de Horários

### Turnos

```typescript
TURNOS_CONFIG = {
  manha: { inicio: '07:15', fim: '13:35', slots: [...] },
  tarde: { inicio: '14:35', fim: '19:05', slots: [...] },
  noite: { inicio: '19:30', fim: '22:30', slots: [...] }
}
```

### Configuração por Dia

- Segunda a Sexta: Aulas de manhã
- Terça: Aulas de manhã + vespertino (tarde)
- Sábado e Domingo: Livres

---

## Cores e Áreas do ENEM

```typescript
CORES_AREAS = {
  natureza: '#10B981',    // Verde
  matematica: '#EF4444',  // Vermelho
  linguagens: '#3B82F6',  // Azul
  humanas: '#F97316',     // Laranja
  outros: '#8B5CF6',      // Roxo
}
```

Detecção automática de área por palavras-chave no título do bloco. Ver `src/constants/colors.ts` para lista completa de keywords.

---

## Deploy

### Frontend (Vercel)

Configurado via `vercel.json`:
- Build command: `npm run build`
- Output directory: `dist`
- Framework: Vite
- SPA routing configurado (rewrites para index.html)

```bash
# Deploy manual
vercel --prod
```

### Docker

Configuração multi-stage:
- **Stage 1**: Build com Node.js 20
- **Stage 2**: Nginx Alpine para servir arquivos estáticos

```bash
# Build e run com Docker Compose
docker-compose up --build
```

### Variáveis de Ambiente na Vercel

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_KEY`

### Configuração CORS no Supabase

Adicione a URL da Vercel em: **Settings > API > URL Configuration > Allowed Origins**

```
https://seu-projeto.vercel.app
```

---

## Fluxo de Dados Típico

```
1. Busca por Matrícula
   StudentSearch → studentService.findByMatricula → 
   Repository → State (currentStudent)

2. Carregamento de Cronograma
   setSelectedWeek → repo.cronogramas.getCronograma →
   repo.blocos.getBlocos → State (cronograma, blocks)

3. Adicionar Bloco
   addBlock → repo.blocos.createBloco → 
   State update → UI re-render

4. Drag & Drop
   DndKit → moveBlock → repo.blocos.updateBloco →
   State update → UI re-render

5. Análise de Simulado
   Upload de arquivo → simulado-analyzer →
   Sugestões de estudo baseadas em questões erradas
```

---

## Componentes Principais

### Kanban

- `KanbanBoard`: Container principal com DndContext
- `KanbanColumn`: Coluna de um dia da semana
- `KanbanCell`: Célula de um turno em um dia
- `DraggableBlockCard`: Card arrastável
- `BlockCard`: Visualização estática do card

### Blocos

- `BlockEditorModal`: Modal de edição/criação
- `BlockTypeSelector`: Seletor de tipo (estudo, revisão, etc.)
- `DisciplinaSelector`: Seletor de disciplina com cores

### Aluno

- `StudentSearch`: Input de busca por matrícula
- `StudentCard`: Exibição dos dados do aluno
- `StudentAvatar`: Avatar com fallback
- `AlunoAvulsoForm`: Cadastro de alunos XTRI

### Exportação

- `SchedulePDFDocument`: Documento PDF (@react-pdf/renderer)
- `ShareDropdown`: Menu de exportação/compartilhamento

### Simulado

- `SimuladoAnalyzer`: Upload e análise de resultados do simulado

---

## Considerações de Segurança

1. **RLS (Row Level Security)**: Habilitado no Supabase para todas as tabelas
2. **Service Role Key**: Usada para operações administrativas (em `.env.local`)
3. **Validação**: Zod schemas para validação de formulários em `src/validation/schemas.ts`
4. **Sanitização**: React JSX escapa automaticamente conteúdo
5. **Variáveis de ambiente**: Nunca commite arquivos `.env.local`

---

## Validação

O projeto usa Zod para validação de schemas:

```typescript
// src/validation/schemas.ts
import { z } from 'zod'

export const blocoFormSchema = z.object({
  tipo: z.enum(TIPOS_BLOCO),
  titulo: z.string().min(1).max(100),
  descricao: z.string().max(500).optional(),
  disciplinaCodigo: z.string().optional(),
  prioridade: z.number().min(0).max(2),
})
```

---

## Dicas para Desenvolvedores

1. Use o modo `mock` para desenvolvimento offline (`VITE_REPOSITORY_MODE=mock`)
2. Teste sempre em ambos os modos (mock e supabase)
3. Mantenha os tipos em `domain.ts` sincronizados com o schema do Supabase
4. Use o padrão Repository para todas as operações de dados
5. Prefira Zustand para estado global, React Query para cache de servidor
6. Componentes devem ser pequenos e focados em uma responsabilidade
7. Use os seletores da store para dados derivados
8. Siga o padrão Result<T, E> para error handling em serviços
9. O tema visual segue o estilo Apple (cores neutras, design minimalista, glassmorphism)

---

## Contato

**XTRI EdTech**  
Natal/RN - Brasil  
contato@xtri.online
