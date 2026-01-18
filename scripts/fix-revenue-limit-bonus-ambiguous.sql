-- IMPORTANTE: Execute este script no Supabase Dashboard -> SQL Editor
-- Este script corrige o erro "column reference revenue_limit_bonus is ambiguous"
-- na função increment_company_revenue

-- A variável local revenue_limit_bonus estava em conflito com a coluna da tabela
-- Renomeamos a variável local para v_revenue_limit_bonus

CREATE OR REPLACE FUNCTION public.increment_company_revenue() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  company_record RECORD;
  v_revenue_limit NUMERIC;
  v_revenue_limit_bonus NUMERIC;
  v_effective_limit NUMERIC;
BEGIN
  -- Só incrementa quando o pedido é confirmado
  IF NEW.status = 'confirmed' AND (OLD IS NULL OR OLD.status = 'pending') THEN
    -- Buscar dados da empresa incluindo o bônus
    SELECT 
      c.subscription_status, 
      c.subscription_plan,
      c.monthly_revenue,
      c.revenue_reset_date,
      COALESCE(c.revenue_limit_bonus, 0) as bonus
    INTO company_record
    FROM companies c
    WHERE c.id = NEW.company_id;
    
    -- Resetar faturamento se novo mês
    IF company_record.revenue_reset_date IS NULL OR 
       date_trunc('month', company_record.revenue_reset_date) < date_trunc('month', now()) THEN
      UPDATE companies 
      SET monthly_revenue = 0, revenue_reset_date = now()
      WHERE id = NEW.company_id;
      company_record.monthly_revenue := 0;
    END IF;
    
    -- Determinar limite de faturamento baseado no plano
    SELECT COALESCE(sp.revenue_limit, 2000)
    INTO v_revenue_limit
    FROM subscription_plans sp
    WHERE sp.key = COALESCE(company_record.subscription_plan, 'free')
    LIMIT 1;
    
    -- Se não encontrar plano, usar limite padrão
    IF v_revenue_limit IS NULL THEN
      v_revenue_limit := 2000;
    END IF;
    
    -- Calcular limite efetivo (base + bônus)
    v_revenue_limit_bonus := COALESCE(company_record.bonus, 0);
    v_effective_limit := v_revenue_limit + v_revenue_limit_bonus;
    
    -- Verificar se atingiu o limite efetivo (skip se ilimitado)
    IF v_revenue_limit != -1 AND (company_record.monthly_revenue + NEW.total) > v_effective_limit THEN
      -- Criar notificação
      INSERT INTO notifications (user_id, title, message, type, data)
      SELECT 
        c.owner_id,
        'Limite de faturamento atingido!',
        'Você atingiu o limite de R$ ' || v_effective_limit || ' em vendas do seu plano' || 
        CASE WHEN v_revenue_limit_bonus > 0 THEN ' (incluindo bônus de R$ ' || v_revenue_limit_bonus || ')' ELSE '' END ||
        '. Faça upgrade para continuar recebendo pedidos.',
        'warning',
        jsonb_build_object(
          'type', 'revenue_limit', 
          'plan', COALESCE(company_record.subscription_plan, 'free'),
          'base_limit', v_revenue_limit,
          'bonus', v_revenue_limit_bonus,
          'effective_limit', v_effective_limit
        )
      FROM companies c
      WHERE c.id = NEW.company_id;
      
      RAISE EXCEPTION 'Limite de faturamento do plano atingido (R$ %). Faça upgrade para continuar.', v_effective_limit;
    END IF;
    
    -- Incrementar faturamento
    UPDATE companies 
    SET monthly_revenue = COALESCE(monthly_revenue, 0) + NEW.total
    WHERE id = NEW.company_id;
    
    -- Notificar quando estiver próximo do limite efetivo (80%)
    IF v_revenue_limit != -1 AND 
       (company_record.monthly_revenue + NEW.total) >= (v_effective_limit * 0.8) AND
       (company_record.monthly_revenue + NEW.total) < v_effective_limit THEN
      INSERT INTO notifications (user_id, title, message, type, data)
      SELECT 
        c.owner_id,
        'Você está próximo do limite!',
        'Você já faturou R$ ' || ROUND(company_record.monthly_revenue + NEW.total, 2) || ' de R$ ' || v_effective_limit || ' do mês' ||
        CASE WHEN v_revenue_limit_bonus > 0 THEN ' (incluindo bônus de R$ ' || v_revenue_limit_bonus || ')' ELSE '' END ||
        '. Considere fazer upgrade.',
        'info',
        jsonb_build_object(
          'type', 'revenue_limit_warning', 
          'revenue', company_record.monthly_revenue + NEW.total, 
          'limit', v_effective_limit,
          'base_limit', v_revenue_limit,
          'bonus', v_revenue_limit_bonus
        )
      FROM companies c
      WHERE c.id = NEW.company_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$_$;

-- Corrigir também a função check_and_block_revenue_limit
CREATE OR REPLACE FUNCTION public.check_and_block_revenue_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_revenue_limit NUMERIC;
  v_revenue_limit_bonus NUMERIC;
  v_effective_limit NUMERIC;
BEGIN
  -- Só verifica quando monthly_revenue é atualizado
  IF NEW.monthly_revenue IS DISTINCT FROM OLD.monthly_revenue THEN
    -- Buscar limite do plano atual
    SELECT COALESCE(sp.revenue_limit, 2000)
    INTO v_revenue_limit
    FROM subscription_plans sp
    WHERE sp.key = COALESCE(NEW.subscription_plan, 'free')
    LIMIT 1;
    
    -- Se não encontrar plano, usar limite padrão do gratuito
    IF v_revenue_limit IS NULL THEN
      v_revenue_limit := 2000;
    END IF;
    
    -- Obter bônus da empresa
    v_revenue_limit_bonus := COALESCE(NEW.revenue_limit_bonus, 0);
    
    -- Calcular limite efetivo (base + bônus)
    v_effective_limit := v_revenue_limit + v_revenue_limit_bonus;
    
    -- Se limite não é ilimitado (-1) e faturamento excedeu limite efetivo
    IF v_revenue_limit != -1 AND NEW.monthly_revenue >= v_effective_limit THEN
      -- Despublicar cardápio automaticamente
      NEW.menu_published := false;
      
      -- Criar notificação para o dono
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        NEW.owner_id,
        'Cardápio bloqueado - Limite atingido!',
        'Seu cardápio foi despublicado automaticamente pois você atingiu o limite de R$ ' || v_effective_limit || 
        CASE WHEN v_revenue_limit_bonus > 0 THEN ' (base: R$ ' || v_revenue_limit + ' + bônus: R$ ' || v_revenue_limit_bonus || ')' ELSE '' END ||
        ' em vendas do plano ' || 
        CASE 
          WHEN NEW.subscription_plan = 'starter' THEN 'Inicial'
          WHEN NEW.subscription_plan = 'basic' THEN 'Básico'
          WHEN NEW.subscription_plan = 'growth' THEN 'Crescimento'
          WHEN NEW.subscription_plan = 'pro' THEN 'Pro'
          ELSE 'Gratuito'
        END || '. Faça upgrade para continuar recebendo pedidos.',
        'error',
        jsonb_build_object(
          'type', 'revenue_limit_blocked',
          'monthly_revenue', NEW.monthly_revenue,
          'revenue_limit', v_revenue_limit,
          'revenue_limit_bonus', v_revenue_limit_bonus,
          'effective_limit', v_effective_limit,
          'plan', COALESCE(NEW.subscription_plan, 'free')
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Pronto! As variáveis locais foram renomeadas para evitar ambiguidade.
