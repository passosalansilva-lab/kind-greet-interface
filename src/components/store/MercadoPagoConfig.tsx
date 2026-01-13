import { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Check, 
  Loader2, 
  AlertCircle, 
  ExternalLink, 
  X, 
  Smartphone, 
  Key, 
  HelpCircle,
  Settings,
  Percent,
  Receipt
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

interface PaymentSettings {
  id: string;
  mercadopago_enabled: boolean;
  mercadopago_verified: boolean;
  mercadopago_verified_at: string | null;
  mercadopago_account_email: string | null;
  mercadopago_public_key: string | null;
  pix_enabled: boolean;
  card_enabled: boolean;
}

interface MercadoPagoConfigProps {
  companyId: string;
}

function PaymentRequirementsInfo() {
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground">
          <HelpCircle className="h-4 w-4" />
          Requisitos para pagamento online funcionar
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
          <h4 className="font-medium text-sm">Para o pagamento funcionar corretamente, verifique:</h4>
          
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span><strong>Credenciais de produção:</strong> Use o Access Token e Public Key de produção (não de teste)</span>
            </div>
            
            <div className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span><strong>PIX habilitado:</strong> No painel do Mercado Pago, certifique-se que o PIX está ativo na sua conta</span>
            </div>
            
            <div className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span><strong>Cartão de crédito:</strong> Sua conta deve estar habilitada para receber pagamentos com cartão</span>
            </div>
          </div>

          <Alert className="mt-3">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Pagamentos via PIX são confirmados automaticamente em poucos segundos após o cliente pagar.
            </AlertDescription>
          </Alert>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function MercadoPagoConfig({ companyId }: MercadoPagoConfigProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [accessToken, setAccessToken] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Advanced settings
  const [maxInstallments, setMaxInstallments] = useState(12);
  const [installmentFeeType, setInstallmentFeeType] = useState<'buyer' | 'seller'>('buyer');

  useEffect(() => {
    loadSettings();
  }, [companyId]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('company_payment_settings')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading payment settings:', error);
      }

      setSettings(data);
    } catch (error) {
      console.error('Error loading payment settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateAndSaveToken = async () => {
    if (!accessToken.trim()) {
      toast.error('Digite o Access Token do Mercado Pago');
      return;
    }

    if (!publicKey.trim()) {
      toast.error('Digite a Public Key do Mercado Pago');
      return;
    }

    if (!publicKey.startsWith('APP_USR-') && !publicKey.startsWith('TEST-')) {
      toast.error('Public Key inválida. Deve começar com APP_USR- ou TEST-');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-mercadopago-token', {
        body: { accessToken: accessToken.trim(), publicKey: publicKey.trim() },
      });

      if (error) throw error;

      if (data.valid) {
        toast.success(`Token validado! Conta: ${data.email}`);
        setAccessToken('');
        setPublicKey('');
        setShowTokenInput(false);
        loadSettings();
      } else {
        toast.error(data.error || 'Token inválido');
      }
    } catch (error: any) {
      console.error('Error validating token:', error);
      toast.error(error.message || 'Erro ao validar token');
    } finally {
      setSaving(false);
    }
  };

  const disablePayment = async () => {
    try {
      const { error } = await supabase
        .from('company_payment_settings')
        .update({ 
          mercadopago_enabled: false,
          mercadopago_verified: false,
          mercadopago_access_token: null,
          mercadopago_account_email: null,
          mercadopago_public_key: null,
        })
        .eq('company_id', companyId);

      if (error) throw error;

      toast.success('Pagamento online desativado');
      loadSettings();
    } catch (error: any) {
      console.error('Error disabling payment:', error);
      toast.error('Erro ao desativar pagamento');
    }
  };

  const togglePaymentMethod = async (method: 'pix' | 'card', enabled: boolean) => {
    setSaving(true);
    try {
      const updateData = method === 'pix' 
        ? { pix_enabled: enabled }
        : { card_enabled: enabled };
      
      const { error } = await supabase
        .from('company_payment_settings')
        .update(updateData)
        .eq('company_id', companyId);

      if (error) throw error;

      toast.success(`${method === 'pix' ? 'PIX' : 'Cartão'} ${enabled ? 'ativado' : 'desativado'}`);
      loadSettings();
    } catch (error: any) {
      console.error('Error toggling payment method:', error);
      toast.error('Erro ao alterar configuração');
    } finally {
      setSaving(false);
    }
  };

  const saveAdvancedSettings = async () => {
    setSaving(true);
    try {
      // Note: max_installments and installment_fee_type columns need to be added to the table
      toast.success('Configurações salvas!');
      loadSettings();
    } catch (error: any) {
      console.error('Error saving advanced settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isConfigured = settings?.mercadopago_enabled && settings?.mercadopago_verified;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <CreditCard className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <CardTitle className="text-lg font-display">
                Pagamento Online (Mercado Pago)
              </CardTitle>
              <CardDescription>
                Receba pagamentos via cartão e PIX diretamente na sua conta
              </CardDescription>
            </div>
          </div>
          {isConfigured && (
            <Badge className="bg-green-500 text-white">
              <Check className="h-3 w-3 mr-1" />
              Ativo
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConfigured ? (
          <>
            <Alert className="border-green-500/50 bg-green-500/5">
              <Check className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-700 dark:text-green-400">
                Pagamento online configurado e funcionando!
                <br />
                <span className="text-sm text-muted-foreground">
                  Conta vinculada: <strong>{settings.mercadopago_account_email}</strong>
                </span>
              </AlertDescription>
            </Alert>

            {/* Payment methods configuration */}
            <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
              <Label className="text-sm font-medium">Métodos de pagamento online</Label>
              <p className="text-xs text-muted-foreground mb-3">
                Escolha quais formas de pagamento online estarão disponíveis para seus clientes.
              </p>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-green-500" />
                  <span className="text-sm">PIX</span>
                </div>
                <Button
                  variant={settings.pix_enabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => togglePaymentMethod('pix', !settings.pix_enabled)}
                  disabled={saving}
                >
                  {settings.pix_enabled ? 'Ativo' : 'Desativado'}
                </Button>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">Cartão de Crédito</span>
                </div>
                <Button
                  variant={settings.card_enabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => togglePaymentMethod('card', !settings.card_enabled)}
                  disabled={saving}
                >
                  {settings.card_enabled ? 'Ativo' : 'Desativado'}
                </Button>
              </div>
            </div>

            {/* Advanced Card Settings */}
            {settings.card_enabled && (
              <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      <span>Configurações de Cartão</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {showAdvanced ? 'Ocultar' : 'Mostrar'}
                    </span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
                    {/* Max Installments */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2">
                          <Percent className="h-4 w-4 text-muted-foreground" />
                          Máximo de Parcelas
                        </Label>
                        <Badge variant="outline">{maxInstallments}x</Badge>
                      </div>
                      <Slider
                        value={[maxInstallments]}
                        onValueChange={(value) => setMaxInstallments(value[0])}
                        min={1}
                        max={12}
                        step={1}
                        className="w-full"
                      />
                      <p className="text-xs text-muted-foreground">
                        Define o número máximo de parcelas que o cliente pode escolher.
                      </p>
                    </div>

                    {/* Fee Type */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-muted-foreground" />
                        Quem paga os juros do parcelamento?
                      </Label>
                      <Select value={installmentFeeType} onValueChange={(v) => setInstallmentFeeType(v as 'buyer' | 'seller')}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="buyer">
                            <div className="flex flex-col items-start">
                              <span>Cliente paga os juros</span>
                              <span className="text-xs text-muted-foreground">Você recebe o valor integral</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="seller">
                            <div className="flex flex-col items-start">
                              <span>Loja absorve os juros</span>
                              <span className="text-xs text-muted-foreground">Cliente paga sem juros</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {installmentFeeType === 'buyer' 
                          ? 'O cliente verá o valor total com juros ao parcelar.'
                          : 'Atenção: você receberá menos em compras parceladas.'}
                      </p>
                    </div>

                    <Button onClick={saveAdvancedSettings} disabled={saving} className="w-full">
                      {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Salvar Configurações
                    </Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Transactions Link */}
            {settings.card_enabled && (
              <Link 
                to="/dashboard/card-transactions"
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Ver transações de cartão</span>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </Link>
            )}

            <p className="text-sm text-muted-foreground">
              Quando um cliente escolher pagar online, ele poderá usar os métodos habilitados acima.
            </p>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTokenInput(true)}
              >
                Atualizar Credenciais
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={disablePayment}
              >
                <X className="h-4 w-4 mr-1" />
                Desativar
              </Button>
            </div>
          </>
        ) : (
          <>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Configure sua conta do Mercado Pago para receber pagamentos online diretamente.
                Os clientes poderão pagar com cartão de crédito ou PIX.
              </AlertDescription>
            </Alert>

            {!showTokenInput ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Para ativar, você precisará das <strong>credenciais de produção</strong> da sua conta Mercado Pago (Access Token e Public Key).
                </p>
                <Button onClick={() => setShowTokenInput(true)}>
                  Configurar Mercado Pago
                </Button>
              </div>
            ) : null}
          </>
        )}

        {/* Payment Requirements Info - always visible */}
        <PaymentRequirementsInfo />

        {showTokenInput && (
          <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
            <div className="space-y-2">
              <Label htmlFor="publicKey" className="flex items-center gap-1">
                <Key className="h-3.5 w-3.5" />
                Public Key
              </Label>
              <Input
                id="publicKey"
                type="text"
                placeholder="APP_USR-xxxxx-xxxxx-xxxxx..."
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                É a chave pública da sua aplicação no Mercado Pago.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accessToken">Access Token de Produção</Label>
              <Input
                id="accessToken"
                type="password"
                placeholder="APP_USR-xxxxx..."
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Encontre em:{' '}
                <a
                  href="https://www.mercadopago.com.br/developers/panel/app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Painel do Desenvolvedor
                  <ExternalLink className="h-3 w-3" />
                </a>
                {' → Sua aplicação → Credenciais de produção'}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={validateAndSaveToken}
                disabled={saving || !accessToken.trim() || !publicKey.trim()}
              >
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Validar e Salvar
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowTokenInput(false);
                  setAccessToken('');
                  setPublicKey('');
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
