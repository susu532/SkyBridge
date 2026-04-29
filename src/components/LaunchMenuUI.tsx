import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PlaneTakeoff, X } from 'lucide-react';

interface LaunchMenuUIProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunch: () => void;
}

export const LaunchMenuUI: React.FC<LaunchMenuUIProps> = ({ isOpen, onClose, onLaunch }) => {
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
            <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6">
              <PlaneTakeoff className="w-8 h-8 text-blue-400" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-2 leading-tight">
               Bren
            </h2>
            
            <p className="text-gray-400 mb-8 leading-relaxed">
              Hey there! Want me to launch you into the sky?
            </p>

            <div className="flex flex-col w-full gap-3">
              <button
                onClick={onLaunch}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                Launch Me!
              </button>
              
              <button
                onClick={onClose}
                className="w-full bg-white/5 hover:bg-white/10 text-white font-semibold py-4 px-6 rounded-xl transition-colors border border-white/10"
              >
                No Thanks
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
