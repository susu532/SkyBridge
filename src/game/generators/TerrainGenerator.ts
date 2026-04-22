import { BLOCK } from '../TextureAtlas';
import { Chunk, CHUNK_HEIGHT } from '../Chunk';

export const BIOMES = {
  SNOWY_TUNDRA: { height: 10, scale: 0.015, topBlock: BLOCK.SNOW, subBlock: BLOCK.DIRT, treeChance: 0.02, plantChance: 0.05, treeType: 'SPRUCE' },
  TAIGA: { height: 20, scale: 0.02, topBlock: BLOCK.GRASS, subBlock: BLOCK.DIRT, treeChance: 0.15, plantChance: 0.05, treeType: 'SPRUCE' },
  SAVANNA: { height: 8, scale: 0.008, topBlock: BLOCK.GRASS, subBlock: BLOCK.DIRT, treeChance: 0.02, plantChance: 0.15, treeType: 'OAK' },
  PLAINS: { height: 5, scale: 0.01, topBlock: BLOCK.GRASS, subBlock: BLOCK.DIRT, treeChance: 0.01, plantChance: 0.2, treeType: 'OAK' },
  FOREST: { height: 15, scale: 0.02, topBlock: BLOCK.GRASS, subBlock: BLOCK.DIRT, treeChance: 0.15, plantChance: 0.1, treeType: 'BIRCH' },
  JUNGLE: { height: 25, scale: 0.025, topBlock: BLOCK.GRASS, subBlock: BLOCK.DIRT, treeChance: 0.3, plantChance: 0.3, treeType: 'JUNGLE' },
  SWAMP: { height: 2, scale: 0.015, topBlock: BLOCK.MUD, subBlock: BLOCK.DIRT, treeChance: 0.08, plantChance: 0.15, treeType: 'OAK' },
  BADLANDS: { height: 25, scale: 0.01, topBlock: BLOCK.RED_SAND, subBlock: BLOCK.TERRACOTTA, treeChance: 0.001, plantChance: 0.02, treeType: 'CACTUS' },
  VOLCANIC: { height: 30, scale: 0.02, topBlock: BLOCK.OBSIDIAN, subBlock: BLOCK.STONE, treeChance: 0, plantChance: 0, treeType: 'NONE' },
  DESERT: { height: 8, scale: 0.01, topBlock: BLOCK.SAND, subBlock: BLOCK.SANDSTONE, treeChance: 0.005, plantChance: 0.05, treeType: 'CACTUS' },
  MOUNTAINS: { height: 60, scale: 0.005, topBlock: BLOCK.STONE, subBlock: BLOCK.STONE, treeChance: 0.005, plantChance: 0.01, treeType: 'SPRUCE' },
  OCEAN: { height: -15, scale: 0.01, topBlock: BLOCK.SAND, subBlock: BLOCK.SAND, treeChance: 0, plantChance: 0, treeType: 'NONE' },
  MUSHROOM_ISLAND: { height: 10, scale: 0.015, topBlock: BLOCK.MYCELIUM, subBlock: BLOCK.DIRT, treeChance: 0.05, plantChance: 0.2, treeType: 'GIANT_MUSHROOM' },
  ICE_SPIKES: { height: 15, scale: 0.02, topBlock: BLOCK.SNOW, subBlock: BLOCK.DIRT, treeChance: 0.05, plantChance: 0, treeType: 'ICE_SPIKE' },
  CHERRY_GROVE: { height: 35, scale: 0.015, topBlock: BLOCK.GRASS, subBlock: BLOCK.DIRT, treeChance: 0.2, plantChance: 0.3, treeType: 'CHERRY' },
  DARK_FOREST: { height: 15, scale: 0.02, topBlock: BLOCK.GRASS, subBlock: BLOCK.DIRT, treeChance: 0.4, plantChance: 0.2, treeType: 'DARK_OAK' }
};

