import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Sparkles, PartyPopper, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TicketHolder {
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  total_tickets: number;
}

interface LotteryDrawAnimationProps {
  isOpen: boolean;
  onClose: () => void;
  participants: TicketHolder[];
  winner: TicketHolder | null;
  prizeName: string;
}

// Confetti particle component
const Confetti = ({ delay, color }: { delay: number; color: string }) => {
  const randomX = Math.random() * 100;
  const randomRotation = Math.random() * 360;
  const randomDuration = 2 + Math.random() * 2;

  return (
    <motion.div
      className="absolute w-3 h-3 rounded-sm"
      style={{ 
        backgroundColor: color,
        left: `${randomX}%`,
        top: -20
      }}
      initial={{ y: -20, rotate: 0, opacity: 1 }}
      animate={{ 
        y: '100vh', 
        rotate: randomRotation + 720,
        opacity: [1, 1, 0]
      }}
      transition={{ 
        duration: randomDuration, 
        delay,
        ease: 'easeIn'
      }}
    />
  );
};

// Floating star component
const FloatingStar = ({ delay, size, x, y }: { delay: number; size: number; x: number; y: number }) => {
  return (
    <motion.div
      className="absolute text-yellow-400/30"
      style={{ left: `${x}%`, top: `${y}%` }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ 
        opacity: [0, 1, 0],
        scale: [0.5, 1.2, 0.5],
        rotate: [0, 180, 360]
      }}
      transition={{ 
        duration: 3,
        delay,
        repeat: Infinity,
        ease: 'easeInOut'
      }}
    >
      <Star className="fill-current" style={{ width: size, height: size }} />
    </motion.div>
  );
};

// Ticket floating animation
const FloatingTicket = ({ delay, x }: { delay: number; x: number }) => {
  return (
    <motion.div
      className="absolute text-2xl"
      style={{ left: `${x}%`, bottom: -50 }}
      initial={{ y: 0, opacity: 0 }}
      animate={{ 
        y: '-120vh',
        opacity: [0, 1, 1, 0],
        rotate: [0, -10, 10, -10, 0]
      }}
      transition={{ 
        duration: 8,
        delay,
        repeat: Infinity,
        ease: 'linear'
      }}
    >
      🎟️
    </motion.div>
  );
};

