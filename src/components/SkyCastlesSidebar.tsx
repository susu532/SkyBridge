import React, { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';

export const SkyCastlesSidebar: React.FC = () => {
  const currentMode = useGameStore(state => state.currentMode);
  const skycoins = useGameStore(state => state.skycoins[currentMode] ?? 500);
  const addSkycoins = useGameStore(state => state.addSkycoins);
  const serverId = useGameStore(state => state.serverId);
  const [recentRewards, setRecentRewards] = useState<{id: number, amount: number}[]>([]);
  const [syncState, setSyncState] = useState<any>((window as any).latestSkyCastlesSync || null);
  const dateStr = new Date().toLocaleDateString('en-GB', { year: '2-digit', month: '2-digit', day: '2-digit' });

  useEffect(() => {
    const handleSkycoinsReward = (e: any) => {
      const { amount, reason } = e.detail;
      addSkycoins(amount);
      
      const id = Date.now();
      setRecentRewards(prev => [...prev, { id, amount }]);
      setTimeout(() => {
        setRecentRewards(prev => prev.filter(r => r.id !== id));
      }, 2000);
    };

    const handleSync = (e: any) => {
      setSyncState((prev: any) => {
        const next = e.detail;
        if (!prev) return next;
        if (
          prev.redHp === next.redHp &&
          prev.blueHp === next.blueHp &&
          prev.gameState === next.gameState &&
          prev.timeToRestart === next.timeToRestart &&
          prev.redPlayers === next.redPlayers &&
          prev.bluePlayers === next.bluePlayers
        ) {
          return prev;
        }
        return next;
      });
    };
    
    window.addEventListener('skycoinsRewarded', handleSkycoinsReward);
    window.addEventListener('skyCastlesSync', handleSync);
    return () => {
      window.removeEventListener('skycoinsRewarded', handleSkycoinsReward);
      window.removeEventListener('skyCastlesSync', handleSync);
    };
  }, [addSkycoins]);

  return (
    <div className="absolute right-0 md:right-4 landscape:right-0 xl:landscape:right-4 top-0 md:top-32 landscape:top-0 xl:landscape:top-24 flex flex-col gap-2 pointer-events-none mc-font z-10 transform scale-[0.15] sm:scale-75 xl:scale-100 origin-top-right safe-pr safe-pt landscape:scale-[0.15] md:landscape:scale-[0.65] xl:landscape:scale-100">
      {recentRewards.map(reward => (
        <div key={reward.id} className="absolute -left-32 top-11 text-[#FFFF55] font-bold text-lg mc-text-shadow animate-[slideUpFade_2s_ease-out_forwards]">
          +{reward.amount} Skycoins!
        </div>
      ))}
      <div className="bg-black/60  p-3 md:p-4 border-l-4 border-[#FFAA00] text-white text-sm md:text-base shadow-2xl min-w-[160px] md:min-w-[200px]">
        <div className="text-[#FFAA00] font-bold mb-1 text-center uppercase tracking-[0.1em] text-lg mc-text-shadow">SkyCastles</div>
        <div className="text-white/60 text-xs text-center mb-3 border-b border-white/10 pb-2 mc-text-shadow">
          {dateStr} <span className="text-[#55FF55]">{serverId || 'm123'}</span>
        </div>
        
        <div className="space-y-2">
          {syncState && (
            <div className="flex flex-col pt-1 pb-2 gap-1.5">
              <div className="text-white text-xs font-bold mc-text-shadow flex justify-between items-center">
                <span>Red Morvane:</span>
                <span className={syncState.redHp > 0 ? "text-[#FF5555]" : "text-gray-500"}>
                  {syncState.redHp > 0 ? `${Math.ceil(syncState.redHp)}/${syncState.redMax}` : 'DEAD'}
                </span>
              </div>
              <div className="text-white/60 text-[10px] mc-text-shadow text-left -mt-1">
                Players: {syncState.redPlayers ?? 0}/25
              </div>
              <div className="text-white text-xs font-bold mc-text-shadow flex justify-between items-center mt-1">
                <span>Blue Morvane:</span>
                <span className={syncState.blueHp > 0 ? "text-[#5555FF]" : "text-gray-500"}>
                  {syncState.blueHp > 0 ? `${Math.ceil(syncState.blueHp)}/${syncState.blueMax}` : 'DEAD'}
                </span>
              </div>
              <div className="text-white/60 text-[10px] mc-text-shadow text-left -mt-1">
                Players: {syncState.bluePlayers ?? 0}/25
              </div>
              {syncState.gameState === 'endgame' && (
                <div className="text-[#FFAA00] text-xs font-bold text-center mt-2 animate-pulse">
                  Restart in {syncState.timeToRestart}s
                </div>
              )}
            </div>
          )}
          <div className="flex flex-col border-t border-white/10 pt-2 mt-2">
            <span className="text-[#FFFF55] text-sm mc-text-shadow font-bold">● Skycoins: {skycoins}</span>
          </div>

          <div className="pt-2 text-xs text-white/80 mc-text-shadow italic border-t border-white/10 mt-2">
            Defeat enemies to earn Skycoins!
          </div>
        
        </div>

        <div className="mt-6 text-center text-xs text-[#FFAA00] font-bold tracking-tighter opacity-50 mc-text-shadow">
          SKYCASTLES
        </div>
      </div>
    </div>
  );
};
