-- Recalibracao TRI estimada XTRI v1.2.
-- A engine agora comprime a cauda superior de LC para impedir que uma faixa
-- abaixo de 45/45 ultrapasse o score perfeito da propria referencia.
ALTER TABLE public.simulado_respostas
  ALTER COLUMN tri_version SET DEFAULT '1.2';
