import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Inventory, ItemType, ItemStack } from '../game/Inventory';
import { ITEM_NAMES } from '../game/Constants';
import { Slot } from './inventory/Slot';
import { PlayerGrid } from './inventory/PlayerGrid';
import { HotbarGrid } from './inventory/HotbarGrid';
import { audioManager } from '../game/AudioManager';
import { useGameStore } from '../store/gameStore';

export const ChestUI = React.memo<{
  playerInventory: Inventory;
  chestInventory: Inventory;
  isOpen: boolean;
  onClose: () => void;
  onDropItem?: (type: ItemType, count: number) => void;
}>(({ playerInventory, chestInventory, isOpen, onClose, onDropItem }) => {
  const [heldItem, setHeldItem] = useState<ItemStack | null>(null);
  const [hoveredItem, setHoveredItem] = useState<ItemStack | null>(null);
  const heldItemRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const inventoryVersion = useGameStore(state => state.inventoryVersion);

  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    button: number;
    visitedSlots: Set<string>;
  }>({ isDragging: false, button: -1, visitedSlots: new Set() });

  useEffect(() => {
    const handleMouseUp = () => setDragState({ isDragging: false, button: -1, visitedSlots: new Set() });
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const heldItemRefState = useRef(heldItem);
  heldItemRefState.current = heldItem;

  useEffect(() => {
    if (!isOpen) {
      if (heldItemRefState.current) {
        const remaining = playerInventory.addItem(heldItemRefState.current.type, heldItemRefState.current.count, heldItemRefState.current.metadata);
        if (remaining > 0 && onDropItem) {
          onDropItem(heldItemRefState.current.type, remaining);
        }
      }
      setHeldItem(null);
      setHoveredItem(null);
    }
  }, [isOpen, playerInventory]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (heldItemRef.current) {
        heldItemRef.current.style.left = `${e.clientX}px`;
        heldItemRef.current.style.top = `${e.clientY}px`;
      }
      if (tooltipRef.current) {
        tooltipRef.current.style.left = `${e.clientX + 15}px`;
        tooltipRef.current.style.top = `${e.clientY - 15}px`;
      }
    };

    if (isOpen) {
      audioManager.play('chest_open', 0.5, 1.0);
      window.addEventListener('mousemove', handleMouseMove);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        audioManager.play('chest_close', 0.5, 1.0);
      };
    }
  }, [isOpen]);

  const handleSlotAction = useCallback((
    slotItem: ItemStack | null,
    sourceGroup: 'chest' | 'inventory' | 'hotbar',
    slotIndex: number,
    button: number,
    isDragSelect = false
  ) => {
    if (isDragSelect && !heldItemRefState.current) return;
    
    let targetInventory = sourceGroup === 'chest' ? chestInventory : playerInventory;
    let actualIndex = slotIndex;
    if (sourceGroup === 'inventory') actualIndex = slotIndex + 9;

    setHeldItem(prevHeldItem => {
      let currentItem = slotItem;
      let pendingHeld = prevHeldItem;

      if (!pendingHeld && currentItem) {
        if (button === 0) {
          pendingHeld = { ...currentItem };
          targetInventory.slots[actualIndex] = null;
          audioManager.play('click', 0.5, 1.2);
        } else if (button === 2) {
          const half = Math.ceil(currentItem.count / 2);
          pendingHeld = { ...currentItem, count: half };
          const remainder = currentItem.count - half;
          targetInventory.slots[actualIndex] = remainder > 0 ? { ...currentItem, count: remainder } : null;
          audioManager.play('click', 0.5, 1.2);
        }
      } else if (pendingHeld) {
        if (!currentItem) {
          if (button === 0) {
            targetInventory.slots[actualIndex] = { ...pendingHeld };
            pendingHeld = null;
            audioManager.play('click', 0.5, 0.9);
          } else if (button === 2) {
            targetInventory.slots[actualIndex] = { ...pendingHeld, count: 1 };
            pendingHeld.count--;
            if (pendingHeld.count === 0) pendingHeld = null;
            audioManager.play('click', 0.5, 0.9);
          }
        } else {
          if (currentItem.type === pendingHeld.type) {
            if (button === 0) {
              const total = currentItem.count + pendingHeld.count;
              if (total <= 64) {
                targetInventory.slots[actualIndex] = { ...currentItem, count: total };
                pendingHeld = null;
              } else {
                targetInventory.slots[actualIndex] = { ...currentItem, count: 64 };
                pendingHeld.count = total - 64;
              }
              audioManager.play('click', 0.5, 0.9);
            } else if (button === 2 && currentItem.count < 64) {
              targetInventory.slots[actualIndex] = { ...currentItem, count: currentItem.count + 1 };
              pendingHeld.count--;
              if (pendingHeld.count === 0) pendingHeld = null;
              audioManager.play('click', 0.5, 0.9);
            }
          } else {
            targetInventory.slots[actualIndex] = { ...pendingHeld };
            pendingHeld = { ...currentItem };
            audioManager.play('click', 0.5, 1.0);
          }
        }
      }
      
      return pendingHeld;
    });
    useGameStore.getState().incrementInventoryVersion();
  }, [chestInventory, playerInventory]);

  if (!isOpen) return null;

  const renderTooltip = () => {
    if (!hoveredItem) return null;
    return (
      <div 
        ref={tooltipRef}
        className="fixed pointer-events-none z-[100] mc-panel p-2 text-white shadow-xl max-w-xs"
      >
        <div className="font-bold mc-text-shadow leading-tight mb-1" style={{ color: '#55FFFF' }}>
          {ITEM_NAMES[hoveredItem.type] || `Unknown Item (${hoveredItem.type})`}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto"
      onContextMenu={(e) => e.preventDefault()}
    >
      <AnimatePresence>
        <motion.div
           initial={{ opacity: 0, scale: 0.9 }}
           animate={{ opacity: 1, scale: 1 }}
           exit={{ opacity: 0, scale: 0.9 }}
           className="mc-panel w-[95%] max-w-2xl flex flex-col p-4 space-y-4"
        >
          {/* Title */}
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-bold mc-text-shadow text-white uppercase tracking-wide">Chest</h2>
            <button onClick={onClose} className="mc-panel px-3 py-1 text-white hover:bg-[#8B8B8B] mc-text-shadow active:bg-[#555555]">
              X
            </button>
          </div>

          <div className="flex flex-col gap-6 w-full">
            
            {/* Chest Grid */}
            <div className="bg-[#8B8B8B] p-2 border-2 border-t-[#373737] border-l-[#373737] border-b-white border-r-white w-full max-w-md mx-auto">
              <div className="grid grid-cols-9 gap-[2px]">
                {chestInventory.slots.slice(0, 27).map((item, i) => (
                    <Slot
                      key={`chest-${i}`}
                      item={item}
                      onClick={(_, button, isShift, isEnter) => handleSlotAction(item, 'chest', i, button)}
                      onHover={setHoveredItem}
                      isDragging={dragState.isDragging}
                      dragButton={dragState.button}
                    />
                ))}
              </div>
            </div>

            {/* Inventory Divider */}
            <div className="w-full flex justify-center">
              <div className="text-gray-300 font-bold uppercase tracking-widest text-sm mc-text-shadow">Inventory</div>
            </div>

            {/* Player Grid */}
            <div className="flex flex-col items-center gap-[2px]">
              <div className="bg-[#8B8B8B] p-2 border-2 border-t-[#373737] border-l-[#373737] border-b-white border-r-white w-full max-w-md mx-auto">
                <div className="grid grid-cols-9 gap-[2px]">
                  {playerInventory.slots.slice(9, 36).map((item, i) => (
                    <Slot
                      key={`inv-${i}`}
                      item={item}
                      onClick={(_, button, isShift, isEnter) => handleSlotAction(item, 'inventory', i, button)}
                      onHover={setHoveredItem}
                      isDragging={dragState.isDragging}
                      dragButton={dragState.button}
                    />
                  ))}
                </div>
              </div>

              <div className="bg-[#8B8B8B] p-2 border-2 border-t-[#373737] border-l-[#373737] border-b-white border-r-white mt-1 w-full max-w-md mx-auto">
                <div className="grid grid-cols-9 gap-[2px]">
                  {playerInventory.slots.slice(0, 9).map((item, i) => (
                    <Slot
                      key={`hotbar-${i}`}
                      item={item}
                      onClick={(_, button, isShift, isEnter) => handleSlotAction(item, 'hotbar', i, button)}
                      onHover={setHoveredItem}
                      isDragging={dragState.isDragging}
                      dragButton={dragState.button}
                    />
                  ))}
                </div>
              </div>
            </div>

          </div>
        </motion.div>
      </AnimatePresence>

      {/* Held Item Render */}
      {heldItem && (
        <div ref={heldItemRef} className="fixed pointer-events-none z-[90] -translate-x-1/2 -translate-y-1/2 w-8 h-8">
          <Slot item={heldItem} onClick={() => {}} onHover={() => {}} />
        </div>
      )}

      {renderTooltip()}
    </div>
  );
});
