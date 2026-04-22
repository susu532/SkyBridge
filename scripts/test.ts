import fs from 'fs';

const atlasPath = 'src/game/TextureAtlas.ts';
let code = fs.readFileSync(atlasPath, 'utf8');

const colorsData = JSON.parse(fs.readFileSync('data/colors.json', 'utf8'));

for (const [key, val] of Object.entries(colorsData)) {
  const hex = (val as string).toLowerCase();

  // If key is mapped in my code, it might not be matched if they used a different hex.
  // But wait, the prompt says "Refactor TextureAtlas.ts to use colors from data/colors.json instead of hardcoded strings."
}
