# 🧪 Como Testar Localmente

## Opção 1: Script Automático (Recomendado)

```bash
cd "/Volumes/1T/backup/apps/Horários de estudo 1.0/xtri-cronogramas"
./start-dev.sh
```

Este script vai:
- Limpar cache
- Verificar porta ocupada
- Instalar dependências (se necessário)
- Iniciar o servidor

## Opção 2: Comandos Manuais

### Passo 1: Ir para o diretório
```bash
cd "/Volumes/1T/backup/apps/Horários de estudo 1.0/xtri-cronogramas"
```

### Passo 2: Limpar cache (se servidor não iniciar)
```bash
rm -rf node_modules/.vite
```

### Passo 3: Matar processos na porta (se ocupada)
```bash
lsof -ti:5173 | xargs kill -9 2>/dev/null
```

### Passo 4: Iniciar servidor
```bash
npm run dev
```

### Passo 5: Acessar
Abra: **http://localhost:5173**

---

## 🔧 Problemas Comuns

### ❌ "Port 5173 is already in use"

**Solução:** O Vite vai tentar outra porta automaticamente (5174, 5175...).

Ou force uma porta específica:
```bash
npx vite --port 3000
```

### ❌ "Cannot find module"

**Solução:**
```bash
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### ❌ Página em branco / Erros no console

**Solução:** Limpar cache do navegador:
- Chrome: `Cmd + Shift + R` (Mac) ou `Ctrl + Shift + R` (Windows)
- Ou abra em aba anônima: `Cmd + Shift + N`

### ❌ "failed to load config from vite.config.ts"

**Solução:** Verifique se o arquivo existe:
```bash
ls -la vite.config.ts
```

Se estiver corrompido, restaure:
```bash
git checkout vite.config.ts
```

---

## ✅ Fluxo de Teste da Nova Funcionalidade

1. **Acesse:** http://localhost:5173
2. **Digite matrícula:** `214150129` (ou qualquer uma do mock)
3. **Clique:** "Buscar"
4. **Clique:** "Analisar Simulado"
5. **Teste a seleção:**
   - ☑ Veja que todos começam selecionados
   - ☐ Desmarque alguns tópicos
   - Veja o contador atualizar: "2 de 4 selecionados"
   - Clique "Limpar seleção" → todos desmarcados
   - Clique "Selecionar todos" → todos marcados
6. **Distribua:**
   - Com alguns selecionados, clique "Distribuir (X)"
   - Verifique se só os selecionados foram para o Kanban

---

## 📸 Screenshots Esperados

Após "Analisar Simulado":

```
┌────────────────────────────────────────────────────────────┐
│ Simulado ENEM 2024                                 [X]     │
│ 120 acertos • 45 erros • 15 em branco                      │
├────────────────────────────────────────────────────────────┤
│ LC [====]  CH [====]  CN [====]  MT [====]                │
├────────────────────────────────────────────────────────────┤
│ Selecione os tópicos para revisar      4 de 4 selecionados │
│ [Selecionar todos] | [Limpar seleção]                      │
├────────────────────────────────────────────────────────────┤
│ ☑ Linguagens - 10 erros para revisar        [10 erros]     │  ← Azul
│ ☑ Matemática - 10 erros para revisar        [10 erros]     │  ← Azul
│ ☑ Natureza - 5 erros para revisar            [5 erros]     │  ← Azul
│ ☑ Humanas - 8 erros para revisar             [8 erros]     │  ← Azul
├────────────────────────────────────────────────────────────┤
│ 4 tópicos serão adicionados      [Cancelar] [Distribuir(4)]│
└────────────────────────────────────────────────────────────┘
```

Ao desmarcar alguns:
```
│ ☐ Matemática - 10 erros para revisar        [10 erros]     │  ← Branco
```

---

## 🆘 Ainda não funciona?

Me envie:
1. **Screenshot** do terminal com o erro
2. **Screenshot** do navegador
3. **Output** do comando:
   ```bash
   cd "/Volumes/1T/backup/apps/Horários de estudo 1.0/xtri-cronogramas"
   npm run dev 2>&1 | head -50
   ```

---

## 📞 Alternativa: Build e Preview

Se o modo dev não funcionar, tente:

```bash
# Build
npm run build

# Preview do build
npm run preview
```

Acesse: http://localhost:4173
