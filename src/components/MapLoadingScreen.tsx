import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { CrazyGamesManager } from '../game/CrazyGamesManager';

export function MapLoadingScreen() {
  const isMapLoading = useGameStore(state => state.isMapLoading);
  const loadingProgress = useGameStore(state => state.loadingProgress);
  const loadingMessage = useGameStore(state => state.loadingMessage);
  const setIsMapLoading = useGameStore(state => state.setIsMapLoading);

  const [showTapToPlay, setShowTapToPlay] = useState(false);

  useEffect(() => {
    if (isMapLoading) {
      CrazyGamesManager.loadingStart();
      document.exitPointerLock?.();
      
      let timer: any;
      if (loadingProgress >= 1) {
        setShowTapToPlay(true);
        CrazyGamesManager.loadingStop();
      } else {
        setShowTapToPlay(false);
        // Fallback: if somehow progress never reaches 1, show it after 5 seconds
        timer = setTimeout(() => {
          setShowTapToPlay(true);
          CrazyGamesManager.loadingStop();
        }, 5000);
      }
      return () => clearTimeout(timer);
    } else {
      setShowTapToPlay(false);
    }
  }, [isMapLoading, loadingProgress]);

  const handleTapToPlay = () => {
    if (showTapToPlay) {
      setIsMapLoading(false);
      document.body.requestPointerLock?.();
    }
  };

  return (
    <AnimatePresence>
      {isMapLoading && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: showTapToPlay ? 0 : 0.5 } }}
          className="fixed inset-0 z-[100] flex items-center justify-center mc-font cursor-pointer"
          onPointerDown={handleTapToPlay}
          onClick={handleTapToPlay}
          style={showTapToPlay ? { backgroundColor: 'rgba(0, 0, 0, 0.8)' } : {
            backgroundColor: '#1E1E24',
            backgroundImage: 'repeating-linear-gradient(45deg, #2A2A35 25%, transparent 25%, transparent 75%, #2A2A35 75%, #2A2A35), repeating-linear-gradient(45deg, #2A2A35 25%, #1E1E24 25%, #1E1E24 75%, #2A2A35 75%, #2A2A35)',
            backgroundPosition: '0 0, 20px 20px',
            backgroundSize: '40px 40px'
          }}
        >
          {showTapToPlay ? (
            <div className="flex flex-col items-center justify-center gap-4 landscape:gap-2 sm:gap-10 max-w-lg w-[90%] text-center pointer-events-none">
              {/* Logo Area */}
              <div className="flex flex-col items-center gap-4">
                <img 
                  src="https://raw.githubusercontent.com/susu532/sounds/main/minecraft/favicon.png" 
                  alt="Starplex Logo" 
                  className="w-[40vh] h-[40vh] min-w-[120px] min-h-[120px] max-w-[384px] max-h-[384px] drop-shadow-[0_16px_32px_rgba(0,0,0,0.8)] select-none pointer-events-none object-contain landscape:w-[25vh] landscape:h-[25vh]"
                  style={{ imageRendering: 'pixelated' }}
                />
               
              </div>

              {/* Tap to Play Button */}
              <div className="flex flex-col items-center gap-2 sm:gap-4 w-full">
                <div className="animate-pulse w-full max-w-sm">
                  <span className="block text-center text-white text-xl landscape:text-lg sm:text-2xl md:text-4xl font-black bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 px-6 py-4 landscape:px-4 landscape:py-2 sm:px-8 sm:py-5 rounded-xl border-4 border-amber-300 select-none shadow-[0_8px_0_#975A16,0_12px_24px_rgba(0,0,0,0.6)] tracking-wider">
                    TAP TO PLAY
                  </span>
                </div>
                <p className="text-gray-300 text-xs md:text-sm font-bold uppercase tracking-widest drop-shadow-[1px_1px_0_rgba(0,0,0,1)] text-center">
                  (Click or Tap Anywhere to Enter)
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 sm:gap-6 p-4 sm:p-8 landscape:p-4 rounded-2xl bg-black/60 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] md:backdrop-blur-sm w-[90%] max-w-md pointer-events-none">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                className="relative w-12 h-12 landscape:w-10 landscape:h-10 sm:w-16 sm:h-16 flex items-center justify-center"
              >
                <Loader2 className="w-8 h-8 landscape:w-6 landscape:h-6 sm:w-12 sm:h-12 text-[#55FFFF] animate-spin" />
              </motion.div>
              <div className="flex flex-col items-center gap-1 sm:gap-2 w-full">
                <h1 className="text-xl landscape:text-lg sm:text-2xl md:text-3xl text-white font-bold drop-shadow-md text-center">
                  Entering World
                </h1>
                
                <div className="w-full bg-[#111] h-4 rounded-full overflow-hidden border border-[#333] mt-2 relative">
                  <div 
                    className="h-full bg-[#55FFFF] transition-all duration-300 ease-out"
                    style={{ width: `${Math.max(5, loadingProgress * 100)}%` }}
                  />
                </div>

                <p className="text-[#AAAAAA] text-sm md:text-base animate-pulse mt-1">
                  {loadingMessage}...
                </p>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
