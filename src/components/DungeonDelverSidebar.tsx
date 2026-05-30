import React, { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { networkManager } from '../game/NetworkManager';

interface DungeonDelverSidebarProps {
  isMobile?: boolean;
}

export const DungeonDelverSidebar: React.FC<DungeonDelverSidebarProps> = ({ isMobile }) => {
  const leaderboard = useGameStore(state => state.leaderboard);
  const serverId = useGameStore(state => state.serverId);
  const dateStr = new Date().toLocaleDateString('en-GB', { year: '2-digit', month: '2-digit', day: '2-digit' });

  const players = Object.values(leaderboard).sort((a, b) => b.kills - a.kills).slice(0, 5);

  return (
    <div 
      className={`absolute right-0 flex flex-col gap-2 pointer-events-none mc-font safe-pr safe-pt transition-all top-0 sm:top-14 md:top-28 transform origin-top-right scale-[0.40] sm:scale-75 md:scale-90 lg:scale-100 ${isMobile ? 'landscape:top-10 landscape:scale-[0.35] sm:landscape:top-12 sm:landscape:scale-[0.35] md:landscape:scale-[0.45] lg:landscape:scale-[0.55] xl:landscape:scale-[0.55]' : 'landscape:scale-[0.40] md:landscape:scale-75 lg:landscape:scale-90 xl:landscape:scale-100'}`}
    >
      <div className="bg-black/60 p-3 md:p-4 border-l-4 border-red-500 text-white text-sm md:text-base shadow-2xl min-w-[160px] md:min-w-[200px]">
        <div className="text-red-500 font-bold mb-1 text-center uppercase tracking-[0.1em] text-lg mc-text-shadow">DUNGEON DELVER</div>
        <div className="text-white/60 text-xs text-center mb-3 border-b border-white/10 pb-2 mc-text-shadow">{dateStr} <span className="text-[#55FF55]">{serverId || 'm123'}</span></div>
        
        <div className="space-y-2">
          <div className="border-t border-white/10 pt-3 mt-3">
            <span className="text-red-400 text-sm mc-text-shadow font-bold block mb-2 uppercase tracking-wide">Top Slayers</span>
            {players.length === 0 && (
                <div className="text-white/40 text-xs mc-text-shadow italic">No slayers yet...</div>
            )}
            {players.map((p, index) => {
                const isMe = p.id === networkManager.id;
                return (
                    <div key={p.id} className="flex justify-between items-center bg-black/40 px-2 py-1.5 mb-1 border-l-2 border-red-500/50">
                       <div className="flex items-center gap-2">
                         <span className="text-white/50 text-xs">{index + 1}.</span>
                         <span className={`truncate max-w-[90px] mc-text-shadow text-sm ${isMe ? 'text-[#FFFF55]' : 'text-white'}`}>{p.name || 'Unknown'}</span>
                       </div>
                       <span className="text-red-400 font-bold mc-text-shadow">{p.kills}</span>
                    </div>
                );
            })}
          </div>
        </div>

        <div className="mt-5 text-center text-[10px] text-red-500/50 font-bold tracking-widest mc-text-shadow">
          STARPLEX.IO
        </div>
      </div>
    </div>
  );
};
