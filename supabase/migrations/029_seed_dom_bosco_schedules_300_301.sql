-- Migration 029: seed school_schedules para Dom Bosco — Turma 300 e 301 (2026)
--
-- Fonte: PARAMETRIZAÇÃO ENSINO MÉDIO 2026.xlsx, sheet ' HORÁRIOS - 1ª SEMESTRE 2026'
-- 3ª série, 2 turmas, ano letivo 2026.
--
-- Blocos vazios do contraturno NAO sao cadastrados (decisao PO 2026-05-01):
-- coord adiciona via mentoria individual quando definir.
--
-- Idempotente: DELETE da tupla (school_id, turma, ano_letivo) antes do INSERT.

DO $$
DECLARE
  v_school_id uuid := '4c8b9c6a-8a3c-48a7-b913-9eb2acf8a25e';  -- Dom Bosco
  v_ano int := 2026;
  v_inserted int;
BEGIN
  -- Limpa qualquer cadastro previo de Turma 300 ou 301 desse ano (idempotencia)
  DELETE FROM public.school_schedules
  WHERE school_id = v_school_id AND ano_letivo = v_ano AND turma IN ('Turma 300','Turma 301');

-- Inserindo 72 blocos (36 Turma 300 + 36 Turma 301)
  INSERT INTO public.school_schedules
    (school_id, turma, dia_semana, horario_inicio, horario_fim, turno, disciplina, professor, ano_letivo)
  VALUES
    (v_school_id, 'Turma 300', 'segunda', '07:20', '08:05', 'manha', 'ARTE', 'RAFAELA CRISTINA', v_ano),
    (v_school_id, 'Turma 300', 'terca', '07:20', '08:05', 'manha', 'FÍSICA II', 'CARLOS ALBERTO', v_ano),
    (v_school_id, 'Turma 300', 'quarta', '07:20', '08:05', 'manha', 'HISTÓRIA', 'ARNALDO JR.', v_ano),
    (v_school_id, 'Turma 300', 'quinta', '07:20', '08:05', 'manha', 'QUÍMICA I', 'CLEWTON MELO', v_ano),
    (v_school_id, 'Turma 300', 'sexta', '07:20', '08:05', 'manha', 'MATEMÁTICA 4-5', 'FELIPE MARTINS', v_ano),
    (v_school_id, 'Turma 300', 'segunda', '08:05', '08:50', 'manha', 'BIOLOGIA II', 'LUIS FERNANDO', v_ano),
    (v_school_id, 'Turma 300', 'terca', '08:05', '08:50', 'manha', 'LÍNGUA PORTUGUESA', 'ANTÔNIO MORAES', v_ano),
    (v_school_id, 'Turma 300', 'quarta', '08:05', '08:50', 'manha', 'MATEMÁTICA 4-5', 'FELIPE MARTINS', v_ano),
    (v_school_id, 'Turma 300', 'quinta', '08:05', '08:50', 'manha', 'QUÍMICA I', 'CLEWTON MELO', v_ano),
    (v_school_id, 'Turma 300', 'sexta', '08:05', '08:50', 'manha', 'INGLÊS/ESPANHOL', 'LEANDRO VEIGA / ADRIANNE VELOSO', v_ano),
    (v_school_id, 'Turma 300', 'segunda', '09:05', '09:50', 'manha', 'QUÍMICA II', 'WELYSON MESQUITA', v_ano),
    (v_school_id, 'Turma 300', 'terca', '09:05', '09:50', 'manha', 'FÍSICA II', 'CARLOS ALBERTO', v_ano),
    (v_school_id, 'Turma 300', 'quarta', '09:05', '09:50', 'manha', 'LÍNGUA PORTUGUESA', 'ANTÔNIO MORAES', v_ano),
    (v_school_id, 'Turma 300', 'quinta', '09:05', '09:50', 'manha', 'FILOSOFIA', 'CLÁUDIA RAÍSSA', v_ano),
    (v_school_id, 'Turma 300', 'sexta', '09:05', '09:50', 'manha', 'GEOGRAFIA', 'DIÓGENES MOREIRA', v_ano),
    (v_school_id, 'Turma 300', 'segunda', '09:50', '10:35', 'manha', 'FÍSICA I', 'NOBUYUKI DOIHARA', v_ano),
    (v_school_id, 'Turma 300', 'terca', '09:50', '10:35', 'manha', 'BIOLOGIA II', 'LUIS FERNANDO', v_ano),
    (v_school_id, 'Turma 300', 'quarta', '09:50', '10:35', 'manha', 'LÍNGUA PORTUGUESA', 'ANTÔNIO MORAES', v_ano),
    (v_school_id, 'Turma 300', 'quinta', '09:50', '10:35', 'manha', 'MATEMÁTICA 1-2-3', 'MARCÔNIO NÓBREGA', v_ano),
    (v_school_id, 'Turma 300', 'sexta', '09:50', '10:35', 'manha', 'GEOGRAFIA', 'DIÓGENES MOREIRA', v_ano),
    (v_school_id, 'Turma 300', 'segunda', '10:55', '11:40', 'manha', 'PRODUÇÃO TEXTUAL', 'SÂMIA RAFAELA', v_ano),
    (v_school_id, 'Turma 300', 'terca', '10:55', '11:40', 'manha', 'LITERATURA', 'GRAÇA FIGUERÊDO', v_ano),
    (v_school_id, 'Turma 300', 'quarta', '10:55', '11:40', 'manha', 'MATEMÁTICA 1-2-3', 'MARCÔNIO NÓBREGA', v_ano),
    (v_school_id, 'Turma 300', 'quinta', '10:55', '11:40', 'manha', 'PERCURSO DE APROFUNDAMENTO MATEMÁTICA 1-2-3', 'MARCÔNIO NÓBREGA', v_ano),
    (v_school_id, 'Turma 300', 'sexta', '10:55', '11:40', 'manha', 'HISTÓRIA', 'ARNALDO JR.', v_ano),
    (v_school_id, 'Turma 300', 'segunda', '11:40', '12:25', 'manha', 'PRODUÇÃO TEXTUAL', 'SÂMIA RAFAELA', v_ano),
    (v_school_id, 'Turma 300', 'terca', '11:40', '12:25', 'manha', 'GEOGRAFIA', 'DIÓGENES MOREIRA', v_ano),
    (v_school_id, 'Turma 300', 'quarta', '11:40', '12:25', 'manha', 'MATEMÁTICA 1-2-3', 'MARCÔNIO NÓBREGA', v_ano),
    (v_school_id, 'Turma 300', 'quinta', '11:40', '12:25', 'manha', 'QUÍMICA II', 'WELYSON MESQUITA', v_ano),
    (v_school_id, 'Turma 300', 'sexta', '11:40', '12:25', 'manha', 'BIOLOGIA I', 'MARCOS DANÚBIO', v_ano),
    (v_school_id, 'Turma 300', 'segunda', '12:25', '13:10', 'manha', 'BIOLOGIA I', 'MARCOS DANÚBIO', v_ano),
    (v_school_id, 'Turma 300', 'terca', '12:25', '13:10', 'manha', 'PERCURSO DE APROFUNDAMENTO PRODUÇÃO TEXTUAL', 'SÂMIA RAFAELA', v_ano),
    (v_school_id, 'Turma 300', 'quarta', '12:25', '13:10', 'manha', 'FÍSICA I', 'NOBUYUKI DOIHARA', v_ano),
    (v_school_id, 'Turma 300', 'quinta', '12:25', '13:10', 'manha', 'SOCIOLOGIA', 'CLÁUDIA RAÍSSA', v_ano),
    (v_school_id, 'Turma 300', 'sexta', '12:25', '13:10', 'manha', 'HISTÓRIA', 'ARNALDO JR.', v_ano),
    (v_school_id, 'Turma 300', 'quarta', '17:15', '18:00', 'tarde', 'EDUCAÇÃO FÍSICA', 'SÔNIA', v_ano),
    (v_school_id, 'Turma 301', 'segunda', '07:20', '08:05', 'manha', 'BIOLOGIA II', 'LUIS FERNANDO', v_ano),
    (v_school_id, 'Turma 301', 'terca', '07:20', '08:05', 'manha', 'LÍNGUA PORTUGUESA', 'ANTÔNIO MORAES', v_ano),
    (v_school_id, 'Turma 301', 'quarta', '07:20', '08:05', 'manha', 'MATEMÁTICA 1-2-3', 'MARCÔNIO NÓBREGA', v_ano),
    (v_school_id, 'Turma 301', 'quinta', '07:20', '08:05', 'manha', 'FILOSOFIA', 'CLÁUDIA RAÍSSA', v_ano),
    (v_school_id, 'Turma 301', 'sexta', '07:20', '08:05', 'manha', 'GEOGRAFIA', 'DIÓGENES MOREIRA', v_ano),
    (v_school_id, 'Turma 301', 'segunda', '08:05', '08:50', 'manha', 'ARTE', 'RAFAELA CRISTINA', v_ano),
    (v_school_id, 'Turma 301', 'terca', '08:05', '08:50', 'manha', 'FÍSICA II', 'CARLOS ALBERTO', v_ano),
    (v_school_id, 'Turma 301', 'quarta', '08:05', '08:50', 'manha', 'MATEMÁTICA 1-2-3', 'MARCÔNIO NÓBREGA', v_ano),
    (v_school_id, 'Turma 301', 'quinta', '08:05', '08:50', 'manha', 'FÍSICA I', 'NOBUYUKI DOIHARA', v_ano),
    (v_school_id, 'Turma 301', 'sexta', '08:05', '08:50', 'manha', 'GEOGRAFIA', 'DIÓGENES MOREIRA', v_ano),
    (v_school_id, 'Turma 301', 'segunda', '09:05', '09:50', 'manha', 'PRODUÇÃO TEXTUAL', 'SÂMIA RAFAELA', v_ano),
    (v_school_id, 'Turma 301', 'terca', '09:05', '09:50', 'manha', 'LITERATURA', 'GRAÇA FIGUERÊDO', v_ano),
    (v_school_id, 'Turma 301', 'quarta', '09:05', '09:50', 'manha', 'SOCIOLOGIA', 'CLÁUDIA RAÍSSA', v_ano),
    (v_school_id, 'Turma 301', 'quinta', '09:05', '09:50', 'manha', 'QUÍMICA I', 'CLEWTON MELO', v_ano),
    (v_school_id, 'Turma 301', 'sexta', '09:05', '09:50', 'manha', 'MATEMÁTICA 4-5', 'FELIPE MARTINS', v_ano),
    (v_school_id, 'Turma 301', 'segunda', '09:50', '10:35', 'manha', 'PRODUÇÃO TEXTUAL', 'SÂMIA RAFAELA', v_ano),
    (v_school_id, 'Turma 301', 'terca', '09:50', '10:35', 'manha', 'FÍSICA II', 'CARLOS SOUZA', v_ano),
    (v_school_id, 'Turma 301', 'quarta', '09:50', '10:35', 'manha', 'QUÍMICA II', 'WELYSON MESQUITA', v_ano),
    (v_school_id, 'Turma 301', 'quinta', '09:50', '10:35', 'manha', 'QUÍMICA I', 'CLEWTON MELO', v_ano),
    (v_school_id, 'Turma 301', 'sexta', '09:50', '10:35', 'manha', 'INGLÊS/ESPANHOL', 'LEANDRO VEIGA / ADRIANNE VELOSO', v_ano),
    (v_school_id, 'Turma 301', 'segunda', '10:55', '11:40', 'manha', 'BIOLOGIA I', 'MARCOS DANÚBIO', v_ano),
    (v_school_id, 'Turma 301', 'terca', '10:55', '11:40', 'manha', 'MATEMÁTICA 1-2-3', 'MARCÔNIO NÓBREGA', v_ano),
    (v_school_id, 'Turma 301', 'quarta', '10:55', '11:40', 'manha', 'HISTÓRIA', 'ARNALDO JR.', v_ano),
    (v_school_id, 'Turma 301', 'quinta', '10:55', '11:40', 'manha', 'HISTÓRIA', 'ARNALDO JR.', v_ano),
    (v_school_id, 'Turma 301', 'sexta', '10:55', '11:40', 'manha', 'BIOLOGIA I', 'MARCOS DANÚBIO', v_ano),
    (v_school_id, 'Turma 301', 'segunda', '11:40', '12:25', 'manha', 'FÍSICA I', 'NOBUYUKI DOIHARA', v_ano),
    (v_school_id, 'Turma 301', 'terca', '11:40', '12:25', 'manha', 'PERCURSO DE APROFUNDAMENTO PRODUÇÃO TEXTUAL', 'SÂMIA RAFAELA', v_ano),
    (v_school_id, 'Turma 301', 'quarta', '11:40', '12:25', 'manha', 'LÍNGUA PORTUGUESA', 'ANTÔNIO MORAES', v_ano),
    (v_school_id, 'Turma 301', 'quinta', '11:40', '12:25', 'manha', 'PERCURSO DE APROFUNDAMENTO MATEMÁTICA 1-2-3', 'MARCÔNIO NÓBREGA', v_ano),
    (v_school_id, 'Turma 301', 'sexta', '11:40', '12:25', 'manha', 'HISTÓRIA', 'ARNALDO JR.', v_ano),
    (v_school_id, 'Turma 301', 'segunda', '12:25', '13:10', 'manha', 'BIOLOGIA II', 'LUIS FERNANDO', v_ano),
    (v_school_id, 'Turma 301', 'terca', '12:25', '13:10', 'manha', 'GEOGRAFIA', 'DIÓGENES MOREIRA', v_ano),
    (v_school_id, 'Turma 301', 'quarta', '12:25', '13:10', 'manha', 'LÍNGUA PORTUGUESA', 'ANTÔNIO MORAES', v_ano),
    (v_school_id, 'Turma 301', 'quinta', '12:25', '13:10', 'manha', 'QUÍMICA II', 'WELYSON MESQUITA', v_ano),
    (v_school_id, 'Turma 301', 'sexta', '12:25', '13:10', 'manha', 'MATEMÁTICA 4-5', 'FELIPE MARTINS', v_ano),
    (v_school_id, 'Turma 301', 'quarta', '17:15', '18:00', 'tarde', 'EDUCAÇÃO FÍSICA', 'BÁRBARA', v_ano)
  ;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RAISE NOTICE 'Migration 029: % blocos inseridos para Dom Bosco Turma 300+301 (ano %).', v_inserted, v_ano;
END $$;
