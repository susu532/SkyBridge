import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const constantsFile = fs.readFileSync(path.join(__dirname, '../src/game/Constants.ts'), 'utf-8');

// Parse ITEM_COLORS
const colorsMatch = constantsFile.match(/export const ITEM_COLORS[^\{]+\{([\s\S]*?)\n\};/);
if (colorsMatch) {
  const colorsMap: Record<string, string> = {};
  const lines = colorsMatch[1].split('\n');
  for (const line of lines) {
    const match = line.match(/\[ItemType\.([^\]]+)\]:\s*'([^']+)'/);
    if (match) {
      colorsMap[match[1]] = match[2];
    }
  }
  fs.writeFileSync(path.join(__dirname, '../data/colors.json'), JSON.stringify(colorsMap, null, 2));
}

const namesMatch = constantsFile.match(/export const ITEM_NAMES[^\{]+\{([\s\S]*?)\n\};/);
if (namesMatch) {
  const namesMap: Record<string, string> = {};
  const lines = namesMatch[1].split('\n');
  for (const line of lines) {
    const match = line.match(/\[ItemType\.([^\]]+)\]:\s*["'](.*)["']/);
    if (match) {
      namesMap[match[1]] = match[2];
    }
  }
  fs.writeFileSync(path.join(__dirname, '../data/names.json'), JSON.stringify(namesMap, null, 2));
}