export function LotteryDrawAnimation({
  isOpen,
  onClose,
  participants,
  winner,
  prizeName,
}: LotteryDrawAnimationProps) {
  const [phase, setPhase] = useState<'spinning' | 'revealing' | 'winner'>('spinning');
  const [currentName, setCurrentName] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);

  const confettiColors = [
    '#FFD700',
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#96E6A1',
    '#DDA0DD',
    '#F7DC6F',
    '#FF9F43',
    '#EE5A24',
    '#00D2D3',
  ];

  // Generate random positions for stars
  const stars = Array.from({ length: 20 }).map((_, i) => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 12 + Math.random() * 24,
    delay: Math.random() * 2,
  }));

  // Generate ticket positions
  const tickets = Array.from({ length: 8 }).map((_, i) => ({
    x: 5 + (i * 12),
    delay: i * 0.8,
  }));

  useEffect(() => {
    if (!isOpen || !winner) return;

    setPhase('spinning');
    setShowConfetti(false);

    // Spinning phase - rapidly cycle through names
    let spinInterval: NodeJS.Timeout;
    let spinCount = 0;
    const maxSpins = 30;
    
    const names = participants.map(p => p.customer_name);
    
    spinInterval = setInterval(() => {
      spinCount++;
      const randomIndex = Math.floor(Math.random() * names.length);
      setCurrentName(names[randomIndex]);

      // Slow down near the end
      if (spinCount >= maxSpins - 5) {
        clearInterval(spinInterval);
        
        // Slower reveal phase
        let slowCount = 0;
        const slowInterval = setInterval(() => {
          slowCount++;
          const randomIndex = Math.floor(Math.random() * names.length);
          setCurrentName(names[randomIndex]);
          
          if (slowCount >= 5) {
            clearInterval(slowInterval);
            setPhase('revealing');
            
            // Final reveal
            setTimeout(() => {
              setCurrentName(winner.customer_name);
              setPhase('winner');
              setShowConfetti(true);
            }, 800);
          }
        }, 300);
      }
    }, 80);

    return () => {
      clearInterval(spinInterval);
    };
  }, [isOpen, winner, participants]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
        style={{ 
          position: 'fixed',
          top: 0, 
          left: 0, 
          width: '100vw',
          height: '100vh',
          margin: 0,
          padding: 0,
        }}
      >
        {/* Gradient background */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, #1a1a2e 0%, #16213e 40%, #0f0f23 100%)',
          }}
        />

        {/* Animated gradient overlay */}
        <motion.div
          className="absolute inset-0 opacity-40"
          animate={{
            background: [
              'radial-gradient(circle at 20% 80%, #f59e0b33 0%, transparent 50%)',
              'radial-gradient(circle at 80% 20%, #f59e0b33 0%, transparent 50%)',
              'radial-gradient(circle at 50% 50%, #f59e0b33 0%, transparent 50%)',
              'radial-gradient(circle at 20% 80%, #f59e0b33 0%, transparent 50%)',
            ]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Floating stars background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {stars.map((star, i) => (
            <FloatingStar 
              key={i}
              x={star.x}
              y={star.y}
              size={star.size}
              delay={star.delay}
            />
          ))}
        </div>

        {/* Floating tickets */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {tickets.map((ticket, i) => (
            <FloatingTicket 
              key={i}
              x={ticket.x}
              delay={ticket.delay}
            />
          ))}
        </div>

        {/* Decorative circles */}
        <motion.div
          className="absolute w-96 h-96 rounded-full border border-yellow-500/10"
          style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full border border-orange-500/10"
          style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
          animate={{ scale: [1.1, 1, 1.1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 4, repeat: Infinity }}
        />

        {/* Confetti */}
        {showConfetti && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 150 }).map((_, i) => (
              <Confetti 
                key={i} 
                delay={i * 0.015} 
                color={confettiColors[i % confettiColors.length]} 
              />
            ))}
          </div>
        )}

        {/* Main content */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="relative z-10 text-center px-8 py-12 max-w-lg mx-4"
        >
          {/* Spinning/Revealing phase */}
          {(phase === 'spinning' || phase === 'revealing') && (
            <div className="space-y-8">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="inline-flex items-center justify-center w-28 h-28 rounded-full bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 shadow-2xl shadow-orange-500/50"
              >
                <Sparkles className="h-14 w-14 text-white" />
              </motion.div>

              <div>
                <motion.p 
                  className="text-yellow-400/80 text-xl mb-4 font-medium"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  ✨ Sorteando... ✨
                </motion.p>
                <motion.div
                  key={currentName}
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="text-white text-4xl md:text-5xl font-bold drop-shadow-lg"
                >
                  {currentName}
                </motion.div>
              </div>
            </div>
          )}

          {/* Winner phase */}
          {phase === 'winner' && winner && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', duration: 0.6, bounce: 0.4 }}
              className="space-y-6"
            >
              {/* Trophy with glow effect */}
              <div className="relative inline-block">
                <motion.div
                  className="absolute inset-0 rounded-full bg-yellow-400/30 blur-2xl"
                  animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <motion.div
                  animate={{ 
                    scale: [1, 1.1, 1],
                    rotate: [0, -5, 5, 0]
                  }}
                  transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
                  className="relative inline-flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br from-yellow-300 via-yellow-400 to-orange-500 shadow-2xl shadow-yellow-500/50"
                >
                  <Trophy className="h-16 w-16 text-white drop-shadow-lg" />
                </motion.div>
              </div>

              <div className="space-y-3">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="flex items-center justify-center gap-3 text-yellow-400"
                >
                  <PartyPopper className="h-8 w-8" />
                  <span className="text-2xl font-bold tracking-wide">PARABÉNS!</span>
                  <PartyPopper className="h-8 w-8 scale-x-[-1]" />
                </motion.div>

                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-white text-5xl md:text-6xl font-bold drop-shadow-lg"
                >
                  {winner.customer_name}
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="text-white/60 text-lg"
                >
                  {winner.customer_phone}
                </motion.p>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="mt-8 p-5 rounded-2xl bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-sm border border-white/20 shadow-xl"
              >
                <p className="text-yellow-400/80 text-sm mb-2 font-medium">🎁 Prêmio</p>
                <p className="text-white text-2xl font-bold">{prizeName}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
              >
                <Button
                  onClick={onClose}
                  size="lg"
                  className="mt-8 bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold hover:from-yellow-300 hover:to-orange-400 shadow-lg shadow-orange-500/30 px-8 py-6 text-lg"
                >
                  Fechar
                </Button>
              </motion.div>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}