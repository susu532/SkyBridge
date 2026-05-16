import { useEffect, useState, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { motion, AnimatePresence } from 'motion/react';

export function TopObjectiveHUD() {
  const [timeLeft, setTimeLeft] = useState(20 * 60);
  const [gameState, setGameState] = useState('playing');
  const [winningTeam, setWinningTeam] = useState<string | null>(null);
  
  const playerTeam = useGameStore(state => state.playerTeam);

  const [showEndgameText, setShowEndgameText] = useState(false);
  const [showResetText, setShowResetText] = useState(false);
  const [prevGameState, setPrevGameState] = useState('playing');
  
  const isMapLoading = useGameStore(state => state.isMapLoading);
  const [prevMapLoading, setPrevMapLoading] = useState(isMapLoading);
  const [waitingForNewMatchSequence, setWaitingForNewMatchSequence] = useState(false);

  const [showMatchStartText, setShowMatchStartText] = useState(false);
  const hasShownMatchStartText = useRef(false);

  useEffect(() => {
    if (gameState !== 'playing') {
      hasShownMatchStartText.current = false;
      setShowMatchStartText(false);
    } else {
      if (timeLeft <= 1192 && timeLeft >= 1188 && !hasShownMatchStartText.current) {
        hasShownMatchStartText.current = true;
        setShowMatchStartText(true);
      }
    }
  }, [timeLeft, gameState]);

  useEffect(() => {
    if (showMatchStartText) {
      const t = setTimeout(() => setShowMatchStartText(false), 5000);
      return () => clearTimeout(t);
    }
  }, [showMatchStartText]);

  useEffect(() => {
    if (gameState === 'endgame' && prevGameState === 'playing') {
      setShowEndgameText(true);
      const t = setTimeout(() => setShowEndgameText(false), 5000);
      return () => clearTimeout(t);
    } else if (gameState === 'playing' && prevGameState === 'endgame') {
      setWaitingForNewMatchSequence(true);
    }
    setPrevGameState(gameState);
  }, [gameState, prevGameState]);

  useEffect(() => {
      if (!isMapLoading && prevMapLoading) {
          if (waitingForNewMatchSequence) {
             setShowResetText(true);
             const t = setTimeout(() => setShowResetText(false), 4000);
             setWaitingForNewMatchSequence(false);
             return () => clearTimeout(t);
          }
      }
      setPrevMapLoading(isMapLoading);
  }, [isMapLoading, prevMapLoading, waitingForNewMatchSequence]);

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
  
  let resultText = '';
  let resultColor = '';
  
  if (gameState === 'endgame') {
    if (winningTeam === 'draw') {
      headerText = 'DRAW';
      headerColorClass = 'text-yellow-400';
      resultText = 'DRAW';
      resultColor = 'text-yellow-400';
    } else if (winningTeam) {
      headerText = `${winningTeam.toUpperCase()} WINS`;
      headerColorClass = winningTeam.toLowerCase() === 'red' ? 'text-red-500' : 'text-blue-400';
      
      if (playerTeam) {
          if (playerTeam === winningTeam) {
              resultText = 'VICTORY!';
              resultColor = 'text-yellow-400 font-extrabold shadow-[0_0_20px_#FFAA00] mc-text-shadow';
          } else {
              resultText = 'DEFEAT';
              resultColor = 'text-red-600 font-extrabold shadow-[0_0_20px_#FF0000] mc-text-shadow';
          }
      } else {
          resultText = `${winningTeam.toUpperCase()} WINS!`;
          resultColor = headerColorClass;
      }
    }
  }

  return (
    <>
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

      <AnimatePresence>
        {showEndgameText && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0, y: -50 }}
              animate={{ scale: 1.2, opacity: 1, y: 0 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ type: 'spring', bounce: 0.5, duration: 1 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-[100]"
            >
               <h1 className={`text-6xl md:text-8xl tracking-widest uppercase ${resultColor}`}>
                  {resultText}
               </h1>
            </motion.div>
        )}
        
        {showMatchStartText && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0, y: -50 }}
              animate={{ scale: 1.2, opacity: 1, y: 0 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ type: 'spring', bounce: 0.5, duration: 1 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-[100]"
            >
               <h1 className="text-6xl md:text-8xl tracking-widest uppercase text-yellow-400 font-extrabold shadow-[0_0_30px_#FFAA00] mc-text-shadow border-8 border-yellow-400 p-6 md:p-10 bg-black/40 backdrop-blur-sm rounded-xl">
                  NEW MATCH
               </h1>
            </motion.div>
        )}

        {showResetText && (
            <motion.div
              initial={{ opacity: 0, scale: 2, filter: "blur(10px)", rotateX: 90 }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)", rotateX: 0 }}
              exit={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }}
              transition={{ duration: 1, ease: 'circOut' }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-[100]"
            >
               <div className="flex flex-col items-center">
                   <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 drop-shadow-[0_0_15px_rgba(0,255,255,0.8)] tracking-[0.2em] uppercase italic">
                       NEW MATCH
                   </h1>
                   <motion.div
                     initial={{ width: 0 }}
                     animate={{ width: '100%' }}
                     transition={{ duration: 1, delay: 0.5, ease: 'circOut' }}
                     className="h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent mt-4"
                   />
               </div>
            </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
