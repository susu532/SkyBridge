
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  id: string;
  text: string;
  color: string;
}

export const GameMessages: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    const handleMessage = (e: any) => {
      const { text, color } = e.detail;
      const id = Math.random().toString(36).substring(7);
      
      setMessages(prev => [...prev, { id, text, color: color || 'white' }]);
      
      setTimeout(() => {
        setMessages(prev => prev.filter(m => m.id !== id));
      }, 3000);
    };

    window.addEventListener('gameMessage', handleMessage as EventListener);
    return () => window.removeEventListener('gameMessage', handleMessage as EventListener);
  }, []);

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
