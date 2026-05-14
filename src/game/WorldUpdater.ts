import * as THREE from "three";
import { CHUNK_SIZE, CHUNK_HEIGHT, WORLD_Y_OFFSET } from "./Chunk";
import { World } from "./World";
import { settingsManager } from "./Settings";

import { useGameStore } from "../store/gameStore";

export class WorldUpdater {
  world: World;

  constructor(world: World) {
    this.world = world;
  }

  update(playerPosition: THREE.Vector3, camera?: THREE.Camera) {
    const pcx = Math.floor(playerPosition.x / CHUNK_SIZE);
    const pcz = Math.floor(playerPosition.z / CHUNK_SIZE);

    const startTime = performance.now();
    const isMapLoading = useGameStore.getState().isMapLoading;
    const maxTimePerFrame = isMapLoading ? 50 : 3; // Boosted when loading map

    const frustum = new THREE.Frustum();
    if (camera) {
      const projScreenMatrix = new THREE.Matrix4();
      projScreenMatrix.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
      );
      frustum.setFromProjectionMatrix(projScreenMatrix);
    }

    // Generate new chunks
    const chunksToGenerate: {
      cx: number;
      cz: number;
      distSq: number;
      inFrustum: boolean;
    }[] = [];
    for (let x = -this.world.renderDistance; x <= this.world.renderDistance; x++) {
      for (let z = -this.world.renderDistance; z <= this.world.renderDistance; z++) {
        const cx = pcx + x;
        const cz = pcz + z;
        const key = this.world.getChunkKey(cx, cz);
        if (!this.world.getChunk(cx, cz) && !this.world.generatingChunks.has(key)) {
          let inFrustum = true;
          if (camera) {
            const box = new THREE.Box3(
              new THREE.Vector3(
                cx * CHUNK_SIZE,
                WORLD_Y_OFFSET,
                cz * CHUNK_SIZE,
              ),
              new THREE.Vector3(
                (cx + 1) * CHUNK_SIZE,
                WORLD_Y_OFFSET + CHUNK_HEIGHT,
                (cz + 1) * CHUNK_SIZE,
              ),
            );
            inFrustum = frustum.intersectsBox(box);
          }
          chunksToGenerate.push({ cx, cz, distSq: x * x + z * z, inFrustum });
        }
      }
    }

    // Prioritize chunks in frustum, then by distance
    chunksToGenerate.sort((a, b) => {
      if (a.inFrustum && !b.inFrustum) return -1;
      if (!a.inFrustum && b.inFrustum) return 1;
      return a.distSq - b.distSq;
    });

    let activeGenerations = this.world.generatingChunks.size;
    for (const { cx, cz } of chunksToGenerate) {
      // Limit concurrent chunk generation to prevent stutter
      if (
        activeGenerations < (isMapLoading ? 32 : 2) &&
        performance.now() - startTime < maxTimePerFrame
      ) {
        this.world.generateChunk(cx, cz);
        activeGenerations++;
      } else {
        break;
      }
    }

    // Unload far chunks
    for (const [key, chunk] of this.world.chunks.entries()) {
      const dx = Math.abs(chunk.x - pcx);
      const dz = Math.abs(chunk.z - pcz);
      if (dx > this.world.renderDistance + 1 || dz > this.world.renderDistance + 1) {
        if (chunk.mesh) {
          this.world.scene.remove(chunk.mesh);
          chunk.mesh.geometry.dispose();
          // We don't dispose the material because it's shared across all chunks
        }
        if (chunk.transparentMesh) {
          this.world.scene.remove(chunk.transparentMesh);
          chunk.transparentMesh.geometry.dispose();
        }
        this.world.chunks.delete(key);
      }
    }

    // Update meshes
    const chunksToMesh: { chunk: any; distSq: number; inFrustum: boolean }[] =
      [];
    let activeMeshing = 0;
    for (const chunk of this.world.chunks.values()) {
      if (chunk.isMeshing) activeMeshing++;
      if (chunk.needsUpdate && !chunk.isMeshing) {
        const dx = chunk.x - pcx;
        const dz = chunk.z - pcz;
        let inFrustum = true;
        if (camera) {
          const box = new THREE.Box3(
            new THREE.Vector3(
              chunk.x * CHUNK_SIZE,
              WORLD_Y_OFFSET,
              chunk.z * CHUNK_SIZE,
            ),
            new THREE.Vector3(
              (chunk.x + 1) * CHUNK_SIZE,
              WORLD_Y_OFFSET + CHUNK_HEIGHT,
              (chunk.z + 1) * CHUNK_SIZE,
            ),
          );
          inFrustum = frustum.intersectsBox(box);
        }
        chunksToMesh.push({ chunk, distSq: dx * dx + dz * dz, inFrustum });
      }
    }

    // Sort by frustum visibility, then distance so closer visible chunks mesh first
    chunksToMesh.sort((a, b) => {
      if (a.inFrustum && !b.inFrustum) return -1;
      if (!a.inFrustum && b.inFrustum) return 1;
      return a.distSq - b.distSq;
    });

    for (const { chunk } of chunksToMesh) {
      // Limit concurrent meshing to prevent stutter, but allow more if they are in frustum
      const maxConcurrent = isMapLoading ? 32 : (chunksToMesh[0]?.inFrustum ? 16 : 8);
      if (
        activeMeshing < maxConcurrent &&
        performance.now() - startTime < maxTimePerFrame * 4
      ) {
        const cx = chunk.x;
        const cz = chunk.z;
        const chunkCache = new Array(9);
        for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            chunkCache[dx + 1 + (dz + 1) * 3] = this.world.getChunk(cx + dx, cz + dz);
          }
        }

        const isPerformanceMode = settingsManager.getSettings().performanceMode;
        const neighborsBlocks = chunkCache.map((c) => (c ? c.blocks : null));
        const neighborsLight = chunkCache.map((c) => (c ? c.light : null));

        chunk.isMeshing = true;
        chunk.needsUpdate = false;

        const taskId = ++this.world.taskIdCounter;
        const promise = new Promise((resolve, reject) => {
          this.world.pendingTasks.set(taskId, { resolve, reject, chunk });
        });

        const worker = this.world.meshWorkers[this.world.nextWorkerIndex];
        this.world.nextWorkerIndex =
          (this.world.nextWorkerIndex + 1) % this.world.meshWorkers.length;

        worker.postMessage({
          taskId,
          chunkX: chunk.x,
          chunkZ: chunk.z,
          blocks: chunk.blocks,
          light: chunk.light,
          neighborsBlocks,
          neighborsLight,
          performanceMode: isPerformanceMode,
        });

        activeMeshing++;
      } else {
        break;
      }
    }
  }
}
