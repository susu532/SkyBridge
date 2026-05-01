import fs from 'fs';
import path from 'path';

let content = fs.readFileSync('src/server/GameServer.ts', 'utf-8');

// The strategy interface
const gameModeInterface = `import { ChunkManager } from './ChunkManager';

export interface GameModeInfo {
  name: string;
  allowPvP: boolean;
  allowMobSpawns: boolean; // natural
  allowPlayerMobSpawns: boolean; // from client, except bosses
  
  isIndestructible(x: number, y: number, z: number, bakedBlocks: Map<string, number>): boolean;
  getBlockAt(x: number, y: number, z: number, chunkManager: ChunkManager, bakedBlocks: Map<string, number>): number;
  getRespawnPosition(playerId: string): {x: number, y: number, z: number};
}
`;

fs.mkdirSync('src/server/modes', { recursive: true });
fs.writeFileSync('src/server/modes/GameMode.ts', gameModeInterface);

// HubMode
const hubMode = `import { GameModeInfo } from './GameMode';
import { BLOCK, CHUNK_SIZE, WORLD_Y_OFFSET } from '../constants';
import { ChunkManager } from '../ChunkManager';

export class HubMode implements GameModeInfo {
  name = '/hub';
  allowPvP = false;
  allowMobSpawns = false;
  allowPlayerMobSpawns = false;

  isIndestructible(x: number, y: number, z: number, bakedBlocks: Map<string, number>): boolean {
    return true; // Entire hub is indestructible
  }

  getBlockAt(x: number, y: number, z: number, chunkManager: ChunkManager, bakedBlocks: Map<string, number>): number {
    const key = \`\${Math.floor(x)},\${Math.floor(y)},\${Math.floor(z)}\`;
    
    // Portal to SkyBridge (Force at Y=3 floor level)
    if (z === 15 && Math.abs(x) <= 2) {
       if (Math.abs(x) === 2) {
          if (y >= 3 && y <= 7) return BLOCK.OBSIDIAN;
       } else {
          if (y === 7) return BLOCK.OBSIDIAN;
          if (y >= 3 && y <= 6) return BLOCK.LAVA;
       }
    }

    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const chunkType = chunkManager.getBlockFromChunk(cx, cz, lx, Math.floor(y) - WORLD_Y_OFFSET, lz);
    if (chunkType !== undefined) return chunkType;
    
    const distSq = x * x + z * z;
    const dist = Math.sqrt(distSq);
    
    if (distSq <= 7225 && y >= -60 && y <= 0) { // Max radius 85, within world height bounds
      const radiusAtY = Math.sqrt(y + 60) * 11;
      const noise = (Math.sin(x * 0.1) + Math.cos(z * 0.1)) * 4;
      
      if (dist < radiusAtY + noise) {
         if (y === -60) return 1; // Bedrock
         if (y >= -60 && y < 0) return 1; // Stone/Dirt
         if (y === 0) return 115; // Polished Andesite
      }
    }
    return BLOCK.AIR;
  }

  getRespawnPosition(playerId: string): {x: number, y: number, z: number} {
    const rx = (Math.random() - 0.5) * 4;
    const rz = (Math.random() - 0.5) * 4;
    return { x: rx, y: 10, z: rz };
  }
}
`;
fs.writeFileSync('src/server/modes/HubMode.ts', hubMode);

