-- Auditoria defensiva da TRI estimada dos simulados.
--
-- A tabela guarda somente agregados anonimos por item. Ela NAO altera respostas
-- nem autoriza recalculo automatico: itens sinalizados entram em fila de revisao.

ALTER TABLE public.simulado_respostas
  ADD COLUMN IF NOT EXISTS tri_method text NOT NULL DEFAULT 'xtri_reference_anchored',
  ADD COLUMN IF NOT EXISTS tri_version text NOT NULL DEFAULT '1.1',
  ADD COLUMN IF NOT EXISTS correction_status text NOT NULL DEFAULT 'computed'
    CHECK (correction_status IN ('computed', 'recomputed', 'blocked_review', 'manual_reviewed')),
  ADD COLUMN IF NOT EXISTS areas_realizadas text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS confidence_level text NOT NULL DEFAULT 'unknown'
    CHECK (confidence_level IN ('high', 'medium', 'low', 'invalid', 'unknown'));

UPDATE public.simulado_respostas
SET
  areas_realizadas = array_remove(ARRAY[
    CASE WHEN acertos_lc + erros_lc > 0 THEN 'LC' END,
    CASE WHEN acertos_ch + erros_ch > 0 THEN 'CH' END,
    CASE WHEN acertos_cn + erros_cn > 0 THEN 'CN' END,
    CASE WHEN acertos_mt + erros_mt > 0 THEN 'MT' END
  ]::text[], NULL),
  confidence_level = CASE
    WHEN (acertos_lc + erros_lc >= 40)
      AND (acertos_ch + erros_ch >= 40)
      AND (acertos_cn + erros_cn >= 40)
      AND (acertos_mt + erros_mt >= 40)
      THEN 'high'
    WHEN (
      (CASE WHEN acertos_lc + erros_lc > 0 THEN 1 ELSE 0 END) +
      (CASE WHEN acertos_ch + erros_ch > 0 THEN 1 ELSE 0 END) +
      (CASE WHEN acertos_cn + erros_cn > 0 THEN 1 ELSE 0 END) +
      (CASE WHEN acertos_mt + erros_mt > 0 THEN 1 ELSE 0 END)
    ) >= 2 THEN 'medium'
    WHEN (
      (CASE WHEN acertos_lc + erros_lc > 0 THEN 1 ELSE 0 END) +
      (CASE WHEN acertos_ch + erros_ch > 0 THEN 1 ELSE 0 END) +
      (CASE WHEN acertos_cn + erros_cn > 0 THEN 1 ELSE 0 END) +
      (CASE WHEN acertos_mt + erros_mt > 0 THEN 1 ELSE 0 END)
    ) = 1 THEN 'low'
    ELSE 'invalid'
  END
WHERE areas_realizadas = '{}'::text[]
   OR confidence_level = 'unknown';

CREATE TABLE IF NOT EXISTS public.simulado_item_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulado_id uuid NOT NULL REFERENCES public.simulados(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.simulado_itens(id) ON DELETE CASCADE,
  numero int NOT NULL CHECK (numero BETWEEN 1 AND 180),
  area text NOT NULL CHECK (area IN ('LC', 'CH', 'CN', 'MT')),
  gabarito char(1) NOT NULL CHECK (gabarito IN ('A', 'B', 'C', 'D', 'E')),
  dificuldade_original int NOT NULL CHECK (dificuldade_original BETWEEN 1 AND 5),
  n_respostas int NOT NULL CHECK (n_respostas >= 0),
  n_respondidas int NOT NULL CHECK (n_respondidas >= 0),
  n_acertos int NOT NULL CHECK (n_acertos >= 0),
  n_brancos int NOT NULL CHECK (n_brancos >= 0),
  taxa_acerto numeric(7,4),
  erro_padrao_taxa numeric(7,4),
  alternativa_mais_marcada char(1) CHECK (
    alternativa_mais_marcada IS NULL OR alternativa_mais_marcada IN ('A', 'B', 'C', 'D', 'E')
  ),
  alternativa_mais_marcada_pct numeric(7,4),
  alternativas jsonb NOT NULL DEFAULT '{}'::jsonb,
  discriminacao_proxy numeric(8,4),
  classifications text[] NOT NULL DEFAULT '{}'::text[],
  review_status text NOT NULL DEFAULT 'sinal_de_revisao'
    CHECK (review_status IN (
      'sinal_de_revisao',
      'gabarito_confirmado',
      'gabarito_corrigido',
      'item_anulado',
      'dificuldade_recalibrada'
    )),
  recalculo_bloqueado boolean NOT NULL DEFAULT true,
  audit_version text NOT NULL DEFAULT '1.0',
  audited_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT simulado_item_audits_unique_version UNIQUE (simulado_id, numero, audit_version),
  CONSTRAINT simulado_item_audits_classifications_valid CHECK (
    classifications <@ ARRAY[
      'confiavel_operacionalmente',
      'sinal_revisao_gabarito',
      'sinal_revisao_dificuldade',
      'sinal_revisao_discriminacao',
      'amostra_insuficiente',
      'bloqueado_para_recalculo'
    ]::text[]
  )
);

CREATE INDEX IF NOT EXISTS idx_simulado_item_audits_simulado
  ON public.simulado_item_audits (simulado_id, area, numero);

CREATE INDEX IF NOT EXISTS idx_simulado_item_audits_review_status
  ON public.simulado_item_audits (review_status, recalculo_bloqueado);

COMMENT ON TABLE public.simulado_item_audits IS
  'Auditoria anonima por item do simulado. Sinaliza revisao; nao altera notas automaticamente.';

COMMENT ON COLUMN public.simulado_item_audits.discriminacao_proxy IS
  'Correlacao item-total aproximada usando acerto do item contra acertos da area sem o item.';

ALTER TABLE public.simulado_item_audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "simulado_item_audits_admin_all" ON public.simulado_item_audits;
DROP POLICY IF EXISTS "simulado_item_audits_coord_school_all" ON public.simulado_item_audits;

CREATE POLICY "simulado_item_audits_admin_all"
ON public.simulado_item_audits
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY "simulado_item_audits_coord_school_all"
ON public.simulado_item_audits
FOR ALL
TO authenticated
USING (
  public.current_project_role() = 'coordinator'
  AND EXISTS (
    SELECT 1
    FROM public.simulados s
    WHERE s.id = simulado_item_audits.simulado_id
      AND s.school_id = public.current_school_id()
  )
)
WITH CHECK (
  public.current_project_role() = 'coordinator'
  AND EXISTS (
    SELECT 1
    FROM public.simulados s
    WHERE s.id = simulado_item_audits.simulado_id
      AND s.school_id = public.current_school_id()
  )
);

CREATE OR REPLACE FUNCTION public.simulado_item_audits_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS simulado_item_audits_before_update ON public.simulado_item_audits;
CREATE TRIGGER simulado_item_audits_before_update
BEFORE UPDATE ON public.simulado_item_audits
FOR EACH ROW EXECUTE FUNCTION public.simulado_item_audits_touch_updated_at();

GRANT SELECT, INSERT, UPDATE ON public.simulado_item_audits TO authenticated;
REVOKE ALL ON public.simulado_item_audits FROM anon;
