
import React, { useEffect, useState } from 'react';
import { skyBridgeManager, PlayerStats } from '../game/SkyBridgeManager';

export const SkyBridgeActionBar: React.FC = () => {
  const [stats, setStats] = useState<PlayerStats>(skyBridgeManager.effectiveStats);

  useEffect(() => {
    let frameId: number;
    let lastHealth = skyBridgeManager.effectiveStats.health;
    let lastMaxHealth = skyBridgeManager.effectiveStats.maxHealth;
    let lastDefense = skyBridgeManager.effectiveStats.defense;
    let lastIntelligence = skyBridgeManager.effectiveStats.intelligence;
    let lastMaxIntelligence = skyBridgeManager.effectiveStats.maxIntelligence;

    const update = () => {
      const stats = skyBridgeManager.effectiveStats;
      
      if (
        stats.health !== lastHealth ||
        stats.maxHealth !== lastMaxHealth ||
        stats.defense !== lastDefense ||
        stats.intelligence !== lastIntelligence ||
        stats.maxIntelligence !== lastMaxIntelligence
      ) {
        setStats({ ...stats });
        lastHealth = stats.health;
        lastMaxHealth = stats.maxHealth;
        lastDefense = stats.defense;
        lastIntelligence = stats.intelligence;
        lastMaxIntelligence = stats.maxIntelligence;
      }

      frameId = requestAnimationFrame(update);
    };

    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <div className="absolute bottom-[55px] md:bottom-24 landscape:bottom-[45px] xl:landscape:bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-4 md:gap-12 pointer-events-none select-none mc-font w-full max-w-[100vw] justify-center px-1 transform scale-[0.75] sm:scale-100 origin-bottom landscape:scale-[0.6] md:landscape:scale-[0.75] xl:landscape:scale-100">
      {/* Health */}
      <div className="flex flex-col items-center">
        <div className="text-[#FF5555] font-bold text-xs sm:text-base md:text-2xl mc-text-shadow mb-0.5 md:mb-1 whitespace-nowrap">
          {Math.floor(stats.health)}/{stats.maxHealth}❤
        </div>
        <div className="w-20 sm:w-24 md:w-40 h-2 md:h-3 bg-black/60 border border-black/80 md:border-2 rounded-sm overflow-hidden">
          <div 
            className="h-full bg-[#FF5555] transition-all duration-300"
            style={{ width: `${(stats.health / stats.maxHealth) * 100}%` }}
          />
        </div>
      </div>

      {/* Defense */}
      <div className="flex flex-col items-center">
        <div className="text-[#55FF55] font-bold text-xs sm:text-base md:text-2xl mc-text-shadow whitespace-nowrap pt-3 md:pt-0">
          {stats.defense}❈ <span className="hidden md:inline">Defense</span>
        </div>
      </div>

      {/* Intelligence/Mana */}
      <div className="flex flex-col items-center">
        <div className="text-[#55FFFF] font-bold text-xs sm:text-base md:text-2xl mc-text-shadow mb-0.5 md:mb-1 whitespace-nowrap">
          {Math.floor(stats.intelligence)}/{stats.maxIntelligence}✎
        </div>
        <div className="w-20 sm:w-24 md:w-40 h-2 md:h-3 bg-black/60 border border-black/80 md:border-2 rounded-sm overflow-hidden">
          <div 
            className="h-full bg-[#55FFFF] transition-all duration-300"
            style={{ width: `${(stats.intelligence / stats.maxIntelligence) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};
