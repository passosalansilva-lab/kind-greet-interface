-- Adiciona colunas de pagamento na tabela comandas
-- Execute este script no seu Supabase SQL Editor

ALTER TABLE comandas 
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS amount_received DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS change_amount DECIMAL(10,2);

-- Adiciona comentários para documentação
COMMENT ON COLUMN comandas.payment_method IS 'Método de pagamento: dinheiro, cartao, pix';
COMMENT ON COLUMN comandas.amount_received IS 'Valor recebido do cliente (relevante para pagamento em dinheiro)';
COMMENT ON COLUMN comandas.change_amount IS 'Valor do troco dado ao cliente';