export class TerrainGenerator {
  static getTerrainData(wx: number, wz: number, noise2D: (x: number, y: number) => number) {
    const isBlueSide = wz >= 70;
    const isRedSide = wz <= -70;
    
    const tempNoise = noise2D(wx * 0.002, wz * 0.002);
    const moistNoise = noise2D(wx * 0.002 + 1000, wz * 0.002 + 1000);
    const elevationNoise = noise2D(wx * 0.003, wz * 0.003);

    let biome = BIOMES.PLAINS;
    
    if (tempNoise < -0.5) {
      biome = BIOMES.ICE_SPIKES;
    } else if (tempNoise < -0.2) {
      biome = moistNoise < 0 ? BIOMES.SNOWY_TUNDRA : BIOMES.TAIGA;
    } else if (tempNoise < 0.2) {
      if (moistNoise < -0.3) biome = BIOMES.CHERRY_GROVE;
      else if (moistNoise < 0.3) biome = BIOMES.FOREST;
      else biome = BIOMES.DARK_FOREST;
    } else if (tempNoise < 0.6) {
      if (moistNoise < -0.3) biome = BIOMES.SAVANNA;
      else if (moistNoise < 0.3) biome = BIOMES.PLAINS;
      else biome = BIOMES.SWAMP;
    } else {
      if (moistNoise < -0.4) biome = BIOMES.BADLANDS;
      else if (moistNoise < 0.4) biome = BIOMES.DESERT;
      else biome = BIOMES.JUNGLE;
    }
    if (tempNoise > 0.8) {
      if (moistNoise < -0.4) biome = BIOMES.VOLCANIC;
      else if (moistNoise < 0.4) biome = BIOMES.MUSHROOM_ISLAND;
      else biome = BIOMES.JUNGLE;
    }

    // Override with Ocean or Mountains based on elevation
    if (elevationNoise < -0.5) biome = BIOMES.OCEAN;
    else if (elevationNoise > 0.6) biome = BIOMES.MOUNTAINS;

    let baseHeight = 62 + Math.floor(noise2D(wx * biome.scale, wz * biome.scale) * biome.height);
    
    // Add some high-frequency noise for detail
    baseHeight += Math.floor(noise2D(wx * 0.05, wz * 0.05) * 3);

    // Flatten protected areas (villages, castles, bridge)
    const isVillageOrCastle = (wx >= -50 && wx <= 50) && ((wz >= 70 && wz <= 410) || (wz <= -70 && wz >= -410));
    const isBridgeArea = wx >= -12 && wx <= 12 && wz > -70 && wz < 70;
    
    let targetHeight = baseHeight;
    let blendFactor = 0;
    let distToProtected = 999;

    if (isVillageOrCastle || isBridgeArea) {
      targetHeight = 64;
      distToProtected = 0;
      blendFactor = 1;
    } else {
      // Calculate distance to protected areas for smooth blending
      if (wx >= -60 && wx <= 60) {
        if (wz > 60 && wz < 420) { // Blue side
          const dx = Math.max(0, Math.abs(wx) - 50);
          const dz = Math.max(0, 70 - wz, wz - 410);
          distToProtected = Math.sqrt(dx*dx + dz*dz);
        } else if (wz < -60 && wz > -420) { // Red side
          const dx = Math.max(0, Math.abs(wx) - 50);
          const dz = Math.max(0, wz - (-70), -410 - wz);
          distToProtected = Math.sqrt(dx*dx + dz*dz);
        } else if (wz >= -70 && wz <= 70) { // Bridge
          const dx = Math.max(0, Math.abs(wx) - 12);
          distToProtected = dx;
        }
      }

      if (distToProtected < 10) {
        targetHeight = 64;
        blendFactor = 1 - (distToProtected / 10);
      }
    }
    
    // Island edge falloff
    if (isBlueSide || isRedSide) {
      const islandCenterZ = isBlueSide ? 240 : -240;
      const distFromCenter = Math.sqrt(wx * wx + (wz - islandCenterZ) * (wz - islandCenterZ));
      const islandRadius = 180;
      const edgeBlend = 20;
      
      if (distFromCenter > islandRadius - edgeBlend) {
        const edgeFactor = (distFromCenter - (islandRadius - edgeBlend)) / edgeBlend;
        targetHeight = Math.floor(targetHeight * (1 - edgeFactor) + 40 * edgeFactor);
        if (edgeFactor > 0.5) biome = BIOMES.OCEAN;
      }
    }

    // Smoothstep
    blendFactor = blendFactor * blendFactor * (3 - 2 * blendFactor);

    const finalHeight = Math.floor(baseHeight * (1 - blendFactor) + targetHeight * blendFactor);
    
    return { height: finalHeight, biome, isProtected: distToProtected === 0 };
  }

  static generateShelter(chunk: Chunk, lx: number, lz: number, worldX: number, worldZ: number, isBlue: boolean) {
    const startZ = isBlue ? 300 : -300;
    const distToStart = Math.abs(worldZ - startZ);
    const blockType = isBlue ? BLOCK.BLUE_STONE : BLOCK.RED_STONE;

    // Stairs
    if (Math.abs(worldZ) >= 300 && Math.abs(worldZ) < 364) { // Extended range for gentler slope
      if (worldX >= -5 && worldX <= 5) {
        const stairY2 = 124 - distToStart; // Height in half-blocks
        const stairY = Math.floor(stairY2 / 2);
        const hasSlab = stairY2 % 2 === 1;
        const slabType = isBlue ? BLOCK.SLAB_BLUE_STONE : BLOCK.SLAB_RED_STONE;

        for (let y = stairY - 1; y <= stairY + 6; y++) {
          if (y === stairY - 1) {
            chunk.setBlockFast(lx, y, lz, blockType); // Floor
            if (hasSlab) {
              chunk.setBlockFast(lx, y + 1, lz, slabType); // Slab on top of floor
            }
          } else if (worldX === -5 || worldX === 5) {
            chunk.setBlockFast(lx, y, lz, blockType); // Walls
          } else if (y === stairY + 6) {
            if (distToStart > 3) {
              chunk.setBlockFast(lx, y, lz, blockType); // Roof
            } else {
              chunk.setBlockFast(lx, y, lz, BLOCK.AIR); // Open roof at entrance
            }
          } else {
            // Only clear if not a slab we just placed
            if (!hasSlab || y !== stairY) {
              chunk.setBlockFast(lx, y, lz, BLOCK.AIR); // Air inside
            }
          }
        }
        // Clear anything above the entrance
        if (distToStart <= 3) {
          for (let y = stairY + 6; y < CHUNK_HEIGHT; y++) {
            chunk.setBlockFast(lx, y, lz, BLOCK.AIR);
          }
        }
      }
    }

    // Main Room
    if (Math.abs(worldZ) >= 364 && Math.abs(worldZ) <= 404) {
      if (worldX >= -20 && worldX <= 20) {
        for (let y = 30; y <= 45; y++) {
          const isWall = worldX === -20 || worldX === 20 || Math.abs(worldZ) === 364 || Math.abs(worldZ) === 404 || y === 30 || y === 45;
          if (isWall) {
            // Doorway
            if (Math.abs(worldZ) === 364 && worldX > -5 && worldX < 5 && y >= 31 && y <= 36) {
              chunk.setBlockFast(lx, y, lz, BLOCK.AIR);
            } else {
              chunk.setBlockFast(lx, y, lz, blockType);
            }
          } else {
            chunk.setBlockFast(lx, y, lz, BLOCK.AIR);
          }
        }
      }
    }
  }
}
