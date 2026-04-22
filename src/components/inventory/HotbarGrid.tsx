import React from 'react';
import { Inventory, ItemStack } from '../../game/Inventory';
import { Slot } from './Slot';

interface HotbarGridProps {
  inventory: Inventory;
  handleSlotInteraction: (type: 'inv' | 'grid', index: number, isHotbar: boolean, button: number, isShift: boolean, isEnter: boolean) => void;
  handleDoubleClick: () => void;
  setHoveredItem: (item: ItemStack | null) => void;
  dragState: { isDragging: boolean; button: number };
}

export const HotbarGrid: React.FC<HotbarGridProps> = ({ inventory, handleSlotInteraction, handleDoubleClick, setHoveredItem, dragState }) => {
  return (
    <div className="grid grid-cols-9 gap-1">
      {Array.from({ length: 9 }).map((_, i) => (
        <Slot 
          key={i} 
          item={inventory.slots[i]} 
          onClick={(_, button, isShift, isEnter) => handleSlotInteraction('inv', i, true, button, isShift, isEnter)} 
          onDoubleClick={handleDoubleClick}
          onHover={setHoveredItem}
          isDragging={dragState.isDragging}
          dragButton={dragState.button}
        />
      ))}
    </div>
  );
};