// SkyBridgeMode
const skyBridgeMode = `import { GameModeInfo } from './GameMode';
import { BLOCK, CHUNK_SIZE, WORLD_Y_OFFSET } from '../constants';
import { ChunkManager } from '../ChunkManager';
import { getTerrainHeight, getTerrainMinHeight, noise2D, noise3D } from '../../game/TerrainGenerator';

export class SkyBridgeMode implements GameModeInfo {
  name = '/skybridge';
  allowPvP = true;
  allowMobSpawns = true;
  allowPlayerMobSpawns = true;

  isIndestructible(x: number, y: number, z: number, bakedBlocks: Map<string, number>): boolean {
    const key = \`\${Math.floor(x)},\${Math.floor(y)},\${Math.floor(z)}\`;
    if (bakedBlocks.has(key)) return true;
    if (y === -60) return true; // Bedrock
    
    // Village boundaries (protected area)
    const isBlueVillageZ = z >= 61 && z <= 110;
    const isRedVillageZ = z >= -110 && z <= -61;
    const isVillageX = x >= -50 && x <= 50;
    if (isVillageX && (isBlueVillageZ || isRedVillageZ) && y >= 4) {
      return true;
    }
    return false;
  }

  getBlockAt(x: number, y: number, z: number, chunkManager: ChunkManager, bakedBlocks: Map<string, number>): number {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const chunkType = chunkManager.getBlockFromChunk(cx, cz, lx, Math.floor(y) - WORLD_Y_OFFSET, lz);
    if (chunkType !== undefined) return chunkType;

    const key = \`\${Math.floor(x)},\${Math.floor(y)},\${Math.floor(z)}\`;
    if (bakedBlocks.has(key)) return bakedBlocks.get(key)!;
    
    const isBlueSide = z >= 0;
    const isRedSide = z < 0;
    const isVoid = !isBlueSide && !isRedSide;

    if (isVoid) return BLOCK.AIR;

    const groundY = getTerrainHeight(x, z, false);
    if (y >= groundY && y < groundY + 1) return 1; 
    
    if (y < groundY) {
      const dxBlue = Math.max(0, Math.abs(x) - 50);
      const dzBlue = Math.max(0, 0 - z, z - 110);
      const distBlue = Math.sqrt(dxBlue * dxBlue + dzBlue * dzBlue);

      const dxRed = Math.max(0, Math.abs(x) - 50);
      const dzRed = Math.max(0, -110 - z, z - 0);
      const distRed = Math.sqrt(dxRed * dxRed + dzRed * dzRed);

      const distToProtected = Math.min(distBlue, distRed);
      const isAreaProtected = distToProtected === 0;
      
      const isVillageOrCastle = (x >= -50 && x <= 50) && ((z >= 61 && z <= 410) || (z <= -61 && z >= -410));
      const isProtected = isVillageOrCastle || isAreaProtected;

      const elevationNoise = noise2D(x * 0.001, z * 0.001);
      const isOcean = elevationNoise < -0.5;

      const hasCaves = !isProtected && !isOcean && noise2D(x * 0.01, z * 0.01) > 0.3;
      
      const cy = y + 60;
      const cTerrainHeight = groundY + 60;
      
      if (hasCaves && cy > 1 && cy < cTerrainHeight - 4) {
        let isCave = false;
        const tunnelRadius = 0.08 + noise3D(x * 0.005, cy * 0.005, z * 0.005) * 0.05;
        if (Math.abs(noise3D(x * 0.015, cy * 0.015, z * 0.015)) < tunnelRadius && 
            Math.abs(noise3D(x * 0.015 + 1000, cy * 0.015 + 1000, z * 0.015 + 1000)) < tunnelRadius) {
          isCave = true;
        }
        
        if (noise3D(x * 0.008, cy * 0.01, z * 0.008) > 0.3) {
          isCave = true;
        }

        if (isCave) {
          if (cy < 10) return BLOCK.LAVA;
          return BLOCK.AIR;
        }
      }
      return 1;
    }
    
    return BLOCK.AIR;
  }

  getRespawnPosition(playerId: string): {x: number, y: number, z: number} {
    const rx = (Math.random() - 0.5) * 4;
    const rz = (Math.random() - 0.5) * 4;
    const pZ = (Math.random() > 0.5) ? 1 : -1; // Randomly fallback if we don't have previous state easily accessible here without players list
    // Wait, let's keep it robust by letting game_server pass in the p's current sideZ.
    return { x: rx, y: 207, z: rz };
  }
}
`;
fs.writeFileSync('src/server/modes/SkyBridgeMode.ts', skyBridgeMode);

// SkyCastlesMode
const skyCastlesMode = `import { GameModeInfo } from './GameMode';
import { BLOCK, CHUNK_SIZE, WORLD_Y_OFFSET } from '../constants';
import { ChunkManager } from '../ChunkManager';
import { getTerrainHeight, getTerrainMinHeight, noise2D, noise3D } from '../../game/TerrainGenerator';

export class SkyCastlesMode implements GameModeInfo {
  name: string;
  allowPvP = true;
  allowMobSpawns = false;
  allowPlayerMobSpawns = false;

  constructor(name: string) {
    this.name = name;
  }

  isIndestructible(x: number, y: number, z: number, bakedBlocks: Map<string, number>): boolean {
    const key = \`\${Math.floor(x)},\${Math.floor(y)},\${Math.floor(z)}\`;
    if (bakedBlocks.has(key)) return true;
    if (y === -60) return true;

    const isWithinX = x >= -45 && x <= 45;
    const shipCenter = 450;
    const isBlueShip = z >= (shipCenter - 50) && z <= (shipCenter + 100);
    const isRedShip = z >= -(shipCenter + 100) && z <= -(shipCenter - 50);
    if (isWithinX && (isBlueShip || isRedShip) && y >= 130) {
      return true;
    }

    return false;
  }

  getBlockAt(x: number, y: number, z: number, chunkManager: ChunkManager, bakedBlocks: Map<string, number>): number {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const chunkType = chunkManager.getBlockFromChunk(cx, cz, lx, Math.floor(y) - WORLD_Y_OFFSET, lz);
    if (chunkType !== undefined) return chunkType;

    const key = \`\${Math.floor(x)},\${Math.floor(y)},\${Math.floor(z)}\`;
    if (bakedBlocks.has(key)) return bakedBlocks.get(key)!;
    
    const isBlueSide = z >= 70;
    const isRedSide = z <= -70;
    const isVoid = !isBlueSide && !isRedSide;
    const isBridge = isVoid && x >= -8 && x <= 8;

    if (isBridge) {
      if (y === 0 || (y === 1 && (x === -8 || x === 8))) return 1;
      return BLOCK.AIR;
    }

    if (isVoid) return BLOCK.AIR;
    if (Math.abs(z) >= 550 || Math.abs(x) > 95) return BLOCK.AIR;

    const groundY = getTerrainHeight(x, z, true);
    if (y >= groundY && y < groundY + 1) return 1; 
    
    if (y < groundY) {
      const minH = getTerrainMinHeight(x, z, true);
      if (y < minH) return BLOCK.AIR;
      return 1;
    }
    
    return BLOCK.AIR;  
  }

  getRespawnPosition(playerId: string): {x: number, y: number, z: number} {
    const rx = (Math.random() - 0.5) * 4;
    const rz = (Math.random() - 0.5) * 4;
    return { x: rx, y: 207, z: rz };
  }
}
`;
fs.writeFileSync('src/server/modes/SkyCastlesMode.ts', skyCastlesMode);

console.log("Modes created");
