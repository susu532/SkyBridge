import React, { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

export const StatsPanel: React.FC = () => {
  const showLeaderboard = useGameStore(state => state.showLeaderboard);
  const setShowLeaderboard = useGameStore(state => state.setShowLeaderboard);
  const leaderboard = useGameStore(state => state.leaderboard);
  const currentMode = useGameStore(state => state.currentMode);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        setShowLeaderboard(true);
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        setShowLeaderboard(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [setShowLeaderboard]);

  if (!showLeaderboard) return null;

  const players = Object.values(leaderboard);
  
  // Sort players by Kills descending, then Deaths ascending
  players.sort((a, b) => {
    if (b.kills !== a.kills) return b.kills - a.kills;
    return a.deaths - b.deaths;
  });

  const isSkyCastles = currentMode.startsWith('skycastles');

  let redTeam: typeof players = [];
  let blueTeam: typeof players = [];
  let soloPlayers: typeof players = [];

  if (isSkyCastles) {
    redTeam = players.filter(p => p.team === 'red');
    blueTeam = players.filter(p => p.team === 'blue');
    soloPlayers = players.filter(p => p.team !== 'red' && p.team !== 'blue');
  } else {
    soloPlayers = players;
  }

  const renderTable = (teamPlayers: typeof players, title: string, colorClass: string) => {
    if (teamPlayers.length === 0 && !isSkyCastles) return null;
    return (
      <div className="mb-4 w-full">
        <h3 className={`text-lg font-bold mb-2 ${colorClass}`}>{title} ({teamPlayers.length})</h3>
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-white/20 text-white/70">
              <th className="py-1 px-2 font-medium w-1/2">Player</th>
              <th className="py-1 px-2 font-medium text-center">Kills</th>
              <th className="py-1 px-2 font-medium text-center">Deaths</th>
            </tr>
          </thead>
          <tbody>
            {teamPlayers.length === 0 ? (
              <tr><td colSpan={3} className="py-2 px-2 text-center text-white/40 italic">Empty</td></tr>
            ) : teamPlayers.map((p) => (
              <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="py-1 px-2 truncate max-w-[120px]">{p.name || 'Unknown'}</td>
                <td className="py-1 px-2 text-center text-[#55FF55]">{p.kills}</td>
                <td className="py-1 px-2 text-center text-[#FF5555]">{p.deaths}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-[100] mc-font">
      <div className="bg-black/80  border-[3px] border-white/20 p-6 rounded shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto pointer-events-auto shadow-[0_10px_30px_rgba(0,0,0,0.8)] custom-scrollbar">
        <h2 className="text-2xl text-center text-[#FFAA00] font-bold mb-4 uppercase tracking-[0.1em] mc-text-shadow">
          Post-Match Stats
        </h2>
        
        <div className="flex flex-col md:flex-row gap-6 w-full">
          {isSkyCastles ? (
            <>
              <div className="flex-1 bg-red-900/20 p-3 border border-red-500/30 rounded">
                {renderTable(redTeam, 'Red Team', 'text-[#FF5555] mc-text-shadow')}
              </div>
              <div className="flex-1 bg-blue-900/20 p-3 border border-blue-500/30 rounded">
                {renderTable(blueTeam, 'Blue Team', 'text-[#5555FF] mc-text-shadow')}
              </div>
            </>
          ) : (
             <div className="flex-1">
               {renderTable(soloPlayers, 'Players', 'text-white')}
             </div>
          )}
        </div>
        
        {isSkyCastles && soloPlayers.length > 0 && (
          <div className="mt-4 bg-gray-900/40 p-3 border border-gray-500/30 rounded">
            {renderTable(soloPlayers, 'Spectators / Unassigned', 'text-gray-400')}
          </div>
        )}
      </div>
    </div>
  );
};
