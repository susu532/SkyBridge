import fs from 'fs';
import path from 'path';

// Parse Inventory.ts
const inventoryTs = fs.readFileSync(path.join(process.cwd(), 'src', 'game', 'Inventory.ts'), 'utf-8');

// The easiest way to get the array is to use eval since it's a JS object structure.
// But we need to define ItemType and Rarity.
enum ItemType {
  WOOD = 4, PLANKS = 11, STICK = 13, COAL = 505, TORCH = 186, DIRT = 1, SAND = 6, GRASS = 2,
  WOODEN_PICKAXE = 436, STONE_PICKAXE = 437, IRON_PICKAXE = 438, GOLDEN_PICKAXE = 439, DIAMOND_PICKAXE = 440,
  WOODEN_SWORD = 441, STONE_SWORD = 442, IRON_SWORD = 443, GOLDEN_SWORD = 444, DIAMOND_SWORD = 445,
  WOODEN_SHOVEL = 446, STONE_SHOVEL = 447, IRON_SHOVEL = 448, GOLDEN_SHOVEL = 449, DIAMOND_SHOVEL = 450,
  WOODEN_AXE = 451, STONE_AXE = 452, IRON_AXE = 453, GOLDEN_AXE = 454, DIAMOND_AXE = 455,
  COBBLESTONE = 182, IRON_INGOT = 502, GOLD_INGOT = 503, DIAMOND = 504
}
enum Rarity {
  COMMON = 'COMMON', UNCOMMON = 'UNCOMMON', RARE = 'RARE', EPIC = 'EPIC', LEGENDARY = 'LEGENDARY'
}

let recipesMatch = inventoryTs.match(/export const RECIPES: Recipe\[\] = (\[[\s\S]*?\]);/);
if (recipesMatch) {
  let recipesCode = recipesMatch[1];
  
  // Replace enums with strings temporarily
  const evaluated = eval(`
    (function() {
      const ItemType = ${JSON.stringify(ItemType)};
      const Rarity = ${JSON.stringify(Rarity)};
      return ${recipesCode};
    })()
  `);
  
  // Since we want to keep ItemType keys (e.g. "WOOD"), let's map the inverse mapping.
  const intToItemType = Object.fromEntries(
      Object.entries(ItemType).filter(([k,v]) => typeof v === 'number').map(([k,v]) => [v, k])
  );

  const mapped = evaluated.map(recipe => {
      // replace number inputs with string keys
      const mappedInput = recipe.input.map(input => input === null ? null : intToItemType[input]);
      const mappedOutput = {
          ...recipe.output,
          type: intToItemType[recipe.output.type],
      };
      return {
          ...recipe,
          input: mappedInput,
          output: mappedOutput
      };
  });

  fs.writeFileSync(path.join(process.cwd(), 'data', 'recipes.json'), JSON.stringify(mapped, null, 2));
  console.log("Extracted RECIPES successfully!");
} else {
  console.error("Could not find RECIPES block");
}
