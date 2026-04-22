import { BLOCK } from '../TextureAtlas';

export class VillageGenerator {
  static getVillageBlock(wx: number, wy: number, wz: number, isBlue: boolean): number {
    const zBase = isBlue ? 131 : -180;
    const localZ = isBlue ? wz - 131 : wz - (-131); // localZ from 0 to 49
    const absLocalZ = Math.abs(localZ);
    
    // 1. Village Fence
    const isFenceX = (wx === -50 || wx === 50) && absLocalZ >= 0 && absLocalZ <= 49;
    const isFenceZ = (localZ === 0 || localZ === (isBlue ? 49 : -49)) && wx >= -50 && wx <= 50;
    
    if (isFenceX || isFenceZ) {
      if (wy <= 8) {
        // Double doors in the fence (front and back)
        const isFrontDoor = localZ === 0;
        const isBackDoor = localZ === (isBlue ? 49 : -49);
        if ((isFrontDoor || isBackDoor) && wx >= -4 && wx <= 4 && wy <= 10) {
          // Open door effect: just air in the middle
          if (Math.abs(wx) < 3) return BLOCK.AIR;
          // Door posts/frames
          return BLOCK.WOOD;
        }
        
        // Fence style: stone base, wood top
        if (wy <= 3) return BLOCK.STONE;
        if (wy === 8 && wx % 2 === 0) return BLOCK.AIR; // Battlements for fence
        return BLOCK.WOOD;
      }
    }

    // 2. Custom Buildings
    const drawTavern = (hx: number, hz: number, width: number, depth: number) => {
      const dx = wx - hx;
      const dz = wz - hz;
      if (dx >= 0 && dx < width && dz >= 0 && dz < depth) {
        const isWall = dx === 0 || dx === width - 1 || dz === 0 || dz === depth - 1;
        const isCorner = (dx === 0 || dx === width - 1) && (dz === 0 || dz === depth - 1);
        
        if (wy >= 5 && wy <= 14) {
          if (isWall) {
            if (wy === 5) return BLOCK.STONE;
            if (isCorner) return BLOCK.WOOD;
            if (wy === 10) return BLOCK.WOOD;
            
            // Door
            if (dz === 0 && dx >= Math.floor(width/2) - 1 && dx <= Math.floor(width/2) + 1 && wy <= 7) return BLOCK.AIR;
            
            // Windows
            if ((wy === 7 || wy === 8 || wy === 12 || wy === 13) && !isCorner && (dx % 4 === 2 || dz % 4 === 2)) return BLOCK.GLASS;
            
            return BLOCK.PLANKS;
          } else {
            if (wy === 5 || wy === 10) return BLOCK.PLANKS; // Floors
            if (wy === 6 && dx === 2 && dz === depth - 2) return BLOCK.WOOD; // Stair block
            if (wy === 7 && dx === 3 && dz === depth - 2) return BLOCK.WOOD; // Stair block
            if (wy === 8 && dx === 4 && dz === depth - 2) return BLOCK.WOOD; // Stair block
            if (wy === 9 && dx === 5 && dz === depth - 2) return BLOCK.WOOD; // Stair block
            if (wy === 10 && dx >= 2 && dx <= 5 && dz === depth - 2) return BLOCK.AIR; // Stair hole
            return BLOCK.AIR;
          }
        }
        
        // Roof
        if (wy > 14 && wy <= 14 + Math.floor(width/2) + 1) {
          const roofLevel = wy - 14;
          if (dx === roofLevel - 1 || dx === width - roofLevel) return BLOCK.WOOD;
          if (dx >= roofLevel && dx < width - roofLevel) {
            if (dz === 0 || dz === depth - 1) return BLOCK.PLANKS; // Gable ends
            return BLOCK.AIR; // Inside attic
          }
        }
      }
      return BLOCK.AIR;
    };

    const drawHouse = (hx: number, hz: number, width: number, depth: number) => {
      const dx = wx - hx;
      const dz = wz - hz;
      if (dx >= 0 && dx < width && dz >= 0 && dz < depth) {
        const isWall = dx === 0 || dx === width - 1 || dz === 0 || dz === depth - 1;
        const isCorner = (dx === 0 || dx === width - 1) && (dz === 0 || dz === depth - 1);
        
        if (wy >= 5 && wy <= 9) {
          if (isWall) {
            if (wy === 5) return BLOCK.STONE;
            if (isCorner) return BLOCK.WOOD;
            
            // Door
            if (dz === 0 && dx === Math.floor(width/2) && wy <= 7) return BLOCK.AIR;
            
            // Windows
            if (wy === 7 && !isCorner && dx % 2 === 0) return BLOCK.GLASS;
            
            return BLOCK.PLANKS;
          } else {
            if (wy === 5) return BLOCK.PLANKS; // Floor
            return BLOCK.AIR;
          }
        }
        
        // Roof
        if (wy > 9 && wy <= 9 + Math.floor(depth/2) + 1) {
          const roofLevel = wy - 9;
          if (dz === roofLevel - 1 || dz === depth - roofLevel) return BLOCK.WOOD;
          if (dz >= roofLevel && dz < depth - roofLevel) {
            if (dx === 0 || dx === width - 1) return BLOCK.PLANKS; // Gable ends
            return BLOCK.AIR;
          }
        }
      }
      return BLOCK.AIR;
    };

    const drawFarm = (hx: number, hz: number, width: number, depth: number) => {
      const dx = wx - hx;
      const dz = wz - hz;
      if (dx >= 0 && dx < width && dz >= 0 && dz < depth) {
        if (wy === 4) return BLOCK.DIRT;
        if (wy === 5) {
          if (dx === 0 || dx === width - 1 || dz === 0 || dz === depth - 1) return BLOCK.WOOD; // Fence
          if (dx % 3 === 1) return BLOCK.WATER; // Irrigation
          return BLOCK.WHEAT; // Crops
        }
      }
      return BLOCK.AIR;
    };

    // 3. Central Well
    const wellZ = isBlue ? 155 : -155;
    if (wx >= -2 && wx <= 2 && wz >= wellZ - 2 && wz <= wellZ + 2) {
      if (wy <= 4) return BLOCK.STONE;
      if (wy === 5) {
        if (Math.abs(wx) === 2 || Math.abs(wz - wellZ) === 2) return BLOCK.STONE;
        return BLOCK.WATER;
      }
      if (wy >= 6 && wy <= 8) {
        if (Math.abs(wx) === 2 && Math.abs(wz - wellZ) === 2) return BLOCK.WOOD; // Pillars
        return BLOCK.AIR;
      }
      if (wy === 9) return BLOCK.WOOD; // Roof
    }

    // 4. Place Buildings
    let block = BLOCK.AIR;
    
    // Large Tavern
    block = drawTavern(-35, isBlue ? 140 : -170, 15, 20); if (block !== BLOCK.AIR) return block;
    block = drawTavern(20, isBlue ? 140 : -170, 15, 20); if (block !== BLOCK.AIR) return block;
    
    // Small Houses
    block = drawHouse(-15, isBlue ? 135 : -145, 7, 7); if (block !== BLOCK.AIR) return block;
    block = drawHouse(-15, isBlue ? 145 : -155, 7, 7); if (block !== BLOCK.AIR) return block;
    block = drawHouse(-15, isBlue ? 165 : -175, 7, 7); if (block !== BLOCK.AIR) return block;
    
    block = drawHouse(8, isBlue ? 135 : -145, 7, 7); if (block !== BLOCK.AIR) return block;
    block = drawHouse(8, isBlue ? 145 : -155, 7, 7); if (block !== BLOCK.AIR) return block;
    block = drawHouse(8, isBlue ? 165 : -175, 7, 7); if (block !== BLOCK.AIR) return block;
    
    // Farms
    block = drawFarm(-45, isBlue ? 165 : -145, 20, 10); if (block !== BLOCK.AIR) return block;
    block = drawFarm(25, isBlue ? 165 : -145, 20, 10); if (block !== BLOCK.AIR) return block;

    return BLOCK.AIR;
  }
}
