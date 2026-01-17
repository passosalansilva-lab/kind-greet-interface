-- Add WhatsApp driver share setting to companies table
-- This setting controls whether to automatically open WhatsApp when assigning a driver to an order

ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS whatsapp_driver_share_enabled BOOLEAN DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.companies.whatsapp_driver_share_enabled IS 'Quando ativado, ao atribuir um entregador a um pedido, abre automaticamente o WhatsApp com a mensagem do pedido para o entregador';
