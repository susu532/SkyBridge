import React, { useEffect, useState, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { Game } from '../game/Game';
import { ITEM_NAMES } from '../game/Constants';
import { ItemIcon } from './inventory/Slot';

export const HotbarUI: React.FC<{ game: Game | null }> = ({ game }) => {
  const inventoryVersion = useGameStore(state => state.inventoryVersion);
  const globalHotbarIndex = useGameStore(state => state.hotbarIndex);
  const setGlobalHotbarIndex = useGameStore(state => state.setHotbarIndex);
  
  const [hotbarItems, setHotbarItems] = useState<(any | null)[]>(new Array(9).fill(null));

  const [dropProgress, setDropProgress] = useState<{ index: number, progress: number } | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (game) {
      setHotbarItems([...game.player.inventory.slots.slice(0, 9)]);
    }
  }, [game, inventoryVersion]);

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

  if (!game) return null;

  return (
      <div 
        className="absolute bottom-0 sm:bottom-2 md:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-0.5 sm:gap-0 p-1 bg-[#C6C6C6] border-t-2 border-l-2 border-white border-b-2 border-r-2 border-[#555555] shadow-2xl pointer-events-auto max-w-[100vw] sm:max-w-none overflow-x-auto custom-scrollbar rounded-sm safe-mb transform origin-bottom z-[60] scale-[0.65] sm:scale-85 md:scale-100 landscape:scale-[0.45] sm:landscape:scale-75 md:landscape:scale-90 lg:landscape:scale-100"
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
  );
};
