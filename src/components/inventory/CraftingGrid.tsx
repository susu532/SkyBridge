import React from 'react';
import { ItemStack } from '../../game/Inventory';
import { Slot } from './Slot';

interface CraftingGridProps {
  craftingGrid: (ItemStack | null)[];
  craftingResult: ItemStack | null;
  handleSlotInteraction: (type: 'inv' | 'grid', index: number, isHotbar: boolean, button: number, isShift: boolean, isEnter: boolean) => void;
  handleResultClick: (isShift: boolean) => void;
  handleDoubleClick: () => void;
  setHoveredItem: (item: ItemStack | null) => void;
  dragState: { isDragging: boolean; button: number };
}

export const CraftingGrid: React.FC<CraftingGridProps> = ({ 
  craftingGrid, craftingResult, handleSlotInteraction, handleResultClick, handleDoubleClick, setHoveredItem, dragState 
}) => {
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="text-[#373737] text-xs mb-1 self-start">Crafting</div>
      <div className="flex items-center gap-4">
        <div className="grid grid-cols-2 gap-1">
          {craftingGrid.map((item, i) => (
            <Slot 
              key={i} 
              item={item} 
              onClick={(_, button, isShift, isEnter) => handleSlotInteraction('grid', i, false, button, isShift, isEnter)} 
              onDoubleClick={handleDoubleClick}
              onHover={setHoveredItem}
              isDragging={dragState.isDragging}
              dragButton={dragState.button}
            />
          ))}
        </div>
        <div className="text-2xl text-[#373737]">→</div>
        <Slot 
          item={craftingResult} 
          onClick={(_, __, isShift) => handleResultClick(isShift)} 
          onDoubleClick={handleDoubleClick}
          isResult 
          onHover={setHoveredItem}
        />
      </div>
    </div>
  );
};
