import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGameStore } from '../store/gameStore';

export const KillCelebrationUI: React.FC = () => {
  const killCelebrations = useGameStore((state) => state.killCelebrations);

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-20 sm:bottom-32 md:bottom-40 lg:bottom-48 pointer-events-none z-[900] flex flex-col items-center gap-1.5 select-none w-max transform origin-bottom scale-[0.65] sm:scale-85 md:scale-100 landscape:scale-[0.45] sm:landscape:scale-75 md:landscape:scale-90 lg:landscape:scale-100">
      <AnimatePresence>
        {killCelebrations.map((kill) => (
          <motion.div
            key={kill.id}
            initial={{ opacity: 0, scale: 0.8, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -10 }}
            transition={{
              type: "spring",
              stiffness: 450,
              damping: 25
            }}
            className="flex items-center gap-2 px-3 py-1 bg-black/80 border border-[#55FF55]/40 rounded-md backdrop-blur-sm shadow-md mc-font"
          >
            <span className="text-sm">⚔️</span>
            <span className="text-xs sm:text-sm font-bold text-[#55FF55] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] mc-text-shadow whitespace-nowrap">
              {kill.isPlayer ? "PLAYER KILLED!" : "MOB DEFEATED!"}
            </span>
            <span className="text-xs sm:text-sm text-gray-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] mc-text-shadow whitespace-nowrap">
              defeated <span className="font-bold text-[#FFFF55]">{kill.victimName}</span>
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
