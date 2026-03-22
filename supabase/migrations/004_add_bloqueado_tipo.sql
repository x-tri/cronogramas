-- Migration: Add 'bloqueado' to blocos_cronograma tipo check constraint
-- Allows users to block time slots they can't use for studying

-- Drop the existing constraint
ALTER TABLE blocos_cronograma DROP CONSTRAINT IF EXISTS blocos_cronograma_tipo_check;

-- Re-create with 'bloqueado' included
ALTER TABLE blocos_cronograma ADD CONSTRAINT blocos_cronograma_tipo_check
  CHECK (tipo IN ('aula_oficial', 'estudo', 'simulado', 'revisao', 'descanso', 'rotina', 'foco', 'bloqueado'));
