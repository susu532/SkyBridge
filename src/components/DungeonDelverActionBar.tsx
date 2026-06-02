import React, { useEffect, useState } from 'react';
import { skyBridgeManager } from '../game/SkyBridgeManager';
import { useGameStore } from '../store/gameStore';
import { networkManager } from '../game/NetworkManager';
import { getMilestoneColor } from '../game/MilestoneColor';

export const DungeonDelverActionBar: React.FC<{ isMobile?: boolean }> = ({ isMobile }) => {
  const [health, setHealth] = useState(100);
  const leaderboard = useGameStore(state => state.leaderboard);
  const myKills = leaderboard[networkManager.id]?.kills || 0;

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

  const milestoneGoal = 13;
  const currentMilestoneKills = myKills % milestoneGoal;
  const milestoneLevel = Math.floor(myKills / milestoneGoal);
  
  let milestoneColorStr = '#555555';
  if (milestoneLevel >= 5) milestoneColorStr = '#ffff00';
  else if (milestoneLevel === 4) milestoneColorStr = '#8a2be2';
  else if (milestoneLevel === 3) milestoneColorStr = '#0000ff';
  else if (milestoneLevel === 2) milestoneColorStr = '#00ff00';
  else if (milestoneLevel === 1) milestoneColorStr = '#ff0000';
  else milestoneColorStr = '#ffffff';

  return (
    <div className={`absolute bottom-[44px] sm:bottom-16 md:bottom-20 lg:bottom-24 left-1/2 -translate-x-1/2 flex items-center justify-center gap-2 sm:gap-4 md:gap-12 pointer-events-none select-none mc-font w-full px-1 transform origin-bottom z-50 scale-[0.45] sm:scale-85 md:scale-100 ${isMobile ? 'landscape:scale-[0.55] sm:landscape:scale-[0.55] md:landscape:scale-[0.60] lg:landscape:scale-[0.65]' : 'landscape:scale-[0.65] sm:landscape:scale-85 md:landscape:scale-100'}`}>
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
      
      {/* Milestone */}
      <div className="flex flex-col items-center">
        <div 
          className="font-bold text-xs sm:text-base md:text-2xl mc-text-shadow mb-0.5 md:mb-1 whitespace-nowrap"
          style={{ color: milestoneColorStr }}
        >
          {milestoneLevel >= 5 ? 'MAX' : `${currentMilestoneKills}/${milestoneGoal}`} Kills
        </div>
        <div className="w-16 sm:w-32 md:w-48 h-1 md:h-3 bg-black/60 border border-black/80 md:border-2 rounded-sm overflow-hidden">
          <div 
            className="h-full transition-all duration-300"
            style={{ 
               width: `${milestoneLevel >= 5 ? 100 : (currentMilestoneKills / milestoneGoal) * 100}%`,
               backgroundColor: milestoneColorStr 
            }}
          />
        </div>
      </div>
    </div>
  );
};
