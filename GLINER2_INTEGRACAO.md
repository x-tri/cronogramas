# GLiNER2 no XTRI Cronogramas

## Objetivo

Usar o GLiNER2 para enriquecer `question_contents` de `exams` e `projetos` com
uma taxonomia canônica compatível com o app:

- área ENEM
- disciplina
- tópico
- resumo curto
- palavras-chave

O frontend continua leve. A inferência roda offline em Python e o React só
consome o metadado salvo no JSONB.

## Por que offline

Este projeto é Vite/React estático. O GLiNER2 depende de Python/Torch e não é
um bom candidato para inferência no navegador.

O encaixe correto é ETL/enriquecimento:

1. buscar `question_contents` no Supabase legado,
2. enriquecer com GLiNER2,
3. salvar o metadado no próprio JSONB,
4. o app só usa o rótulo do GLiNER quando ele estiver aprovado.

## Instalação local

```bash
python3 -m venv .venv-gliner
source .venv-gliner/bin/activate
pip install --upgrade pip
pip install gliner2
```

## Dry run em um exame

```bash
pnpm gliner:enrich -- \
  --table exams \
  --record-id 4f791b0e-0605-41d0-bc4e-127d9db17e9e \
  --dry-run
```

## Aplicar no Supabase

Use service role quando houver RLS bloqueando `PATCH`.

```bash
export SUPABASE_SERVICE_ROLE_KEY="..."

pnpm gliner:enrich -- \
  --table exams \
  --record-id 4f791b0e-0605-41d0-bc4e-127d9db17e9e \
  --apply
```

## Arquivo local

Também dá para enriquecer um JSON exportado sem tocar no banco:

```bash
pnpm gliner:enrich -- \
  --input-file output/question-contents.json \
  --output-file output/question-contents.enriched.json
```

## Metadado salvo

Cada item de `question_contents` passa a aceitar:

```json
{
  "questionNumber": 1,
  "answer": "A",
  "content": "Charge (Humor/Trabalho)",
  "gliner": {
    "model": "fastino/gliner2-base-v1",
    "sourceText": "Charge (Humor/Trabalho)",
    "suggestedArea": "Ciências Humanas",
    "suggestedSubject": "Sociologia",
    "suggestedTopic": "Trabalho e produção",
    "suggestedLabel": "Sociologia - Trabalho e produção",
    "approvedLabel": null,
    "reviewStatus": "pending",
    "summary": "humor sobre trabalho",
    "keywords": ["humor", "trabalho"],
    "classifiedAt": "2026-04-06T00:00:00+00:00"
  }
}
```

## Consumo no app

O frontend agora resolve o tópico nesta ordem:

1. `question_contents[].gliner.approvedLabel` ou `suggestedLabel` com `reviewStatus=approved`
2. `question_contents[].content`
3. fallback legado por faixa do número da questão

Isso reduz dependência da heurística `Q1-5`, `Q6-10`, etc., sem quebrar
compatibilidade com dados antigos.

## Regra de segurança

No dry-run real deste projeto, algumas sugestões do modelo vieram boas e outras
claramente erradas para snippets muito curtos. Por isso o pipeline já nasce em
modo de revisão:

- GLiNER sugere
- humano aprova
- só então o app passa a usar o rótulo enriquecido
