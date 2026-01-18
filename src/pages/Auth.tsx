import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';
import { AuthForm } from '@/components/auth/AuthForm';
import { useAuth } from '@/hooks/useAuth';
import { ChromaKeyImage } from '@/components/ui/chroma-key-image';
import { useSystemLogo } from '@/hooks/useSystemLogo';
import { ElectronTitleBar, useIsElectron } from '@/components/layout/ElectronTitleBar';
import foodPizza from '@/assets/food-pizza-transparent.png';
import foodBurger from '@/assets/food-burger-transparent.png';
import foodAcai from '@/assets/food-acai-transparent.png';
import foodSushi from '@/assets/food-sushi-transparent.png';
import { UtensilsCrossed, Truck, BarChart3, Smartphone } from 'lucide-react';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';

const features = [
  { icon: UtensilsCrossed, text: 'Cardápio digital completo' },
  { icon: Truck, text: 'Gestão de entregas' },
  { icon: BarChart3, text: 'Relatórios em tempo real' },
  { icon: Smartphone, text: 'Pedidos pelo celular' },
];

const foodImages = [
  { src: foodPizza, alt: 'Pizza', label: 'Pizzarias' },
  { src: foodBurger, alt: 'Hambúrguer', label: 'Hamburguerias' },
  { src: foodAcai, alt: 'Açaí', label: 'Açaiterias' },
  { src: foodSushi, alt: 'Sushi', label: 'Japonesa' },
];

export default function Auth() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [currentSlide, setCurrentSlide] = useState(0);
  const { user, loading, hasRole, staffCompany } = useAuth();
  const { setTheme } = useTheme();
  const { logoUrl } = useSystemLogo("landing");
  const navigate = useNavigate();
  const location = useLocation();
  const isElectronApp = useIsElectron();

  // Force light theme on Auth page
  useEffect(() => {
    setTheme('light');
  }, [setTheme]);

  // Auto-rotate carousel
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % foodImages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlMode = params.get('mode');
    if (urlMode === 'signup') {
      setMode('signup');
    } else if (urlMode === 'login') {
      setMode('login');
    }
  }, [location.search]);

  useEffect(() => {
    if (!loading && user) {
      const isDriver = hasRole('delivery_driver');
      const isStoreOwner = hasRole('store_owner');
      const isSuperAdmin = hasRole('super_admin');
      const isStoreStaff = hasRole('store_staff');
      
      if (isDriver && !isStoreOwner && !isSuperAdmin && !isStoreStaff) {
        navigate('/driver');
      } else if (isStoreStaff && !isStoreOwner && !isSuperAdmin) {
        if (staffCompany) {
          navigate('/dashboard');
        }
      } else {
        navigate('/dashboard');
      }
    }
  }, [user, loading, hasRole, staffCompany, navigate]);


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <GoogleReCaptchaProvider reCaptchaKey={RECAPTCHA_SITE_KEY}>
      <div className={`min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-primary/5 ${isElectronApp ? 'pt-8' : ''}`}>
        {/* Electron Title Bar */}
        <ElectronTitleBar />

        {/* Logo no canto superior esquerdo */}
        <div className={`absolute ${isElectronApp ? 'top-14' : 'top-6'} left-6 z-20`}>
          <ChromaKeyImage
            src={logoUrl}
            alt="Cardápio On"
            className="h-16 sm:h-20 w-auto drop-shadow-lg"
          />
        </div>

        <div className="flex flex-1">
          {/* Left side - Form */}
          <div className={`w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 ${isElectronApp ? 'pt-24 sm:pt-16' : 'pt-20 sm:pt-8'}`}>
            <div className="w-full max-w-md animate-fade-in">
              <div className="text-center mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold font-display text-foreground">
                  {mode === 'login' ? 'Bem-vindo de volta!' : 'Crie sua conta'}
                </h1>
                <p className="text-muted-foreground mt-2 text-sm sm:text-base">
                  {mode === 'login'
                    ? 'Entre para gerenciar seu cardápio'
                    : 'Comece a vender online hoje'}
                </p>
              </div>

            <div className="bg-card rounded-2xl border border-border p-6 sm:p-8 shadow-xl shadow-primary/5">
              <AuthForm mode={mode} onToggleMode={() => setMode(mode === 'login' ? 'signup' : 'login')} />
            </div>
            
            {/* Mobile features - shown only on mobile */}
            <div className="lg:hidden mt-8 grid grid-cols-2 gap-3">
              {features.map((feature, index) => (
                <div 
                  key={index}
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-card/50 border border-border/50"
                >
                  <feature.icon className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-xs font-medium text-foreground">{feature.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right side - Hero with carousel */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary/10 via-accent/5 to-secondary/10">
          {/* Decorative circles */}
          <div className="absolute -top-20 -left-20 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-warning/10 rounded-full blur-2xl" />
          
          <div className="relative z-10 flex flex-col items-center justify-center w-full p-12">
            {/* Carousel */}
            <div className="relative mb-8 w-full max-w-md">
              <div className="relative h-72 flex items-center justify-center">
                {foodImages.map((image, index) => (
                  <div
                    key={index}
                    className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-500 ${
                      index === currentSlide 
                        ? 'opacity-100 scale-100 z-10' 
                        : 'opacity-0 scale-90 z-0'
                    }`}
                  >
                    <img 
                      src={image.src} 
                      alt={image.alt} 
                      className="w-56 h-56 object-contain drop-shadow-2xl"
                    />
                    <span className="mt-4 text-lg font-semibold text-foreground bg-card/80 backdrop-blur-sm px-4 py-2 rounded-full border border-border/50">
                      {image.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Text content */}
            <div className="text-center max-w-md animate-slide-up">
              <h2 className="text-3xl font-bold font-display text-foreground mb-4">
                Seu cardápio digital em minutos
              </h2>
              <p className="text-muted-foreground mb-8">
                Gerencie pedidos, entregas e vendas de forma simples e eficiente.
              </p>
              
              {/* Features grid */}
              <div className="grid grid-cols-2 gap-4">
                {features.map((feature, index) => (
                  <div 
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 transition-all hover:bg-card/80 hover:border-primary/30"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <feature.icon className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-foreground">{feature.text}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Stats */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-8">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">100+</div>
                <div className="text-xs text-muted-foreground">Empresas</div>
              </div>
              <div className="w-px bg-border" />
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">10k+</div>
                <div className="text-xs text-muted-foreground">Pedidos</div>
              </div>
              <div className="w-px bg-border" />
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">98%</div>
                <div className="text-xs text-muted-foreground">Satisfação</div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </GoogleReCaptchaProvider>
  );
}
