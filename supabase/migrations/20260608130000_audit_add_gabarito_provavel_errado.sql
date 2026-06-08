-- Auditoria TRI: novo nível de severidade 'gabarito_provavel_errado'.
-- Sinal forte e separado do 'sinal_revisao_gabarito' genérico: dispara quando o
-- distrator supera o gabarito entre quem respondeu E a discriminação item-resto é
-- não-positiva (assinatura clássica de chave errada/miskey). Continua sendo SINAL
-- de revisão, nunca veredito — recálculo segue bloqueado até validação humana.
--
-- Amplia o CHECK que valida o array `classifications` (senão o upsert da auditoria
-- rejeita o novo valor). ALVO: PRIMARY (cronograma-de-estudos) — tabela simulado_item_audits.

alter table public.simulado_item_audits
  drop constraint if exists simulado_item_audits_classifications_valid;

alter table public.simulado_item_audits
  add constraint simulado_item_audits_classifications_valid check (
    classifications <@ array[
      'confiavel_operacionalmente',
      'sinal_revisao_gabarito',
      'gabarito_provavel_errado',
      'sinal_revisao_dificuldade',
      'sinal_revisao_discriminacao',
      'amostra_insuficiente',
      'bloqueado_para_recalculo'
    ]::text[]
  );
