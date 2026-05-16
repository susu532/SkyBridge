import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Inventory, ItemType, ItemStack, getMaxStack } from '../game/Inventory';
import { ITEM_NAMES } from '../game/Constants';
import { Slot, ItemIcon } from './inventory/Slot';
import { PlayerGrid } from './inventory/PlayerGrid';
import { HotbarGrid } from './inventory/HotbarGrid';
import { audioManager } from '../game/AudioManager';
import { useGameStore } from '../store/gameStore';

function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
  const ref = useRef(callback);
  ref.current = callback;
  return useCallback((...args: any[]) => ref.current(...args), []) as T;
}

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

  const handleSlotAction = useStableCallback((
    slotItem: ItemStack | null,
    sourceGroup: 'chest' | 'inventory' | 'hotbar',
    slotIndex: number,
    button: number,
    isShift: boolean,
    isEnter: boolean = false
  ) => {
    let targetInventory = sourceGroup === 'chest' ? chestInventory : playerInventory;
    const actualIndex = sourceGroup === 'inventory' ? slotIndex + 9 : slotIndex;
    const slotId = `${sourceGroup}-${actualIndex}`;

    if (isEnter) {
      audioManager.play('click', 0.3, 0.8 + Math.random() * 0.4);
      if (heldItemRefState.current) {
        if (button === 0) { // Left drag
          if (!dragState.visitedSlots.has(slotId)) {
            const target = targetInventory.slots[actualIndex];
            if (!target) {
              targetInventory.slots[actualIndex] = { ...heldItemRefState.current, count: 1 };
              const newHeld = { ...heldItemRefState.current, count: heldItemRefState.current.count - 1 };
              setHeldItem(newHeld.count > 0 ? newHeld : null);
              setDragState(prev => ({ ...prev, visitedSlots: new Set(prev.visitedSlots).add(slotId) }));
            }
          }
        } else if (button === 2) { // Right drag
          if (!dragState.visitedSlots.has(slotId)) {
            const target = targetInventory.slots[actualIndex];
            if (!target || target.type === heldItemRefState.current.type) {
              if (!target) {
                targetInventory.slots[actualIndex] = { ...heldItemRefState.current, count: 1 };
              } else if (target.count < getMaxStack(heldItemRefState.current.type)) {
                targetInventory.slots[actualIndex] = { ...target, count: target.count + 1 };
              } else {
                return;
              }
              const newHeld = { ...heldItemRefState.current, count: heldItemRefState.current.count - 1 };
              setHeldItem(newHeld.count > 0 ? newHeld : null);
              setDragState(prev => ({ ...prev, visitedSlots: new Set(prev.visitedSlots).add(slotId) }));
            }
          }
        }
      }
      useGameStore.getState().incrementInventoryVersion();
      return;
    }

    if (heldItemRefState.current && (!slotItem || slotItem.type === heldItemRefState.current.type)) {
      setDragState({ isDragging: true, button, visitedSlots: new Set([slotId]) });
    } else {
      setDragState({ isDragging: false, button: -1, visitedSlots: new Set() });
    }

    if (isShift && slotItem && !heldItemRefState.current) {
      // Instant transfer to the other inventory
      const destinationInv = sourceGroup === 'chest' ? playerInventory : chestInventory;
      const remaining = destinationInv.addItem(slotItem.type, slotItem.count, slotItem.metadata);
      if (remaining === 0) {
        targetInventory.slots[actualIndex] = null;
      } else {
        targetInventory.slots[actualIndex] = { ...slotItem, count: remaining };
      }
      useGameStore.getState().incrementInventoryVersion();
      audioManager.play('click', 0.5, 1.2);
      return;
    }

    let pendingHeld = heldItemRefState.current;
    let nextHeld = pendingHeld;

    if (!pendingHeld && slotItem) {
      if (button === 0) {
        nextHeld = { ...slotItem };
        targetInventory.slots[actualIndex] = null;
        audioManager.play('click', 0.5, 1.2);
      } else if (button === 2) {
        const half = Math.ceil(slotItem.count / 2);
        nextHeld = { ...slotItem, count: half };
        const remainder = slotItem.count - half;
        targetInventory.slots[actualIndex] = remainder > 0 ? { ...slotItem, count: remainder } : null;
        audioManager.play('click', 0.5, 1.2);
      }
    } else if (pendingHeld) {
      if (!slotItem) {
        if (button === 0) {
          targetInventory.slots[actualIndex] = { ...pendingHeld };
          nextHeld = null;
          audioManager.play('click', 0.5, 0.9);
        } else if (button === 2) {
          targetInventory.slots[actualIndex] = { ...pendingHeld, count: 1 };
          nextHeld = { ...pendingHeld, count: pendingHeld.count - 1 };
          if (nextHeld.count === 0) nextHeld = null;
          audioManager.play('click', 0.5, 0.9);
        }
      } else {
        if (slotItem.type === pendingHeld.type) {
          if (button === 0) {
            const maxStack = getMaxStack(slotItem.type);
            const canAdd = Math.min(pendingHeld.count, maxStack - slotItem.count);
            targetInventory.slots[actualIndex] = { ...slotItem, count: slotItem.count + canAdd };
            nextHeld = { ...pendingHeld, count: pendingHeld.count - canAdd };
            if (nextHeld.count === 0) nextHeld = null;
            audioManager.play('click', 0.5, 0.9);
          } else if (button === 2 && slotItem.count < getMaxStack(slotItem.type)) {
            targetInventory.slots[actualIndex] = { ...slotItem, count: slotItem.count + 1 };
            nextHeld = { ...pendingHeld, count: pendingHeld.count - 1 };
            if (nextHeld.count === 0) nextHeld = null;
            audioManager.play('click', 0.5, 0.9);
          }
        } else {
          targetInventory.slots[actualIndex] = { ...pendingHeld };
          nextHeld = { ...slotItem };
          audioManager.play('click', 0.5, 1.0);
        }
      }
    }
    
    setHeldItem(nextHeld);
    useGameStore.getState().incrementInventoryVersion();
  });

  const handleDoubleClick = useStableCallback(() => {
    if (!heldItemRefState.current) return;
    
    let gathered = 0;
    const pendingHeld = heldItemRefState.current;
    const needed = getMaxStack(pendingHeld.type) - pendingHeld.count;
    if (needed <= 0) return;

    // Gather from player inventory
    for (let i = 0; i < 36; i++) {
      const slot = playerInventory.slots[i];
      if (slot && slot.type === pendingHeld.type) {
        const take = Math.min(needed - gathered, slot.count);
        playerInventory.slots[i] = slot.count - take > 0 ? { ...slot, count: slot.count - take } : null;
        gathered += take;
        if (gathered >= needed) break;
      }
    }

    // Gather from chest inventory
    if (gathered < needed) {
      for (let i = 0; i < 27; i++) {
        const slot = chestInventory.slots[i];
        if (slot && slot.type === pendingHeld.type) {
          const take = Math.min(needed - gathered, slot.count);
          chestInventory.slots[i] = slot.count - take > 0 ? { ...slot, count: slot.count - take } : null;
          gathered += take;
          if (gathered >= needed) break;
        }
      }
    }

    if (gathered > 0) {
      setHeldItem({ ...pendingHeld, count: pendingHeld.count + gathered });
      useGameStore.getState().incrementInventoryVersion();
      audioManager.play('click', 0.5, 1.2);
    }
  });

  if (!isOpen) return null;

  const renderTooltip = () => {
    if (!hoveredItem) return null;
    return (
      <div 
        ref={tooltipRef}
        className="fixed pointer-events-none z-[200] mc-panel p-2 text-white shadow-xl max-w-xs scale-75 sm:scale-100 origin-top-left"
      >
        <div className="font-bold mc-text-shadow leading-tight mb-1" style={{ color: '#55FFFF' }}>
          {ITEM_NAMES[hoveredItem.type] || `Unknown Item (${hoveredItem.type})`}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 pointer-events-auto"
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget && heldItem) {
          if (onDropItem) onDropItem(heldItem.type, heldItem.count);
          setHeldItem(null);
        } else if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="transform scale-[0.6] sm:scale-[0.8] md:scale-100 landscape:scale-[0.55] md:landscape:scale-[0.8] xl:landscape:scale-100 origin-center pointer-events-none w-full h-full flex items-center justify-center">
        <div className="pointer-events-auto flex items-center justify-center w-full" onPointerDown={(e) => e.stopPropagation()}>
          <AnimatePresence>
            <motion.div
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.9 }}
               className="mc-panel w-[95%] max-w-2xl flex flex-col p-4 space-y-4 max-h-[95vh] overflow-y-auto custom-scrollbar"
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
                      onClick={(_, button, isShift, isEnter) => handleSlotAction(item, 'chest', i, button, isShift, isEnter)}
                      onDoubleClick={handleDoubleClick}
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
                      onClick={(_, button, isShift, isEnter) => handleSlotAction(item, 'inventory', i, button, isShift, isEnter)}
                      onDoubleClick={handleDoubleClick}
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
                      onClick={(_, button, isShift, isEnter) => handleSlotAction(item, 'hotbar', i, button, isShift, isEnter)}
                      onDoubleClick={handleDoubleClick}
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
        </div>
      </div>

      {/* Held Item Render */}
      {heldItem && (
        <div 
          ref={heldItemRef}
          className="fixed pointer-events-none z-[200] -translate-x-1/2 -translate-y-1/2 drop-shadow-lg w-10 h-10 flex items-center justify-center overflow-hidden scale-75 sm:scale-100 origin-center"
          style={{ left: -100, top: -100 }}
        >
           <ItemIcon item={heldItem} />
           {heldItem?.metadata?.durability !== undefined && heldItem?.metadata?.maxDurability !== undefined && (
            <div className="absolute bottom-0 left-0 w-full h-1 bg-black/50 pointer-events-none">
              <div 
                className="h-full"
                style={{ 
                  width: `${(heldItem.metadata.durability / heldItem.metadata.maxDurability) * 100}%`,
                  backgroundColor: (heldItem.metadata.durability / heldItem.metadata.maxDurability) > 0.5 ? '#00FF00' : (heldItem.metadata.durability / heldItem.metadata.maxDurability) > 0.2 ? '#FFFF00' : '#FF0000'
                }}
              />
            </div>
          )}
        </div>
      )}

      {renderTooltip()}
    </div>
  );
});
