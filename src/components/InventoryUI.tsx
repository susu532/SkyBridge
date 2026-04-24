import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Inventory, ItemType, ItemStack, RECIPES, checkRecipe, getDefaultMetadata, getMaxStack } from '../game/Inventory';
import { ITEM_COLORS, ITEM_NAMES } from '../game/Constants';
import { getTextureAtlasDataUrl, getBlockUVs } from '../game/TextureAtlas';
import { RARITY_COLORS, Rarity } from '../game/SkyBridgeManager';
import { audioManager } from '../game/AudioManager';
import { Slot, ItemIcon } from './inventory/Slot';
import { CraftingGrid } from './inventory/CraftingGrid';
import { PlayerGrid } from './inventory/PlayerGrid';
import { HotbarGrid } from './inventory/HotbarGrid';
import { ItemCategory, getItemCategory } from '../game/Categories';

import { useGameStore } from '../store/gameStore';

function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
  const ref = useRef(callback);
  ref.current = callback;
  return useCallback((...args: any[]) => ref.current(...args), []) as T;
}

interface InventoryUIProps {
  inventory: Inventory;
  isOpen: boolean;
  onClose: () => void;
  onDropItem?: (type: ItemType, count: number) => void;
}

export const InventoryUI = React.memo<InventoryUIProps>(({ inventory, isOpen, onClose, onDropItem }) => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'building_blocks'>('inventory');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory>(ItemCategory.ALL);
  const [craftingGrid, setCraftingGrid] = useState<(ItemStack | null)[]>(new Array(4).fill(null));
  const [craftingResult, setCraftingResult] = useState<ItemStack | null>(null);
  const [heldItem, setHeldItem] = useState<ItemStack | null>(null);
  const [hoveredItem, setHoveredItem] = useState<ItemStack | null>(null);
  const heldItemRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const inventoryVersion = useGameStore(state => state.inventoryVersion);
  const skycoins = useGameStore(state => state.skycoins);

  // Dragging state
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    button: number;
    visitedSlots: Set<string>; // "grid-0" or "inv-5"
  }>({ isDragging: false, button: -1, visitedSlots: new Set() });

  useEffect(() => {
    const handleMouseUp = () => {
      setDragState({ isDragging: false, button: -1, visitedSlots: new Set() });
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const heldItemRefState = useRef(heldItem);
  const craftingGridRefState = useRef(craftingGrid);
  heldItemRefState.current = heldItem;
  craftingGridRefState.current = craftingGrid;

  useEffect(() => {
    if (!isOpen) {
      const itemsToReturn: ItemStack[] = [];
      if (heldItemRefState.current) itemsToReturn.push({ ...heldItemRefState.current });
      craftingGridRefState.current.forEach(item => {
        if (item) itemsToReturn.push({ ...item });
      });
      
      itemsToReturn.forEach(item => {
        const remaining = inventory.addItem(item.type, item.count, item.metadata);
        
        // Drop if still remaining
        if (remaining > 0 && onDropItem) {
          onDropItem(item.type, remaining);
        }
      });

      setCraftingGrid(new Array(4).fill(null));
      setHeldItem(null);
      setHoveredItem(null);
    }
  }, [isOpen, inventory]);

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
      audioManager.play('click', 0.5, 0.8);
      window.addEventListener('mousemove', handleMouseMove);
    } else {
      audioManager.play('click', 0.5, 0.6);
    }
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isOpen]);

  useEffect(() => {
    const inputTypes = craftingGrid.map(s => s?.type ?? null);
    const result = checkRecipe(inputTypes, false);
    setCraftingResult(result);
  }, [craftingGrid]);

  const handleSlotInteraction = useStableCallback((type: 'inv' | 'grid', index: number, isHotbar: boolean = false, button: number, isShift: boolean, isEnter: boolean) => {
    if (isEnter) {
      audioManager.play('click', 0.3, 0.8 + Math.random() * 0.4);
      if (heldItem) {
        if (button === 0) { // Left drag: distribute
          // This is complex for a simple state-based UI, but let's do a basic "place if empty"
          const slotId = `${type}-${isHotbar ? index : index + 9}`;
          if (!dragState.visitedSlots.has(slotId)) {
            const actualIndex = isHotbar ? index : index + 9;
            const target = type === 'inv' ? inventory.slots[actualIndex] : craftingGrid[index];
            
            if (!target) {
              if (type === 'inv') {
                inventory.slots[actualIndex] = { type: heldItem.type, count: 1 };
              } else {
                setCraftingGrid(prev => {
                  const next = [...prev];
                  next[index] = { type: heldItem.type, count: 1 };
                  return next;
                });
              }
              heldItem.count--;
              if (heldItem.count <= 0) setHeldItem(null);
              setDragState(prev => ({ ...prev, visitedSlots: new Set(prev.visitedSlots).add(slotId) }));
            }
          }
        } else if (button === 2) { // Right drag: place 1
          const slotId = `${type}-${isHotbar ? index : index + 9}`;
          if (!dragState.visitedSlots.has(slotId)) {
            const actualIndex = isHotbar ? index : index + 9;
            const target = type === 'inv' ? inventory.slots[actualIndex] : craftingGrid[index];
            
            if (!target || target.type === heldItem.type) {
              if (type === 'inv') {
                if (!inventory.slots[actualIndex]) {
                  inventory.slots[actualIndex] = { type: heldItem.type, count: 1 };
                } else if (inventory.slots[actualIndex]!.count < getMaxStack(heldItem.type)) {
                  inventory.slots[actualIndex]!.count++;
                } else {
                  return; // Full
                }
              } else {
                setCraftingGrid(prev => {
                  const next = [...prev];
                  if (!next[index]) {
                    next[index] = { type: heldItem.type, count: 1 };
                  } else if (next[index]!.count < getMaxStack(heldItem.type)) {
                    next[index] = { ...next[index]!, count: next[index]!.count + 1 };
                  }
                  return next;
                });
              }
              heldItem.count--;
              if (heldItem.count <= 0) setHeldItem(null);
              setDragState(prev => ({ ...prev, visitedSlots: new Set(prev.visitedSlots).add(slotId) }));
            }
          }
        }
      }
      useGameStore.getState().incrementInventoryVersion();
      return;
    }

    // Initial click
    setDragState({ isDragging: true, button, visitedSlots: new Set([`${type}-${isHotbar ? index : index + 9}`]) });

    if (type === 'inv') {
      handleSlotClick(index, isHotbar, button === 2, isShift);
    } else {
      handleCraftingClick(index, button === 2);
    }
  });

  const handleSlotClick = useStableCallback((index: number, isHotbar: boolean = false, isRightClick: boolean = false, isShiftClick: boolean = false) => {
    audioManager.play('click', 0.5, 1.0 + Math.random() * 0.2);
    const actualIndex = isHotbar ? index : index + 9;
    const slotItem = inventory.slots[actualIndex];

    if (isShiftClick) {
      if (slotItem) {
        const targetRange = isHotbar ? [9, 35] : [0, 8];
        let remaining = slotItem.count;
        
        for (let i = targetRange[0]; i <= targetRange[1]; i++) {
          const target = inventory.slots[i];
          if (target && target.type === slotItem.type && target.count < getMaxStack(slotItem.type)) {
            const canAdd = Math.min(remaining, getMaxStack(slotItem.type) - target.count);
            target.count += canAdd;
            remaining -= canAdd;
          }
          if (remaining <= 0) break;
        }

        if (remaining > 0) {
          for (let i = targetRange[0]; i <= targetRange[1]; i++) {
            if (!inventory.slots[i]) {
              inventory.slots[i] = { type: slotItem.type, count: remaining };
              remaining = 0;
              break;
            }
          }
        }

        if (remaining <= 0) {
          inventory.slots[actualIndex] = null;
        } else {
          slotItem.count = remaining;
        }
      }
    } else if (isRightClick) {
      if (!heldItem && slotItem) {
        const half = Math.ceil(slotItem.count / 2);
        setHeldItem({ type: slotItem.type, count: half });
        slotItem.count -= half;
        if (slotItem.count <= 0) inventory.slots[actualIndex] = null;
      } else if (heldItem && !slotItem) {
        inventory.slots[actualIndex] = { type: heldItem.type, count: 1 };
        heldItem.count--;
        if (heldItem.count <= 0) setHeldItem(null);
      } else if (heldItem && slotItem && heldItem.type === slotItem.type) {
        if (slotItem.count < getMaxStack(slotItem.type)) {
          slotItem.count++;
          heldItem.count--;
          if (heldItem.count <= 0) setHeldItem(null);
        }
      }
    } else {
      if (heldItem && !slotItem) {
        inventory.slots[actualIndex] = { ...heldItem };
        setHeldItem(null);
      } else if (!heldItem && slotItem) {
        setHeldItem({ ...slotItem });
        inventory.slots[actualIndex] = null;
      } else if (heldItem && slotItem) {
        if (heldItem.type === slotItem.type) {
          const canAdd = Math.min(heldItem.count, getMaxStack(slotItem.type) - slotItem.count);
          slotItem.count += canAdd;
          heldItem.count -= canAdd;
          if (heldItem.count <= 0) setHeldItem(null);
        } else {
          const temp = { ...slotItem };
          inventory.slots[actualIndex] = { ...heldItem };
          setHeldItem(temp);
        }
      }
    }
    useGameStore.getState().incrementInventoryVersion();
  });

  const handleCraftingClick = useStableCallback((index: number, isRightClick: boolean = false) => {
    audioManager.play('click', 0.5, 1.0 + Math.random() * 0.2);
    const slotItem = craftingGrid[index];
    if (isRightClick) {
      if (!heldItem && slotItem) {
        // Split stack
        const half = Math.ceil(slotItem.count / 2);
        setHeldItem({ type: slotItem.type, count: half });
        setCraftingGrid(prev => {
          const next = [...prev];
          const remaining = slotItem.count - half;
          next[index] = remaining > 0 ? { ...slotItem, count: remaining } : null;
          return next;
        });
      } else if (heldItem && (!slotItem || slotItem.type === heldItem.type)) {
        // Place 1
        setCraftingGrid(prev => {
          const next = [...prev];
          if (next[index]) {
            if (next[index]!.count < getMaxStack(heldItem.type)) {
              next[index] = { ...next[index]!, count: next[index]!.count + 1 };
            }
          } else {
            next[index] = { type: heldItem.type, count: 1 };
          }
          return next;
        });
        heldItem.count--;
        if (heldItem.count <= 0) setHeldItem(null);
      }
    } else {
      if (heldItem && !slotItem) {
        setCraftingGrid(prev => {
          const next = [...prev];
          next[index] = { type: heldItem.type, count: 1 };
          return next;
        });
        heldItem.count--;
        if (heldItem.count <= 0) setHeldItem(null);
      } else if (!heldItem && slotItem) {
        setHeldItem({ ...slotItem });
        setCraftingGrid(prev => {
          const next = [...prev];
          next[index] = null;
          return next;
        });
      } else if (heldItem && slotItem) {
        if (heldItem.type === slotItem.type) {
          const canAdd = Math.min(heldItem.count, getMaxStack(slotItem.type) - slotItem.count);
          setCraftingGrid(prev => {
            const next = [...prev];
            next[index] = { ...next[index]!, count: next[index]!.count + canAdd };
            return next;
          });
          heldItem.count -= canAdd;
          if (heldItem.count <= 0) setHeldItem(null);
        } else {
          const temp = { ...slotItem };
          setCraftingGrid(prev => {
            const next = [...prev];
            next[index] = { ...heldItem };
            return next;
          });
          setHeldItem(temp);
        }
      }
    }
    useGameStore.getState().incrementInventoryVersion();
  });

  const handleResultClick = useStableCallback((isShiftClick: boolean = false) => {
    if (!craftingResult) return;
    audioManager.play('pop', 0.6, 1.0 + Math.random() * 0.2);

    if (isShiftClick) {
      let currentGrid = [...craftingGrid];
      let craftedAny = false;
      
      while (true) {
        const inputTypes = currentGrid.map(s => s?.type ?? null);
        const result = checkRecipe(inputTypes, false);
        if (!result) break;

        // Check if we can fit it in inventory
        let remaining = result.count;
        for (let i = 0; i < 36; i++) {
          const slot = inventory.slots[i];
          if (slot && slot.type === result.type && slot.count < getMaxStack(result.type)) {
            remaining -= Math.min(remaining, getMaxStack(result.type) - slot.count);
          }
          if (remaining <= 0) break;
        }
        if (remaining > 0) {
          for (let i = 0; i < 36; i++) {
            if (!inventory.slots[i]) {
              remaining = 0;
              break;
            }
          }
        }

        if (remaining > 0) {
          // Can't fit more in inventory
          break;
        }

        // Actually add to inventory
        let toAdd = result.count;
        for (let i = 0; i < 36; i++) {
          const slot = inventory.slots[i];
          if (slot && slot.type === result.type && slot.count < getMaxStack(result.type)) {
            const canAdd = Math.min(toAdd, getMaxStack(result.type) - slot.count);
            slot.count += canAdd;
            toAdd -= canAdd;
          }
          if (toAdd <= 0) break;
        }
        if (toAdd > 0) {
          for (let i = 0; i < 36; i++) {
            if (!inventory.slots[i]) {
              inventory.slots[i] = { type: result.type, count: toAdd };
              toAdd = 0;
              break;
            }
          }
        }

        craftedAny = true;
        currentGrid = currentGrid.map(s => s ? (s.count > 1 ? { ...s, count: s.count - 1 } : null) : null);
      }
      
      if (craftedAny) {
        setCraftingGrid(currentGrid);
        useGameStore.getState().incrementInventoryVersion();
      }
    } else {
    if (craftingResult && (!heldItem || (heldItem.type === craftingResult.type && heldItem.count + craftingResult.count <= getMaxStack(craftingResult.type)))) {
        if (heldItem) {
          heldItem.count += craftingResult.count;
        } else {
          setHeldItem({ ...craftingResult });
        }
        setCraftingGrid(prev => prev.map(s => s ? (s.count > 1 ? { ...s, count: s.count - 1 } : null) : null));
        useGameStore.getState().incrementInventoryVersion();
      }
    }
  });

  const handleDoubleClick = useStableCallback(() => {
    if (!heldItem) return;
    
    let gathered = 0;
    const needed = getMaxStack(heldItem.type) - heldItem.count;
    if (needed <= 0) return;

    // Gather from inventory
    for (let i = 0; i < 37; i++) {
      const slot = inventory.slots[i];
      if (slot && slot.type === heldItem.type) {
        const take = Math.min(needed - gathered, slot.count);
        slot.count -= take;
        gathered += take;
        if (slot.count <= 0) inventory.slots[i] = null;
        if (gathered >= needed) break;
      }
    }

    // Gather from crafting grid
    if (gathered < needed) {
      const nextGrid = [...craftingGrid];
      let gridChanged = false;
      for (let i = 0; i < 4; i++) {
        const slot = nextGrid[i];
        if (slot && slot.type === heldItem.type) {
          const take = Math.min(needed - gathered, slot.count);
          const remaining = slot.count - take;
          nextGrid[i] = remaining > 0 ? { ...slot, count: remaining } : null;
          gathered += take;
          gridChanged = true;
          if (gathered >= needed) break;
        }
      }
      if (gridChanged) {
        setCraftingGrid(nextGrid);
      }
    }

    if (gathered > 0) {
      setHeldItem(prev => prev ? { ...prev, count: prev.count + gathered } : null);
      useGameStore.getState().incrementInventoryVersion();
    }
  });

  const creativeItems = useMemo(() => {
    const allTypes = Object.values(ItemType)
      .filter((v): v is ItemType => 
        typeof v === 'number' && 
        v > 0 && 
        v !== ItemType.MINION && 
        v !== ItemType.ASPECT_OF_THE_END && 
        !ITEM_NAMES[v]?.startsWith('WATER_') &&
        !!ITEM_NAMES[v]
      );

    return allTypes
      .filter(type => {
        const name = ITEM_NAMES[type]?.toLowerCase() || '';
        const category = getItemCategory(type);
        
        const matchesSearch = name.includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === ItemCategory.ALL || category === selectedCategory;
        
        return matchesSearch && matchesCategory;
      })
      .map(type => {
        return { 
          type, 
          count: getMaxStack(type),
          metadata: getDefaultMetadata(type)
        };
      });
  }, [searchQuery, selectedCategory]);

  const handleCreativeClick = useStableCallback((item: ItemStack | null, button: number) => {
    if (!item) return;
    audioManager.play('click', 0.5, 1.0 + Math.random() * 0.2);
    if (button === 0) {
      setHeldItem({ ...item, count: getMaxStack(item.type) });
    } else if (button === 2) {
      setHeldItem({ ...item, count: 1 });
    }
  });

  const emptyDoubleClick = React.useCallback(() => {}, []);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" 
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && heldItem) {
          if (onDropItem) onDropItem(heldItem.type, heldItem.count);
          setHeldItem(null);
        }
      }}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="mc-panel p-4 shadow-2xl relative mc-font"
      >
        <div className="flex items-center gap-4 mb-4 border-b-2 border-[#373737]/30 pb-2">
          <button 
            className={`font-bold text-lg px-3 py-1 rounded-sm ${activeTab === 'inventory' ? 'bg-[#373737] text-white' : 'text-[#373737] hover:bg-black/10'}`}
            onClick={() => setActiveTab('inventory')}
          >
            Survival Inventory
          </button>
          <button 
            className={`font-bold text-lg px-3 py-1 rounded-sm ${activeTab === 'building_blocks' ? 'bg-[#373737] text-white' : 'text-[#373737] hover:bg-black/10'}`}
            onClick={() => setActiveTab('building_blocks')}
          >
            Building Blocks
          </button>
          
          <div className="flex items-center gap-2 ml-4 px-3 py-1 bg-yellow-400/20 border border-yellow-400/40 rounded-sm text-yellow-600 font-bold">
            <span className="text-sm uppercase tracking-wider opacity-60">Balance:</span>
            <span>{skycoins.toLocaleString()} Skycoins</span>
          </div>

          <button onClick={onClose} className="ml-auto text-[#373737] hover:text-red-600 font-bold px-2 text-xl">✕</button>
        </div>

        {activeTab === 'inventory' ? (
          <>
            <div className="flex gap-8 mb-8">
              <div className="flex flex-col gap-4">
                <div className="w-32 h-48 mc-slot flex items-center justify-center text-[#373737] font-bold">
                  Player
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] uppercase opacity-60 font-bold">Off-hand</span>
                  <Slot 
                    item={inventory.slots[Inventory.OFF_HAND_SLOT]}
                    onClick={(item, button, isShift) => handleSlotInteraction('inv', Inventory.OFF_HAND_SLOT, true, button, isShift, false)}
                    onDoubleClick={() => handleDoubleClick()}
                    onHover={setHoveredItem}
                    isDragging={dragState.isDragging}
                    dragButton={dragState.button}
                  />
                </div>
              </div>

              <div className="flex flex-col items-center justify-center">
                <CraftingGrid 
                  craftingGrid={craftingGrid}
                  craftingResult={craftingResult}
                  handleSlotInteraction={handleSlotInteraction}
                  handleResultClick={handleResultClick}
                  handleDoubleClick={handleDoubleClick}
                  setHoveredItem={setHoveredItem}
                  dragState={dragState}
                />
              </div>
            </div>

            <PlayerGrid 
              inventory={inventory}
              handleSlotInteraction={handleSlotInteraction}
              handleDoubleClick={handleDoubleClick}
              setHoveredItem={setHoveredItem}
              dragState={dragState}
            />
          </>
        ) : (
          <div className="flex gap-4 h-[400px] mb-4">
            {/* Sidebar */}
            <div className="w-40 mc-panel p-2 bg-black/10 overflow-y-auto custom-scrollbar">
              <div className="text-xs font-bold text-[#373737] uppercase mb-2 px-1">Categories</div>
              {Object.values(ItemCategory).map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`w-full text-left px-2 py-1.5 text-sm rounded transition-colors mb-1 ${
                    selectedCategory === cat 
                      ? 'bg-[#373737] text-white shadow-[2px_2px_0_rgba(0,0,0,0.5)]' 
                      : 'text-[#373737] hover:bg-black/5'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col gap-3 min-w-0">
              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 px-4 bg-black/10 border-2 border-[#373737]/20 rounded focus:outline-none focus:border-[#373737] text-[#373737] placeholder-[#373737]/50"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#373737] hover:text-black font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Grid */}
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {creativeItems.length > 0 ? (
                  <div className="grid grid-cols-8 gap-1.5 pb-2">
                    {creativeItems.map((item) => (
                      <Slot
                        key={`creative-${item.type}`}
                        item={item as ItemStack}
                        onClick={handleCreativeClick}
                        onDoubleClick={emptyDoubleClick}
                        onHover={setHoveredItem}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-[#373737]/50 italic">
                    <p>No items found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <HotbarGrid 
          inventory={inventory}
          handleSlotInteraction={handleSlotInteraction}
          handleDoubleClick={handleDoubleClick}
          setHoveredItem={setHoveredItem}
          dragState={dragState}
        />

        {/* Tooltip */}
        {hoveredItem && !heldItem && (
          <div 
            ref={tooltipRef}
            className="fixed z-[200] px-3 py-2 bg-[#100010]/95 border-2 border-[#25015b] text-white text-sm pointer-events-none shadow-xl min-w-[150px] mc-font"
            style={{ left: -1000 }}
          >
            <div 
              className="font-bold text-xl mb-1 mc-text-shadow" 
              style={{ color: RARITY_COLORS[hoveredItem.metadata?.rarity || Rarity.COMMON] }}
            >
              {ITEM_NAMES[hoveredItem.type]}
            </div>
            
            {hoveredItem.metadata?.stats && (
              <div className="space-y-0.5 mb-2 border-b border-white/10 pb-2">
                {Object.entries(hoveredItem.metadata.stats).map(([stat, value]) => {
                  const isBaseStat = stat === 'damage' || stat === 'health' || stat === 'intelligence' || stat === 'defense';
                  const color = stat === 'damage' ? '#FF5555' : (stat === 'strength' ? '#FFAA00' : '#55FF55');
                  
                  return (
                    <div key={stat} className="flex justify-between mc-text-shadow">
                      <span className="text-[#AAAAAA] capitalize">{stat.replace(/([A-Z])/g, ' $1')}:</span>
                      <span className="font-bold" style={{ color }}>{isBaseStat ? "" : "+"}{value}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {hoveredItem.metadata?.description && (
              <div className="text-[#AAAAAA] mb-2 leading-tight mc-text-shadow">
                {hoveredItem.metadata.description}
              </div>
            )}

            {hoveredItem.metadata?.ability && (
              <div className="mb-2 border-t border-white/10 pt-2">
                <div className="text-[#FFFF55] font-bold uppercase text-xs mc-text-shadow">Ability: {hoveredItem.metadata.ability.name}</div>
                <div className="text-[#AAAAAA] text-xs leading-tight mc-text-shadow">{hoveredItem.metadata.ability.description}</div>
                {hoveredItem.metadata.ability.manaCost && (
                  <div className="text-[#55FFFF] text-[10px] mt-1 mc-text-shadow">Mana Cost: {hoveredItem.metadata.ability.manaCost}</div>
                )}
              </div>
            )}

            {hoveredItem.metadata?.durability !== undefined && hoveredItem.metadata?.maxDurability !== undefined && (
              <div className="text-[#AAAAAA] text-xs mt-1 border-t border-white/10 pt-1 mc-text-shadow">
                Durability: {hoveredItem.metadata.durability} / {hoveredItem.metadata.maxDurability}
              </div>
            )}

            <div 
              className="font-bold uppercase tracking-widest mt-1 text-center border-t border-white/10 pt-1 mc-text-shadow"
              style={{ color: RARITY_COLORS[hoveredItem.metadata?.rarity || Rarity.COMMON] }}
            >
              {hoveredItem.metadata?.rarity || Rarity.COMMON}
            </div>
          </div>
        )}

        {heldItem && (
          <div 
            ref={heldItemRef}
            className="fixed pointer-events-none z-[100] -translate-x-1/2 -translate-y-1/2 drop-shadow-lg w-10 h-10 flex items-center justify-center overflow-hidden"
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
      </motion.div>
    </div>
  );
});

