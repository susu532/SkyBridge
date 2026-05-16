import React, { memo } from 'react';
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
}> = memo(({ item, onClick, onDoubleClick, isResult, onHover, isDragging, dragButton }) => (
  <div 
    onPointerDown={(e) => {
      e.stopPropagation();
      e.preventDefault();
      onClick(item, e.button, e.shiftKey, false);
    }}
    onDoubleClick={(e) => {
      e.preventDefault();
      if (onDoubleClick) onDoubleClick();
    }}
    onMouseEnter={() => {
      if (onHover) onHover(item);
      if (isDragging) onClick(item, dragButton!, false, true);
    }}
    onMouseLeave={() => {
      if (onHover) onHover(null);
    }}
    className={`w-[34px] h-[34px] sm:w-10 sm:h-10 mc-slot flex items-center justify-center cursor-pointer hover:bg-[#A0A0A0] transition-colors relative group`}
    style={{ 
      borderWidth: item?.metadata?.rarity && item.metadata.rarity !== Rarity.COMMON ? '3px' : '2px',
      borderColor: item?.metadata?.rarity ? RARITY_COLORS[item.metadata.rarity] : undefined,
      contentVisibility: 'auto',
      containIntrinsicSize: '34px 34px',
      transform: 'translateZ(0)'
    }}
  >
    <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 pointer-events-none" />
    {item && <ItemIcon item={item} />}
    {(() => {
      const isSword = item?.type && item.type >= 441 && item.type <= 445;
      const isTool = item?.type && ((item.type >= 436 && item.type <= 440) || (item.type >= 446 && item.type <= 455));
      const serverName = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('server') || 'hub' : 'hub';
      const isSkyCastles = serverName.startsWith('skycastles');
      const shouldShow = item?.metadata?.durability !== undefined && item?.metadata?.maxDurability !== undefined && !isSword && !(isTool && isSkyCastles);
      
      if (!shouldShow) return null;

      return (
        <div className="absolute bottom-0 left-0 w-full h-1 bg-black/50 pointer-events-none">
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
), (prev, next) => {
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
        const serverName = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('server') || 'hub' : 'hub';
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
