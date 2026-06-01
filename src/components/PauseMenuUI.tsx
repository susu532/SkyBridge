
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Play, Settings, LogOut, Users, Check } from 'lucide-react';
import { audioManager } from '../game/AudioManager';
import { networkManager } from '../game/NetworkManager';
import { CommunitySidebar } from './CommunitySidebar';
import { CrazyGamesManager } from '../game/CrazyGamesManager';

interface PauseMenuUIProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  isMobile?: boolean;
}

export const PauseMenuUI: React.FC<PauseMenuUIProps> = ({ 
  isOpen, 
  onClose, 
  onOpenSettings,
  isMobile
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleInvite = () => {
    try {
      const server = new URLSearchParams(window.location.search).get('server') || 'dungeondelver';
      const link = CrazyGamesManager.inviteLink({ server });
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn("Copy to clipboard failed", e);
    }
  };

  const menuItems = [
    { 
      label: 'Back to Game', 
      icon: <Play className="w-5 h-5" />, 
      onClick: onClose,
      primary: true 
    },
    { 
      label: copied ? 'Link Copied!' : 'Invite Friends', 
      icon: copied ? <Check className="w-5 h-5 text-green-500" /> : <Users className="w-5 h-5 text-blue-400" />, 
      onClick: handleInvite,
      primary: false 
    },
    { 
      label: 'Settings', 
      icon: <Settings className="w-5 h-5" />, 
      onClick: onOpenSettings 
    },
    /*
    { 
      label: 'Quit Game', 
      icon: <LogOut className="w-5 h-5" />, 
      onClick: () => {
        networkManager.initMatchmaking('dungeondelver');
        window.dispatchEvent(new CustomEvent('requestGameRestart'));
      }
    },
    */
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 pointer-events-auto"
        onPointerDown={(e) => {
          e.stopPropagation();
          if (e.target === e.currentTarget) {
             onClose();
          }
        }}
      >
        {/* Separated Sidebar Panel on Extreme Right Screen (Full-Height) */}
        <motion.div
          initial={{ x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 320, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 220 }}
          className={`fixed top-0 right-0 bottom-0 h-full w-64 md:w-72 lg:w-80 bg-[#9F9F9F] border-l-4 border-[#555555] shrink-0 z-[95] overflow-hidden flex flex-col shadow-2xl origin-right transform ${isMobile ? 'landscape:w-56 landscape:scale-90 sm:landscape:scale-100 sm:landscape:w-64 max-w-[45vw]' : ''}`}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <CommunitySidebar />
        </motion.div>

        {/* Primary Centered Pause Menu Card */}
        <div className={`w-full max-w-xs relative transform scale-100 origin-center p-4 ${isMobile ? 'landscape:scale-[0.55] sm:landscape:scale-[0.6] md:landscape:scale-[0.8] xl:landscape:scale-100' : ''}`}>
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="bg-[#C6C6C6] border-t-4 border-l-4 border-white border-b-4 border-r-4 border-[#555555] w-full shadow-2xl overflow-hidden"
            onPointerDown={(e) => e.stopPropagation()}
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
                starplex.io v1.0.4
              </span>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
