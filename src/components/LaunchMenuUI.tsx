import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Rocket, Wind } from 'lucide-react';

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
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="relative w-full max-w-sm bg-gradient-to-b from-[#1e1e24] to-[#141418] border border-purple-500/30 rounded-3xl shadow-2xl p-8 flex flex-col items-center text-center overflow-hidden"
          >
            {/* Background glow */}
            <div className="absolute -top-24 -translate-x-1/2 left-1/2 w-48 h-48 bg-purple-500/20 rounded-full blur-[50px] pointer-events-none" />

            <div className="relative w-20 h-20 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-purple-500/20">
              <Rocket className="w-10 h-10 text-white" />
              <Wind className="absolute bottom-3 left-3 w-4 h-4 text-white/60" />
            </div>

            <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
               Bren
            </h2>
            
            <p className="text-gray-300 mb-8 leading-relaxed font-medium">
              Hey there! Want me to launch you into the sky with your Elytra?
            </p>

            <div className="flex flex-col w-full gap-3 relative z-10">
              <button
                onClick={onLaunch}
                className="w-full relative group bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-3 overflow-hidden"
              >
                <div className="absolute inset-0 bg-[linear-gradient(to_right,transparent,rgba(255,255,255,0.2),transparent)] -translate-x-[150%] skew-x-[-30deg] group-hover:animate-[shimmer_1.5s_infinite]" />
                <Rocket className="w-5 h-5 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
                <span className="text-lg">Launch Me!</span>
              </button>
              
              <button
                onClick={onClose}
                className="w-full bg-white/5 hover:bg-white/10 text-white/80 hover:text-white font-semibold py-4 px-6 rounded-xl transition-colors border border-white/5 hover:border-white/20"
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
