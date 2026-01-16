import { useState, useEffect, useCallback } from 'react';
import { Tag, ChevronLeft, ChevronRight, Sparkles, Percent, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { OptimizedImage } from '@/components/ui/optimized-image';
import { cn } from '@/lib/utils';
import { usePromotionTracking, useTrackPromotionViews } from '@/hooks/usePromotionTracking';
import { motion, AnimatePresence } from 'framer-motion';

interface Promotion {
  id: string;
  name: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  product_id: string | null;
  category_id: string | null;
  image_url: string | null;
  is_active: boolean;
  expires_at: string | null;
}

interface PromotionsBannerProps {
  promotions: Promotion[];
  companyId?: string;
  onPromotionClick?: (promotion: Promotion) => void;
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
    scale: 0.95,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
    scale: 0.95,
  }),
};

export function PromotionsBanner({ promotions, companyId, onPromotionClick }: PromotionsBannerProps) {
  const { trackClick } = usePromotionTracking();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [direction, setDirection] = useState(0);

  const activePromotions = promotions.filter(p => p.is_active);

  // Track views for all active promotions
  useTrackPromotionViews(activePromotions, companyId, activePromotions.length > 0);

  const nextSlide = useCallback(() => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % activePromotions.length);
  }, [activePromotions.length]);

  const prevSlide = useCallback(() => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + activePromotions.length) % activePromotions.length);
  }, [activePromotions.length]);

  useEffect(() => {
    if (!isAutoPlaying || activePromotions.length <= 1) return;

    const interval = setInterval(() => {
      setDirection(1);
      nextSlide();
    }, 5000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, nextSlide, activePromotions.length]);

  if (activePromotions.length === 0) return null;

  const currentPromotion = activePromotions[currentIndex];

  const formatDiscount = (type: string, value: number) => {
    if (type === 'percentage') {
      return `${value}% OFF`;
    }
    return `R$ ${Number(value).toFixed(2)} OFF`;
  };

  const getTimeRemaining = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return null;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d restantes`;
    if (hours > 0) return `${hours}h restantes`;
    return 'Últimas horas!';
  };

  return (
    <motion.div 
      className="px-4 mt-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div 
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary/90 to-primary/80 shadow-xl"
        onMouseEnter={() => setIsAutoPlaying(false)}
        onMouseLeave={() => setIsAutoPlaying(true)}
      >
        {/* Decorative elements with floating animation */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div 
            className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.1, 0.2, 0.1],
            }}
            transition={{ 
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <motion.div 
            className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"
            animate={{ 
              scale: [1.2, 1, 1.2],
              opacity: [0.15, 0.1, 0.15],
            }}
            transition={{ 
              duration: 5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <motion.div
            animate={{ 
              rotate: [0, 15, -15, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{ 
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <Sparkles className="absolute top-4 right-4 h-6 w-6 text-white/30" />
          </motion.div>
        </div>

        <AnimatePresence mode="wait" custom={direction}>
          <motion.button
            key={currentIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            onClick={() => {
              if (companyId) {
                trackClick(currentPromotion.id, companyId);
              }
              onPromotionClick?.(currentPromotion);
            }}
            className="relative w-full text-left p-5 min-h-[140px] flex items-center gap-4"
            whileTap={{ scale: 0.98 }}
          >
            {/* Image */}
            {currentPromotion.image_url ? (
              <motion.div 
                className="flex-shrink-0 w-24 h-24 rounded-2xl overflow-hidden shadow-lg ring-2 ring-white/20"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.3 }}
              >
                <OptimizedImage
                  src={currentPromotion.image_url}
                  alt={currentPromotion.name}
                  className="w-full h-full object-cover"
                  containerClassName="w-full h-full"
                  fallback={
                    <div className="w-full h-full bg-white/20 flex items-center justify-center">
                      <Tag className="h-8 w-8 text-white/60" />
                    </div>
                  }
                />
              </motion.div>
            ) : (
              <motion.div 
                className="flex-shrink-0 w-24 h-24 rounded-2xl bg-white/20 flex items-center justify-center shadow-lg ring-2 ring-white/20"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.3 }}
              >
                <Percent className="h-10 w-10 text-white" />
              </motion.div>
            )}

            {/* Content */}
            <div className="flex-1 min-w-0 text-white">
              <motion.div 
                className="flex items-center gap-2 mb-2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15, duration: 0.3 }}
              >
                <Badge className="bg-white text-primary font-bold px-3 py-1 text-sm shadow-md">
                  <Zap className="h-3.5 w-3.5 mr-1" />
                  {formatDiscount(currentPromotion.discount_type, currentPromotion.discount_value)}
                </Badge>
                {getTimeRemaining(currentPromotion.expires_at) && (
                  <motion.span 
                    className="text-xs text-white/80 bg-white/20 px-2 py-1 rounded-full"
                    animate={{ opacity: [0.8, 1, 0.8] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    ⏱️ {getTimeRemaining(currentPromotion.expires_at)}
                  </motion.span>
                )}
              </motion.div>
              <motion.h3 
                className="font-display font-bold text-lg leading-tight line-clamp-1"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.3 }}
              >
                {currentPromotion.name}
              </motion.h3>
              {currentPromotion.description && (
                <motion.p 
                  className="text-sm text-white/80 mt-1 line-clamp-2 leading-relaxed"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, duration: 0.3 }}
                >
                  {currentPromotion.description}
                </motion.p>
              )}
              <motion.div 
                className="flex items-center gap-1 mt-2 text-sm text-white/70"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.3 }}
              >
                <Tag className="h-3.5 w-3.5" />
                <span>Toque para ver</span>
              </motion.div>
            </div>
          </motion.button>
        </AnimatePresence>

        {/* Navigation arrows */}
        {activePromotions.length > 1 && (
          <>
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 text-white border-0 transition-transform hover:scale-110"
                onClick={(e) => {
                  e.stopPropagation();
                  prevSlide();
                }}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 text-white border-0 transition-transform hover:scale-110"
                onClick={(e) => {
                  e.stopPropagation();
                  nextSlide();
                }}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </motion.div>
          </>
        )}

        {/* Dots indicator */}
        {activePromotions.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {activePromotions.map((_, index) => (
              <motion.button
                key={index}
                className={cn(
                  "h-2 rounded-full transition-colors",
                  index === currentIndex 
                    ? "bg-white" 
                    : "bg-white/40 hover:bg-white/60"
                )}
                animate={{ 
                  width: index === currentIndex ? 24 : 8,
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setDirection(index > currentIndex ? 1 : -1);
                  setCurrentIndex(index);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
