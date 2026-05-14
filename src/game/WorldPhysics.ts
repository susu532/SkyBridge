import { BLOCK, isWater, isAnyTorch, isSolidBlock } from "./TextureAtlas";
import { World } from "./World";
import { audioManager } from "./AudioManager";

export class WorldPhysics {
  world: World;
  
  constructor(world: World) {
    this.world = world;
  }

  tick(delta: number) {
    // Water Updates
    if (this.world.waterUpdates.size > 0) {
      const MAX_WATER_UPDATES_PER_TICK = 500;
      const waterToCheck = Array.from(this.world.waterUpdates).slice(
        0,
        MAX_WATER_UPDATES_PER_TICK,
      );

      for (const key of waterToCheck) {
        this.world.waterUpdates.delete(key);
      }

      for (const key of waterToCheck) {
        const [x, y, z] = key.split(",").map(Number);
        const block = this.world.getBlock(x, y, z);

        if (isWater(block)) {
          let level = 0;
          if (block === BLOCK.WATER) level = 0;
          else level = block - BLOCK.WATER_1 + 1;

          // Check if it should disappear (if it's flowing water)
          if (level > 0) {
            const above = this.world.getBlock(x, y + 1, z);
            let hasSource = isWater(above);

            if (!hasSource) {
              const checkSource = (nx: number, nz: number) => {
                const n = this.world.getBlock(nx, y, nz);
                if (isWater(n)) {
                  let nLevel = n === BLOCK.WATER ? 0 : n - BLOCK.WATER_1 + 1;
                  if (nLevel < level) return true;
                }
                return false;
              };

              if (
                checkSource(x + 1, z) ||
                checkSource(x - 1, z) ||
                checkSource(x, z + 1) ||
                checkSource(x, z - 1)
              ) {
                hasSource = true;
              }
            }

            if (!hasSource) {
              this.world.setBlock(x, y, z, BLOCK.AIR, true);
              continue; // It disappeared, no need to flow
            }
          }

          // Flow logic
          if (level < 7) {
            const below = this.world.getBlock(x, y - 1, z);
            let nLevelBelow = isWater(below)
              ? below === BLOCK.WATER
                ? 0
                : below - BLOCK.WATER_1 + 1
              : 999;

            if (below === BLOCK.AIR || (isWater(below) && nLevelBelow > 1)) {
              // Flow down
              if (below === BLOCK.AIR) {
                audioManager.play("splash", 0.1, 0.5 + Math.random() * 0.5);
              }
              this.world.setBlock(x, y - 1, z, BLOCK.WATER_1, true);
            } else if (!isWater(below) && below !== BLOCK.AIR) {
              // Flow horizontally
              const nextLevel = level + 1;
              const nextBlockType = BLOCK.WATER_1 + nextLevel - 1;

              const checkAndFlow = (nx: number, nz: number) => {
                const neighbor = this.world.getBlock(nx, y, nz);
                if (neighbor === BLOCK.AIR) {
                  this.world.setBlock(nx, y, nz, nextBlockType, true);
                } else if (isWater(neighbor)) {
                  let nLevel =
                    neighbor === BLOCK.WATER ? 0 : neighbor - BLOCK.WATER_1 + 1;
                  if (nLevel > nextLevel) {
                    this.world.setBlock(nx, y, nz, nextBlockType, true);
                  }
                }
              };

              checkAndFlow(x + 1, z);
              checkAndFlow(x - 1, z);
              checkAndFlow(x, z + 1);
              checkAndFlow(x, z - 1);
            }
          }
        }
      }
    }

    // Gravity Updates
    if (this.world.fallingBlocks.size > 0) {
      const MAX_FALLING_UPDATES_PER_TICK = 100;
      const toCheck = Array.from(this.world.fallingBlocks).slice(
        0,
        MAX_FALLING_UPDATES_PER_TICK,
      );

      for (const key of toCheck) {
        this.world.fallingBlocks.delete(key);
      }

      for (const key of toCheck) {
        const [x, y, z] = key.split(",").map(Number);
        const block = this.world.getBlock(x, y, z);

        const isPlantType =
          isAnyTorch(block) ||
          block === BLOCK.TALL_GRASS ||
          block === BLOCK.FLOWER_RED ||
          block === BLOCK.FLOWER_YELLOW ||
          block === BLOCK.WHEAT;

        if (this.world.hasWeight(block)) {
          const below = this.world.getBlock(x, y - 1, z);
          if (below === BLOCK.AIR || isWater(below)) {
            if (this.world.setBlock(x, y, z, BLOCK.AIR, true)) {
              this.world.setBlock(x, y - 1, z, block, true);

              this.world.addGravityCheck(x, y - 1, z);
              this.world.addGravityCheck(x, y + 1, z);
              this.world.addGravityCheck(x + 1, y, z);
              this.world.addGravityCheck(x - 1, y, z);
              this.world.addGravityCheck(x, y, z + 1);
              this.world.addGravityCheck(x, y, z - 1);
            }
          }
        } else if (isPlantType) {
          let supportBlock = BLOCK.AIR;
          if (block === BLOCK.TORCH_WALL_X_POS)
            supportBlock = this.world.getBlock(x + 1, y, z);
          else if (block === BLOCK.TORCH_WALL_X_NEG)
            supportBlock = this.world.getBlock(x - 1, y, z);
          else if (block === BLOCK.TORCH_WALL_Z_POS)
            supportBlock = this.world.getBlock(x, y, z + 1);
          else if (block === BLOCK.TORCH_WALL_Z_NEG)
            supportBlock = this.world.getBlock(x, y, z - 1);
          else supportBlock = this.world.getBlock(x, y - 1, z);

          if (!isSolidBlock(supportBlock)) {
            this.world.setBlock(x, y, z, BLOCK.AIR, true);
            this.world.addGravityCheck(x, y + 1, z);
          }
        }
      }
    }
  }
}
