-- Migration 033: janelas Pomodoro de estudo para Dom Bosco (2026)
--
-- Objetivo:
--   Abrir mais horarios de TARDE e NOITE para distribuicao de revisoes,
--   usando blocos de 50 minutos com 10 minutos de descanso entre blocos.
--
-- Como funciona:
--   school_schedules com disciplina = '—' sao placeholders: aparecem como
--   slots vazios/editaveis e nao contam como aula oficial.
--
-- Janelas:
--   Tarde: 14:30-15:20, 15:30-16:20, 16:30-17:20, 17:30-18:20, 18:30-19:20
--   Noite: 19:30-20:20, 20:30-21:20, 21:30-22:20
--
-- Observacao:
--   A Educacao Fisica real de quarta 17:15-18:00 permanece. O frontend bloqueia
--   slots Pomodoro que se sobrepoem a aulas reais.

DO $$
DECLARE
  v_school_id uuid := '4c8b9c6a-8a3c-48a7-b913-9eb2acf8a25e'; -- Dom Bosco
  v_ano int := 2026;
  v_inserted int := 0;
  v_turma text;
  v_dia text;
  v_slot text[];
  v_dias text[] := ARRAY['segunda', 'terca', 'quarta', 'quinta', 'sexta'];
  v_slots text[][] := ARRAY[
    ARRAY['tarde','14:30','15:20'],
    ARRAY['tarde','15:30','16:20'],
    ARRAY['tarde','16:30','17:20'],
    ARRAY['tarde','17:30','18:20'],
    ARRAY['tarde','18:30','19:20'],
    ARRAY['noite','19:30','20:20'],
    ARRAY['noite','20:30','21:20'],
    ARRAY['noite','21:30','22:20']
  ];
BEGIN
  -- Remove apenas placeholders antigos de tarde/noite. Aulas reais permanecem.
  DELETE FROM public.school_schedules
  WHERE school_id = v_school_id
    AND ano_letivo = v_ano
    AND turno IN ('tarde', 'noite')
    AND disciplina = '—';

  FOR v_turma IN
    SELECT DISTINCT turma
    FROM public.school_schedules
    WHERE school_id = v_school_id
      AND ano_letivo = v_ano
      AND turma IS NOT NULL
  LOOP
    FOREACH v_dia IN ARRAY v_dias LOOP
      FOREACH v_slot SLICE 1 IN ARRAY v_slots LOOP
        IF NOT EXISTS (
          SELECT 1
          FROM public.school_schedules
          WHERE school_id = v_school_id
            AND ano_letivo = v_ano
            AND turma = v_turma
            AND dia_semana = v_dia
            AND horario_inicio = v_slot[2]
        ) THEN
          INSERT INTO public.school_schedules
            (school_id, turma, dia_semana, horario_inicio, horario_fim, turno, disciplina, professor, ano_letivo)
          VALUES
            (v_school_id, v_turma, v_dia, v_slot[2], v_slot[3], v_slot[1], '—', NULL, v_ano);
          v_inserted := v_inserted + 1;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Migration 033: % placeholders Pomodoro inseridos para Dom Bosco.', v_inserted;
END $$;
