# 🔍 Investigando a Tabela Student_Content

Parece que encontramos algo importante! A tabela `Student_Content` provavelmente contém os conteúdos específicos das provas.

## Queries para investigar:

```sql
-- 1. Estrutura da tabela Student_Content
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Student_Content'
ORDER BY ordinal_position;

-- 2. Quantos registros existem?
SELECT COUNT(*) as total FROM "Student_Content";

-- 3. Ver alguns registros
SELECT * FROM "Student_Content" LIMIT 5;

-- 4. Buscar conteúdo do projeto específico (Diagnóstica-MarRN)
SELECT * FROM "Student_Content" 
WHERE project_id = 'a0753a5a-fda3-4ae8-b8e1-516660c76752'
LIMIT 10;

-- 5. Ou buscar por nome do projeto
SELECT * FROM "Student_Content" 
WHERE project_name ILIKE '%Diagnóstica%'
LIMIT 10;

-- 6. Ver se tem campo de questão (question_number, numero_questao, etc.)
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'Student_Content'
AND (
  column_name ILIKE '%question%'
  OR column_name ILIKE '%questao%'
  OR column_name ILIKE '%numero%'
  OR column_name ILIKE '%content%'
  OR column_name ILIKE '%conteudo%'
);
```

## Perguntas importantes:

1. **A tabela `Student_Content` tem o quê?**
   - Conteúdos de cada questão?
   - Gabarito?
   - Respostas dos alunos?

2. **Como faz o link com o projeto?**
   - Tem `project_id`?
   - Tem `project_name`?
   - Tem outro campo?

3. **Como identifica cada questão?**
   - `question_number`?
   - `numero_questao`?
   - `questao`?

4. **Onde está o conteúdo?**
   - Coluna `content`?
   - Coluna `conteudo`?
   - Coluna `topic`?

## Execute no SQL Editor:

1. Acesse: https://supabase.com/dashboard
2. Vá em: **SQL Editor**
3. Cole as queries acima
4. Me envie os resultados

Assim posso ver exatamente como fazer o link entre:
- Projeto → Student_Content → Questões específicas
