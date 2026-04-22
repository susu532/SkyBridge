
import React, { useEffect, useState } from 'react';
import { skyBridgeManager, PlayerStats, RARITY_COLORS, Rarity } from '../game/SkyBridgeManager';

export const SkyBridgeSidebar: React.FC<{ skycoins?: number }> = ({ skycoins = 0 }) => {
  const [stats, setStats] = useState<PlayerStats>(skyBridgeManager.effectiveStats);
  const [skills, setSkills] = useState(skyBridgeManager.skills);

  useEffect(() => {
    let frameId: number;
    let lastStatsStr = JSON.stringify(skyBridgeManager.effectiveStats);
    let lastSkillsStr = JSON.stringify(skyBridgeManager.skills);

    const update = () => {
      const currentStatsStr = JSON.stringify(skyBridgeManager.effectiveStats);
      const currentSkillsStr = JSON.stringify(skyBridgeManager.skills);

      if (currentStatsStr !== lastStatsStr) {
        setStats({ ...skyBridgeManager.effectiveStats });
        lastStatsStr = currentStatsStr;
      }
      if (currentSkillsStr !== lastSkillsStr) {
        setSkills({ ...skyBridgeManager.skills });
        lastSkillsStr = currentSkillsStr;
      }

      frameId = requestAnimationFrame(update);
    };

    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 pointer-events-none mc-font">
      {/* Sidebar Container */}
      <div className="bg-black/60 backdrop-blur-md p-4 border-l-4 border-[#FFFF55] text-white text-base shadow-2xl min-w-[200px]">
        <div className="text-[#FFFF55] font-bold mb-1 text-center uppercase tracking-[0.1em] text-lg mc-text-shadow">SkyBridge</div>
        <div className="text-white/60 text-xs text-center mb-3 border-b border-white/10 pb-2 mc-text-shadow">04/11/26 <span className="text-[#55FF55]">m123</span></div>
        
        <div className="space-y-2">
          <div className="flex flex-col">
            <span className="text-white text-sm mc-text-shadow">SkyBridge Level: <span className="text-[#55FFFF] font-bold">1</span></span>
            <div className="w-full h-1.5 bg-black/40 mt-1 rounded-full overflow-hidden">
              <div className="h-full bg-[#55FFFF] w-[15%]" />
            </div>
          </div>

          <div className="flex flex-col border-t border-white/10 pt-2 mt-2">
            <span className="text-[#FFFF55] text-sm mc-text-shadow font-bold">● Skycoins: {skycoins}</span>
          </div>

          <div className="pt-2 space-y-1 border-t border-white/10 text-sm mc-text-shadow">
            <div className="flex justify-between gap-4">
              <span className="text-[#FF5555]">❤ Health</span>
              <span className="text-[#FF5555] font-bold">{Math.floor(stats.health)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[#55FFFF]">✎ Intelligence</span>
              <span className="text-[#55FFFF] font-bold">{Math.floor(stats.intelligence)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[#55FF55]">❈ Defense</span>
              <span className="text-[#55FF55] font-bold">{stats.defense}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[#FF5555]">❁ Strength</span>
              <span className="text-[#FF5555] font-bold">{stats.strength}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[#5555FF]">☣ Crit Chance</span>
              <span className="text-[#5555FF] font-bold">{stats.critChance}%</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[#5555FF]">☠ Crit Damage</span>
              <span className="text-[#5555FF] font-bold">{stats.critDamage}%</span>
            </div>
            {stats.miningSpeed > 0 && (
              <div className="flex justify-between gap-4">
                <span className="text-[#FFAA00]">⸕ Mining Speed</span>
                <span className="text-[#FFAA00] font-bold">{stats.miningSpeed}</span>
              </div>
            )}
            {stats.miningFortune > 0 && (
              <div className="flex justify-between gap-4">
                <span className="text-[#FFAA00]">☘ Mining Fortune</span>
                <span className="text-[#FFAA00] font-bold">{stats.miningFortune}</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 text-[#55FF55] font-bold mb-2 border-t border-white/10 pt-3 uppercase tracking-widest text-sm mc-text-shadow">Skills</div>
        <div className="space-y-2 text-sm mc-text-shadow">
          {(Object.entries(skills) as [string, any][]).map(([name, progress]) => (
            <div key={name} className="flex flex-col">
              <div className="flex justify-between items-baseline">
                <span className="text-white/80">{name}</span>
                <span className="text-[#FFFF55] text-xs">Lvl {progress.level}</span>
              </div>
              <div className="w-full h-1 bg-black/40 mt-1 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#55FF55] transition-all duration-500" 
                  style={{ width: `${(progress.xp / progress.nextLevelXp) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 text-center text-xs text-[#FFFF55] font-bold tracking-tighter opacity-50 mc-text-shadow">
          WWW.SKYBRIDGE.NET
        </div>
      </div>
    </div>
  );
};
