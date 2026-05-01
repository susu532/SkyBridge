
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Play, Settings, LogOut } from 'lucide-react';
import { audioManager } from '../game/AudioManager';

import { networkManager } from '../game/NetworkManager';

interface PauseMenuUIProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

export const PauseMenuUI: React.FC<PauseMenuUIProps> = ({ 
  isOpen, 
  onClose, 
  onOpenSettings 
}) => {
  if (!isOpen) return null;

  const menuItems = [
    { 
      label: 'Back to Game', 
      icon: <Play className="w-5 h-5" />, 
      onClick: onClose,
      primary: true 
    },
    { 
      label: 'Settings', 
      icon: <Settings className="w-5 h-5" />, 
      onClick: onOpenSettings 
    },
    { 
      label: 'Quit Game', 
      icon: <LogOut className="w-5 h-5" />, 
      onClick: () => {
        networkManager.initMatchmaking('hub');
        window.dispatchEvent(new CustomEvent('requestGameRestart'));
      }
    },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-[#C6C6C6] border-t-4 border-l-4 border-white border-b-4 border-r-4 border-[#555555] w-full max-w-xs shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-[#8B8B8B] p-4 flex items-center justify-between border-b-4 border-[#555555]">
            <h2 className="text-xl font-bold text-white drop-shadow-[2px_2px_0_rgba(0,0,0,1)] uppercase tracking-wider">
              Menu
            </h2>
            <button 
              onClick={onClose}
              className="p-1 hover:bg-white/20 transition-colors rounded"
            >
              <X className="w-5 h-5 text-white drop-shadow-[1.5px_1.5px_0_rgba(0,0,0,1)]" />
            </button>
          </div>

          {/* Menu Options */}
          <div className="p-4 space-y-3">
            {menuItems.map((item, i) => (
              <button
                key={i}
                onClick={() => {
                  audioManager.play('click', 0.5, 0.8);
                  item.onClick();
                }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 font-bold uppercase tracking-widest transition-all
                  ${item.primary 
                    ? 'bg-[#3c8527] hover:bg-[#4caf50] text-white border-t-2 border-l-2 border-[#5ebc3d] border-b-2 border-r-2 border-[#1e4614]' 
                    : 'bg-[#A0A0A0] hover:bg-white text-[#555555] border-t-2 border-l-2 border-white border-b-2 border-r-2 border-[#555555]'
                  }
                  shadow-md active:translate-y-0.5 active:shadow-inner
                `}
              >
                <span className={item.primary ? 'text-white' : 'text-[#555555]'}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="bg-[#8B8B8B] p-2 text-center border-t-2 border-[#555555]">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-tighter">
              SkyBridge v1.0.4
            </span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
