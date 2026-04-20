# XTRI Cronogramas

Monorepo do frontend XTRI — preparação ENEM baseada em TRI.

- **`/`** — painel admin (super admin e coordenador) em `horariodeestudos.com`
- **`/aluno`** — portal do aluno em `aluno.horariodeestudos.com`

Stack: React 19 + TypeScript strict + Vite 7 + Supabase + pnpm.

## Deploy

### 🚀 Automático (padrão)

Push em `main` dispara o workflow `.github/workflows/deploy-hostinger.yml`:

1. **CI gate** — `tsc --noEmit` + 294 testes Vitest (admin) + `tsc` do aluno
2. **Deploy** — build admin + aluno → snapshot do `public_html` atual (mantém 3 últimos) → rsync via SSH → verify por hash do bundle servido

Logs: aba **Actions** do repo. Tempo médio: **~3 min**.

Deploy manual pela UI: **Actions → Deploy to Hostinger → Run workflow**.

### 🔧 Fallback manual — `./deploy-hostinger.sh`

Se o GitHub Actions estiver com outage ou você precisar subir um hotfix sem passar por `main`:

```bash
cp .env.deploy.example .env.deploy  # preencha HOSTINGER_PASSWORD
brew install hudochenkov/sshpass/sshpass

./deploy-hostinger.sh              # build + deploy admin + aluno
./deploy-hostinger.sh --no-build   # só sobe dist/ existente
./deploy-hostinger.sh admin        # só admin
./deploy-hostinger.sh aluno        # só aluno
```

`.env.deploy` está no `.gitignore` — nunca commitar.

### ↩️ Rollback

**Via Git** (lento, passa pelo CI de novo, ~3 min):
```bash
git revert <sha-ruim> && git push origin main
```

**Via snapshot no servidor** (instantâneo, ~30s — credenciais no `.env.deploy` local):
```bash
source .env.deploy
ssh -i ~/.ssh/hostinger_deploy -p "$HOSTINGER_PORT" \
    "$HOSTINGER_USER@$HOSTINGER_HOST" '
  cd domains/horariodeestudos.com
  ls -dt public_html.bak-*  # lista snapshots (até 3 mantidos)
  rm -rf public_html
  mv public_html.bak-<timestamp> public_html
'
```

---

## Template original Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
