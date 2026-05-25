import { useState, useEffect } from 'react';
import { useUIStore } from '../store/uiStore';
import { useGameStore } from '../store/gameStore';
import { ItemType } from '../game/Inventory';
import { Game } from '../game/Game';

export function LoadoutUI({ game }: { game: Game | null }) {
  const isOpen = useUIStore(state => state.isLoadoutOpen);
  const setIsOpen = useUIStore(state => state.setLoadoutOpen);
  const isMapLoading = useGameStore(state => state.isMapLoading);
  const currentMode = useGameStore(state => state.currentMode);

  // We should track locally if they picked for this connection.
  // When isMapLoading becomes false, we show if haven't picked.
  const [hasPicked, setHasPicked] = useState(true);

  useEffect(() => {
    if (isMapLoading) {
      setHasPicked(false);
    } else if (!hasPicked && currentMode !== 'hub' && currentMode !== 'dungeondelver') {
      setIsOpen(true);
      // Ensure controls unlocked to click
      if (game) {
        document.exitPointerLock?.();
      }
    }
  }, [isMapLoading, hasPicked, currentMode, game]);

  const selectLoadout = (type: 'sword' | 'bow') => {
    if (!game) return;
    
    // Pick loadout
    if (type === 'sword') {
      let count = 0;
      for (const slot of game.player.inventory.slots) {
         if (slot && slot.type === ItemType.WOODEN_SWORD) count += slot.count;
      }
      if (count === 0) game.player.inventory.addItem(ItemType.WOODEN_SWORD, 1);
    } else {
      let count = 0;
      for (const slot of game.player.inventory.slots) {
         if (slot && slot.type === ItemType.WOODEN_SWORD) count += slot.count;
      }
      if (count > 0) {
        game.player.inventory.removeItem(ItemType.WOODEN_SWORD, count);
      }
      game.player.inventory.addItem(ItemType.BOW, 1);
    }

    setHasPicked(true);
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto"
      onPointerDown={e => e.stopPropagation()}
    >
      <div className="mc-panel p-6 flex flex-col items-center gap-6 animate-[slideUpFade_0.3s_ease-out_reverse]">
        <h2 className="text-2xl mc-font text-white mc-text-shadow">Choose Your Loadout</h2>
        
        <div className="flex gap-6">
          <button
            onClick={() => selectLoadout('sword')}
            className="flex flex-col items-center gap-4 bg-[#7B7B7B] border-[3px] border-t-white border-l-white border-b-[#555555] border-r-[#555555] p-6 hover:brightness-110 active:mc-button-shadow transition-all"
          >
            <div className="w-16 h-16 bg-zinc-800 flex items-center justify-center border-2 border-black/50 shadow-inner">
              <span className="text-4xl">🗡️</span>
            </div>
            <span className="text-white font-bold mc-text-shadow text-lg">Warrior</span>
            <span className="text-zinc-300 text-sm max-w-[120px] text-center">Starts with a Wooden Sword</span>
          </button>

          <button
            onClick={() => selectLoadout('bow')}
            className="flex flex-col items-center gap-4 bg-[#7B7B7B] border-[3px] border-t-white border-l-white border-b-[#555555] border-r-[#555555] p-6 hover:brightness-110 active:mc-button-shadow transition-all"
          >
            <div className="w-16 h-16 bg-zinc-800 flex items-center justify-center border-2 border-black/50 shadow-inner">
               <span className="text-4xl" style={{ transform: 'rotate(45deg)' }}>🏹</span>
            </div>
            <span className="text-white font-bold mc-text-shadow text-lg">Archer</span>
            <span className="text-zinc-300 text-sm max-w-[120px] text-center">Starts with a Bow</span>
          </button>
        </div>
      </div>
    </div>
  );
}
