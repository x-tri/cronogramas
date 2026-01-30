-- Migration: Create cronogramas and blocos_cronograma tables
-- Execute this in the Supabase SQL Editor (https://supabase.com/dashboard)

-- Tabela de cronogramas
CREATE TABLE IF NOT EXISTS cronogramas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id TEXT NOT NULL,
  semana_inicio DATE NOT NULL,
  semana_fim DATE NOT NULL,
  observacoes TEXT,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'arquivado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de blocos do cronograma
CREATE TABLE IF NOT EXISTS blocos_cronograma (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cronograma_id UUID NOT NULL REFERENCES cronogramas(id) ON DELETE CASCADE,
  dia_semana TEXT NOT NULL CHECK (dia_semana IN ('segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo')),
  horario_inicio TEXT NOT NULL,
  horario_fim TEXT NOT NULL,
  turno TEXT NOT NULL CHECK (turno IN ('manha', 'tarde', 'noite')),
  tipo TEXT NOT NULL CHECK (tipo IN ('aula_oficial', 'estudo', 'simulado', 'revisao', 'descanso', 'rotina', 'foco')),
  titulo TEXT NOT NULL,
  descricao TEXT,
  disciplina_codigo TEXT,
  cor TEXT,
  prioridade INTEGER NOT NULL DEFAULT 0 CHECK (prioridade IN (0, 1, 2)),
  concluido BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_cronogramas_aluno ON cronogramas(aluno_id);
CREATE INDEX IF NOT EXISTS idx_blocos_cronograma ON blocos_cronograma(cronograma_id);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cronogramas_updated_at ON cronogramas;
CREATE TRIGGER cronogramas_updated_at
  BEFORE UPDATE ON cronogramas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Habilitar RLS (Row Level Security)
ALTER TABLE cronogramas ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocos_cronograma ENABLE ROW LEVEL SECURITY;

-- Políticas: permitir todas as operações (ajustar quando adicionar autenticação)
DROP POLICY IF EXISTS "Allow all cronogramas" ON cronogramas;
CREATE POLICY "Allow all cronogramas" ON cronogramas FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all blocos" ON blocos_cronograma;
CREATE POLICY "Allow all blocos" ON blocos_cronograma FOR ALL USING (true);
