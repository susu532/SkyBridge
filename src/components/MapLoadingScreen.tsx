import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2 } from 'lucide-react';

export function MapLoadingScreen() {
  const isMapLoading = useGameStore(state => state.isMapLoading);
  const loadingProgress = useGameStore(state => state.loadingProgress);
  const loadingMessage = useGameStore(state => state.loadingMessage);
  const setIsMapLoading = useGameStore(state => state.setIsMapLoading);

  useEffect(() => {
    if (isMapLoading) {
      const timer = setTimeout(() => {
        setIsMapLoading(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isMapLoading, setIsMapLoading]);

  return (
    <AnimatePresence>
      {isMapLoading && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5, ease: 'easeOut' } }}
          className="fixed inset-0 z-[100] flex items-center justify-center mc-font"
          style={{
            backgroundColor: '#1E1E24',
            backgroundImage: 'repeating-linear-gradient(45deg, #2A2A35 25%, transparent 25%, transparent 75%, #2A2A35 75%, #2A2A35), repeating-linear-gradient(45deg, #2A2A35 25%, #1E1E24 25%, #1E1E24 75%, #2A2A35 75%, #2A2A35)',
            backgroundPosition: '0 0, 20px 20px',
            backgroundSize: '40px 40px'
          }}
        >
          <div className="flex flex-col items-center gap-6 p-8 rounded-2xl bg-black/60 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] md:backdrop-blur-sm w-[90%] max-w-md">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              className="relative w-16 h-16 flex items-center justify-center"
            >
              <Loader2 className="w-12 h-12 text-[#55FFFF] animate-spin" />
            </motion.div>
            <div className="flex flex-col items-center gap-2 w-full">
              <h1 className="text-2xl md:text-3xl text-white font-bold drop-shadow-md text-center">
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
