-- Migration: Create alunos_xtris table
-- Execute this in the Supabase SQL Editor

-- Tabela de alunos da Escola XTRI
CREATE TABLE IF NOT EXISTS alunos_xtris (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matricula TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  turma TEXT NOT NULL DEFAULT 'XTRI',
  email TEXT,
  foto_filename TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para busca por matrícula
CREATE INDEX IF NOT EXISTS idx_alunos_xtris_matricula ON alunos_xtris(matricula);

-- Habilitar RLS (Row Level Security)
ALTER TABLE alunos_xtris ENABLE ROW LEVEL SECURITY;

-- Políticas: permitir todas as operações (ajustar quando adicionar autenticação)
DROP POLICY IF EXISTS "Allow all alunos_xtris" ON alunos_xtris;
CREATE POLICY "Allow all alunos_xtris" ON alunos_xtris FOR ALL USING (true);
