import * as fs from 'fs';

let data = fs.readFileSync('src/game/World.ts', 'utf8');
data = data.replace(/this\.noise2D/g, 'noise2D');
data = data.replace(/this\.noise3D/g, 'noise3D');
data = data.replace(/this\.getTerrainData\(worldX, worldZ\)/g, 'getTerrainData(worldX, worldZ, this.isSkyCastles, this.isHub, this.worldSize)');

// Remove getTerrainData method
const startIdx = data.indexOf('  getTerrainData(wx: number, wz: number) {');
if (startIdx !== -1) {
  // Find the end of the method
  let openBraces = 0;
  let inMethod = false;
  let endIdx = -1;
  for (let i = startIdx; i < data.length; i++) {
    if (data[i] === '{') {
      openBraces++;
      inMethod = true;
    } else if (data[i] === '}') {
      openBraces--;
      if (inMethod && openBraces === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }
  if (endIdx !== -1) {
    data = data.substring(0, startIdx) + data.substring(endIdx);
  }
}

fs.writeFileSync('src/game/World.ts', data);
