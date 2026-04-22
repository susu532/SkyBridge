
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { skyBridgeManager } from '../game/SkyBridgeManager';

export const DamageOverlay: React.FC = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let lastHealth = skyBridgeManager.stats.health;
    let frameId: number;

    const checkHealth = () => {
      const currentHealth = skyBridgeManager.stats.health;
      if (currentHealth < lastHealth) {
        setShow(true);
        setTimeout(() => setShow(false), 200);
      }
      lastHealth = currentHealth;
      frameId = requestAnimationFrame(checkHealth);
    };
    
    frameId = requestAnimationFrame(checkHealth);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-red-600 pointer-events-none z-[999]"
        />
      )}
    </AnimatePresence>
  );
};
