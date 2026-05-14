import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';

export function TopObjectiveHUD() {
  const [timeLeft, setTimeLeft] = useState(20 * 60);
  const [gameState, setGameState] = useState('playing');
  const [winningTeam, setWinningTeam] = useState<string | null>(null);

  useEffect(() => {
    const handleSync = (e: Event) => {
      const data = (e as CustomEvent).detail;
      setGameState(data.gameState || 'playing');
      setWinningTeam(data.winningTeam || null);
      if (typeof data.timeRemaining === 'number') {
        setTimeLeft(data.timeRemaining);
      }
    };

    window.addEventListener('skyCastlesSync', handleSync);
    return () => window.removeEventListener('skyCastlesSync', handleSync);
  }, []);

  const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const seconds = (timeLeft % 60).toString().padStart(2, '0');

  const inOvertime = timeLeft === 0;

  let headerText = inOvertime ? 'OVERTIME' : `${minutes}:${seconds}`;
  let headerColorClass = inOvertime ? 'text-red-500 animate-pulse' : 'text-white';
  
  if (gameState === 'endgame') {
    if (winningTeam === 'draw') {
      headerText = 'DRAW';
      headerColorClass = 'text-yellow-400';
    } else if (winningTeam) {
      headerText = `${winningTeam.toUpperCase()} WINS`;
      headerColorClass = winningTeam.toLowerCase() === 'red' ? 'text-red-500' : 'text-blue-400';
    }
  }

  return (
    <div className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] z-50 origin-top safe-pt scale-75 md:scale-100">
      <div 
        className={`font-mono tracking-wider font-bold bg-black/60 px-4 md:px-6 py-0.5 md:py-1 rounded-t-lg border-t-2 border-l-2 border-r-2 border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] ${headerColorClass}`}
        style={{ fontSize: 'clamp(0.85rem, 1.5vw, 2.25rem)' }}
      >
        {headerText}
      </div>
      <div 
        className="text-[#FFDD55] mc-text-shadow font-sans font-semibold bg-black/80 px-4 md:px-8 py-0.5 md:py-2 rounded-b-lg border-2 border-white/10 text-center shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
        style={{ fontSize: 'clamp(0.5rem, 1vw, 1rem)' }}
      >
        Guard Morvane at all costs &mdash; eliminate the rival team!
      </div>
    </div>
  );
}
