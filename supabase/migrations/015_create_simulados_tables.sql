-- Migration: Create simulados tables (Fase 1)
-- Goal: base schema for admin-authored ENEM-style simulados with student submissions.
--
-- Design:
--   * simulados         — cabecalho do simulado (titulo, escola, turmas, status).
--   * simulado_itens    — 180 itens obrigatorios (45 por area LC/CH/CN/MT),
--                         com gabarito oficial + dificuldade Angoff (1-5) + topico/habilidade.
--   * simulado_respostas — submissao do aluno com respostas cruas e resultados TRI
--                          computados pelo Edge Function (ver Fase 2).
--
-- Restricoes-chave:
--   * CHECK garante consistencia numero <-> area (itens 1..45 = LC, 46..90 = CH, ...).
--   * Trigger simulados_guard_publish impede publicar sem 180 itens (45 por area).
--   * UNIQUE (simulado_id, student_id) garante 1 submissao por aluno por simulado.
--
-- RLS: definida na migration 016_simulados_rls.sql.

-- ---------------------------------------------------------------------------
-- simulados
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.simulados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(trim(title)) > 0),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  turmas text[] NOT NULL DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'closed')),
  published_at timestamptz,
  closed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_simulados_school_status
  ON public.simulados (school_id, status);

CREATE INDEX IF NOT EXISTS idx_simulados_created_by
  ON public.simulados (created_by);

COMMENT ON TABLE public.simulados IS
  'Cabecalho do simulado ENEM criado pelo admin/coordenador. 180 itens via simulado_itens.';
COMMENT ON COLUMN public.simulados.turmas IS
  'Lista de turmas alvo dentro da escola. Vazio = disponivel para toda a escola.';
COMMENT ON COLUMN public.simulados.status IS
  'draft (rascunho) | published (sinal verde, recebe respostas) | closed (nao aceita mais).';

