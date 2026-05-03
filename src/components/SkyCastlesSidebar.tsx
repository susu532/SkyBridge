import React, { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

export const SkyCastlesSidebar: React.FC = () => {
  const currentMode = useGameStore(state => state.currentMode);
  const skycoins = useGameStore(state => state.skycoins[currentMode] ?? 500);
  const addSkycoins = useGameStore(state => state.addSkycoins);
  const [recentRewards, setRecentRewards] = React.useState<{id: number, amount: number}[]>([]);

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
    
    window.addEventListener('skycoinsRewarded', handleSkycoinsReward);
    return () => window.removeEventListener('skycoinsRewarded', handleSkycoinsReward);
  }, [addSkycoins]);

  return (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 pointer-events-none mc-font z-10">
      {recentRewards.map(reward => (
        <div key={reward.id} className="absolute -left-32 top-11 text-[#FFFF55] font-bold text-lg mc-text-shadow animate-[slideUpFade_2s_ease-out_forwards]">
          +{reward.amount} Skycoins!
        </div>
      ))}
      <div className="bg-black/60 backdrop-blur-md p-4 border-l-4 border-[#FFAA00] text-white text-base shadow-2xl min-w-[200px]">
        <div className="text-[#FFAA00] font-bold mb-1 text-center uppercase tracking-[0.1em] text-lg mc-text-shadow">SkyCastles</div>
        <div className="text-white/60 text-xs text-center mb-3 border-b border-white/10 pb-2 mc-text-shadow">
          04/11/26 <span className="text-[#55FF55]">m123</span>
        </div>
        
        <div className="space-y-2">
          <div className="flex flex-col border-t border-white/10 pt-2 mt-2">
            <span className="text-[#FFFF55] text-sm mc-text-shadow font-bold">● Skycoins: {skycoins}</span>
          </div>

          <div className="pt-2 text-xs text-white/80 mc-text-shadow italic border-t border-white/10 mt-2">
            Kill enemies to earn Skycoins!
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-[#FFAA00] font-bold tracking-tighter opacity-50 mc-text-shadow">
          WWW.SKYCASTLES.NET
        </div>
      </div>
    </div>
  );
};
