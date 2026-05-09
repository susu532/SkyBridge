import React, { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { Game } from '../game/Game';
import { ITEM_NAMES } from '../game/Constants';
import { ItemIcon } from './inventory/Slot';

export const HotbarUI: React.FC<{ game: Game | null }> = ({ game }) => {
  const inventoryVersion = useGameStore(state => state.inventoryVersion);
  const globalHotbarIndex = useGameStore(state => state.hotbarIndex);
  const setGlobalHotbarIndex = useGameStore(state => state.setHotbarIndex);
  
  const [hotbarItems, setHotbarItems] = useState<(any | null)[]>(new Array(9).fill(null));

  useEffect(() => {
    if (game) {
      setHotbarItems([...game.player.inventory.slots.slice(0, 9)]);
    }
  }, [game, inventoryVersion]);

  if (!game) return null;

  return (
      <div 
        className="absolute bottom-2 md:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-0.5 md:gap-0 p-1 bg-[#C6C6C6] border-t-2 border-l-2 border-white border-b-2 border-r-2 border-[#555555] shadow-2xl pointer-events-auto max-w-[98vw] md:max-w-none overflow-x-auto custom-scrollbar rounded-sm safe-mb"
        onClick={(e) => e.stopPropagation()}
      >
        {hotbarItems.map((item, i) => {
          const isSelected = i === globalHotbarIndex;
          return (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                if (game) {
                  game.player.hotbarIndex = i;
                  setGlobalHotbarIndex(i);
                }
              }}
              title={item ? `${ITEM_NAMES[item.type]} x${item.count}` : undefined}
              className={`
                relative flex items-center justify-center flex-shrink-0 transition-all
                w-10 h-10 sm:w-12 sm:h-12
                ${isSelected 
                  ? 'bg-[#8B8B8B] border-[3px] sm:border-4 border-white z-10 scale-105 sm:scale-110 shadow-xl rounded-sm' 
                  : 'bg-[#8B8B8B] border-2 border-black/20 hover:bg-[#A0A0A0]'
                }
              `}
            >
              {item ? (
                <div className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center">
                  <ItemIcon item={item} />
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
