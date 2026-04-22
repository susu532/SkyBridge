import fs from 'fs';

const atlasPath = 'src/game/TextureAtlas.ts';
let code = fs.readFileSync(atlasPath, 'utf8');

const colorsData = JSON.parse(fs.readFileSync('data/colors.json', 'utf8'));

// We want to replace hardcoded strings with ITEM_COLORS[BLOCK.XXX] || '###'
// Let's create a map going from hex to BLOCK name
const hexToBlock: Record<string, string> = {};
for (const [key, val] of Object.entries(colorsData)) {
  const hex = (val as string).toLowerCase();
  // Prefer the first one or a specific block?
  // Let's just track all of them if possible.
  if (!hexToBlock[hex]) {
    hexToBlock[hex] = key;
  }
}

// We can just iterate through hexToBlock and replace the occurrences.
let replacedCount = 0;
for (const [hex, blockName] of Object.entries(hexToBlock)) {
  // Replace simple quotes
  const regex1 = new RegExp(`'${hex}'`, 'gi');
  
  code = code.replace(regex1, (match) => {
    replacedCount++;
    return `(ITEM_COLORS[BLOCK.${blockName}] || '${hex}')`;
  });
}

fs.writeFileSync('src/game/TextureAtlas_refactored.ts', code);
console.log(`Replaced ${replacedCount} hardcoded colors.`);
