# Deploy na Hostinger

Fluxo atual de publicacao do projeto:

1. Gere o build local:

```bash
pnpm build
```

2. Compacte o conteudo de `dist/` em um `.zip`.

3. No File Manager da Hostinger, abra `public_html`.

4. Substitua o `index.html` e a pasta `assets/` pelo build novo.

5. Mantenha apenas os arquivos estaticos realmente usados pelo app, como `logo-xtri.png` e `vite.svg`.

6. Faca um hard refresh no navegador apos o upload:

- Windows: `Ctrl+F5`
- macOS: `Cmd+Shift+R`

## Quando houver mudanca em Edge Functions

Publique a funcao no Supabase antes de subir o frontend:

```bash
npx supabase functions deploy nome-da-funcao --project-ref axtmozyrnsrhqrnktshz
```

Observacoes importantes:

- `plano-estudo-generator` deve ser publicada com `--no-verify-jwt`
- segredos como `MARITACA_KEY` ficam no Supabase, nao no frontend
- confira `https://horariodeestudos.com` em aba anonima apos o deploy

## Checklist rapido

- `pnpm build` passou
- a Edge Function nova foi publicada
- `public_html` recebeu o `index.html` e `assets/` novos
- o site carregou os bundles novos
- login, plano IA e PDF funcionaram
