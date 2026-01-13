import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, XCircle, CreditCard, ChevronDown, ExternalLink, Eye, EyeOff, Info } from 'lucide-react';

interface PaymentSettings {
  picpay_enabled: boolean;
  picpay_verified: boolean;
  picpay_client_id: string | null;
  picpay_client_secret: string | null;
  picpay_account_email: string | null;
}

interface PicPayConfigProps {
  companyId: string;
}

const PicPayRequirementsInfo = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-4">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground hover:text-foreground">
          <span className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            Como obter as credenciais do PicPay?
          </span>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Alert className="mt-2">
          <AlertDescription className="text-sm space-y-2">
            <p><strong>Para integrar o PicPay:</strong></p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Acesse sua conta no <a href="https://lojista.picpay.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">PicPay Empresas <ExternalLink className="h-3 w-3" /></a></li>
              <li>Vá em <strong>Integrações</strong></li>
              <li>Clique em <strong>Gateway de Pagamento</strong></li>
              <li>Copie o <strong>Client ID</strong> e o <strong>Client Secret</strong></li>
              <li>Cole os valores nos campos abaixo</li>
            </ol>
            <p className="text-xs text-muted-foreground mt-2">
              As credenciais são únicas da sua conta e permitem receber pagamentos via PicPay.
            </p>
          </AlertDescription>
        </Alert>
      </CollapsibleContent>
    </Collapsible>
  );
};

export function PicPayConfig({ companyId }: PicPayConfigProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [showClientId, setShowClientId] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [settings, setSettings] = useState<PaymentSettings>({
    picpay_enabled: false,
    picpay_verified: false,
    picpay_client_id: null,
    picpay_client_secret: null,
    picpay_account_email: null,
  });

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [accountEmail, setAccountEmail] = useState('');

  useEffect(() => {
    loadSettings();
  }, [companyId]);

  const loadSettings = async () => {
    try {
      // Check if PicPay is available at system level
      const { data: sysData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'integration_picpay_enabled')
        .maybeSingle();
      
      const available = sysData?.value === 'true';
      setIsAvailable(available);

      if (!available) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('company_payment_settings')
        .select('picpay_enabled, picpay_verified, picpay_client_id, picpay_client_secret, picpay_account_email')
        .eq('company_id', companyId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          picpay_enabled: !!data.picpay_enabled,
          picpay_verified: !!data.picpay_verified,
          picpay_client_id: data.picpay_client_id,
          picpay_client_secret: data.picpay_client_secret,
          picpay_account_email: data.picpay_account_email,
        });
        setClientId(data.picpay_client_id || '');
        setClientSecret(data.picpay_client_secret || '');
        setAccountEmail(data.picpay_account_email || '');
      }
    } catch (error) {
      console.error('Error loading PicPay settings:', error);
      toast.error('Erro ao carregar configurações do PicPay');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!clientId.trim() || !clientSecret.trim() || !accountEmail.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from('company_payment_settings')
        .select('id')
        .eq('company_id', companyId)
        .maybeSingle();

      const updateData = {
        picpay_enabled: true,
        picpay_verified: false,
        picpay_client_id: clientId.trim(),
        picpay_client_secret: clientSecret.trim(),
        picpay_account_email: accountEmail.trim(),
      };

      if (existing) {
        const { error } = await supabase
          .from('company_payment_settings')
          .update(updateData)
          .eq('company_id', companyId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_payment_settings')
          .insert({ company_id: companyId, ...updateData });
        if (error) throw error;
      }

      setSettings(prev => ({ ...prev, ...updateData }));
      toast.success('Credenciais salvas! Valide a conexão para ativar.');
    } catch (error) {
      console.error('Error saving PicPay settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-picpay-credentials', {
        body: { companyId }
      });

      if (error) throw error;

      if (data?.valid) {
        setSettings(prev => ({ ...prev, picpay_verified: true }));
        toast.success('Conexão validada com sucesso!');
      } else {
        toast.error(data?.message || 'Credenciais inválidas');
      }
    } catch (error: any) {
      console.error('Error validating PicPay:', error);
      toast.error('Erro ao validar credenciais');
    } finally {
      setValidating(false);
    }
  };

  const handleDisable = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('company_payment_settings')
        .update({
          picpay_enabled: false,
          picpay_verified: false,
        })
        .eq('company_id', companyId);

      if (error) throw error;

      setSettings(prev => ({ ...prev, picpay_enabled: false, picpay_verified: false }));
      toast.success('PicPay desativado');
    } catch (error) {
      console.error('Error disabling PicPay:', error);
      toast.error('Erro ao desativar');
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

  // PicPay não disponível no sistema
  if (!isAvailable) {
    return (
      <Card className="opacity-75">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#21C25E]/10 rounded-lg grayscale">
                <CreditCard className="h-5 w-5 text-[#21C25E]" />
              </div>
              <div>
                <CardTitle className="text-lg">PicPay</CardTitle>
                <CardDescription>Receba pagamentos via PicPay</CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-300">
              Em breve
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Alert className="bg-amber-50 border-amber-200">
            <Info className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-700">
              <strong>Integração em manutenção</strong>
              <p className="text-sm mt-1">
                A integração com PicPay está temporariamente indisponível devido a instabilidades na API do parceiro. 
                Estamos trabalhando para restabelecer o serviço em breve.
              </p>
              <p className="text-xs mt-2 text-amber-600">
                Use o Mercado Pago como alternativa para receber pagamentos online.
              </p>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // PicPay disponível - mostra formulário completo
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#21C25E]/10 rounded-lg">
              <CreditCard className="h-5 w-5 text-[#21C25E]" />
            </div>
            <div>
              <CardTitle className="text-lg">PicPay</CardTitle>
              <CardDescription>Receba pagamentos via PicPay</CardDescription>
            </div>
          </div>
          {settings.picpay_verified ? (
            <Badge variant="outline" className="text-green-600 border-green-600 gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Verificado
            </Badge>
          ) : settings.picpay_enabled ? (
            <Badge variant="outline" className="text-amber-600 border-amber-600 gap-1">
              <XCircle className="h-3 w-3" />
              Não verificado
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <PicPayRequirementsInfo />

        <div className="space-y-4">
          <div>
            <Label htmlFor="picpay-email">E-mail da conta PicPay *</Label>
            <Input
              id="picpay-email"
              type="email"
              value={accountEmail}
              onChange={(e) => setAccountEmail(e.target.value)}
              placeholder="seu-email@empresa.com"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="picpay-client-id">Client ID *</Label>
            <div className="relative mt-1.5">
              <Input
                id="picpay-client-id"
                type={showClientId ? "text" : "password"}
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Seu Client ID do PicPay"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowClientId(!showClientId)}
              >
                {showClientId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="picpay-secret">Client Secret *</Label>
            <div className="relative mt-1.5">
              <Input
                id="picpay-secret"
                type={showSecret ? "text" : "password"}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Seu Client Secret do PicPay"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowSecret(!showSecret)}
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Credenciais
          </Button>

          {settings.picpay_enabled && !settings.picpay_verified && (
            <Button variant="outline" onClick={handleValidate} disabled={validating}>
              {validating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Validar Conexão
            </Button>
          )}

          {settings.picpay_enabled && (
            <Button variant="destructive" onClick={handleDisable} disabled={saving}>
              Desativar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