-- ---------------------------------------------------------------------------
-- simulado_itens
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.simulado_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulado_id uuid NOT NULL REFERENCES public.simulados(id) ON DELETE CASCADE,
  numero int NOT NULL CHECK (numero BETWEEN 1 AND 180),
  area text NOT NULL CHECK (area IN ('LC', 'CH', 'CN', 'MT')),
  gabarito char(1) NOT NULL CHECK (gabarito IN ('A', 'B', 'C', 'D', 'E')),
  dificuldade int NOT NULL CHECK (dificuldade BETWEEN 1 AND 5),
  topico text,
  habilidade text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Consistencia numero <-> area (faixas ENEM fixas):
  CONSTRAINT simulado_itens_numero_area_consistency CHECK (
    (numero BETWEEN 1   AND 45  AND area = 'LC') OR
    (numero BETWEEN 46  AND 90  AND area = 'CH') OR
    (numero BETWEEN 91  AND 135 AND area = 'CN') OR
    (numero BETWEEN 136 AND 180 AND area = 'MT')
  ),
  CONSTRAINT simulado_itens_simulado_numero_unique UNIQUE (simulado_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_simulado_itens_simulado_area
  ON public.simulado_itens (simulado_id, area);

COMMENT ON TABLE public.simulado_itens IS
  'Gabarito oficial + dificuldade Angoff (1-5) + conteudo por item. 180 por simulado.';
COMMENT ON COLUMN public.simulado_itens.dificuldade IS
  'Angoff 1..5 atribuida pelo coordenador na criacao. Usada como peso no motor TRI.';

-- ---------------------------------------------------------------------------
-- simulado_respostas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.simulado_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulado_id uuid NOT NULL REFERENCES public.simulados(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  -- answers: { "1": "A", "2": "B", ..., "180": "E" }. Branco pode ser "" ou ausente.
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Scores TRI por area (escala ENEM 200-1000).
  tri_lc numeric(6,2),
  tri_ch numeric(6,2),
  tri_cn numeric(6,2),
  tri_mt numeric(6,2),
  -- Totais por area. CHECK garante que acertos+erros+branco sempre some 45.
  -- Default: tudo branco (estado "antes de computar" valido). Edge Function
  -- preenche os valores reais na submissao.
  acertos_lc int NOT NULL DEFAULT 0  CHECK (acertos_lc >= 0),
  erros_lc   int NOT NULL DEFAULT 0  CHECK (erros_lc   >= 0),
  branco_lc  int NOT NULL DEFAULT 45 CHECK (branco_lc  >= 0),
  acertos_ch int NOT NULL DEFAULT 0  CHECK (acertos_ch >= 0),
  erros_ch   int NOT NULL DEFAULT 0  CHECK (erros_ch   >= 0),
  branco_ch  int NOT NULL DEFAULT 45 CHECK (branco_ch  >= 0),
  acertos_cn int NOT NULL DEFAULT 0  CHECK (acertos_cn >= 0),
  erros_cn   int NOT NULL DEFAULT 0  CHECK (erros_cn   >= 0),
  branco_cn  int NOT NULL DEFAULT 45 CHECK (branco_cn  >= 0),
  acertos_mt int NOT NULL DEFAULT 0  CHECK (acertos_mt >= 0),
  erros_mt   int NOT NULL DEFAULT 0  CHECK (erros_mt   >= 0),
  branco_mt  int NOT NULL DEFAULT 45 CHECK (branco_mt  >= 0),
  -- Mapas de erro agregados para dashboard do aluno e do coordenador.
  erros_por_topico jsonb NOT NULL DEFAULT '{}'::jsonb,
  erros_por_habilidade jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  -- Integridade dos totais (defesa contra bugs na Edge Function / payload malformado).
  CONSTRAINT simulado_respostas_totais_lc_45
    CHECK (acertos_lc + erros_lc + branco_lc = 45),
  CONSTRAINT simulado_respostas_totais_ch_45
    CHECK (acertos_ch + erros_ch + branco_ch = 45),
  CONSTRAINT simulado_respostas_totais_cn_45
    CHECK (acertos_cn + erros_cn + branco_cn = 45),
  CONSTRAINT simulado_respostas_totais_mt_45
    CHECK (acertos_mt + erros_mt + branco_mt = 45),
  -- TRI na escala ENEM 200-1000 (quando nao-nulo).
  CONSTRAINT simulado_respostas_tri_lc_escala
    CHECK (tri_lc IS NULL OR (tri_lc BETWEEN 200 AND 1000)),
  CONSTRAINT simulado_respostas_tri_ch_escala
    CHECK (tri_ch IS NULL OR (tri_ch BETWEEN 200 AND 1000)),
  CONSTRAINT simulado_respostas_tri_cn_escala
    CHECK (tri_cn IS NULL OR (tri_cn BETWEEN 200 AND 1000)),
  CONSTRAINT simulado_respostas_tri_mt_escala
    CHECK (tri_mt IS NULL OR (tri_mt BETWEEN 200 AND 1000)),
  CONSTRAINT simulado_respostas_unique UNIQUE (simulado_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_simulado_respostas_student
  ON public.simulado_respostas (student_id);

CREATE INDEX IF NOT EXISTS idx_simulado_respostas_simulado
  ON public.simulado_respostas (simulado_id);

COMMENT ON TABLE public.simulado_respostas IS
  'Uma submissao por aluno por simulado. Scores TRI e mapa de erros preenchidos pelo Edge Function.';

-- ---------------------------------------------------------------------------
-- Trigger: validar 180 itens (45 por area) antes de publicar
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_simulado_complete(p_simulado_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)                                    = 180 AND
    COUNT(*) FILTER (WHERE area = 'LC')         = 45  AND
    COUNT(*) FILTER (WHERE area = 'CH')         = 45  AND
    COUNT(*) FILTER (WHERE area = 'CN')         = 45  AND
    COUNT(*) FILTER (WHERE area = 'MT')         = 45
  FROM public.simulado_itens
  WHERE simulado_id = p_simulado_id;
$$;

REVOKE ALL ON FUNCTION public.validate_simulado_complete(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_simulado_complete(uuid) TO authenticated;

-- Trigger roda como o usuario que esta fazendo UPDATE (coordinator/super_admin).
-- A checagem de completude usa validate_simulado_complete, que e SECURITY DEFINER
-- para contornar RLS em simulado_itens (o caller pode nao enxergar todos os itens
-- por causa das policies em 016_simulados_rls.sql). Nao remover SECURITY DEFINER
-- daquela funcao sem reavaliar esta trigger.
CREATE OR REPLACE FUNCTION public.simulados_guard_publish()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'published' AND OLD.status IS DISTINCT FROM 'published' THEN
      IF NOT public.validate_simulado_complete(NEW.id) THEN
        RAISE EXCEPTION
          'Simulado % incompleto: exige 180 itens (45 por area LC/CH/CN/MT) antes de publicar.',
          NEW.id
          USING ERRCODE = 'check_violation';
      END IF;
      NEW.published_at := COALESCE(NEW.published_at, now());
    END IF;

    IF NEW.status = 'closed' AND OLD.status IS DISTINCT FROM 'closed' THEN
      NEW.closed_at := COALESCE(NEW.closed_at, now());
    END IF;

    NEW.updated_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS simulados_before_update ON public.simulados;
CREATE TRIGGER simulados_before_update
BEFORE UPDATE ON public.simulados
FOR EACH ROW EXECUTE FUNCTION public.simulados_guard_publish();

-- Trigger simples para manter updated_at em simulado_itens.
CREATE OR REPLACE FUNCTION public.simulado_itens_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS simulado_itens_before_update ON public.simulado_itens;
CREATE TRIGGER simulado_itens_before_update
BEFORE UPDATE ON public.simulado_itens
FOR EACH ROW EXECUTE FUNCTION public.simulado_itens_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Grants
-- Concede acesso a authenticated; RLS (migration 016) faz o filtering fino.
-- anon nao tem acesso a nenhuma das tabelas de simulado.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulados          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulado_itens     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulado_respostas TO authenticated;

REVOKE ALL ON public.simulados          FROM anon;
REVOKE ALL ON public.simulado_itens     FROM anon;
REVOKE ALL ON public.simulado_respostas FROM anon;
