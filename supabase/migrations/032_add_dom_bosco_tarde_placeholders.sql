-- Migration 032: placeholders de tarde para Dom Bosco Turma 300/301
--
-- Contexto:
--   Decisao original (2026-05-01, opcao B): nao cadastrar slots vazios do
--   contraturno em school_schedules. Coord adicionaria via mentoria individual.
--
-- Atualizacao (2026-05-02): coord precisa ver as LINHAS de horario na grade
--   do mentor (Kanban/Timeline) para poder clicar e adicionar atividades em
--   slots vazios. Como `applySlotsOverrideFromSchedule` deriva slots APENAS
--   dos horarios presentes em school_schedules, sem cadastro a tarde mostra
--   so a unica linha (17:15 EDF quarta).
--
-- Solucao (Karpathy §3 surgical):
--   Inserir placeholders nos 4 horarios da tarde × 5 dias × 2 turmas, com
--   disciplina = '—' (em-dash, marker reservado). Frontend (kanban-cell.tsx)
--   trata '—' como slot vazio editavel — render visual de aula nao acontece.
--
--   Slots tarde Dom Bosco (do Excel oficial):
--     15:00-15:45, 15:45-16:30, 16:30-17:15, 17:15-18:00
--
--   Total inserido: 4 horarios × 5 dias × 2 turmas - 2 (EDF quarta ja existente
--   nas Turmas 300 e 301) = 38 placeholders.
--
-- Idempotente: ON CONFLICT DO NOTHING via WHERE NOT EXISTS para nao duplicar.

DO $$
DECLARE
  v_school_id uuid := '4c8b9c6a-8a3c-48a7-b913-9eb2acf8a25e'; -- Dom Bosco
  v_ano int := 2026;
  v_inserted int;
  v_turmas text[] := ARRAY['Turma 300', 'Turma 301'];
  v_dias text[] := ARRAY['segunda', 'terca', 'quarta', 'quinta', 'sexta'];
  v_slots text[][] := ARRAY[
    ARRAY['15:00','15:45'],
    ARRAY['15:45','16:30'],
    ARRAY['16:30','17:15'],
    ARRAY['17:15','18:00']
  ];
  v_turma text;
  v_dia text;
  i int;
BEGIN
  v_inserted := 0;
  FOREACH v_turma IN ARRAY v_turmas LOOP
    FOREACH v_dia IN ARRAY v_dias LOOP
      FOR i IN 1..array_length(v_slots, 1) LOOP
        -- Pula se ja existe (evita conflito com Educacao Fisica quarta 17:15)
        IF NOT EXISTS (
          SELECT 1 FROM public.school_schedules
          WHERE school_id = v_school_id
            AND turma = v_turma
            AND dia_semana = v_dia
            AND horario_inicio = v_slots[i][1]
            AND ano_letivo = v_ano
        ) THEN
          INSERT INTO public.school_schedules
            (school_id, turma, dia_semana, horario_inicio, horario_fim, turno, disciplina, professor, ano_letivo)
          VALUES
            (v_school_id, v_turma, v_dia, v_slots[i][1], v_slots[i][2], 'tarde', '—', NULL, v_ano);
          v_inserted := v_inserted + 1;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  RAISE NOTICE 'Migration 032: % placeholders de tarde inseridos para Dom Bosco.', v_inserted;
END $$;
