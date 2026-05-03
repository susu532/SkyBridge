import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Server, Play, ShoppingCart } from 'lucide-react';
import { NPC } from '../game/NPC';

interface ServerJoinUIProps {
  isOpen: boolean;
  serverName?: string;
  npc?: NPC | null;
  onClose: () => void;
  onJoin: () => void;
  onOpenShop?: () => void;
}

export const ServerJoinUI: React.FC<ServerJoinUIProps> = ({ isOpen, serverName = 'skybridge', npc, onClose, onJoin, onOpenShop }) => {
  const displayName = serverName === 'skycastles' ? 'SkyCastles' : serverName === 'voidtrail' ? 'Voidtrail' : serverName === 'dungeondelver' ? 'Dungeon Delver' : 'SkyBridge';
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            className="relative w-full max-w-sm bg-[#1a1a1a]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8 flex flex-col items-center text-center"
          >
            <div className="w-16 h-16 bg-[#FFFF55]/10 rounded-2xl flex items-center justify-center mb-6">
              <Server className="w-8 h-8 text-[#FFFF55]" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-2 leading-tight">
               {displayName}
            </h2>
            
            <div className="w-full flex flex-col gap-3 mt-4">
              <button
                onClick={onJoin}
                className="w-full h-12 bg-white text-black hover:bg-[#FFFF55] font-bold rounded-xl transition-all flex items-center justify-center gap-2 group active:scale-95"
              >
                <Play className="w-4 h-4 fill-current transition-transform group-hover:scale-110" />
                JOIN GAME
              </button>

              {npc && npc.shopItems && npc.shopItems.length > 0 && onOpenShop && (
                <button
                  onClick={onOpenShop}
                  className="w-full h-12 bg-[#373737] text-white hover:bg-[#444] border-2 border-[#555] font-bold rounded-xl transition-all flex items-center justify-center gap-2 group active:scale-95"
                >
                  <ShoppingCart className="w-4 h-4 transition-transform group-hover:scale-110" />
                  OPEN SHOP
                </button>
              )}
            </div>

            <button 
              onClick={onClose}
              className="absolute top-4 right-4 text-white/20 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
