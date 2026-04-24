
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGameStore } from '../store/gameStore';

export const GameMessages: React.FC = () => {
  const messages = useGameStore(state => state.messages);

  return (
    <div className="fixed bottom-1/4 left-1/2 -translate-x-1/2 pointer-events-none z-[500] flex flex-col items-center gap-2">
      <AnimatePresence>
        {messages.map((m) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="px-4 py-1 bg-black/50 rounded-full text-sm font-medium backdrop-blur-sm border border-white/10"
            style={{ color: m.color }}
          >
            {m.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
