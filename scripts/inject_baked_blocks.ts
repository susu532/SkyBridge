import fs from 'fs';
import path from 'path';

const bakedData = JSON.parse(fs.readFileSync('data/bakedBlocks.json', 'utf8'));

let bakedString = '  bakedBlocks = new Map<string, number>([\n';
const entries = [];
for (const [key, value] of Object.entries(bakedData)) {
    entries.push(`    ["${key}", ${value}]`);
}
bakedString += entries.join(',\n');
bakedString += '\n  ]);';

let worldTs = fs.readFileSync('src/game/World.ts', 'utf8');

worldTs = worldTs.replace(
    /\/\/ BAKED_BLOCKS_START[\s\S]*?\/\/ BAKED_BLOCKS_END/,
    `// BAKED_BLOCKS_START\n` + bakedString + `\n  // BAKED_BLOCKS_END`
);

fs.writeFileSync('src/game/World.ts', worldTs);
console.log('Injected baked blocks into World.ts');
