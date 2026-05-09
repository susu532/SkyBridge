
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { skyBridgeManager } from '../game/SkyBridgeManager';
import { Game } from '../game/Game';

export const DamageOverlay: React.FC<{game?: Game}> = ({game}) => {
  const [showDamageFlash, setShowDamageFlash] = useState(false);
  const [inEnemyBase, setInEnemyBase] = useState(false);

  useEffect(() => {
    let lastHealth = skyBridgeManager.stats.health;
    let frameId: number;

    const check = () => {
      const currentHealth = skyBridgeManager.stats.health;
      if (currentHealth < lastHealth) {
        setShowDamageFlash(true);
        setTimeout(() => setShowDamageFlash(false), 200);
      }
      lastHealth = currentHealth;
      
      // Check enemy base
      if (game) {
        const p = game.player;
        let enemyBase = false;
        if (p.team === 'red' && p.position.z > 70) enemyBase = true;
        if (p.team === 'blue' && p.position.z < -70) enemyBase = true;
        setInEnemyBase(enemyBase);
      }

      frameId = requestAnimationFrame(check);
    };
    
    frameId = requestAnimationFrame(check);
    return () => cancelAnimationFrame(frameId);
  }, [game]);

  return (
    <>
      <AnimatePresence>
        {showDamageFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-red-600 pointer-events-none z-[999]"
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {inEnemyBase && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.2 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-red-700 pointer-events-none z-[998]"
            style={{ mixBlendMode: 'multiply' }}
          />
        )}
      </AnimatePresence>
    </>
  );
};
