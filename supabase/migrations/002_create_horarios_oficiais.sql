-- Migration: Create horarios_oficiais table
-- Execute this in the Supabase SQL Editor (https://supabase.com/dashboard)

-- Tabela de horários oficiais por turma
CREATE TABLE IF NOT EXISTS horarios_oficiais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turma TEXT NOT NULL,
  dia_semana TEXT NOT NULL CHECK (dia_semana IN ('segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo')),
  horario_inicio TEXT NOT NULL,
  horario_fim TEXT NOT NULL,
  turno TEXT NOT NULL CHECK (turno IN ('manha', 'tarde', 'noite')),
  disciplina TEXT NOT NULL,
  professor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para busca por turma
CREATE INDEX IF NOT EXISTS idx_horarios_turma ON horarios_oficiais(turma);

-- Habilitar RLS
ALTER TABLE horarios_oficiais ENABLE ROW LEVEL SECURITY;

-- Política: permitir leitura para todos
DROP POLICY IF EXISTS "Allow read horarios" ON horarios_oficiais;
CREATE POLICY "Allow read horarios" ON horarios_oficiais FOR SELECT USING (true);

-- Política: permitir todas operações (ajustar quando adicionar autenticação de admin)
DROP POLICY IF EXISTS "Allow all horarios" ON horarios_oficiais;
CREATE POLICY "Allow all horarios" ON horarios_oficiais FOR ALL USING (true);
