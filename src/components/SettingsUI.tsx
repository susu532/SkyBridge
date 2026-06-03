import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { settingsManager, GameSettings, DEFAULT_SETTINGS } from '../game/Settings';
import { networkManager } from '../game/NetworkManager';
import { useGameStore } from '../store/gameStore';
import { X, Settings as SettingsIcon, Monitor, MousePointer2, Volume2, Bug, Zap, Keyboard, Globe } from 'lucide-react';

interface SettingsUIProps {
  isOpen: boolean;
  onClose: () => void;
}

const translations: Record<string, Record<string, string>> = {
  en: {
    settingsTitle: "Settings Configuration",
    graphics: "Graphics",
    renderDistance: "Render Distance",
    fov: "Field of View (FOV)",
    performanceMode: "Performance Mode",
    performanceDesc: "Reduces render distance and disables heavy effects for smoother gameplay",
    premiumShaders: "Premium Shaders",
    shadersDesc: "Enables Real-time Shadows, Water Waves, and Wind",
    controls: "Controls",
    sensitivity: "Mouse Sensitivity",
    invertMouse: "Invert Mouse",
    audio: "Audio",
    masterVolume: "Master Volume",
    keybinds: "Keybinds",
    debug: "Debug",
    showDebug: "Show Debug Info (F3)",
    resetButton: "Reset to Defaults",
    doneButton: "Done",
    cancelButton: "Cancel",
    languageSection: "Language / Region",
    selectLanguage: "Select Language",
    serverRegion: "Server Region"
  },
  es: {
    settingsTitle: "Configuración de Ajustes",
    graphics: "Gráficos",
    renderDistance: "Distancia de Sombreado",
    fov: "Campo de Visión (FOV)",
    performanceMode: "Modo Rendimiento",
    performanceDesc: "Reduce la distancia de renderizado y desactiva efectos pesados",
    premiumShaders: "Shaders Premium",
    shadersDesc: "Activa sombras en tiempo real, efectos de agua y viento",
    controls: "Controles",
    sensitivity: "Sensibilidad del Ratón",
    invertMouse: "Invertir Ratón",
    audio: "Sonido",
    masterVolume: "Volumen Principal",
    keybinds: "Teclado / Racks",
    debug: "Depurar",
    showDebug: "Mostrar Info de Depuración (F3)",
    resetButton: "Restablecer Ajustes",
    doneButton: "Aceptar",
    cancelButton: "Cancelar",
    languageSection: "Idioma / Region",
    selectLanguage: "Seleccionar Idioma",
    serverRegion: "Región del Servidor"
  },
  fr: {
    settingsTitle: "Configuration des Options",
    graphics: "Graphismes",
    renderDistance: "Distance d'Affichage",
    fov: "Champ de Vision (FOV)",
    performanceMode: "Mode Performance",
    performanceDesc: "Réduit la distance d'affichage et désactive les effets pour plus de fluidité",
    premiumShaders: "Shaders Premium",
    shadersDesc: "Active les ombres en temps réel, les vagues et le vent",
    controls: "Contrôles",
    sensitivity: "Sensibilité de la Souris",
    invertMouse: "Inverser la Souris",
    audio: "Audio",
    masterVolume: "Volume Principal",
    keybinds: "Raccourcis clavier",
    debug: "Débogage",
    showDebug: "Afficher les Infos de Débug (F3)",
    resetButton: "Réinitialiser",
    doneButton: "Confirmer",
    cancelButton: "Annuler",
    languageSection: "Langue / Région",
    selectLanguage: "Sélectionner la Langue",
    serverRegion: "Région du Serveur"
  },
  de: {
    settingsTitle: "Einstellungen Konfiguration",
    graphics: "Grafikeinstellungen",
    renderDistance: "Sichtweite",
    fov: "Sichtfeld (FOV)",
    performanceMode: "Leistungsmodus",
    performanceDesc: "Reduziert die Sichtweite und deaktiviert komplexe Effekte für mehr FPS",
    premiumShaders: "Premium Shader",
    shadersDesc: "Aktiviert Echtzeitschatten, Wasserwellen und Windeffekte",
    controls: "Steuerung",
    sensitivity: "Mausempfindlichkeit",
    invertMouse: "Maus umkehren",
    audio: "Audio / Sound",
    masterVolume: "Gesamtlautstärke",
    keybinds: "Tastenbelegung",
    debug: "Analysedaten",
    showDebug: "Debug-Informationen (F3)",
    resetButton: "Zurücksetzen",
    doneButton: "Fertig",
    cancelButton: "Abbrechen",
    languageSection: "Sprache / Region",
    selectLanguage: "Sprache Auswählen",
    serverRegion: "Server Region"
  }
};

