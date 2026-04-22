import { World } from './World';
import { isSolidBlock } from './TextureAtlas';

export class LightingManager {
  world: World;
  lightUpdates: { x: number, y: number, z: number, level: number }[] = [];
  lightUpdatesIndex: number = 0;
  lightRemovals: { x: number, y: number, z: number, level: number }[] = [];
  lightRemovalsIndex: number = 0;

  constructor(world: World) {
    this.world = world;
  }

  addLightUpdate(x: number, y: number, z: number, level: number) {
    this.lightUpdates.push({ x, y, z, level });
  }

  addLightRemoval(x: number, y: number, z: number, level: number) {
    this.lightRemovals.push({ x, y, z, level });
  }

  processLightUpdates() {
    const MAX_LIGHT_UPDATES = Number.MAX_SAFE_INTEGER; // Ensure queue ALWAYS completes, no lingering lights
    let updatesProcessed = 0;

    const neighbors = [
      { dx: 1, dy: 0, dz: 0 }, { dx: -1, dy: 0, dz: 0 },
      { dx: 0, dy: 1, dz: 0 }, { dx: 0, dy: -1, dz: 0 },
      { dx: 0, dy: 0, dz: 1 }, { dx: 0, dy: 0, dz: -1 }
    ];

    // Process removals first
    while (this.lightRemovalsIndex < this.lightRemovals.length && updatesProcessed < MAX_LIGHT_UPDATES) {
      const node = this.lightRemovals[this.lightRemovalsIndex++];
      updatesProcessed++;

      for (const n of neighbors) {
        const nx = node.x + n.dx;
        const ny = node.y + n.dy;
        const nz = node.z + n.dz;

        const cx = nx >> 4;
        const cz = nz >> 4;
        if (!this.world.getChunk(cx, cz)) continue;
        
        const nl = this.world.getLight(nx, ny, nz);
        if (nl > 0 && nl < node.level) {
          this.world.setLight(nx, ny, nz, 0);
          this.lightRemovals.push({ x: nx, y: ny, z: nz, level: nl });
        } else if (nl >= node.level && nl > 0) {
          // If the light is stronger or equal to what we're removing, it's either an adjacent light source
          // or another branch of a light. Re-queue it to flood back over the removal area.
          this.lightUpdates.push({ x: nx, y: ny, z: nz, level: nl });
        }
      }
    }

    if (this.lightRemovalsIndex >= this.lightRemovals.length) {
      // It will always reach here because of MAX_SAFE_INTEGER
      this.lightRemovals = [];
      this.lightRemovalsIndex = 0;
    }

    // Process additions
    while (this.lightUpdatesIndex < this.lightUpdates.length && updatesProcessed < MAX_LIGHT_UPDATES) {
      const node = this.lightUpdates[this.lightUpdatesIndex++];
      updatesProcessed++;

      for (const n of neighbors) {
        const nx = node.x + n.dx;
        const ny = node.y + n.dy;
        const nz = node.z + n.dz;

        const cx = nx >> 4;
        const cz = nz >> 4;
        if (!this.world.getChunk(cx, cz)) continue;

        if (isSolidBlock(this.world.getBlock(nx, ny, nz))) continue;

        const nl = this.world.getLight(nx, ny, nz);
        if (nl + 2 <= node.level) {
          this.world.setLight(nx, ny, nz, node.level - 1);
          this.lightUpdates.push({ x: nx, y: ny, z: nz, level: node.level - 1 });
        }
      }
    }

    if (this.lightUpdatesIndex >= this.lightUpdates.length) {
      this.lightUpdates = [];
      this.lightUpdatesIndex = 0;
    }
  }
}
