
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { skyBridgeManager } from '../game/SkyBridgeManager';
import { Game } from '../game/Game';
import { useGameStore } from '../store/gameStore';

export const DamageOverlay: React.FC<{game?: Game}> = ({game}) => {
  const [showDamageFlash, setShowDamageFlash] = useState(false);
  const [inEnemyBase, setInEnemyBase] = useState(false);

  useEffect(() => {
    let lastHealth = skyBridgeManager.stats.health;
    let frameId: number;
    let lastDamageTime = 0;

    const check = () => {
      const currentHealth = skyBridgeManager.stats.health;
      if (currentHealth < lastHealth) {
        setShowDamageFlash(true);
        setTimeout(() => setShowDamageFlash(false), 200);
      }
      lastHealth = currentHealth;
      
      // Check enemy base
      if (game) {
        const currentMode = useGameStore.getState().currentMode;
        const p = game.player;
        let enemyBase = false;
        
        if (currentMode === 'skycastles') {
           if (p.team === 'red' && p.position.z > 175) enemyBase = true;
           if (p.team === 'blue' && p.position.z < -175) enemyBase = true;
        } else if (currentMode === 'skybridge') {
           if (p.team === 'red' && p.position.z > 70) enemyBase = true;
           if (p.team === 'blue' && p.position.z < -70) enemyBase = true;
        }
        
        setInEnemyBase(enemyBase);

        if (enemyBase && Date.now() - lastDamageTime > 1000 && !p.isDead && !p.isSpectator) {
          lastDamageTime = Date.now();
          p.takeDamage(1, undefined, false, "in enemy castle boundaries");
        }
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
