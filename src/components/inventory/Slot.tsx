import React, { memo, useRef, useState, useEffect } from 'react';
import { ItemStack, ItemType } from '../../game/Inventory';
import { ITEM_NAMES } from '../../game/Constants';
import { getTextureAtlasDataUrl, getBlockUVs, isFlatItem, isPlant } from '../../game/TextureAtlas';
import { RARITY_COLORS, Rarity } from '../../game/SkyBridgeManager';
import { motion } from 'motion/react';

export const Slot: React.FC<{ 
  item: ItemStack | null, 
  onClick: (item: ItemStack | null, button: number, isShift: boolean, isEnter: boolean) => void, 
  onDoubleClick?: () => void,
  isResult?: boolean,
  onHover: (item: ItemStack | null) => void,
  isDragging?: boolean,
  dragButton?: number
}> = memo(({ item, onClick, onDoubleClick, isResult, onHover, isDragging, dragButton }) => {
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  const clearTimers = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (progressInterval.current) clearInterval(progressInterval.current);
    setShowProgress(false);
    setProgress(0);
  };

  useEffect(() => clearTimers, []);

  return (
  <div 
    onPointerDown={(e) => {
      e.stopPropagation();
      e.preventDefault();
      
      // Assume left click by default
      const eButton = e.button;
      const isShift = e.shiftKey;
      onClick(item, eButton, isShift, false);
      
      // On mobile (pointerType touch), simulate right-click for splitting item on long press
      if (e.pointerType === 'touch' || window.mobileInputs) {
        clearTimers();
        setShowProgress(true);
        const startTime = Date.now();
        const duration = 500; // 500ms for right-click split
        
        progressInterval.current = setInterval(() => {
          const elapsed = Date.now() - startTime;
          setProgress(Math.min(100, (elapsed / duration) * 100));
        }, 50);

        longPressTimer.current = setTimeout(() => {
          clearTimers();
          // Trigger right-click equivalent
          onClick(item, 2, isShift, false);
        }, duration);
      }
    }}
    onPointerUp={clearTimers}
    onPointerLeave={() => {
      if (onHover) onHover(null);
      clearTimers();
    }}
    onPointerCancel={clearTimers}
    onDoubleClick={(e) => {
      e.preventDefault();
      if (onDoubleClick) onDoubleClick();
    }}
    onMouseEnter={() => {
      if (onHover) onHover(item);
      if (isDragging) onClick(item, dragButton!, false, true);
    }}
    className={`w-[34px] h-[34px] sm:w-10 sm:h-10 mc-slot flex items-center justify-center cursor-pointer hover:bg-[#A0A0A0] transition-colors relative group overflow-hidden`}
    style={{ 
      borderWidth: item?.metadata?.rarity && item.metadata.rarity !== Rarity.COMMON ? '3px' : '2px',
      borderColor: item?.metadata?.rarity ? RARITY_COLORS[item.metadata.rarity] : undefined,
      contentVisibility: 'auto',
      containIntrinsicSize: '34px 34px',
      transform: 'translateZ(0)'
    }}
  >
    {showProgress && progress > 0 && progress < 100 && (
      <div 
        className="absolute bottom-0 left-0 h-1 bg-green-500 z-20"
        style={{ width: `${progress}%` }}
      />
    )}
    <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 pointer-events-none" />
    {item && <ItemIcon item={item} />}
    {(() => {
      const isSword = item?.type && item.type >= 441 && item.type <= 445;
      const isTool = item?.type && ((item.type >= 436 && item.type <= 440) || (item.type >= 446 && item.type <= 455));
      const serverName = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('server') || 'dungeondelver' : 'hub';
      const isSkyCastles = serverName.startsWith('skycastles');
      const shouldShow = item?.metadata?.durability !== undefined && item?.metadata?.maxDurability !== undefined && !isSword && !(isTool && isSkyCastles);
      
      if (!shouldShow) return null;

      return (
        <div className="absolute bottom-0 left-0 w-full h-1 bg-black/50 pointer-events-none z-30">
          <div 
            className="h-full"
            style={{ 
              width: `${(item.metadata!.durability! / item.metadata!.maxDurability!) * 100}%`,
              backgroundColor: (item.metadata!.durability! / item.metadata!.maxDurability!) > 0.5 ? '#00FF00' : (item.metadata!.durability! / item.metadata!.maxDurability!) > 0.2 ? '#FFFF00' : '#FF0000'
            }}
          />
        </div>
      );
    })()}
  </div>
);
}, (prev, next) => {
  if (prev.isDragging !== next.isDragging) return false;
  if (prev.dragButton !== next.dragButton) return false;
  if (prev.isResult !== next.isResult) return false;
  if (prev.onClick !== next.onClick) return false;
  if (prev.onHover !== next.onHover) return false;
  if (prev.onDoubleClick !== next.onDoubleClick) return false;
  
  const p = prev.item;
  const n = next.item;
  if (!p && !n) return true;
  if (!p || !n) return false;
  if (p.type !== n.type) return false;
  if (p.count !== n.count) return false;
  if (p.metadata?.durability !== n.metadata?.durability) return false;
  
  return true;
});

