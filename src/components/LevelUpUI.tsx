
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGameStore } from '../store/gameStore';

export const LevelUpUI: React.FC = () => {
  const popups = useGameStore(state => state.levelUpPopups);
  const data = popups.length > 0 ? popups[popups.length - 1] : null;

  return (
    <AnimatePresence>
      {data && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-[2000]">
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.2, y: -100 }}
            className="flex flex-col items-center"
          >
            <motion.div 
              animate={{ 
                color: ['#FFFF55', '#FFAA00', '#FF5555', '#FFFF55'],
                textShadow: [
                  '0 0 20px rgba(255,255,85,0.8)',
                  '0 0 40px rgba(255,170,0,0.8)',
                  '0 0 20px rgba(255,255,85,0.8)'
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-6xl font-black uppercase tracking-[0.3em] italic drop-shadow-[4px_4px_0_rgba(0,0,0,1)]"
            >
              Level Up!
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-4 bg-black/80 backdrop-blur-md px-8 py-3 border-y-2 border-[#55FF55] flex items-center gap-4 shadow-2xl"
            >
              <span className="text-white text-2xl font-mono uppercase tracking-widest">{data.skill}</span>
              <span className="text-[#55FF55] text-4xl font-black">{data.level}</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-4 text-[#AAAAAA] font-mono text-sm uppercase tracking-tighter"
            >
              New rewards unlocked in your stats!
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
