import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';

export function TopObjectiveHUD() {
  const gameStartTime = useGameStore(state => state.gameStartTime);
  const [timeLeft, setTimeLeft] = useState(20 * 60);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!gameStartTime) return;
      const elapsed = Date.now() - gameStartTime;
      const maxTime = 20 * 60 * 1000;
      const remainingCalc = Math.max(0, maxTime - elapsed);
      setTimeLeft(Math.ceil(remainingCalc / 1000));
    }, 500);
    return () => clearInterval(interval);
  }, [gameStartTime]);

  const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const seconds = (timeLeft % 60).toString().padStart(2, '0');

  const inOvertime = timeLeft === 0;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] z-50">
      <div className={`font-mono tracking-wider text-4xl font-bold bg-black/60 px-6 py-1 rounded-t-lg border-t-2 border-l-2 border-r-2 border-white/10 backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] ${inOvertime ? 'text-red-500 animate-pulse' : 'text-white'}`}>
        {inOvertime ? 'OVERTIME' : `${minutes}:${seconds}`}
      </div>
      <div className="text-[#FFDD55] mc-text-shadow font-sans text-sm md:text-base font-semibold bg-black/80 px-8 py-2 rounded-b-lg border-2 border-white/10 backdrop-blur-sm text-center shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
        Guard Morvane at all costs &mdash; eliminate the rival team!
      </div>
    </div>
  );
}
