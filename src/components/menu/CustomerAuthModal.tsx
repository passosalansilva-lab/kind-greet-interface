import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Mail, User, Phone, Gift, Check } from 'lucide-react';
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';

const emailSchema = z.object({
  email: z.string().email('Email inválido'),
});

const registerSchema = z.object({
  name: z.string().min(2, 'Nome é obrigatório'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
});

type EmailFormData = z.infer<typeof emailSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

export interface CustomerData {
  id: string;
  name: string;
  email: string | null;
  phone: string;
}

export interface ReferralDiscountData {
  discountPercent: number;
  referrerName: string;
  referralCodeId: string;
  referrerId: string;
}

interface CustomerAuthModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (customer: CustomerData, referralDiscount?: ReferralDiscountData) => void;
  referralCode?: string | null;
  companyId?: string;
}

interface CustomerAuthFormProps {
  onClose: () => void;
  onSuccess: (customer: CustomerData, referralDiscount?: ReferralDiscountData) => void;
  referralCode?: string | null;
  companyId?: string;
}

function CustomerAuthForm({ onClose, onSuccess, referralCode, companyId }: CustomerAuthFormProps) {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>(referralCode ? 'register' : 'login');
  const { executeRecaptcha } = useGoogleReCaptcha();

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const resetState = () => {
    emailForm.reset();
    registerForm.reset();
    setMode(referralCode ? 'register' : 'login');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleEmailLogin = async (data: EmailFormData) => {
    setLoading(true);
    try {
      // Verify reCAPTCHA only if configured and available
      if (RECAPTCHA_SITE_KEY && executeRecaptcha) {
        try {
          const recaptchaToken = await executeRecaptcha('customer_login');
          
          const { data: recaptchaResult, error: recaptchaError } = await supabase.functions.invoke('verify-recaptcha', {
            body: { token: recaptchaToken }
          });

          if (recaptchaError || !recaptchaResult?.success) {
            console.error('reCAPTCHA verification failed:', recaptchaError || recaptchaResult?.error);
            toast.error(recaptchaResult?.error || 'Verificação de segurança falhou. Tente novamente.');
            setLoading(false);
            return;
          }
        } catch (recaptchaErr) {
          console.warn('reCAPTCHA error, proceeding without:', recaptchaErr);
        }
      }

      const { data: result, error } = await supabase.functions.invoke('lookup-customer', {
        body: { email: data.email.toLowerCase().trim() }
      });

      if (error) {
        console.error('Customer lookup error:', error);
        throw new Error(error.message || 'Erro ao buscar cliente');
      }

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      if (result?.found && result?.customerId) {
        toast.success(`Bem-vindo de volta, ${result.firstName}!`);
        
        const customer: CustomerData = {
          id: result.customerId,
          name: result.name || result.firstName,
          email: result.email || data.email.toLowerCase().trim(),
          phone: result.phone || '',
        };
        
        onSuccess(customer);
        handleClose();
      } else {
        // Customer not found - offer to register
        if (referralCode) {
          // If there's a referral code, switch to register mode with pre-filled email
          registerForm.setValue('email', data.email.toLowerCase().trim());
          setMode('register');
          toast.info('Cadastre-se para ativar seu desconto de indicação!');
        } else {
          toast.error('Email não encontrado. Faça seu primeiro pedido para se cadastrar.');
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.message?.includes('429') || error.status === 429) {
        toast.error('Muitas tentativas. Aguarde um minuto e tente novamente.');
      } else if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        toast.error('Erro de conexão. Verifique sua internet e tente novamente.');
      } else {
        toast.error(error.message || 'Erro ao buscar cliente. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (data: RegisterFormData) => {
    if (!referralCode || !companyId) {
      toast.error('Código de indicação inválido');
      return;
    }

    setLoading(true);
    try {
      // Verify reCAPTCHA if configured
      if (RECAPTCHA_SITE_KEY && executeRecaptcha) {
        try {
          const recaptchaToken = await executeRecaptcha('customer_register');
          
          const { data: recaptchaResult, error: recaptchaError } = await supabase.functions.invoke('verify-recaptcha', {
            body: { token: recaptchaToken }
          });

          if (recaptchaError || !recaptchaResult?.success) {
            console.error('reCAPTCHA verification failed:', recaptchaError || recaptchaResult?.error);
            toast.error(recaptchaResult?.error || 'Verificação de segurança falhou. Tente novamente.');
            setLoading(false);
            return;
          }
        } catch (recaptchaErr) {
          console.warn('reCAPTCHA error, proceeding without:', recaptchaErr);
        }
      }

      const { data: result, error } = await supabase.functions.invoke('register-referred-customer', {
        body: {
          email: data.email.toLowerCase().trim(),
          name: data.name.trim(),
          phone: data.phone || '',
          referralCode,
          companyId,
        }
      });

      if (error) {
        console.error('Register error:', error);
        throw new Error(error.message || 'Erro ao cadastrar');
      }

      if (result?.error) {
        toast.error(result.error);
        
        // If customer already exists but can't use referral, still log them in
        if (result.customerId) {
          const customer: CustomerData = {
            id: result.customerId,
            name: result.customerName || data.name,
            email: result.customerEmail || data.email,
            phone: result.customerPhone || data.phone || '',
          };
          onSuccess(customer);
          handleClose();
        }
        return;
      }

      if (result?.success) {
        toast.success(result.message || 'Cadastro realizado com sucesso!');
        
        const customer: CustomerData = {
          id: result.customerId,
          name: result.customerName,
          email: result.customerEmail,
          phone: result.customerPhone || '',
        };

        // If referral was valid, pass the discount data
        let referralDiscount: ReferralDiscountData | undefined;
        if (result.referralValid) {
          referralDiscount = {
            discountPercent: result.discountPercent,
            referrerName: result.referrerName,
            referralCodeId: result.referralCodeId,
            referrerId: result.referrerId,
          };
        }
        
        onSuccess(customer, referralDiscount);
        handleClose();
      }
    } catch (error: any) {
      console.error('Register error:', error);
      toast.error(error.message || 'Erro ao cadastrar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'register' && referralCode) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="text-center">Cadastre-se e ganhe desconto!</DialogTitle>
        </DialogHeader>

        <div className="mt-4 p-4 bg-success/10 border border-success/30 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
              <Gift className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="font-medium text-success">Indicação ativa!</p>
              <p className="text-sm text-muted-foreground">
                Complete seu cadastro para receber seu desconto
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={registerForm.handleSubmit(handleRegister)} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome completo *</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="name"
                placeholder="Seu nome"
                className="pl-10"
                {...registerForm.register('name')}
              />
            </div>
            {registerForm.formState.errors.name && (
              <p className="text-sm text-destructive">{registerForm.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                className="pl-10"
                {...registerForm.register('email')}
              />
            </div>
            {registerForm.formState.errors.email && (
              <p className="text-sm text-destructive">{registerForm.formState.errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone (opcional)</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="phone"
                placeholder="(00) 00000-0000"
                className="pl-10"
                {...registerForm.register('phone')}
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Check className="mr-2 h-4 w-4" />
            Cadastrar e Receber Desconto
          </Button>
        </form>

        <div className="mt-4 text-center">
          <Button variant="link" onClick={() => setMode('login')} className="text-sm">
            Já tenho cadastro? Entrar
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-center">Acessar minha conta</DialogTitle>
      </DialogHeader>

      <form onSubmit={emailForm.handleSubmit(handleEmailLogin)} className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              className="pl-10"
              {...emailForm.register('email')}
            />
          </div>
          {emailForm.formState.errors.email && (
            <p className="text-sm text-destructive">{emailForm.formState.errors.email.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Entrar
        </Button>
      </form>

      <p className="mt-4 text-xs text-muted-foreground text-center">
        Use o mesmo email do seu primeiro pedido para acessar seus endereços salvos.
      </p>

      {referralCode && (
        <div className="mt-4 pt-4 border-t">
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => setMode('register')}
          >
            <Gift className="mr-2 h-4 w-4" />
            Novo cliente? Cadastre-se e ganhe desconto!
          </Button>
        </div>
      )}
    </>
  );
}

export function CustomerAuthModal({ open, onClose, onSuccess, referralCode, companyId }: CustomerAuthModalProps) {
  if (!RECAPTCHA_SITE_KEY) {
    console.warn('VITE_RECAPTCHA_SITE_KEY not configured');
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        {RECAPTCHA_SITE_KEY ? (
          <GoogleReCaptchaProvider reCaptchaKey={RECAPTCHA_SITE_KEY}>
            <CustomerAuthForm 
              onClose={onClose} 
              onSuccess={onSuccess} 
              referralCode={referralCode}
              companyId={companyId}
            />
          </GoogleReCaptchaProvider>
        ) : (
          <CustomerAuthForm 
            onClose={onClose} 
            onSuccess={onSuccess}
            referralCode={referralCode}
            companyId={companyId}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
