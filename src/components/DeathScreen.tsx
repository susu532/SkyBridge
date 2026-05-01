
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export const DeathScreen: React.FC = () => {
  const [isDead, setIsDead] = useState(false);

  useEffect(() => {
    const handlePlayerDied = () => {
      // Auto-respawn instantly without showing the pop-up
      window.dispatchEvent(new CustomEvent('requestRespawn'));
    };

    const handlePlayerRespawn = () => {
      setIsDead(false);
    };

    window.addEventListener('playerDied', handlePlayerDied);
    window.addEventListener('playerRespawn', handlePlayerRespawn);

    return () => {
      window.removeEventListener('playerDied', handlePlayerDied);
      window.removeEventListener('playerRespawn', handlePlayerRespawn);
    };
  }, []);

  const handleRespawn = () => {
    setIsDead(false);
    window.dispatchEvent(new CustomEvent('requestRespawn'));
  };

  return (
    <AnimatePresence>
      {isDead && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-red-900/80 backdrop-blur-md z-[10000] flex flex-col items-center justify-center text-white"
        >
          <motion.h1 
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            className="text-6xl font-bold mb-8 drop-shadow-2xl"
          >
            You Died!
          </motion.h1>
          <button
            onClick={handleRespawn}
            className="px-8 py-3 bg-white text-red-900 font-bold rounded-sm hover:bg-gray-200 transition-colors uppercase tracking-widest"
          >
            Respawn
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
