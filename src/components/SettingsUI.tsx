
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { settingsManager, GameSettings, DEFAULT_SETTINGS } from '../game/Settings';
import { X, Settings as SettingsIcon, Monitor, MousePointer2, Volume2, Bug, Zap, Keyboard } from 'lucide-react';

interface SettingsUIProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsUI: React.FC<SettingsUIProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<GameSettings>(settingsManager.getSettings());
  const [rebindingKey, setRebindingKey] = useState<string | null>(null);

  useEffect(() => {
    return settingsManager.subscribe(setSettings);
  }, []);

  useEffect(() => {
    if (!rebindingKey) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.code === 'Escape') {
        setRebindingKey(null);
        return;
      }
      const newKeybinds = { ...settings.keybinds, [rebindingKey]: e.code };
      settingsManager.updateSettings({ keybinds: newKeybinds });
      setRebindingKey(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rebindingKey, settings.keybinds]);

  const handleChange = (key: keyof GameSettings, value: any) => {
    settingsManager.updateSettings({ [key]: value });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
        onClick={() => {
          if (!rebindingKey) onClose();
        }}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-[#C6C6C6] border-t-4 border-l-4 border-white border-b-4 border-r-4 border-[#555555] w-full max-w-2xl overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-[#8B8B8B] p-4 flex items-center justify-between border-b-4 border-[#555555]">
            <div className="flex items-center gap-3">
              <SettingsIcon className="w-6 h-6 text-white drop-shadow-[2px_2px_0_rgba(0,0,0,1)]" />
              <h2 className="text-2xl font-bold text-white drop-shadow-[2px_2px_0_rgba(0,0,0,1)] uppercase tracking-wider">
                Game Settings
              </h2>
            </div>
            <button 
              onClick={() => {
                if (rebindingKey) setRebindingKey(null);
                else onClose();
              }}
              className="p-1 hover:bg-white/20 transition-colors rounded"
            >
              <X className="w-6 h-6 text-white drop-shadow-[2px_2px_0_rgba(0,0,0,1)]" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar space-y-8">
            
            {/* Graphics */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b-2 border-[#8B8B8B] pb-2">
                <Monitor className="w-5 h-5 text-[#555555]" />
                <h3 className="text-lg font-bold text-[#555555] uppercase">Graphics</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={`space-y-2 ${settings.performanceMode ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="flex justify-between">
                    <label className="text-sm font-bold text-[#555555] uppercase">Render Distance</label>
                    <span className="text-sm font-bold text-[#555555]">{settings.renderDistance} Chunks</span>
                  </div>
                  <input 
                    type="range" 
                    min="2" 
                    max="12" 
                    step="1"
                    value={settings.renderDistance}
                    disabled={settings.performanceMode}
                    onChange={(e) => handleChange('renderDistance', parseInt(e.target.value))}
                    className="w-full h-4 bg-[#8B8B8B] appearance-none cursor-pointer border-2 border-black/20"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-sm font-bold text-[#555555] uppercase">Field of View (FOV)</label>
                    <span className="text-sm font-bold text-[#555555]">{settings.fov}</span>
                  </div>
                  <input 
                    type="range" 
                    min="30" 
                    max="110" 
                    step="1"
                    value={settings.fov}
                    onChange={(e) => handleChange('fov', parseInt(e.target.value))}
                    className="w-full h-4 bg-[#8B8B8B] appearance-none cursor-pointer border-2 border-black/20"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-[#A0A0A0] border-2 border-black/20 md:col-span-2">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-500" />
                      <label className="text-sm font-bold text-[#555555] uppercase">Performance Mode</label>
                    </div>
                    <span className="text-xs text-[#555555]">Reduces render distance and disables heavy effects for smoother gameplay</span>
                  </div>
                  <button 
                    onClick={() => {
                      const newMode = !settings.performanceMode;
                      if (newMode) {
                        settingsManager.updateSettings({ 
                          performanceMode: true,
                          renderDistance: Math.min(settings.renderDistance, 4),
                          premiumShaders: false
                        });
                      } else {
                        settingsManager.updateSettings({ performanceMode: false });
                      }
                    }}
                    className={`w-12 h-6 rounded-full transition-colors relative ${settings.performanceMode ? 'bg-green-500' : 'bg-[#555555]'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.performanceMode ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                <div className={`flex items-center justify-between p-3 bg-[#A0A0A0] border-2 border-black/20 md:col-span-2 ${settings.performanceMode ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="flex flex-col">
                    <label className="text-sm font-bold text-[#555555] uppercase">Premium Shaders</label>
                    <span className="text-xs text-[#555555]">Enables Real-time Shadows, Water Waves, and Wind</span>
                  </div>
                  <button 
                    disabled={settings.performanceMode}
                    onClick={() => handleChange('premiumShaders', !settings.premiumShaders)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${settings.premiumShaders ? 'bg-green-500' : 'bg-[#555555]'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.premiumShaders ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </div>
            </section>

            {/* Controls */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b-2 border-[#8B8B8B] pb-2">
                <MousePointer2 className="w-5 h-5 text-[#555555]" />
                <h3 className="text-lg font-bold text-[#555555] uppercase">Controls</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-sm font-bold text-[#555555] uppercase">Mouse Sensitivity</label>
                    <span className="text-sm font-bold text-[#555555]">{Math.round(settings.sensitivity * 10000)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.0005" 
                    max="0.01" 
                    step="0.0005"
                    value={settings.sensitivity}
                    onChange={(e) => handleChange('sensitivity', parseFloat(e.target.value))}
                    className="w-full h-4 bg-[#8B8B8B] appearance-none cursor-pointer border-2 border-black/20"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-[#A0A0A0] border-2 border-black/20">
                  <label className="text-sm font-bold text-[#555555] uppercase">Invert Mouse</label>
                  <button 
                    onClick={() => handleChange('invertMouse', !settings.invertMouse)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${settings.invertMouse ? 'bg-green-500' : 'bg-[#555555]'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.invertMouse ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </div>
            </section>

            {/* Audio */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b-2 border-[#8B8B8B] pb-2">
                <Volume2 className="w-5 h-5 text-[#555555]" />
                <h3 className="text-lg font-bold text-[#555555] uppercase">Audio</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-sm font-bold text-[#555555] uppercase">Master Volume</label>
                    <span className="text-sm font-bold text-[#555555]">{Math.round(settings.volume * 100)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.01"
                    value={settings.volume}
                    onChange={(e) => handleChange('volume', parseFloat(e.target.value))}
                    className="w-full h-4 bg-[#8B8B8B] appearance-none cursor-pointer border-2 border-black/20"
                  />
                </div>
              </div>
            </section>

            {/* Keybinds */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b-2 border-[#8B8B8B] pb-2">
                <Keyboard className="w-5 h-5 text-[#555555]" />
                <h3 className="text-lg font-bold text-[#555555] uppercase">Keybinds</h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(settings.keybinds).map(([name, code]) => (
                  <div key={name} className="flex items-center justify-between p-2 bg-[#A0A0A0] border-2 border-black/10">
                    <span className="text-[10px] font-bold text-[#444] uppercase tracking-wider">
                      {name.replace(/([A-Z0-9])/g, ' $1').trim()}
                    </span>
                    <button
                      onClick={() => setRebindingKey(name)}
                      className={`
                        min-w-[80px] px-2 py-1 text-xs font-mono font-bold border-2 
                        ${rebindingKey === name 
                          ? 'bg-yellow-400 border-yellow-600 text-black animate-pulse' 
                          : 'bg-[#C6C6C6] border-[#555555] text-[#333] hover:bg-white'
                        }
                      `}
                    >
                      {rebindingKey === name ? '???' : (code as string).replace('Key', '').replace('Digit', '')}
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Debug */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b-2 border-[#8B8B8B] pb-2">
                <Bug className="w-5 h-5 text-[#555555]" />
                <h3 className="text-lg font-bold text-[#555555] uppercase">Debug</h3>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-[#A0A0A0] border-2 border-black/20">
                <label className="text-sm font-bold text-[#555555] uppercase">Show Debug Info (F3)</label>
                <button 
                  onClick={() => handleChange('showDebug', !settings.showDebug)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${settings.showDebug ? 'bg-green-500' : 'bg-[#555555]'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.showDebug ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            </section>

          </div>

          {/* Footer */}
          <div className="bg-[#8B8B8B] p-4 flex justify-between gap-4 border-t-4 border-[#555555]">
            <button 
              onClick={() => settingsManager.updateSettings(DEFAULT_SETTINGS)}
              className="px-4 py-2 bg-[#A0A0A0] border-t-2 border-l-2 border-white border-b-2 border-r-2 border-[#555555] font-bold text-[#555555] hover:bg-white transition-colors uppercase text-sm"
            >
              Reset to Defaults
            </button>
            <button 
              onClick={() => {
                if (rebindingKey) setRebindingKey(null);
                else onClose();
              }}
              className="px-8 py-2 bg-[#C6C6C6] border-t-2 border-l-2 border-white border-b-2 border-r-2 border-[#555555] font-bold text-[#555555] hover:bg-white transition-colors uppercase tracking-widest shadow-lg"
            >
              {rebindingKey ? 'Cancel' : 'Done'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
