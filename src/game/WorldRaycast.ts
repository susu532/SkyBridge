import * as THREE from "three";
import { World } from "./World";
import { BLOCK, isWater } from "./TextureAtlas";

export class WorldRaycast {
  world: World;

  constructor(world: World) {
    this.world = world;
  }

  // Raycasting for block placement/breaking
  raycast(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number,
  ) {
    let t = 0;
    // DDA (Digital Differential Analyzer) voxel raycast algorithm.
    const pos = origin.clone();
    let x = Math.floor(pos.x);
    let y = Math.floor(pos.y);
    let z = Math.floor(pos.z);

    const stepX = Math.sign(direction.x);
    const stepY = Math.sign(direction.y);
    const stepZ = Math.sign(direction.z);

    let tMaxX = (stepX > 0 ? x + 1 - pos.x : pos.x - x) / Math.abs(direction.x);
    let tMaxY = (stepY > 0 ? y + 1 - pos.y : pos.y - y) / Math.abs(direction.y);
    let tMaxZ = (stepZ > 0 ? z + 1 - pos.z : pos.z - z) / Math.abs(direction.z);

    const tDeltaX = 1 / Math.abs(direction.x);
    const tDeltaY = 1 / Math.abs(direction.y);
    const tDeltaZ = 1 / Math.abs(direction.z);

    let prevX = x;
    let prevY = y;
    let prevZ = z;

    let hit = false;
    while (t < maxDistance) {
      const block = this.world.getBlock(x, y, z);
      if (block !== BLOCK.AIR && !isWater(block)) {
        hit = true;
        break;
      }

      prevX = x;
      prevY = y;
      prevZ = z;

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          x += stepX;
          t = tMaxX;
          tMaxX += tDeltaX;
        } else {
          z += stepZ;
          t = tMaxZ;
          tMaxZ += tDeltaZ;
        }
      } else {
        if (tMaxY < tMaxZ) {
          y += stepY;
          t = tMaxY;
          tMaxY += tDeltaY;
        } else {
          z += stepZ;
          t = tMaxZ;
          tMaxZ += tDeltaZ;
        }
      }
    }

    if (hit) {
      return {
        hit: true,
        blockPos: new THREE.Vector3(x, y, z),
        prevPos: new THREE.Vector3(prevX, prevY, prevZ),
        blockType: this.world.getBlock(x, y, z),
      };
    }

    return { hit: false };
  }
}
