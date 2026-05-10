-- Auditoria TRI estimada e tecnica demais para coordenador de escola.
-- Coordenador continua vendo ranking/resultados, mas a fila de revisao
-- psicometrica fica restrita ao super_admin.

DROP POLICY IF EXISTS "simulado_item_audits_coord_school_all"
ON public.simulado_item_audits;
