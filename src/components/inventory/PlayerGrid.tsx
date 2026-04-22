import React from 'react';
import { Inventory, ItemStack } from '../../game/Inventory';
import { Slot } from './Slot';

interface PlayerGridProps {
  inventory: Inventory;
  handleSlotInteraction: (type: 'inv' | 'grid', index: number, isHotbar: boolean, button: number, isShift: boolean, isEnter: boolean) => void;
  handleDoubleClick: () => void;
  setHoveredItem: (item: ItemStack | null) => void;
  dragState: { isDragging: boolean; button: number };
}

export const PlayerGrid: React.FC<PlayerGridProps> = ({ inventory, handleSlotInteraction, handleDoubleClick, setHoveredItem, dragState }) => {
  return (
    <div className="grid grid-cols-9 gap-1 mb-4">
      {Array.from({ length: 27 }).map((_, i) => (
        <Slot 
          key={i} 
          item={inventory.slots[i + 9]} 
          onClick={(_, button, isShift, isEnter) => handleSlotInteraction('inv', i, false, button, isShift, isEnter)} 
          onDoubleClick={handleDoubleClick}
          onHover={setHoveredItem}
          isDragging={dragState.isDragging}
          dragButton={dragState.button}
        />
      ))}
    </div>
  );
};