export const SettingsUI: React.FC<SettingsUIProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<GameSettings>(settingsManager.getSettings());
  const [initialRegion] = useState(settings.serverRegion);
  const [rebindingKey, setRebindingKey] = useState<string | null>(null);

  useEffect(() => {
    return settingsManager.subscribe(setSettings);
  }, []);

  useEffect(() => {
    if (!rebindingKey) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.stopImmediatePropagation();
      e.preventDefault();
      if (e.code === 'Escape') {
        setRebindingKey(null);
        return;
      }
      
      const isDuplicate = Object.entries(settings.keybinds).find(([key, code]) => code === e.code && key !== rebindingKey);
      if (isDuplicate) {
        alert("This keybind is already in use for: " + isDuplicate[0]);
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

  const handleClose = () => {
    if (initialRegion !== settingsManager.getSettings().serverRegion) {
      networkManager.initMatchmaking(useGameStore.getState().currentMode);
    }
    onClose();
  };

  if (!isOpen) return null;

  const currentLang = settings.language || 'en';
  const t = translations[currentLang] || translations.en;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 pointer-events-auto"
        onPointerDown={(e) => {
          e.stopPropagation();
          if (e.target === e.currentTarget && !rebindingKey) {
             handleClose();
          }
        }}
      >
        <div 
           className="w-full max-w-2xl transform landscape:scale-[0.55] sm:landscape:scale-[0.6] md:landscape:scale-[0.8] xl:landscape:scale-100 origin-center"
           onPointerDown={(e) => e.stopPropagation()}
        >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-[#C6C6C6] border-t-4 border-l-4 border-white border-b-4 border-r-4 border-[#555555] w-full overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-[#8B8B8B] p-4 flex items-center justify-between border-b-4 border-[#555555]">
            <div className="flex items-center gap-3">
              <SettingsIcon className="w-6 h-6 text-white drop-shadow-[2px_2px_0_rgba(0,0,0,1)] animate-[spin_10s_linear_infinite]" />
              <h2 className="text-2xl font-bold text-white drop-shadow-[2px_2px_0_rgba(0,0,0,1)] uppercase tracking-wider">
                {t.settingsTitle}
              </h2>
            </div>
            <button 
              onClick={() => {
                if (rebindingKey) setRebindingKey(null);
                else handleClose();
              }}
              className="p-1 hover:bg-white/20 transition-colors rounded"
            >
              <X className="w-6 h-6 text-white drop-shadow-[2px_2px_0_rgba(0,0,0,1)]" />
            </button>
          </div>

          {/* Settings Options Scroll Box */}
          <div className="p-6 h-[55vh] md:h-[60vh] overflow-y-auto custom-scrollbar space-y-8 bg-[#C6C6C6] select-none text-left">
            
            {/* Language Selection Section */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b-2 border-[#8B8B8B] pb-2">
                <Globe className="w-5 h-5 text-[#555555]" />
                <h3 className="text-lg font-bold text-[#555555] uppercase font-sans">
                  {t.languageSection}
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1 bg-[#A0A0A0] p-3 border-2 border-black/10">
                  <label className="text-xs font-bold text-[#333] uppercase block">
                    {t.selectLanguage}
                  </label>
                  <select 
                    value={settings.language || 'en'}
                    onChange={(e) => handleChange('language', e.target.value)}
                    className="w-full text-sm font-bold bg-[#C6C6C6] border-2 border-black/30 text-[#222] px-2 py-1.5 focus:outline-none uppercase font-mono"
                  >
                    <option value="en">English (US)</option>
                    <option value="es">Español (ES)</option>
                    <option value="fr">Français (FR)</option>
                    <option value="de">Deutsch (DE)</option>
                  </select>
                </div>
                <div className="space-y-1 bg-[#A0A0A0] p-3 border-2 border-black/10">
                  <label className="text-xs font-bold text-[#333] uppercase block">
                    {t.serverRegion || "Server Region"}
                  </label>
                  <select 
                    value={settings.serverRegion || 'auto'}
                    onChange={(e) => handleChange('serverRegion', e.target.value)}
                    className="w-full text-sm font-bold bg-[#C6C6C6] border-2 border-black/30 text-[#222] px-2 py-1.5 focus:outline-none uppercase font-mono"
                  >
                    <option value="auto">Auto (Fastest)</option>
                    <option value="eu">Europe</option>
                    <option value="us">US East</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Graphics */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b-2 border-[#8B8B8B] pb-2">
                <Monitor className="w-5 h-5 text-[#555555]" />
                <h3 className="text-lg font-bold text-[#555555] uppercase font-sans">{t.graphics}</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={`space-y-2 ${settings.performanceMode ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="flex justify-between">
                    <label className="text-sm font-bold text-[#555555] uppercase font-sans">{t.renderDistance}</label>
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
                    <label className="text-sm font-bold text-[#555555] uppercase font-sans">{t.fov}</label>
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
                      <label className="text-sm font-bold text-[#555555] uppercase">{t.performanceMode}</label>
                    </div>
                    <span className="text-xs text-[#555555]">{t.performanceDesc}</span>
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
                    className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${settings.performanceMode ? 'bg-green-500' : 'bg-[#555555]'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.performanceMode ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                <div className={`flex items-center justify-between p-3 bg-[#A0A0A0] border-2 border-black/20 md:col-span-2 ${settings.performanceMode ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="flex flex-col">
                    <label className="text-sm font-bold text-[#555555] uppercase">{t.premiumShaders}</label>
                    <span className="text-xs text-[#555555]">{t.shadersDesc}</span>
                  </div>
                  <button 
                    disabled={settings.performanceMode}
                    onClick={() => handleChange('premiumShaders', !settings.premiumShaders)}
                    className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${settings.premiumShaders ? 'bg-green-500' : 'bg-[#555555]'}`}
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
                <h3 className="text-lg font-bold text-[#555555] uppercase font-sans">{t.controls}</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-sm font-bold text-[#555555] uppercase">{t.sensitivity}</label>
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
                  <label className="text-sm font-bold text-[#555555] uppercase">{t.invertMouse}</label>
                  <button 
                    onClick={() => handleChange('invertMouse', !settings.invertMouse)}
                    className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${settings.invertMouse ? 'bg-green-500' : 'bg-[#555555]'}`}
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
                <h3 className="text-lg font-bold text-[#555555] uppercase font-sans">{t.audio}</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-sm font-bold text-[#555555] uppercase">{t.masterVolume}</label>
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
                <h3 className="text-lg font-bold text-[#555555] uppercase font-sans">{t.keybinds}</h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(settings.keybinds)
                  .filter(([name]) => name !== 'fly')
                  .map(([name, code]) => (
                    <div key={name} className="flex items-center justify-between p-2 bg-[#A0A0A0] border-2 border-black/10">
                    <span className="text-[10px] font-bold text-[#444] uppercase tracking-wider">
                      {name.replace(/([A-Z0-9])/g, ' $1').trim()}
                    </span>
                    <button
                      onClick={() => setRebindingKey(name)}
                      className={`
                        min-w-[85px] px-2 py-1 text-xs font-mono font-bold border-2 
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
                <h3 className="text-lg font-bold text-[#555555] uppercase font-sans">{t.debug}</h3>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-[#A0A0A0] border-2 border-black/20">
                <label className="text-sm font-bold text-[#555555] uppercase">{t.showDebug}</label>
                <button 
                  onClick={() => handleChange('showDebug', !settings.showDebug)}
                  className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${settings.showDebug ? 'bg-green-500' : 'bg-[#555555]'}`}
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
              {t.resetButton}
            </button>
            <button 
              onClick={() => {
                if (rebindingKey) setRebindingKey(null);
                else handleClose();
              }}
              className="px-8 py-2 bg-[#C6C6C6] border-t-2 border-l-2 border-white border-b-2 border-r-2 border-[#555555] font-bold text-[#555555] hover:bg-white transition-colors uppercase tracking-widest shadow-lg"
            >
              {rebindingKey ? t.cancelButton : t.doneButton}
            </button>
          </div>
        </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