export const ItemIcon = React.memo<{ item: ItemStack }>(({ item }) => {
  const atlasUrl = getTextureAtlasDataUrl();
  const uvs = getBlockUVs(item.type as unknown as number);
  
  if (item.type === ItemType.MINION) {
    return (
      <div className="relative w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center select-none bg-gradient-to-br from-[#FFFF55] to-[#DADA44] rounded-sm border-2 border-black/40 shadow-lg">
        <div className="text-[6px] sm:text-[9px] font-black text-black text-center leading-tight uppercase tracking-tighter">MINION</div>
        {item.count > 1 && (
          <span className="absolute -bottom-1 -right-1 text-[10px] sm:text-[12px] font-bold text-white drop-shadow-[1.5px_1.5px_0_rgba(0,0,0,1)] pointer-events-none z-10">
            {item.count}
          </span>
        )}
      </div>
    );
  }

  if (item.type === ItemType.FLUID_CHOCOLATE_HOSE) {
    return (
      <div className="relative w-[20px] h-[20px] sm:w-[24px] sm:h-[24px] flex items-center justify-center select-none bg-zinc-900 rounded-sm border border-black/80 shadow-md">
        <div className="flex flex-col items-center">
          <div className="w-[4px] h-[5px] bg-[#999999] rounded-t-[1px]"></div>
          <div className="w-[8px] h-[10px] bg-[#3d1c04] rounded-[2px] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] border border-[#261001]"></div>
        </div>
        {item.count > 1 && (
          <span className="absolute -bottom-1 -right-1 text-[10px] sm:text-[12px] font-bold text-white drop-shadow-[1.5px_1.5px_0_rgba(0,0,0,1)] pointer-events-none z-10">
            {item.count}
          </span>
        )}
      </div>
    );
  }

  const flat = isFlatItem(item.type) || isPlant(item.type);

  if (!flat) {
    // 3D Isometric Block Rendering
    const top = uvs[2];
    const side1 = uvs[4];
    const side2 = uvs[5] || uvs[1]; // Use right side if available, fallback to side/back

    return (
      <div className="relative w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center select-none" style={{ perspective: '800px', willChange: 'transform' }}>
        <div className="relative w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center" style={{ transformStyle: 'preserve-3d', transform: 'rotateX(-25deg) rotateY(45deg)', willChange: 'transform' }}>
           {/* Top Face */}
           <div 
             className="absolute w-full h-full bg-no-repeat"
             style={{
               backgroundImage: `url(${atlasUrl})`,
               backgroundSize: '3200% 3200%',
               backgroundPosition: `${(top[0] / 31) * 100}% ${(top[1] / 31) * 100}%`,
               imageRendering: 'pixelated',
               transform: 'rotateX(90deg) translateZ(12px)',
               zIndex: 3,
               willChange: 'transform'
             }}
           />
           {/* Side 1 (Front-Right) */}
           <div 
             className="absolute w-full h-full bg-no-repeat brightness-90"
             style={{
               backgroundImage: `url(${atlasUrl})`,
               backgroundSize: '3200% 3200%',
               backgroundPosition: `${(side2[0] / 31) * 100}% ${(side2[1] / 31) * 100}%`,
               imageRendering: 'pixelated',
               transform: 'translateZ(12px)',
               zIndex: 2,
               willChange: 'transform'
             }}
           />
           {/* Side 2 (Front-Left) - Fixed Transform */}
           <div 
             className="absolute w-full h-full bg-no-repeat brightness-75"
             style={{
               backgroundImage: `url(${atlasUrl})`,
               backgroundSize: '3200% 3200%',
               backgroundPosition: `${(side1[0] / 31) * 100}% ${(side1[1] / 31) * 100}%`,
               imageRendering: 'pixelated',
               transform: 'rotateY(-90deg) translateZ(12px)',
               zIndex: 1,
               willChange: 'transform'
             }}
           />
        </div>
        {item.count > 1 && (
          <span className="absolute -bottom-1 -right-1 text-[10px] sm:text-[12px] font-bold text-white drop-shadow-[1.5px_1.5px_0_rgba(0,0,0,1)] pointer-events-none z-10">
            {item.count}
          </span>
        )}
      </div>
    );
  }

  // 2D Flat Item Rendering
  const face = uvs ? uvs[4] : [0, 0];
  const [x, y] = face;
  
  const isWeaponOrToolOrBow = item?.type && (
    (item.type >= 436 && item.type <= 455) || // tools and swords
    item.type === 461 || item.type === 54     // bow, AOTE
  );
  
  return (
    <div className="relative w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center select-none">
      <motion.div 
        whileHover={{ scale: isWeaponOrToolOrBow ? 1.25 : 1.15, rotate: 5 }}
        className={`w-5 h-5 sm:w-7 sm:h-7 ${isWeaponOrToolOrBow ? 'scale-125 origin-center' : ''}`} 
        style={{ 
          backgroundImage: `url(${atlasUrl})`,
          backgroundSize: '3200% 3200%',
          backgroundPosition: `${(x / 31) * 100}% ${(y / 31) * 100}%`,
          imageRendering: 'pixelated',
          filter: 'drop-shadow(1.5px 1.5px 0px rgba(0,0,0,0.4))'
        }} 
        title={ITEM_NAMES[item.type]}
      />
      {item.count > 1 && (
        <span className="absolute -bottom-1 -right-1 text-[10px] sm:text-[12px] font-bold text-white drop-shadow-[1.5px_1.5px_0_rgba(0,0,0,1)] pointer-events-none z-10">
          {item.count}
        </span>
      )}
      {(() => {
        const isSword = item?.type && item.type >= 441 && item.type <= 445;
        const isTool = item?.type && ((item.type >= 436 && item.type <= 440) || (item.type >= 446 && item.type <= 455));
        const serverName = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('server') || 'dungeondelver' : 'dungeondelver';
        const isSkyCastles = serverName.startsWith('skycastles');
        const shouldShow = item.metadata?.maxDurability && item.metadata.durability !== undefined && !isSword && !(isTool && isSkyCastles);

        if (!shouldShow) return null;

        return (
          <div className="absolute -bottom-[2px] left-0 w-full h-[3px] bg-black pointer-events-none border border-black">
            <div 
              className="h-full transition-all duration-300" 
              style={{ 
                width: `${Math.max(0, (item.metadata!.durability! / item.metadata!.maxDurability!) * 100)}%`,
                backgroundColor: item.metadata!.durability! / item.metadata!.maxDurability! > 0.5 ? '#00FF00' : item.metadata!.durability! / item.metadata!.maxDurability! > 0.2 ? '#FFFF00' : '#FF0000'
              }} 
            />
          </div>
        );
      })()}
    </div>
  );
});
