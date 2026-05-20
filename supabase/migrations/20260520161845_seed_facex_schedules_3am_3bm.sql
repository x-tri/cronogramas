-- Seed horarios oficiais FACEX - turmas 3AM e 3BM (manha, 2026)
--
-- Fonte: "HORARIO PROVISORIO A PARTIR DE 04-05-2026 - 3A-B CAPIM MACIO-SALA (2).pdf"
-- Decisoes:
-- - cadastrar apenas o quadro principal da manha;
-- - nao cadastrar contraturno/tarde;
-- - considerar 12:20-13:10 como manha;
-- - omitir o slot "XXXXXXXXXX" da sexta-feira, 12:20-13:10, da turma 3AM.

DO $$
DECLARE
  v_school_id uuid := 'b0d15331-520f-4bc4-9d61-4ae3c8928656'; -- FACEX
  v_ano int := 2026;
  v_inserted int;
BEGIN
  DELETE FROM public.school_schedules
  WHERE school_id = v_school_id
    AND ano_letivo = v_ano
    AND turma IN ('3AM', '3BM')
    AND turno = 'manha';

  INSERT INTO public.school_schedules
    (school_id, turma, dia_semana, horario_inicio, horario_fim, turno, disciplina, professor, ano_letivo)
  VALUES
    -- FACEX 3AM
    (v_school_id, '3AM', 'segunda', '07:00', '07:50', 'manha', 'LITERATURA', 'NATÁLIA', v_ano),
    (v_school_id, '3AM', 'terca', '07:00', '07:50', 'manha', 'FÍSICA2', 'JÂNIO', v_ano),
    (v_school_id, '3AM', 'quarta', '07:00', '07:50', 'manha', 'BIOLOGIA3', 'PAULA', v_ano),
    (v_school_id, '3AM', 'quinta', '07:00', '07:50', 'manha', 'FÍSICA3', 'JÂNIO', v_ano),
    (v_school_id, '3AM', 'sexta', '07:00', '07:50', 'manha', 'HISTÓRIA1', 'YANO', v_ano),
    (v_school_id, '3AM', 'segunda', '07:50', '08:40', 'manha', 'FÍSICA1', 'PEDRO', v_ano),
    (v_school_id, '3AM', 'terca', '07:50', '08:40', 'manha', 'GEOGRAFIA2', 'MARILUCE', v_ano),
    (v_school_id, '3AM', 'quarta', '07:50', '08:40', 'manha', 'MATEMÁTICA2', 'ROBERTO', v_ano),
    (v_school_id, '3AM', 'quinta', '07:50', '08:40', 'manha', 'LÍNGUA INGLESA', 'DAVID', v_ano),
    (v_school_id, '3AM', 'sexta', '07:50', '08:40', 'manha', 'BIOLOGIA2', 'EDNEUDO', v_ano),
    (v_school_id, '3AM', 'segunda', '08:40', '09:30', 'manha', 'TM-AP.MATEMÁTICA', 'ADILSON', v_ano),
    (v_school_id, '3AM', 'terca', '08:40', '09:30', 'manha', 'QUÍMCA2', 'TONNY', v_ano),
    (v_school_id, '3AM', 'quarta', '08:40', '09:30', 'manha', 'QUÍMCA3', 'TONNY', v_ano),
    (v_school_id, '3AM', 'quinta', '08:40', '09:30', 'manha', 'MATEMÁTICA4', 'ADILSON', v_ano),
    (v_school_id, '3AM', 'sexta', '08:40', '09:30', 'manha', 'HISTÓRIA1', 'YANO', v_ano),
    (v_school_id, '3AM', 'segunda', '09:30', '10:20', 'manha', 'TL-AP.L.PORTUGUESA', 'AURÉLIO', v_ano),
    (v_school_id, '3AM', 'terca', '09:30', '10:20', 'manha', 'ELET.EST. DO E. ARTE', 'EVA MARIA', v_ano),
    (v_school_id, '3AM', 'quarta', '09:30', '10:20', 'manha', 'ELET.E.E.SOCIOLOGIA', 'PETROVICH', v_ano),
    (v_school_id, '3AM', 'quinta', '09:30', '10:20', 'manha', 'MATEMÁTICA3', 'ROBERTO', v_ano),
    (v_school_id, '3AM', 'sexta', '09:30', '10:20', 'manha', 'BIOLOGIA1', 'EDNEUDO', v_ano),
    (v_school_id, '3AM', 'segunda', '10:40', '11:30', 'manha', 'GEOGRAFIA1', 'LUIZ CARLOS', v_ano),
    (v_school_id, '3AM', 'terca', '10:40', '11:30', 'manha', 'TN-AP. QUÍMCA', 'MOURA', v_ano),
    (v_school_id, '3AM', 'quarta', '10:40', '11:30', 'manha', 'TN-AP. BIOLOGIA', 'PAULA', v_ano),
    (v_school_id, '3AM', 'quinta', '10:40', '11:30', 'manha', 'MATEMÁTICA5', 'ADILSON', v_ano),
    (v_school_id, '3AM', 'sexta', '10:40', '11:30', 'manha', 'QUÍMCA1', 'MOURA', v_ano),
    (v_school_id, '3AM', 'segunda', '11:30', '12:20', 'manha', 'GRAMÁTICA', 'AURÉLIO', v_ano),
    (v_school_id, '3AM', 'terca', '11:30', '12:20', 'manha', 'TH-AP. HISTÓRIA', 'EVA', v_ano),
    (v_school_id, '3AM', 'quarta', '11:30', '12:20', 'manha', 'REDAÇÃO', 'MÔNICA', v_ano),
    (v_school_id, '3AM', 'quinta', '11:30', '12:20', 'manha', 'HISTÓRIA2', 'EVA', v_ano),
    (v_school_id, '3AM', 'sexta', '11:30', '12:20', 'manha', 'INTERPRETAÇÃO TEXTUAL', 'NATÁLIA', v_ano),
    (v_school_id, '3AM', 'segunda', '12:20', '13:10', 'manha', 'TH-AP.GEOGRAFIA', 'LUIZ CARLOS', v_ano),
    (v_school_id, '3AM', 'terca', '12:20', '13:10', 'manha', 'ELE-E. ESTUDO FILOSOFIA', 'MOUSINHO', v_ano),
    (v_school_id, '3AM', 'quarta', '12:20', '13:10', 'manha', 'TN-AP. FÍSICA', 'RODRYGO', v_ano),
    (v_school_id, '3AM', 'quinta', '12:20', '13:10', 'manha', 'MATEMÁTICA1', 'ROBERTO', v_ano),

    -- FACEX 3BM
    (v_school_id, '3BM', 'segunda', '07:00', '07:50', 'manha', 'FÍSICA1', 'PEDRO', v_ano),
    (v_school_id, '3BM', 'terca', '07:00', '07:50', 'manha', 'TN-AP. BIOLOGIA', 'PAULA', v_ano),
    (v_school_id, '3BM', 'quarta', '07:00', '07:50', 'manha', 'MATEMÁTICA3', 'ROBERTO', v_ano),
    (v_school_id, '3BM', 'quinta', '07:00', '07:50', 'manha', 'MATEMÁTICA5', 'ADILSON', v_ano),
    (v_school_id, '3BM', 'sexta', '07:00', '07:50', 'manha', 'BIOLOGIA2', 'EDNEUDO', v_ano),
    (v_school_id, '3BM', 'segunda', '07:50', '08:40', 'manha', 'INTERPRETAÇÃO TEXTUAL', 'NATÁLIA', v_ano),
    (v_school_id, '3BM', 'terca', '07:50', '08:40', 'manha', 'FÍSICA2', 'JÂNIO', v_ano),
    (v_school_id, '3BM', 'quarta', '07:50', '08:40', 'manha', 'ELET.E.E.SOCIOLOGIA', 'PETROVICH', v_ano),
    (v_school_id, '3BM', 'quinta', '07:50', '08:40', 'manha', 'FÍSICA3', 'JÂNIO', v_ano),
    (v_school_id, '3BM', 'sexta', '07:50', '08:40', 'manha', 'HISTÓRIA1', 'YANO', v_ano),
    (v_school_id, '3BM', 'segunda', '08:40', '09:30', 'manha', 'TH-AP.GEOGRAFIA', 'LUIZ CARLOS', v_ano),
    (v_school_id, '3BM', 'terca', '08:40', '09:30', 'manha', 'GEOGRAFIA2', 'MARILUCE', v_ano),
    (v_school_id, '3BM', 'quarta', '08:40', '09:30', 'manha', 'MATEMÁTICA1', 'ROBERTO', v_ano),
    (v_school_id, '3BM', 'quinta', '08:40', '09:30', 'manha', 'LÍNGUA INGLESA', 'DAVID', v_ano),
    (v_school_id, '3BM', 'sexta', '08:40', '09:30', 'manha', 'BIOLOGIA1', 'EDNEUDO', v_ano),
    (v_school_id, '3BM', 'segunda', '09:30', '10:20', 'manha', 'TN-AP. QUÍMCA', 'MOURA', v_ano),
    (v_school_id, '3BM', 'terca', '09:30', '10:20', 'manha', 'QUÍMCA1', 'MOURA', v_ano),
    (v_school_id, '3BM', 'quarta', '09:30', '10:20', 'manha', 'QUÍMCA3', 'TONNY', v_ano),
    (v_school_id, '3BM', 'quinta', '09:30', '10:20', 'manha', 'TM-AP.MATEMÁTICA', 'ADILSON', v_ano),
    (v_school_id, '3BM', 'sexta', '09:30', '10:20', 'manha', 'HISTÓRIA1', 'YANO', v_ano),
    (v_school_id, '3BM', 'segunda', '10:40', '11:30', 'manha', 'GRAMÁTICA', 'AURÉLIO', v_ano),
    (v_school_id, '3BM', 'terca', '10:40', '11:30', 'manha', 'ELE-E. ESTUDO FILOSOFIA', 'MOUSINHO', v_ano),
    (v_school_id, '3BM', 'quarta', '10:40', '11:30', 'manha', 'MATEMÁTICA2', 'ROBERTO', v_ano),
    (v_school_id, '3BM', 'quinta', '10:40', '11:30', 'manha', 'HISTÓRIA2', 'EVA', v_ano),
    (v_school_id, '3BM', 'sexta', '10:40', '11:30', 'manha', 'TH-AP. HISTÓRIA', 'EVA', v_ano),
    (v_school_id, '3BM', 'segunda', '11:30', '12:20', 'manha', 'GEOGRAFIA1', 'LUIZ CARLOS', v_ano),
    (v_school_id, '3BM', 'terca', '11:30', '12:20', 'manha', 'QUÍMCA2', 'TONNY', v_ano),
    (v_school_id, '3BM', 'quarta', '11:30', '12:20', 'manha', 'BIOLOGIA3', 'PAULA', v_ano),
    (v_school_id, '3BM', 'quinta', '11:30', '12:20', 'manha', 'MATEMÁTICA4', 'ADILSON', v_ano),
    (v_school_id, '3BM', 'sexta', '11:30', '12:20', 'manha', 'LITERATURA', 'NATÁLIA', v_ano),
    (v_school_id, '3BM', 'segunda', '12:20', '13:10', 'manha', 'TL-AP.L.PORTUGUESA', 'AURÉLIO', v_ano),
    (v_school_id, '3BM', 'terca', '12:20', '13:10', 'manha', 'TH-AP. HISTÓRIA', 'EVA', v_ano),
    (v_school_id, '3BM', 'quarta', '12:20', '13:10', 'manha', 'REDAÇÃO', 'MÔNICA', v_ano),
    (v_school_id, '3BM', 'quinta', '12:20', '13:10', 'manha', 'ELET.EST. DO E. ARTE', 'EVA MARIA', v_ano),
    (v_school_id, '3BM', 'sexta', '12:20', '13:10', 'manha', 'TN-AP. FÍSICA', 'RODRYGO', v_ano);

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted <> 69 THEN
    RAISE EXCEPTION 'FACEX schedule seed expected 69 rows, inserted %', v_inserted;
  END IF;

  RAISE NOTICE 'FACEX schedule seed: % linhas inseridas para 3AM/3BM manha (%).', v_inserted, v_ano;
END $$;
