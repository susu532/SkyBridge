import { BLOCK } from './TextureAtlas';
import { ItemType } from './Inventory';

export function getMiningStats(
    blockType: number,
    toolItem: any | null,
  ): { time: number; drops: boolean }
 {
    let hardness = 1.5;
    let isStoneBased = false;
    let isDirtBased = false;
    let isWoodBased = false;
    let requiredTier = 0; // 0: hand, 1: wood, 2: stone, 3: iron, 4: diamond

    switch (blockType) {
      // Base materials
      case BLOCK.STONE:
      case BLOCK.BRICK:
      case BLOCK.BLUE_STONE:
      case BLOCK.RED_STONE:
      case BLOCK.TUFF:
      case BLOCK.CALCITE:
      case BLOCK.DRIPSTONE_BLOCK:
      case BLOCK.AMETHYST_BLOCK:
      case BLOCK.BUDDING_AMETHYST:
      case BLOCK.SCULK_CATALYST:
      case BLOCK.LODESTONE:
      case BLOCK.COBBLESTONE:
      case BLOCK.STONE_BRICKS:
      case BLOCK.ANDESITE:
      case BLOCK.DIORITE:
      case BLOCK.GRANITE:
        hardness = 3;
        isStoneBased = true;
        requiredTier = 1;
        break;

      case BLOCK.DEEPSLATE:
      case BLOCK.COBBLED_DEEPSLATE:
      case BLOCK.POLISHED_DEEPSLATE:
      case BLOCK.DEEPSLATE_BRICKS:
      case BLOCK.DEEPSLATE_TILES:
      case BLOCK.REINFORCED_DEEPSLATE:
        hardness = 4.5;
        isStoneBased = true;
        requiredTier = 1;
        break;

      // Ores (T1 = Wood)
      case BLOCK.COAL_ORE:
      case BLOCK.COPPER_ORE:
        hardness = 3;
        isStoneBased = true;
        requiredTier = 1;
        break;
      case BLOCK.DEEPSLATE_COAL_ORE:
      case BLOCK.DEEPSLATE_COPPER_ORE:
        hardness = 4.5;
        isStoneBased = true;
        requiredTier = 1;
        break;

      // Ores (T2 = Stone)
      case BLOCK.IRON_ORE:
      case BLOCK.LAPIS_ORE:
        hardness = 3;
        isStoneBased = true;
        requiredTier = 2;
        break;
      case BLOCK.DEEPSLATE_IRON_ORE:
      case BLOCK.DEEPSLATE_LAPIS_ORE:
        hardness = 4.5;
        isStoneBased = true;
        requiredTier = 2;
        break;

      // Ores (T3 = Iron)
      case BLOCK.GOLD_ORE:
      case BLOCK.REDSTONE_ORE:
      case BLOCK.DIAMOND_ORE:
      case BLOCK.EMERALD_ORE:
      case BLOCK.NETHER_QUARTZ_ORE:
      case BLOCK.NETHER_GOLD_ORE:
        hardness = 3;
        isStoneBased = true;
        requiredTier = 3;
        break;
      case BLOCK.DEEPSLATE_GOLD_ORE:
      case BLOCK.DEEPSLATE_REDSTONE_ORE:
      case BLOCK.DEEPSLATE_DIAMOND_ORE:
      case BLOCK.DEEPSLATE_EMERALD_ORE:
        hardness = 4.5;
        isStoneBased = true;
        requiredTier = 3;
        break;

      // Ores (T4 = Diamond)
      case BLOCK.OBSIDIAN:
      case BLOCK.CRYING_OBSIDIAN:
        hardness = 50;
        isStoneBased = true;
        requiredTier = 4;
        break;

      case BLOCK.WOOD:
      case BLOCK.PLANKS:
        hardness = 2;
        isWoodBased = true;
        break;
      case BLOCK.DIRT:
      case BLOCK.GRASS:
      case BLOCK.SAND:
      case BLOCK.SNOW:
      case BLOCK.MUD:
        hardness = 0.5;
        isDirtBased = true;
        break;
      case BLOCK.MOSS_BLOCK:
        hardness = 0.5;
        isDirtBased = true;
        break;
      case BLOCK.LEAVES:
      case BLOCK.BIRCH_LEAVES:
      case BLOCK.SPRUCE_LEAVES:
      case BLOCK.GLASS:
      case BLOCK.TALL_GRASS:
      case BLOCK.FLOWER_RED:
      case BLOCK.FLOWER_YELLOW:
      case BLOCK.WHEAT:
      case BLOCK.MOSS_CARPET:
      case BLOCK.SPORE_BLOSSOM:
      case BLOCK.CAVE_VINES:
      case BLOCK.AMETHYST_CLUSTER:
      case BLOCK.LARGE_AMETHYST_BUD:
      case BLOCK.CANDLE:
        hardness = 0.1;
        break;
      case BLOCK.SLAB_STONE:
      case BLOCK.SLAB_BLUE_STONE:
      case BLOCK.SLAB_RED_STONE:
        hardness = 2;
        isStoneBased = true;
        requiredTier = 1;
        break;
      case BLOCK.SLAB_WOOD:
        hardness = 2;
        isWoodBased = true;
        break;
      default:
        hardness = 1.5;
        break;
    }

    let toolSpeed = 1;
    let toolTier = 0;

    // Pickaxes
    const isPickaxe =
      toolItem &&
      [
        ItemType.WOODEN_PICKAXE,
        ItemType.STONE_PICKAXE,
        ItemType.IRON_PICKAXE,
        ItemType.GOLDEN_PICKAXE,
        ItemType.DIAMOND_PICKAXE,
      ].includes(toolItem.type);
    // Axes
    const isAxe =
      toolItem &&
      [
        ItemType.WOODEN_AXE,
        ItemType.STONE_AXE,
        ItemType.IRON_AXE,
        ItemType.GOLDEN_AXE,
        ItemType.DIAMOND_AXE,
      ].includes(toolItem.type);
    // Shovels
    const isShovel =
      toolItem &&
      [
        ItemType.WOODEN_SHOVEL,
        ItemType.STONE_SHOVEL,
        ItemType.IRON_SHOVEL,
        ItemType.GOLDEN_SHOVEL,
        ItemType.DIAMOND_SHOVEL,
      ].includes(toolItem.type);
    // Swords
    const isSword =
      toolItem &&
      [
        ItemType.WOODEN_SWORD,
        ItemType.STONE_SWORD,
        ItemType.IRON_SWORD,
        ItemType.GOLDEN_SWORD,
        ItemType.DIAMOND_SWORD,
      ].includes(toolItem.type);

    let isCorrectToolType = false;
    if (isStoneBased && isPickaxe) isCorrectToolType = true;
    else if (isWoodBased && isAxe) isCorrectToolType = true;
    else if (isDirtBased && isShovel) isCorrectToolType = true;
    else if (!isStoneBased) isCorrectToolType = true; // Hand can break non-stone

    if (toolItem) {
      if (
        [
          ItemType.WOODEN_PICKAXE,
          ItemType.WOODEN_AXE,
          ItemType.WOODEN_SHOVEL,
          ItemType.WOODEN_SWORD,
        ].includes(toolItem.type)
      ) {
        toolSpeed = 2;
        toolTier = 1;
      } else if (
        [
          ItemType.STONE_PICKAXE,
          ItemType.STONE_AXE,
          ItemType.STONE_SHOVEL,
          ItemType.STONE_SWORD,
        ].includes(toolItem.type)
      ) {
        toolSpeed = 4;
        toolTier = 2;
      } else if (
        [
          ItemType.IRON_PICKAXE,
          ItemType.IRON_AXE,
          ItemType.IRON_SHOVEL,
          ItemType.IRON_SWORD,
        ].includes(toolItem.type)
      ) {
        toolSpeed = 6;
        toolTier = 3;
      } else if (
        [
          ItemType.DIAMOND_PICKAXE,
          ItemType.DIAMOND_AXE,
          ItemType.DIAMOND_SHOVEL,
          ItemType.DIAMOND_SWORD,
        ].includes(toolItem.type)
      ) {
        toolSpeed = 8;
        toolTier = 4;
      } else if (
        [
          ItemType.GOLDEN_PICKAXE,
          ItemType.GOLDEN_AXE,
          ItemType.GOLDEN_SHOVEL,
          ItemType.GOLDEN_SWORD,
        ].includes(toolItem.type)
      ) {
        toolSpeed = 12;
        toolTier = 1;
      }

      // Swords mine slightly faster in general (like web/leaves) but 1.5x penalty to speed compared to proper tools.
      if (isSword && (isWoodBased || isDirtBased)) {
        toolSpeed /= 1.5;
        isCorrectToolType = true;
      }
    }

    if (isStoneBased && !isPickaxe) {
      toolSpeed = 1;
      toolTier = 0;
      isCorrectToolType = false;
    }
    if (isWoodBased && !isAxe) {
      toolSpeed = 1;
      isCorrectToolType = false;
    }
    if (isDirtBased && !isShovel) {
      toolSpeed = 1;
      isCorrectToolType = false;
    }

    let multiplier = 5.0;
    let drops = false;

    // Stone type blocks require correct tier
    if (isStoneBased) {
      if (isCorrectToolType && toolTier >= requiredTier) {
        multiplier = 1.5;
        drops = true;
      }
    } else {
      drops = true;
      multiplier = isCorrectToolType ? 1.5 : 5.0;
    }

    let time = (hardness * multiplier) / toolSpeed;

    return { time, drops };
  }
