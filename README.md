# XTRI Cronogramas

Sistema web para montar cronogramas de estudo personalizados de alunos do XTRI e do Colégio Marista, com quadro semanal, análise de simulados e exportação de PDF.

## Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Zustand
- TanStack Query
- Supabase
- Vitest
- Playwright

## Principais fluxos

- busca de aluno por matrícula
- cronograma semanal em formato kanban
- integração com horários oficiais
- análise de simulado
- geração de plano de estudos com IA
- exportação de PDF do cronograma e do plano

## Desenvolvimento

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
```

## Ambiente

Crie um `.env.local` com:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_KEY=...
VITE_REPOSITORY_MODE=supabase
```

Observações:

- a chave da Maritaca fica no Supabase como segredo server-side
- o frontend estático nao deve expor `SUPABASE_SERVICE_ROLE_KEY`

## Deploy atual

O deploy do frontend é feito por upload manual do build na Hostinger. O fluxo atual está documentado em [DEPLOY-HOSTINGER.md](./DEPLOY-HOSTINGER.md).

Quando houver mudança em Edge Functions, publique no Supabase antes de atualizar o frontend.
