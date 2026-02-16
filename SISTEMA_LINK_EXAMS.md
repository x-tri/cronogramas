# 🔗 Sistema de Link Inteligente - Exams

## Problema
O sistema não estava encontrando os exams porque:
- O projeto tem ID: `a0753a5a-fda3-4ae8-b8e1-516660c76752`
- O exam pode ter um ID diferente
- Não existe relação direta por ID entre projetos e exams

## Solução - Linker Inteligente

Criamos um sistema que tenta **5 métodos diferentes** de encontrar o exam:

### Método 1: Busca por ID
```sql
SELECT * FROM exams WHERE id = 'a0753a5a-fda3-4ae8-b8e1-516660c76752'
```

### Método 2: Busca por nome
```sql
SELECT * FROM exams WHERE title ILIKE '%Diagnóstica-MarRN%'
```

### Método 3: Busca por similaridade
Compara nomes normalizados (sem espaços, lowercase)

### Método 4: Campos de link
Verifica se existe algum campo como:
- `project_id`
- `projeto_id`  
- `simulado_id`
- `exam_id`

### Método 5: Tabelas de relacionamento
Verifica tabelas como:
- `project_exams`
- `projeto_exams`
- `simulado_exams`

---

## Busca de Conteúdos

Após encontrar o exam, busca os conteúdos das questões:

### Opção 1: Campo `question_contents` (JSONB array)
```json
[
  {"questionNumber": 1, "content": "Interpretação de Texto", "answer": "A"},
  {"questionNumber": 2, "content": "Gramática", "answer": "B"}
]
```

### Opção 2: Campo `contents` (JSONB array)
Mesma estrutura acima

### Opção 3: Tabela separada
Busca em tabelas como:
- `questions`
- `questoes`
- `exam_questions`

---

## Estrutura esperada da tabela exams

```sql
CREATE TABLE exams (
  id UUID PRIMARY KEY,
  title TEXT,
  answer_key TEXT[],           -- Gabarito ["A", "B", "C", ...]
  question_contents JSONB[],   -- Conteúdos [{"questionNumber": 1, "content": "..."}]
  -- OU
  contents JSONB[],            -- Alternativa
  -- Campos de link opcionais:
  project_id UUID,
  simulado_nome TEXT
);
```

---

## Como verificar seu banco

### 1. Ver estrutura da tabela exams:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'exams';
```

### 2. Ver exams disponíveis:
```sql
SELECT id, title, created_at 
FROM exams 
ORDER BY created_at DESC 
LIMIT 10;
```

### 3. Ver conteúdo de um exam:
```sql
SELECT id, title, 
       array_length(answer_key, 1) as total_respostas,
       array_length(question_contents, 1) as total_conteudos
FROM exams 
LIMIT 5;
```

### 4. Ver se existe tabela de relacionamento:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%exam%';
```

---

## Logs esperados

Quando funcionar, você verá no console:
```
[findExamForProject] Buscando exam para projeto: a0753a5a-...
[findExamForProject] Método 1: Buscando por ID...
[findExamForProject] Método 2: Buscando por nome: Diagnóstica-MarRN
[findExamForProject] ✅ Encontrado por nome!
[getQuestionContents] Buscando conteúdos para exam: xxx
[getQuestionContents] ✅ Usando question_contents
[getRealWrongQuestionsFromExam] ✅ Calculados 45 erros reais!
```

---

## Se ainda não funcionar

Me envie o resultado dessas queries:
1. Estrutura da tabela exams
2. Lista de exams disponíveis
3. Se existe alguma tabela de relacionamento

Assim posso ajustar o linker para sua estrutura específica!
