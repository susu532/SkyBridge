import { ItemType } from './Inventory';
import { ITEM_NAMES } from './Constants';

export enum ItemCategory {
  ALL = 'All',
  BLOCKS = 'Building',
  TOOLS = 'Tools',
  COMBAT = 'Combat',
  FOOD = 'Food',
  REDSTONE = 'Redstone',
  MISC = 'Misc',
}

export function getItemCategory(type: ItemType): ItemCategory {
  const name = ITEM_NAMES[type] || '';
  const nameUpper = name.toUpperCase();

  if (nameUpper.includes('PICKAXE') || nameUpper.includes('SHOVEL') || nameUpper.includes('AXE') || nameUpper.includes('ROD')) {
    if (!nameUpper.includes('BLOCK')) return ItemCategory.TOOLS;
  }

  if (nameUpper.includes('SWORD') || nameUpper.includes('BOW') || nameUpper.includes('ARROW')) {
    return ItemCategory.COMBAT;
  }

  if (nameUpper.includes('APPLE') || nameUpper.includes('BEEF') || nameUpper.includes('BREAD') || nameUpper.includes('WHEAT') || nameUpper.includes('STEAK') || nameUpper.includes('CAKE') || nameUpper.includes('MELON') || nameUpper.includes('PUMPKIN')) {
    return ItemCategory.FOOD;
  }

  if (nameUpper.includes('REDSTONE') || nameUpper.includes('OBSERVER') || nameUpper.includes('TARGET') || nameUpper.includes('DISPENSER') || nameUpper.includes('DROPPER') || nameUpper.includes('DETECTOR') || nameUpper.includes('HOPPER') || nameUpper.includes('LAMP')) {
    return ItemCategory.REDSTONE;
  }

  // Common block keywords
  if (
    nameUpper.includes('LOG') || 
    nameUpper.includes('PLANKS') || 
    nameUpper.includes('LEAVES') || 
    nameUpper.includes('STONE') || 
    nameUpper.includes('DIRT') || 
    nameUpper.includes('GRASS') || 
    nameUpper.includes('SAND') || 
    nameUpper.includes('GLASS') || 
    nameUpper.includes('CONCRETE') || 
    nameUpper.includes('WOOL') || 
    nameUpper.includes('TERRACOTTA') || 
    nameUpper.includes('BRICK') || 
    nameUpper.includes('BLOCK') || 
    nameUpper.includes('ORE') || 
    nameUpper.includes('SLAB') ||
    nameUpper.includes('STAIRS') ||
    nameUpper.includes('OBSIDIAN') ||
    nameUpper.includes('NETHERRACK') ||
    nameUpper.includes('QUARTZ') ||
    nameUpper.includes('ICE') ||
    nameUpper.includes('SNOW') ||
    nameUpper.includes('MUD') ||
    nameUpper.includes('PRISMARINE')
  ) {
    return ItemCategory.BLOCKS;
  }

  return ItemCategory.MISC;
}
