import React, { useEffect, useState } from 'react';
import { skyBridgeManager } from '../game/SkyBridgeManager';

export const DungeonDelverActionBar: React.FC = () => {
  const [health, setHealth] = useState(100);

  useEffect(() => {
    let frameId: number;
    let lastHealth = -1;

    const update = () => {
      const currentHealth = skyBridgeManager.stats.health;
      if (currentHealth !== lastHealth) {
        setHealth(currentHealth);
        lastHealth = currentHealth;
      }
      frameId = requestAnimationFrame(update);
    };
    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <div className="absolute bottom-[55px] md:bottom-24 landscape:bottom-[45px] xl:landscape:bottom-24 left-1/2 -translate-x-1/2 flex items-center justify-center gap-2 sm:gap-4 md:gap-12 pointer-events-none select-none mc-font w-full max-w-[100vw] px-1 transform scale-[0.45] sm:scale-100 origin-bottom landscape:scale-[0.15] sm:landscape:scale-[0.15] md:landscape:scale-[0.5] xl:landscape:scale-100">
      {/* Health */}
      <div className="flex flex-col items-center">
        <div className="text-[#FF5555] font-bold text-xs sm:text-base md:text-2xl mc-text-shadow mb-0.5 md:mb-1 whitespace-nowrap">
          {Math.max(0, Math.floor(health))}/100❤
        </div>
        <div className="w-16 sm:w-32 md:w-48 h-1 md:h-3 bg-black/60 border border-black/80 md:border-2 rounded-sm overflow-hidden">
          <div 
            className="h-full bg-[#FF5555] transition-all duration-300"
            style={{ width: `${Math.max(0, Math.min(100, health))}%` }}
          />
        </div>
      </div>
    </div>
  );
};
