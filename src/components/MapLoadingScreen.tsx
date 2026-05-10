import { useGameStore } from '../store/gameStore';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2 } from 'lucide-react';

export function MapLoadingScreen() {
  const isMapLoading = useGameStore(state => state.isMapLoading);

  return (
    <AnimatePresence>
      {isMapLoading && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5, ease: 'easeOut' } }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60  mc-font"
        >
          <div className="flex flex-col items-center gap-6 p-8 rounded-2xl bg-black/40 border border-white/10 shadow-2xl">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              className="relative w-16 h-16 flex items-center justify-center"
            >
              <Loader2 className="w-12 h-12 text-[#55FFFF] animate-spin" />
            </motion.div>
            <div className="flex flex-col items-center gap-2">
              <h1 className="text-2xl md:text-4xl text-white font-bold drop-shadow-md">
                Entering World
              </h1>
              <p className="text-[#AAAAAA] text-sm md:text-base animate-pulse">
                Awaiting server coordinates...
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
