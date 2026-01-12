-- ============================================
-- Script para Configurar Cron de Verificação de Assinaturas
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- 1. Adicionar coluna de grace period se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' 
    AND column_name = 'subscription_grace_end_date'
  ) THEN
    ALTER TABLE public.companies 
    ADD COLUMN subscription_grace_end_date TIMESTAMPTZ;
    
    COMMENT ON COLUMN public.companies.subscription_grace_end_date IS 
      'Data final do período de carência (7 dias após falha de pagamento)';
  END IF;
END $$;

-- 2. Criar índice para queries de verificação
CREATE INDEX IF NOT EXISTS idx_companies_subscription_status 
ON public.companies(subscription_status) 
WHERE subscription_status IN ('active', 'grace_period');

-- 3. Remover job anterior se existir (ignora erro se não existir)
DO $$ 
BEGIN
  PERFORM cron.unschedule('check-subscription-expirations');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Job check-subscription-expirations não existia, continuando...';
END $$;

-- 4. Agendar cron para rodar diariamente às 11:00 UTC (8:00 BRT)
SELECT cron.schedule(
  'check-subscription-expirations',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://uyaymtikndembadyljib.supabase.co/functions/v1/check-subscription-expirations',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  )
  $$
);

-- 5. Verificar se o job foi criado
SELECT * FROM cron.job WHERE jobname = 'check-subscription-expirations';

-- 6. (Opcional) Para testar imediatamente, execute:
-- SELECT net.http_post(
--   url := 'https://uyaymtikndembadyljib.supabase.co/functions/v1/check-subscription-expirations',
--   headers := '{"Content-Type": "application/json"}'::jsonb,
--   body := '{}'::jsonb
-- );
