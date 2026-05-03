import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Coins, ShoppingCart, X, ArrowRight, TrendingUp, Info } from 'lucide-react';
import { ItemType, Inventory, ItemStack, getMaxStack } from '../game/Inventory';
import { ITEM_NAMES } from '../game/Constants';
import { NPC, ShopItem } from '../game/NPC';
import { audioManager } from '../game/AudioManager';
import { useGameStore } from '../store/gameStore';
import { Slot } from './inventory/Slot';
import { Rarity, RARITY_COLORS } from '../game/SkyBridgeManager';

interface ShopUIProps {
  npc: NPC | null;
  inventory: Inventory;
  isOpen: boolean;
  onClose: () => void;
}

export const ShopUI = React.memo<ShopUIProps>(({ npc, inventory, isOpen, onClose }) => {
  const inventoryVersion = useGameStore(state => state.inventoryVersion);
  const currentMode = useGameStore(state => state.currentMode);
  const [hoveredItem, setHoveredItem] = useState<ItemStack | null>(null);
  const [tradeOffer, setTradeOffer] = useState<(ItemStack | null)[]>(new Array(10).fill(null));

  // Use a Ref to keep track of the current trade offer for high-frequency event handlers
  const tradeOfferRef = React.useRef<(ItemStack | null)[]>(new Array(10).fill(null));
  React.useEffect(() => {
    tradeOfferRef.current = tradeOffer;
  }, [tradeOffer]);

  const buyItems = useMemo(() => npc?.shopItems.filter(i => i.action !== 'sell') || [], [npc]);
  const sellItems = useMemo(() => npc?.shopItems.filter(i => i.action === 'sell') || [], [npc]);

  // Refund trade offer items when closing
  useEffect(() => {
    return () => {
      let refunded = false;
      tradeOfferRef.current.forEach(item => {
        if (item) {
          inventory.addItem(item.type, item.count, item.metadata);
          refunded = true;
        }
      });
      if (refunded) {
        useGameStore.getState().incrementInventoryVersion();
      }
    };
  }, [inventory]);

  const playerCoins = useGameStore(state => state.skycoins[currentMode] ?? 500);

  const getCurrencyCount = React.useCallback((type: ItemType) => {
    if (type === ItemType.SKYCOIN) return playerCoins;
    let count = 0;
    for (const slot of inventory.slots) {
      if (slot && slot.type === type) count += slot.count;
    }
    return count;
  }, [playerCoins, inventory, inventoryVersion]);

  const handleBuy = React.useCallback((shopItem: ShopItem) => {
    console.log('[ShopUI] handleBuy clicked', shopItem);
    const spendType = shopItem.currency;
    const spendAmount = shopItem.price;
    const gainType = shopItem.type;
    const gainAmount = shopItem.outputAmount || 1;
    const gainMetadata = shopItem.metadata;

    // Get latest coins directly from state to avoid stale closure issues
    const currentCoins = useGameStore.getState().getSkycoins();
    console.log('[ShopUI] currentCoins:', currentCoins, 'spendType:', spendType, 'spendAmount:', spendAmount);

    let spendCount = 0;
    if (spendType === ItemType.SKYCOIN) {
      spendCount = currentCoins;
    } else {
      for (const slot of inventory.slots) {
        if (slot && slot.type === spendType) spendCount += slot.count;
      }
    }

    console.log('[ShopUI] spendCount available:', spendCount);
    if (spendCount >= spendAmount) {
      const removed = inventory.removeItem(spendType, spendAmount);
      console.log('[ShopUI] removeItem returned:', removed);
      if (removed) {
        inventory.addItem(gainType, gainAmount, gainMetadata);
        audioManager.play('pop', 0.6, 1.2);
        useGameStore.getState().incrementInventoryVersion();
      } else {
        audioManager.play('click', 0.3, 0.5);
      }
    } else {
      audioManager.play('click', 0.3, 0.5);
    }
  }, [inventory]);

  const sellItemFromInventory = React.useCallback((invIndex: number) => {
    const item = inventory.slots[invIndex];
    if (!item) return;

    const sellDef = sellItems.find(s => s.type === item.type);
    if (!sellDef) {
      audioManager.play('click', 0.3, 0.5);
      return;
    }

    const currentOffer = tradeOfferRef.current;
    const newOffer = [...currentOffer];
    let remaining = item.count;

    // Try stacking in trade box
    for (let i = 0; i < newOffer.length; i++) {
       if (newOffer[i] && newOffer[i]!.type === item.type) {
         const space = getMaxStack(item.type) - newOffer[i]!.count;
         if (space > 0) {
           const toAdd = Math.min(space, remaining);
           newOffer[i] = { ...newOffer[i]!, count: newOffer[i]!.count + toAdd };
           remaining -= toAdd;
         }
       }
    }

    // New slot in trade box
    if (remaining > 0) {
      for (let i = 0; i < newOffer.length; i++) {
        if (!newOffer[i]) {
          newOffer[i] = { type: item.type, count: remaining, metadata: item.metadata };
          remaining = 0;
          break;
        }
      }
    }

    if (remaining < item.count) {
      audioManager.play('pop', 0.8, 1.5);
      // Update inventory slot immutably
      inventory.slots[invIndex] = remaining > 0 ? { ...item, count: remaining } : null;
      
      // Update both state and ref immediately so next click sees the true state
      tradeOfferRef.current = newOffer;
      setTradeOffer(newOffer);
      useGameStore.getState().incrementInventoryVersion();
    }
  }, [inventory, sellItems]);

  const removeTradeItem = React.useCallback((index: number) => {
    const currentOffer = tradeOfferRef.current;
    const item = currentOffer[index];
    if (!item) return;

    const leftover = inventory.addItem(item.type, item.count, item.metadata);
    const newOffer = [...currentOffer];
    newOffer[index] = leftover > 0 ? { ...item, count: leftover } : null;
    
    audioManager.play('pop', 0.8, 1.3);
    tradeOfferRef.current = newOffer;
    setTradeOffer(newOffer);
    useGameStore.getState().incrementInventoryVersion();
  }, [inventory]);

  const finalizeTrade = React.useCallback(() => {
    let totalGain = 0;
    let itemsProcessed = false;
    const currentOffer = tradeOfferRef.current;

    // Process each slot in the trade offer
    const nextOffer = currentOffer.map(item => {
      if (!item) return null;

      const def = sellItems.find(s => s.type === item.type);
      if (def) {
        const multiples = Math.floor(item.count / (def.price || 1));
        if (multiples > 0) {
          totalGain += multiples * (def.outputAmount || 0);
          itemsProcessed = true;
          
          const remainingCount = item.count - (multiples * (def.price || 1));
          return remainingCount > 0 ? { ...item, count: remainingCount } : null;
        }
      }
      return item; // Keep item if not sellable or not enough for a transaction
    });

    if (itemsProcessed) {
      inventory.addItem(ItemType.SKYCOIN, totalGain);
      audioManager.play('level_up', 0.4, 1.5);
      tradeOfferRef.current = nextOffer;
      setTradeOffer(nextOffer);
      useGameStore.getState().incrementInventoryVersion();
    } else {
      audioManager.play('click', 0.3, 0.5);
    }
  }, [inventory, sellItems]);

  const clearTradeOffer = React.useCallback(() => {
    const currentOffer = tradeOfferRef.current;
    currentOffer.forEach(item => {
      if (item) inventory.addItem(item.type, item.count, item.metadata);
    });
    audioManager.play('pop', 0.6, 0.8);
    const emptyOffer = new Array(10).fill(null);
    tradeOfferRef.current = emptyOffer;
    setTradeOffer(emptyOffer);
    useGameStore.getState().incrementInventoryVersion();
  }, [inventory]);

  const potentialGain = tradeOffer.reduce((sum, item) => {
    if (!item) return sum;
    const def = sellItems.find(s => s.type === item.type);
    return sum + (def ? Math.floor(item.count / (def.price || 1)) * (def.outputAmount || 0) : 0);
  }, 0);

  if (!npc) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 mc-font">
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            className="mc-panel w-[960px] max-w-[95vw] h-[640px] max-h-[90vh] flex flex-col p-0 overflow-hidden relative"
          >
            {/* Hypixel Style Header */}
            <div className="relative h-20 bg-[#373737] border-b-[4px] border-[#222] flex items-center px-8 shrink-0">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white uppercase tracking-wider flex items-center gap-3">
                  <ShoppingCart className="text-yellow-400" />
                  {npc.name}'s Shop
                </h2>
                <div className="flex gap-4 mt-1">
                    <span className="text-[#FFD700] font-bold text-sm flex items-center gap-1.5 bg-black/30 px-3 py-0.5 rounded-full border border-yellow-500/30">
                      <Coins size={14} /> {playerCoins.toLocaleString()} Skycoins
                    </span>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="mc-button-shadow bg-[#373737] w-10 h-10 flex items-center justify-center hover:bg-[#444] text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Main Split Section */}
            <div className="flex flex-1 overflow-hidden">
              {/* Left Section: NPC BUYING */}
              <div className="flex-1 border-r-[4px] border-[#222] flex flex-col p-6 bg-[#C6C6C6]">
                <div className="flex items-center justify-between mb-4 px-1">
                  <h3 className="text-[#373737] font-bold uppercase tracking-tight flex items-center gap-2">
                    <TrendingUp size={18} className="text-green-600" />
                    Buy Items
                  </h3>
                  <span className="text-[10px] text-[#373737] bg-white/50 px-2 py-0.5 rounded leading-none">NPC Stock</span>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                  <div className="grid grid-cols-5 gap-3">
                    {buyItems.map((item, i) => {
                      const canAfford = getCurrencyCount(item.currency) >= item.price;
                      return (
                        <div key={i} className="flex flex-col items-center gap-2">
                          <Slot 
                            item={{ type: item.type, count: item.outputAmount || 1 }}
                            onHover={setHoveredItem}
                            onClick={() => handleBuy(item)}
                          />
                          <div className={`text-[10px] font-bold flex items-center gap-0.5 ${canAfford ? 'text-[#373737]' : 'text-red-700'}`}>
                            {item.price} {item.currency === ItemType.SKYCOIN ? <Coins size={10} /> : <span className="uppercase">{ITEM_NAMES[item.currency]?.substring(0, 3)}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Buy Info Footer */}
                <div className="mt-4 pt-4 border-t-2 border-[#8B8B8B] text-[11px] text-[#373737] leading-relaxed flex items-start gap-2 bg-white/20 p-3 rounded">
                  <Info size={16} className="shrink-0 mt-0.5 opacity-60" />
                  <p>Click items above to purchase directly into your inventory. Some items require specific materials instead of Skycoins.</p>
                </div>
              </div>

              {/* Right Section: PLAYER SELLING */}
              <div className="flex-1 flex flex-col p-6 bg-[#B0B0B0]">
                <div className="flex items-center justify-between mb-4 px-1">
                  <h3 className="text-[#373737] font-bold uppercase tracking-tight flex items-center gap-2">
                    <TrendingUp size={18} className="text-red-600 rotate-180" />
                    Sell Items
                  </h3>
                  <span className="text-[10px] text-[#373737] bg-white/50 px-2 py-0.5 rounded leading-none italic">Sell Items Here</span>
                </div>

                {/* Trade Box (Visualized like an interface) */}
                <div className="mc-slot bg-[#8B8B8B]/50 p-4 mb-6 rounded-md">
                   <div className="flex justify-between items-center mb-2 px-1">
                     <span className="text-[10px] font-bold text-[#373737]/60 uppercase tracking-widest">Trade Area</span>
                     <button 
                       onClick={clearTradeOffer}
                       className="text-[10px] text-red-600 hover:text-red-700 hover:underline uppercase font-bold"
                     >
                       Refund All
                     </button>
                   </div>
                   <div className="grid grid-cols-5 gap-2 mb-4">
                     {tradeOffer.map((item, i) => {
                       const isSellable = item && sellItems.some(s => s.type === item.type);
                       return (
                         <div key={`trade-${i}`} className={item && !isSellable ? 'opacity-40' : ''}>
                           <Slot 
                             item={item}
                             onHover={setHoveredItem}
                             onClick={() => removeTradeItem(i)}
                           />
                         </div>
                       );
                     })}
                   </div>
                   <div className="flex items-center justify-between pt-2 border-t-2 border-[#373737]/20">
                     <div>
                       <div className="text-[10px] uppercase font-bold text-[#373737] opacity-60">Estimated Gain</div>
                       <div className="text-xl font-black text-[#FFD700] mc-text-shadow flex items-center gap-2">
                         + {potentialGain.toLocaleString()} <Coins />
                       </div>
                     </div>
                     <button
                       onClick={finalizeTrade}
                       disabled={potentialGain === 0}
                       className={`px-6 h-10 mc-button-shadow font-bold flex items-center gap-2 transition-all ${
                         potentialGain > 0 ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-gray-400 text-gray-600 grayscale cursor-not-allowed'
                       }`}
                     >
                       SELL <ArrowRight size={18} />
                     </button>
                   </div>
                </div>

                {/* Player Inventory (Quick Pick) */}
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="text-[10px] uppercase font-bold text-[#373737] mb-2 px-1 flex justify-between">
                    <span>Your Goods</span>
                    <span className="opacity-50">Click to add to Sell Box</span>
                  </div>
                  <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar bg-black/5 p-2 rounded">
                    <div className="grid grid-cols-9 md:grid-cols-6 lg:grid-cols-8 gap-1.5 content-start">
                      {inventory.slots.slice(0, 36).map((slot, i) => {
                        const canSell = slot && sellItems.some(s => s.type === slot.type);
                        return (
                          <div 
                            key={`inv-${i}`} 
                            className={`relative ${!canSell && slot ? 'opacity-40 grayscale-[0.5]' : ''}`}
                          >
                            <Slot 
                              item={slot}
                              onHover={setHoveredItem}
                              onClick={() => sellItemFromInventory(i)}
                            />
                            {canSell && (
                              <div className="absolute top-0 right-0 w-2 h-2 bg-green-500 rounded-full border border-white shadow-sm" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Custom Skyblock-ish Tooltip (Floating) */}
            <AnimatePresence>
              {hoveredItem && (
                <motion.div
                   initial={{ opacity: 0, scale: 0.95 }}
                   animate={{ opacity: 1, scale: 1 }}
                   exit={{ opacity: 0, scale: 0.95 }}
                   className="fixed z-[110] pointer-events-none bg-[#111111] border-2 border-[#2b2b2b] p-3 shadow-2xl rounded min-w-[200px]"
                   style={{ 
                     left: '50%', 
                     top: '50%', 
                     transform: 'translate(-50%, -50%)',
                     boxShadow: '0 0 30px rgba(0,0,0,0.8)'
                   }}
                >
                  <div 
                    className="font-bold text-lg mb-0.5 leading-tight"
                    style={{ color: hoveredItem.metadata?.rarity ? RARITY_COLORS[hoveredItem.metadata.rarity as Rarity] : '#FFF' }}
                  >
                    {ITEM_NAMES[hoveredItem.type]}
                  </div>
                  
                  {hoveredItem.metadata?.rarity && (
                    <div 
                      className="text-[10px] font-black uppercase tracking-widest mb-2"
                      style={{ color: RARITY_COLORS[hoveredItem.metadata.rarity as Rarity] }}
                    >
                      {hoveredItem.metadata.rarity}
                    </div>
                  )}

                  <div className="text-gray-400 text-xs leading-relaxed mb-4">
                    {hoveredItem.metadata?.description || "A standard item found in the world."}
                  </div>

                  {/* Price info in tooltip */}
                  {buyItems.find(b => b.type === hoveredItem.type) && (
                    <div className="border-t border-white/10 pt-2 flex justify-between items-center text-[11px]">
                      <span className="text-white/50">Purchase Price</span>
                      <span className="text-yellow-400 font-bold flex items-center gap-1">
                        {buyItems.find(b => b.type === hoveredItem.type)?.price} <Coins size={12} />
                      </span>
                    </div>
                  )}
                  {sellItems.find(s => s.type === hoveredItem.type) && (
                    <div className="pt-1 flex justify-between items-center text-[11px]">
                      <span className="text-white/50">Sell Value</span>
                      <span className="text-green-400 font-bold flex items-center gap-1">
                        {sellItems.find(s => s.type === hoveredItem.type)?.outputAmount || 1} <Coins size={12} />
                      </span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});
