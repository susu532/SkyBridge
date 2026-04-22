
import React, { useEffect, useState } from 'react';
import { skyBridgeManager, PlayerStats } from '../game/SkyBridgeManager';

export const SkyBridgeActionBar: React.FC = () => {
  const [stats, setStats] = useState<PlayerStats>(skyBridgeManager.effectiveStats);

  useEffect(() => {
    let frameId: number;
    let lastStatsStr = JSON.stringify(skyBridgeManager.effectiveStats);

    const update = () => {
      const currentStatsStr = JSON.stringify(skyBridgeManager.effectiveStats);

      if (currentStatsStr !== lastStatsStr) {
        setStats({ ...skyBridgeManager.effectiveStats });
        lastStatsStr = currentStatsStr;
      }

      frameId = requestAnimationFrame(update);
    };

    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-12 pointer-events-none select-none mc-font">
      {/* Health */}
      <div className="flex flex-col items-center">
        <div className="text-[#FF5555] font-bold text-2xl mc-text-shadow mb-1">
          {Math.floor(stats.health)}/{stats.maxHealth}❤
        </div>
        <div className="w-40 h-3 bg-black/60 border-2 border-black/80 rounded-sm overflow-hidden">
          <div 
            className="h-full bg-[#FF5555] transition-all duration-300"
            style={{ width: `${(stats.health / stats.maxHealth) * 100}%` }}
          />
        </div>
      </div>

      {/* Defense */}
      <div className="flex flex-col items-center">
        <div className="text-[#55FF55] font-bold text-2xl mc-text-shadow">
          {stats.defense}❈ Defense
        </div>
      </div>

      {/* Intelligence/Mana */}
      <div className="flex flex-col items-center">
        <div className="text-[#55FFFF] font-bold text-2xl mc-text-shadow mb-1">
          {Math.floor(stats.intelligence)}/{stats.maxIntelligence}✎
        </div>
        <div className="w-40 h-3 bg-black/60 border-2 border-black/80 rounded-sm overflow-hidden">
          <div 
            className="h-full bg-[#55FFFF] transition-all duration-300"
            style={{ width: `${(stats.intelligence / stats.maxIntelligence) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};
