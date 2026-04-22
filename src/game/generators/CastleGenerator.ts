import { BLOCK } from '../TextureAtlas';

export class CastleGenerator {
  static getCastleBlock(wx: number, wy: number, wz: number, zOffset: number, accentBlock: number): number {
    const localZ = wz - zOffset;
    
    // Core gothic palette
    const MAIN_STONE = BLOCK.DEEPSLATE_BRICKS;
    const SECONDARY_STONE = BLOCK.STONE_BRICKS;
    const DETAIL_STONE = BLOCK.COBBLED_DEEPSLATE;
    const PILLAR = BLOCK.POLISHED_BLACKSTONE_BRICKS;
    const FLOOR = BLOCK.DEEPSLATE_TILES;
    const GLASS = accentBlock === BLOCK.BLUE_STONE ? BLOCK.GLASS_BLUE : BLOCK.GLASS_RED;
    const ROOF = accentBlock; // We keep the team color for roof accents
    const LIGHT = BLOCK.LANTERN;

    const absX = Math.abs(wx);
    const absZ = Math.abs(localZ);

    // 1. Central Keep (x = +-14, z = +-14) - Gothic style, very tall
    if (absX <= 14 && absZ <= 14) {
      const isKeepWallX = absX === 14;
      const isKeepWallZ = absZ === 14;
      const isKeepCorner = isKeepWallX && isKeepWallZ;
      const isKeepWall = isKeepWallX || isKeepWallZ;

      if (wy <= 60) {
        if (isKeepWall) {
          // Entrances
          const keepGateZ = zOffset > 0 ? -14 : 14;
          if (localZ === keepGateZ && absX <= 3 && wy <= 8) {
            // Gothic Arch
            if (wy === 8 && absX === 3) return MAIN_STONE;
            if (wy === 7 && absX >= 2) return MAIN_STONE;
            if (wy === 6 && absX >= 1) return MAIN_STONE;
            if (wy >= 6 && absX === 0) return BLOCK.IRON_BARS; // Gate portcullis top
            // Open gate below
            return BLOCK.AIR; 
          }
          
          // Corner pillars
          if (isKeepCorner) return PILLAR;

          // Tall Gothic Windows
          if (wy > 15 && wy < 50 && (absX === 0 || absX === 6 || absX === -6 || absZ === 0 || absZ === 6 || absZ === -6)) {
             const windowY = (wy - 15) % 12;
             if (windowY >= 2 && windowY <= 9) {
                // Pointed arch top
                if (windowY === 9 && (absX % 6 !== 0 && absZ % 6 !== 0)) return DETAIL_STONE; 
                return GLASS;
             }
          }
          
          // Buttress attachment ribs on keep walls
          if (wy <= 40 && (absX === 8 || absZ === 8) && !isKeepCorner) {
            return PILLAR;
          }

          // Battlements
          if (wy === 60 && ((absX + absZ) % 3 === 0)) return BLOCK.AIR;
          
          // Texture mixture
          const n = (wx * wy * localZ) % 100;
          if (n < 10) return DETAIL_STONE;
          if (n < 30) return SECONDARY_STONE;
          return wy >= 58 ? DETAIL_STONE : MAIN_STONE;
        }
        
        // Keep Interior
        if (wy % 15 === 0 && wy > 0 && wy < 60) {
          // Stairwell hole
          if (absX <= 2 && absZ <= 2) return BLOCK.AIR; // Central spiral space
          
          // Grand columns inside
          if (absX === 7 && absZ === 7 && wy > 0) return PILLAR;
          
          return FLOOR;
        }
        
        // Interior columns full height
        if (absX === 7 && absZ === 7 && wy > 0 && wy < 60) {
           // Provide some lantern lighting
           if (wy % 15 === 14) return LIGHT;
           return PILLAR;
        }

        // Central Spiral Stairs
        if (absX <= 2 && absZ <= 2) {
          const stairLvl = wy % 8;
          if (absX === 1 && absZ === 1) return PILLAR; // Core pillar
          if (stairLvl === 0 && wx === 2 && localZ === 0) return BLOCK.DARK_OAK_PLANKS;
          if (stairLvl === 1 && wx === 2 && localZ === 2) return BLOCK.DARK_OAK_PLANKS;
          if (stairLvl === 2 && wx === 0 && localZ === 2) return BLOCK.DARK_OAK_PLANKS;
          if (stairLvl === 3 && wx === -2 && localZ === 2) return BLOCK.DARK_OAK_PLANKS;
          if (stairLvl === 4 && wx === -2 && localZ === 0) return BLOCK.DARK_OAK_PLANKS;
          if (stairLvl === 5 && wx === -2 && localZ === -2) return BLOCK.DARK_OAK_PLANKS;
          if (stairLvl === 6 && wx === 0 && localZ === -2) return BLOCK.DARK_OAK_PLANKS;
          if (stairLvl === 7 && wx === 2 && localZ === -2) return BLOCK.DARK_OAK_PLANKS;
        }
      }
      
      // Keep Roof (Spire)
      if (wy > 60 && wy <= 90) {
        const h = wy - 60;
        // Steep slope: radius drops quickly
        const radius = 15 - Math.floor(h / 2);
        if (absX === radius && absZ === radius) return PILLAR; // Spire edges
        if (absX <= radius && absZ <= radius) {
          if (absX === radius - 1 && absZ === radius - 1 && h % 5 === 0) return LIGHT;
          return ROOF;
        }
      }
    }

    // 2. Flying Buttresses
    // Connecting keep (abs=14) to outer towers or ground
    if (wy >= 10 && wy <= 40) {
       // North/South/East/West buttresses
       if ((absX === 8 && absZ > 14 && absZ <= 25) || (absZ === 8 && absX > 14 && absX <= 25)) {
          const distFromKeep = (absX === 8) ? (absZ - 14) : (absX - 14);
          // Arch equation
          const archHeight = 40 - Math.pow(distFromKeep, 1.3);
          if (Math.abs(wy - archHeight) <= 1) {
             return PILLAR;
          }
       }
    }

    // 3. Four Corner Towers (Octagonal/Hex-like) at +-32, +-32
    const isTower = (cx: number, cz: number) => {
      const dx = Math.abs(wx - cx);
      const dz = Math.abs(localZ - cz);
      const dist = dx + dz; // Manhattan-like distance for gothic blocky circle
      const maxDist = (dx <= 4 && dz <= 4) && dist <= 6; // Simple octagonal tower radius
      
      if (maxDist && wy <= 45) {
        const isWall = dist === 6 || (dx === 4 && dz >= 2) || (dz === 4 && dx >= 2);
        if (isWall) {
          // Arrow slits
          if (wy > 15 && wy < 40 && wy % 6 >= 3 && wy % 6 <= 5 && (dx === 0 || dz === 0)) {
            return BLOCK.AIR;
          }
          // Tower battlements
          if (wy === 45 && ((wx + localZ) % 2 === 0)) return BLOCK.AIR;
          return PILLAR;
        }
        if (wy % 15 === 0 && wy > 5) return FLOOR;
        if (wy % 15 === 14 && dx <= 1 && dz <= 1) return LIGHT; // Chandelier
        return BLOCK.AIR;
      }
      
      // Spire Roofs
      if (wy > 45 && wy <= 65) {
        const h = wy - 45;
        const radius = 6 - Math.floor(h / 3);
        if (dx + dz <= radius && dx <= Math.floor(radius/1.5) + 1 && dz <= Math.floor(radius/1.5) + 1) {
          return ROOF;
        }
      }
      return -1;
    };

    const t1 = isTower(-32, -32); if (t1 !== -1) return t1;
    const t2 = isTower(-32, 32);  if (t2 !== -1) return t2;
    const t3 = isTower(32, -32);  if (t3 !== -1) return t3;
    const t4 = isTower(32, 32);   if (t4 !== -1) return t4;

    // 4. Outer Walls (x = +-32, z = +-32) connecting the towers
    if (absX >= 31 && absX <= 33 && absZ <= 32) {
       // X Wall
       if (wy <= 20) {
          // Arch passage
          if (absZ <= 3 && wy <= 12) {
             if (wy === 12 && absZ <= 1) return MAIN_STONE;
             if (wy === 11 && absZ <= 2) return MAIN_STONE;
             return BLOCK.AIR;
          }
          // Battlements
          if (wy === 20 && (absZ % 2 !== 0)) return BLOCK.AIR;
          // Wall thick pillar constraints
          if (absZ % 8 === 0 && absX === 31) return PILLAR; // Inner thick pillar
          if (absZ % 8 === 0 && absX === 33) return PILLAR; // Outer thick pillar
          if (absX === 32) return MAIN_STONE;
          // Walkway base
          if (wy === 15 && absX === 31) return DETAIL_STONE; 
       }
    }

    if (absZ >= 31 && absZ <= 33 && absX <= 32) {
       // Z Wall
       if (wy <= 20) {
          // Gatehouse (Front and Back)
          const frontGateZ = zOffset > 0 ? -32 : 32;
          const backGateZ = zOffset > 0 ? 32 : -32;
          
          if ((localZ === frontGateZ || localZ === backGateZ) && absX <= 4 && wy <= 15) {
             // Main gate gothic arch
             if (wy >= 12) {
                if (wy === 15 && absX === 0) return MAIN_STONE;
                if (wy === 14 && absX <= 1) return MAIN_STONE;
                if (wy === 13 && absX <= 2) return MAIN_STONE;
                if (wy === 12 && absX <= 3) return MAIN_STONE;
             }
             if (absX <= 3 && wy <= 11) {
                if (wy === 11) return BLOCK.IRON_BARS;
                if (wy === 10 && absX <= 2) return BLOCK.IRON_BARS;
                return BLOCK.AIR;
             }
          }
          
          // Battlements
          if (wy === 20 && (absX % 2 !== 0)) return BLOCK.AIR;
          // Pillar constraints
          if (absX % 8 === 0 && absZ === 31) return PILLAR;
          if (absX % 8 === 0 && absZ === 33) return PILLAR;
          if (absZ === 32) return MAIN_STONE;
          // Walkway base
          if (wy === 15 && absZ === 31) return DETAIL_STONE;
       }
    }

    // 5. Courtyard details
    if (absX < 31 && absZ < 31 && (absX > 14 || absZ > 14)) {
       if (wy === 0) {
          // Gothic radiating paths
          if (absX <= 3 || absZ <= 3 || absX === absZ || absX === absZ - 1 || absX === absZ + 1) {
             return FLOOR;
          }
          return BLOCK.MOSS_BLOCK || BLOCK.GRASS;
       }
       if (wy === 1 && absX === absZ && absX % 6 === 0) {
          return LIGHT; // Path lanterns
       }
    }

    return BLOCK.AIR;
  }
}
