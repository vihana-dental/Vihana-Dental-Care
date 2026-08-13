import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface InitialLoaderProps {
  onComplete?: () => void;
}

export const InitialLoader: React.FC<InitialLoaderProps> = ({ onComplete }) => {
  const [stage, setStage] = useState<'drawing' | 'pulsing' | 'exiting' | 'done'>('drawing');

  useEffect(() => {
    // Stage 1: Line draw (1.5s)
    const timer1 = setTimeout(() => {
      setStage('pulsing');
    }, 1500);

    // Stage 2: Soft glowing pulse (0.8s)
    const timer2 = setTimeout(() => {
      setStage('exiting');
    }, 2300);

    // Stage 3: Exit animation completion (0.9s)
    const timer3 = setTimeout(() => {
      setStage('done');
      if (onComplete) onComplete();
    }, 3200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onComplete]);

  if (stage === 'done') return null;

  return (
    <AnimatePresence>
      {stage !== 'done' && (
        <motion.div
          key="initial-loader"
          initial={{ y: 0 }}
          animate={stage === 'exiting' ? { y: '-100vh' } : { y: 0 }}
          transition={{
            duration: 0.85,
            ease: [0.76, 0, 0.24, 1] // Heavy eased cubic-bezier curve
          }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0d1117] text-white select-none overflow-hidden"
        >
          {/* Subtle background gradient glow */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(44,76,156,0.14)_0%,transparent_70%)] pointer-events-none" />

          {/* Central Tooth SVG & Brand Tagline */}
          <div className="relative flex flex-col items-center gap-6 z-10">
            <motion.div
              animate={
                stage === 'pulsing'
                  ? {
                      opacity: [1, 0.4, 1],
                      scale: [1, 1.03, 1],
                    }
                  : stage === 'exiting'
                  ? {
                      scale: 1.15,
                      opacity: 0,
                    }
                  : { opacity: 1, scale: 1 }
              }
              transition={
                stage === 'pulsing'
                  ? { duration: 0.8, repeat: Infinity, ease: 'easeInOut' }
                  : { duration: 0.4 }
              }
              className="relative flex items-center justify-center w-28 h-28 sm:w-36 sm:h-36"
            >
              <svg
                viewBox="0 0 100 100"
                className="w-full h-full text-brand-600 drop-shadow-[0_0_20px_rgba(44,76,156,0.55)]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {/* Minimalist Geometric Tooth Outline */}
                <motion.path
                  d="M 50 15 C 65 15, 82 22, 80 40 C 78 55, 72 68, 68 85 C 65 92, 57 92, 54 85 C 52 80, 51 72, 50 72 C 49 72, 48 80, 46 85 C 43 92, 35 92, 32 85 C 28 68, 22 55, 20 40 C 18 22, 35 15, 50 15 Z"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{
                    duration: 1.5,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                />

                {/* Inner Arch / Smile Line in Tooth */}
                <motion.path
                  d="M 35 38 Q 50 48 65 38"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.8 }}
                  transition={{
                    duration: 1.2,
                    delay: 0.3,
                    ease: 'easeInOut',
                  }}
                />

                {/* Sparkling Accent Star */}
                <motion.path
                  d="M 68 25 L 70 28 L 73 30 L 70 32 L 68 35 L 66 32 L 63 30 L 66 28 Z"
                  fill="currentColor"
                  stroke="none"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    duration: 0.5,
                    delay: 1.1,
                    type: 'spring',
                    stiffness: 200,
                  }}
                />
              </svg>
            </motion.div>

            {/* Minimalist Clinic Name & Progress */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="text-center space-y-1.5"
            >
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans">
                VIHANA <span className="text-brand-600 font-extrabold">DENTAL CARE</span>
              </h1>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400 font-medium">
                Kalapatti • Coimbatore
              </p>
            </motion.div>
          </div>

          {/* Bottom Progress Line */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-48 h-[2px] bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-brand-800 via-brand-600 to-brand-accent"
              initial={{ width: '0%' }}
              animate={{ width: stage === 'exiting' ? '100%' : '80%' }}
              transition={{ duration: 2.2, ease: 'easeInOut' }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
