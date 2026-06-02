import React, { useEffect, useState, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { Game } from '../game/Game';
import { ITEM_NAMES } from '../game/Constants';
import { ItemIcon } from './inventory/Slot';
import { Mail, X } from 'lucide-react';
import { settingsManager } from '../game/Settings';
import { getSecureBackendUrl } from '../utils/security';

export const HotbarUI: React.FC<{ game: Game | null }> = ({ game }) => {
  const inventoryVersion = useGameStore(state => state.inventoryVersion);
  const globalHotbarIndex = useGameStore(state => state.hotbarIndex);
  const setGlobalHotbarIndex = useGameStore(state => state.setHotbarIndex);
  
  const [hotbarItems, setHotbarItems] = useState<(any | null)[]>(new Array(9).fill(null));

  const [dropProgress, setDropProgress] = useState<{ index: number, progress: number } | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackKeybind, setFeedbackKeybind] = useState(() => settingsManager.getSettings().keybinds.feedback || 'KeyG');

  useEffect(() => {
    return settingsManager.subscribe((settings) => {
      if (settings.keybinds.feedback) {
        setFeedbackKeybind(settings.keybinds.feedback);
      }
    });
  }, []);

  useEffect(() => {
    if (game) {
      setHotbarItems([...game.player.inventory.slots.slice(0, 9)]);
    }
  }, [game, inventoryVersion]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if (e.code === feedbackKeybind) {
        setShowFeedbackModal(prev => {
          const next = !prev;
          if (next) {
            document.exitPointerLock();
            if (game && game.controls) {
              game.controls.unlock();
            }
          }
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [game, feedbackKeybind]);

  const handlePointerDown = (e: React.PointerEvent, i: number) => {
    e.stopPropagation();
    
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (progressInterval.current) clearInterval(progressInterval.current);
    
    setDropProgress({ index: i, progress: 0 });
    
    const startTime = Date.now();
    const duration = 1000; // 1 second to drop
    
    progressInterval.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, (elapsed / duration) * 100);
      setDropProgress({ index: i, progress });
    }, 50);

    longPressTimer.current = setTimeout(() => {
      if (progressInterval.current) clearInterval(progressInterval.current);
      setDropProgress(null);
      if (window.mobileInputs) {
        window.mobileInputs.triggerDrop = true;
      }
    }, duration);
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (progressInterval.current) clearInterval(progressInterval.current);
    setDropProgress(null);
  };

  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, []);

  const sendFeedback = async () => {
    if (!feedbackText.trim()) return;
    try {
      const baseUrl = getSecureBackendUrl(import.meta.env.VITE_BACKEND_URL as string);
      const resp = await fetch(`${baseUrl}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: feedbackText })
      });
      const data = await resp.json();
      if (data.warning) {
        alert("Feedback left locally.\nNotice: " + data.warning + "\n(To forward to Discord, set up a proper Webhook URL in AI Studio variables.)");
      } else {
        alert("Feedback sent successfully!");
      }
    } catch (e) {
      console.error('Failed to send feedback', e);
      alert("Failed to send feedback.");
    }
    setShowFeedbackModal(false);
    setFeedbackText("");
  };

  if (!game) return null;

  return (
    <>
      <div 
        className="absolute bottom-0 sm:bottom-2 md:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-0.5 sm:gap-2 pointer-events-none z-[60] safe-mb transform origin-bottom scale-[0.65] sm:scale-85 md:scale-100 landscape:scale-[0.65] sm:landscape:scale-85 md:landscape:scale-90 lg:landscape:scale-100"
      >
        <div 
          className="flex items-center gap-0.5 sm:gap-0 p-1 bg-[#C6C6C6] border-t-2 border-l-2 border-white border-b-2 border-r-2 border-[#555555] shadow-2xl pointer-events-auto max-w-[100vw] sm:max-w-none overflow-x-auto custom-scrollbar rounded-sm"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {hotbarItems.map((item, i) => {
            const isSelected = i === globalHotbarIndex;
            const showProgress = dropProgress?.index === i && dropProgress.progress > 0 && dropProgress.progress < 100;
            return (
              <button
                key={i}
                onPointerDown={(e) => handlePointerDown(e, i)}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onClick={(e) => {
                  e.stopPropagation();
                  if (game) {
                    game.player.hotbarIndex = i;
                    setGlobalHotbarIndex(i);
                  }
                }}
                title={item ? `${ITEM_NAMES[item.type]} x${item.count}` : undefined}
                className={`
                  relative flex items-center justify-center flex-shrink-0 transition-all overflow-hidden
                  w-10 h-10 sm:w-12 sm:h-12
                  ${isSelected 
                    ? 'bg-[#8B8B8B] border-[3px] sm:border-4 border-white z-10 scale-105 sm:scale-110 shadow-xl rounded-sm' 
                    : 'bg-[#8B8B8B] border-2 border-black/20 hover:bg-[#A0A0A0]'
                  }
                `}
              >
                {showProgress && (
                  <div 
                    className="absolute bottom-0 left-0 h-1.5 bg-green-500 z-20"
                    style={{ width: `${dropProgress.progress}%` }}
                  />
                )}
                {item ? (
                  <div className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center relative">
                    <ItemIcon item={item} />
                    {showProgress && (
                      <div 
                        className="absolute inset-0 bg-green-500/30 z-10"
                        style={{ 
                           clipPath: `polygon(0 0, ${dropProgress.progress}% 0, ${dropProgress.progress}% 100%, 0 100%)`
                        }}
                      />
                    )}
                  </div>
                ) : null}
                <span className="absolute top-0.5 left-1 text-[8px] sm:text-[10px] font-bold text-white/20">
                  {i + 1}
                </span>
              </button>
            );
          })}
        </div>
        
        <button
          onClick={(e) => {
             e.stopPropagation();
             setShowFeedbackModal(true);
             document.exitPointerLock();
             if (game && game.controls) game.controls.unlock();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto bg-[#C6C6C6] border-t-2 border-l-2 border-white border-b-2 border-r-2 border-[#555555] p-2 hover:bg-[#8B8B8B] transition-colors rounded-sm group relative flex-shrink-0 h-12 w-12 sm:h-14 sm:w-14 flex items-center justify-center"
          title={`Send suggestions (Key: ${feedbackKeybind.replace('Key', '')})`}
        >
          <Mail className="w-6 h-6 sm:w-8 sm:h-8 text-[#555555] group-hover:text-white" />
          <span className="absolute -top-3 right-0 bg-black/60 text-white text-[10px] px-1 rounded">{feedbackKeybind.replace('Key', '')}</span>
        </button>
      </div>

      {showFeedbackModal && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm p-4 pointer-events-auto cursor-default"
          onPointerDown={(e) => {
            e.stopPropagation();
            setShowFeedbackModal(false);
          }}
        >
          <div 
            className="bg-[#C6C6C6] border-t-4 border-l-4 border-white border-b-4 border-r-4 border-[#555555] p-6 max-w-md w-full relative"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setShowFeedbackModal(false)}
              className="absolute top-2 right-2 p-1 hover:bg-[#8B8B8B] transition-colors border-t-2 border-l-2 border-white border-b-2 border-r-2 border-[#555555]"
            >
              <X className="w-5 h-5 text-black" />
            </button>
            
            <h2 className="text-xl font-bold text-black mb-4 mc-font">Send Feedback</h2>
            <p className="text-black/80 mb-4 text-sm font-medium">Have ideas or found a bug? Send them directly to the developer!</p>
            
            <textarea
              className="w-full h-32 bg-white border-2 border-[#555555] p-3 text-black resize-none mb-4 focus:outline-none focus:border-blue-500 font-sans"
              placeholder="Type your suggestions here..."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            />
            
            <button 
              onClick={sendFeedback}
              className="w-full bg-[#8B8B8B] hover:bg-[#A0A0A0] text-black font-bold py-3 border-t-2 border-l-2 border-white border-b-2 border-r-2 border-[#555555] active:border-t-2 active:border-l-2 active:border-[#555555] active:border-b-white active:border-r-white transition-all mc-font"
            >
              Submit Feedback
            </button>
          </div>
        </div>
      )}
    </>
  );
};
