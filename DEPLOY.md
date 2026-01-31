# Deploy na Vercel

## Passos para deploy

### 1. Conectar repositório

1. Acesse [vercel.com](https://vercel.com)
2. Login com GitHub
3. Clique em "Add New Project"
4. Selecione o repositório `x-tri/cronograma-de-estudos`

### 2. Configurar variáveis de ambiente

Na interface da Vercel, adicione estas variáveis:

```
VITE_SUPABASE_URL=https://axtmozyrnsrhqrnktshz.supabase.co
VITE_SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> ⚠️ **Importante:** Use a chave `anon` pública do Supabase, não a service_role!

### 3. Configurações de build

A Vercel deve detectar automaticamente:
- **Framework:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

### 4. Deploy

Clique em "Deploy" e aguarde o build.

## Configurações do Supabase

### CORS (para produção)

No dashboard do Supabase, adicione a URL da Vercel em:
**Settings > API > URL Configuration > Allowed Origins**

```
https://seu-projeto.vercel.app
```

### Migrações

Execute as migrations no SQL Editor:

1. `001_create_cronograma_tables.sql`
2. `002_create_horarios_oficiais.sql`
3. `003_create_alunos_xtris.sql`

## URLs

- **Produção:** `https://seu-projeto.vercel.app`
- **Preview:** Gerado automaticamente em cada PR
