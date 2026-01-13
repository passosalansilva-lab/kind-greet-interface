import { useState, useEffect } from 'react';
import { CreditCard, Check, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface PaymentGatewaySettings {
  mercadopago_enabled: boolean;
  mercadopago_verified: boolean;
  picpay_enabled: boolean;
  picpay_verified: boolean;
  active_payment_gateway: string;
}

interface SystemIntegrationSettings {
  mercadopago_available: boolean;
  picpay_available: boolean;
}

interface PaymentGatewaySelectorProps {
  companyId: string;
  onGatewayChange?: (gateway: string) => void;
}

export function PaymentGatewaySelector({ companyId, onGatewayChange }: PaymentGatewaySelectorProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PaymentGatewaySettings | null>(null);
  const [systemSettings, setSystemSettings] = useState<SystemIntegrationSettings>({
    mercadopago_available: true,
    picpay_available: false,
  });

  useEffect(() => {
    loadSettings();
  }, [companyId]);

  const loadSettings = async () => {
    try {
      // Load system-wide integration settings
      const { data: sysData } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['integration_mercadopago_enabled', 'integration_picpay_enabled']);
      
      const sysSettings: SystemIntegrationSettings = {
        mercadopago_available: true, // default enabled
        picpay_available: false, // default disabled
      };
      
      sysData?.forEach(item => {
        if (item.key === 'integration_mercadopago_enabled') {
          sysSettings.mercadopago_available = item.value === 'true';
        } else if (item.key === 'integration_picpay_enabled') {
          sysSettings.picpay_available = item.value === 'true';
        }
      });
      
      setSystemSettings(sysSettings);

      // Load company payment settings
      const { data, error } = await supabase
        .from('company_payment_settings')
        .select('mercadopago_enabled, mercadopago_verified, picpay_enabled, picpay_verified, active_payment_gateway')
        .eq('company_id', companyId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          mercadopago_enabled: !!data.mercadopago_enabled,
          mercadopago_verified: !!data.mercadopago_verified,
          picpay_enabled: !!data.picpay_enabled,
          picpay_verified: !!data.picpay_verified,
          active_payment_gateway: data.active_payment_gateway || 'mercadopago',
        });
      } else {
        setSettings({
          mercadopago_enabled: false,
          mercadopago_verified: false,
          picpay_enabled: false,
          picpay_verified: false,
          active_payment_gateway: 'mercadopago',
        });
      }
    } catch (error) {
      console.error('Error loading payment settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGatewaySelect = async (gateway: string) => {
    if (!settings) return;

    // Verificar se o gateway selecionado está configurado
    if (gateway === 'mercadopago' && (!settings.mercadopago_enabled || !settings.mercadopago_verified)) {
      toast({
        title: 'Mercado Pago não configurado',
        description: 'Configure e valide o Mercado Pago abaixo antes de selecioná-lo.',
        variant: 'destructive',
      });
      return;
    }

    if (gateway === 'picpay' && (!settings.picpay_enabled || !settings.picpay_verified)) {
      toast({
        title: 'PicPay não configurado',
        description: 'Configure e valide o PicPay abaixo antes de selecioná-lo.',
        variant: 'destructive',
      });
      return;
    }

    // Se já é o gateway ativo, não fazer nada
    if (settings.active_payment_gateway === gateway) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('company_payment_settings')
        .update({ active_payment_gateway: gateway })
        .eq('company_id', companyId);

      if (error) throw error;

      setSettings({ ...settings, active_payment_gateway: gateway });
      onGatewayChange?.(gateway);
      
      const gatewayName = gateway === 'mercadopago' ? 'Mercado Pago' : 'PicPay';
      toast({
        title: `${gatewayName} ativado!`,
        description: `Os clientes pagarão via ${gatewayName} no checkout.`,
      });
    } catch (error) {
      console.error('Error updating gateway:', error);
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar o gateway de pagamento.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Gateway de Pagamento Ativo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!settings) return null;

  const mercadoPagoReady = settings.mercadopago_enabled && settings.mercadopago_verified;
  const picPayReady = settings.picpay_enabled && settings.picpay_verified;
  
  // Check if any gateway is available at system level
  const anyGatewayAvailable = systemSettings.mercadopago_available || systemSettings.picpay_available;
  const hasAnyGateway = (mercadoPagoReady && systemSettings.mercadopago_available) || (picPayReady && systemSettings.picpay_available);

  // If no gateway is available at system level, show message
  if (!anyGatewayAvailable) {
    return (
      <Card className="border-2 border-dashed">
        <CardHeader>
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Gateway de Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
            <p>Nenhuma integração de pagamento disponível no momento.</p>
            <p className="text-sm mt-1">Entre em contato com o suporte.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-dashed">
      <CardHeader>
        <CardTitle className="text-lg font-display flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          Gateway de Pagamento Ativo
        </CardTitle>
        <CardDescription>
          {hasAnyGateway 
            ? 'Escolha qual gateway será usado para processar pagamentos online. Apenas um pode estar ativo por vez.'
            : 'Configure pelo menos um gateway de pagamento abaixo para receber pagamentos online.'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className={cn(
          "grid gap-3",
          systemSettings.mercadopago_available && systemSettings.picpay_available ? "sm:grid-cols-2" : "sm:grid-cols-1 max-w-md"
        )}>
          {/* Mercado Pago */}
          {systemSettings.mercadopago_available && (
            <button
              type="button"
              onClick={() => handleGatewaySelect('mercadopago')}
              disabled={saving || !mercadoPagoReady}
              className={cn(
                "relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 p-6 transition-all",
                settings.active_payment_gateway === 'mercadopago' && mercadoPagoReady
                  ? "border-[#009ee3] bg-[#009ee3]/5 ring-2 ring-[#009ee3]/20"
                  : mercadoPagoReady
                    ? "border-border hover:border-[#009ee3]/50 hover:bg-[#009ee3]/5 cursor-pointer"
                    : "border-dashed border-muted-foreground/30 opacity-50 cursor-not-allowed"
              )}
            >
              {/* Logo */}
              <div className="h-10 flex items-center justify-center">
                <svg viewBox="0 0 120 40" className="h-8" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="120" height="40" rx="6" fill="#009ee3"/>
                  <text x="60" y="26" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">Mercado Pago</text>
                </svg>
              </div>
              
              {/* Status */}
              {mercadoPagoReady ? (
                <Badge variant="outline" className="text-green-600 border-green-600 gap-1">
                  <Check className="h-3 w-3" />
                  Configurado
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Não configurado
                </Badge>
              )}

              {/* Active indicator */}
              {settings.active_payment_gateway === 'mercadopago' && mercadoPagoReady && (
                <div className="absolute -top-2 -right-2 flex items-center justify-center w-6 h-6 rounded-full bg-[#009ee3] text-white">
                  <Check className="h-4 w-4" />
                </div>
              )}

              {/* Text */}
              <span className="text-xs text-muted-foreground text-center">
                PIX e Cartão de Crédito
              </span>
            </button>
          )}

          {/* PicPay */}
          {systemSettings.picpay_available ? (
            <button
              type="button"
              onClick={() => handleGatewaySelect('picpay')}
              disabled={saving || !picPayReady}
              className={cn(
                "relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 p-6 transition-all",
                settings.active_payment_gateway === 'picpay' && picPayReady
                  ? "border-[#21c25e] bg-[#21c25e]/5 ring-2 ring-[#21c25e]/20"
                  : picPayReady
                    ? "border-border hover:border-[#21c25e]/50 hover:bg-[#21c25e]/5 cursor-pointer"
                    : "border-dashed border-muted-foreground/30 opacity-50 cursor-not-allowed"
              )}
            >
              {/* Logo */}
              <div className="h-10 flex items-center justify-center">
                <svg viewBox="0 0 80 40" className="h-8" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="80" height="40" rx="6" fill="#21c25e"/>
                  <text x="40" y="26" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">PicPay</text>
                </svg>
              </div>
              
              {/* Status */}
              {picPayReady ? (
                <Badge variant="outline" className="text-green-600 border-green-600 gap-1">
                  <Check className="h-3 w-3" />
                  Configurado
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Não configurado
                </Badge>
              )}

              {/* Active indicator */}
              {settings.active_payment_gateway === 'picpay' && picPayReady && (
                <div className="absolute -top-2 -right-2 flex items-center justify-center w-6 h-6 rounded-full bg-[#21c25e] text-white">
                  <Check className="h-4 w-4" />
                </div>
              )}

              {/* Text */}
              <span className="text-xs text-muted-foreground text-center">
                Pagamentos via PicPay
              </span>
            </button>
          ) : (
            // Show PicPay as "Em breve" when not available at system level
            systemSettings.mercadopago_available && (
              <div
                className="relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 p-6 border-dashed border-muted-foreground/30 opacity-60 cursor-not-allowed"
              >
                <div className="h-10 flex items-center justify-center grayscale">
                  <svg viewBox="0 0 80 40" className="h-8" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="80" height="40" rx="6" fill="#21c25e"/>
                    <text x="40" y="26" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">PicPay</text>
                  </svg>
                </div>
                <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-700 border-amber-300">
                  <AlertCircle className="h-3 w-3" />
                  Em breve
                </Badge>
                <span className="text-xs text-muted-foreground text-center">
                  Integração em manutenção
                </span>
              </div>
            )
          )}
        </div>

        {/* Info text */}
        {hasAnyGateway && settings.active_payment_gateway && (
          <p className="text-sm text-center text-muted-foreground mt-4 pt-4 border-t">
            Gateway ativo: <strong className={settings.active_payment_gateway === 'mercadopago' ? 'text-[#009ee3]' : 'text-[#21c25e]'}>
              {settings.active_payment_gateway === 'mercadopago' ? 'Mercado Pago' : 'PicPay'}
            </strong>
          </p>
        )}

        {saving && (
          <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Salvando...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
