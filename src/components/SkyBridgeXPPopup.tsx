
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SkillType } from '../game/SkyBridgeManager';

interface XPPopup {
  id: string;
  skill: SkillType;
  amount: number;
}

export const SkyBridgeXPPopup: React.FC = () => {
  const [popups, setPopups] = useState<XPPopup[]>([]);

  useEffect(() => {
    const handleXP = (e: any) => {
      const { skill, amount } = e.detail;
      const id = Math.random().toString(36).substring(7);
      setPopups(prev => [...prev, { id, skill, amount }]);
      
      setTimeout(() => {
        setPopups(prev => prev.filter(p => p.id !== id));
      }, 2000);
    };

    window.addEventListener('skyBridgeXP', handleXP as EventListener);
    return () => window.removeEventListener('skyBridgeXP', handleXP as EventListener);
  }, []);

  return (
    <div className="absolute bottom-40 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none select-none">
      <AnimatePresence>
        {popups.map((popup) => (
          <motion.div
            key={popup.id}
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 1.1 }}
            className="bg-black/60 backdrop-blur-sm px-4 py-1 rounded-full border border-white/10 flex items-center gap-2"
          >
            <span className="text-[#55FF55] font-bold">+{popup.amount}</span>
            <span className="text-white font-mono text-sm uppercase tracking-widest">{popup.skill} XP</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
