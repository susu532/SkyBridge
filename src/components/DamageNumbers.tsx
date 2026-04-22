
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { networkManager } from '../game/NetworkManager';

interface DamageText {
  id: string;
  amount: number;
  isCrit: boolean;
  x: number;
  y: number;
}

export const DamageNumbers: React.FC = () => {
  const [numbers, setNumbers] = useState<DamageText[]>([]);

  useEffect(() => {
    const handleDamage = (e: any) => {
      const { amount, isCrit } = e.detail;
      const id = Math.random().toString(36).substring(7);
      
      // Random position near center
      const x = window.innerWidth / 2 + (Math.random() - 0.5) * 100;
      const y = window.innerHeight / 2 + (Math.random() - 0.5) * 100;
      
      setNumbers(prev => [...prev, { id, amount, isCrit, x, y }]);
      
      setTimeout(() => {
        setNumbers(prev => prev.filter(n => n.id !== id));
      }, 1000);
    };

    const handleNetworkPlayerHit = (e: any) => {
      const { attackerId, damage, isCrit } = e.detail;
      if (attackerId === networkManager.socket.id) {
        handleDamage({ detail: { amount: damage, isCrit: isCrit || false } });
      }
    };

    window.addEventListener('mobDamage', handleDamage as EventListener);
    window.addEventListener('networkPlayerHit', handleNetworkPlayerHit as EventListener);
    return () => {
      window.removeEventListener('mobDamage', handleDamage as EventListener);
      window.removeEventListener('networkPlayerHit', handleNetworkPlayerHit as EventListener);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[1000] overflow-hidden">
      <AnimatePresence>
        {numbers.map((n) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, scale: 0.5, x: n.x, y: n.y }}
            animate={{ opacity: 1, scale: n.isCrit ? 1.5 : 1, y: n.y - 100 }}
            exit={{ opacity: 0, y: n.y - 150 }}
            className={`font-bold text-2xl drop-shadow-[2px_2px_0_rgba(0,0,0,1)] ${n.isCrit ? 'text-[#FFFF55]' : 'text-white'}`}
          >
            {n.isCrit && '✧ '}{n.amount}{n.isCrit && ' ✧'}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
