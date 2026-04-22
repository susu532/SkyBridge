import * as THREE from 'three';
import { ItemType } from './Inventory';
import { ATLAS_TILES, getBlockUVs, isSolidBlock, isPlant, isFlatItem } from './TextureAtlas';
import { World } from './World';

export interface DroppedItemData {
  id: string;
  type: ItemType;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  createdAt: number;
  pickupDelay: number;
  velocity: THREE.Vector3;
  isGrounded: boolean;
  groundY: number;
  baseY: number;
}

export class DroppedItemInstancedManager {
  scene: THREE.Scene;
  world: World;
  textureAtlas: THREE.Texture;
  
  items: Map<string, DroppedItemData> = new Map();
  
  // Per-type instanced meshes
  instancedMeshes: Map<ItemType, THREE.InstancedMesh> = new Map();
  itemCounts: Map<ItemType, number> = new Map();

  private MAX_INSTANCES = 1000;
  private dummyMatrix = new THREE.Matrix4();
  private dummyQuaternion = new THREE.Quaternion();
  private _pullDirection = new THREE.Vector3();

  constructor(scene: THREE.Scene, world: World, textureAtlas: THREE.Texture) {
    this.scene = scene;
    this.world = world;
    this.textureAtlas = textureAtlas;
  }

  addDroppedItem(id: string, type: ItemType, position: THREE.Vector3, initialVelocity?: THREE.Vector3) {
    if (this.items.has(id)) return;

    if (!this.instancedMeshes.has(type)) {
      let geometry;
      if (isFlatItem(type as unknown as number)) {
        geometry = new THREE.BoxGeometry(0.3, 0.3, 0.05); // Thin item
      } else if (isPlant(type as unknown as number)) {
        // use plane geometry or thin box for plants, to avoid 6 thick faces
        geometry = new THREE.BoxGeometry(0.3, 0.3, 0.05);
      } else {
        geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3); // Block
      }
      const uvs = getBlockUVs(type as unknown as number);
      const uvAttribute = geometry.attributes.uv;
      const size = 1 / ATLAS_TILES;
      const pad = 0.005;

      for (let i = 0; i < 6; i++) {
        const [tx, ty] = uvs[i];
        const uMin = tx * size + pad;
        const uMax = (tx + 1) * size - pad;
        const vMin = 1.0 - (ty + 1) * size + pad;
        const vMax = 1.0 - ty * size - pad;

        const idx = i * 4;
        uvAttribute.setXY(idx, uMin, vMax);
        uvAttribute.setXY(idx + 1, uMax, vMax);
        uvAttribute.setXY(idx + 2, uMin, vMin);
        uvAttribute.setXY(idx + 3, uMax, vMin);
      }
      uvAttribute.needsUpdate = true;

      const isAlphaFlat = isFlatItem(type as unknown as number) || isPlant(type as unknown as number);
      const isGlass = type === ItemType.GLASS;
      const isWaterTypes = type >= ItemType.WATER && type <= ItemType.WATER_7;

      const material = new THREE.MeshLambertMaterial({ 
        map: this.textureAtlas,
        transparent: isGlass || isWaterTypes || isAlphaFlat,
        opacity: isWaterTypes ? 0.6 : 1.0,
        alphaTest: (isGlass || isAlphaFlat) ? 0.5 : 0
      });

      const mesh = new THREE.InstancedMesh(geometry, material, this.MAX_INSTANCES);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false; // Disable frustum culling since instances move
      this.scene.add(mesh);
      this.instancedMeshes.set(type, mesh);
    }

    const velocity = initialVelocity ? initialVelocity.clone() : new THREE.Vector3(
      (Math.random() - 0.5) * 1.5,
      2 + Math.random() * 2,
      (Math.random() - 0.5) * 1.5
    );

    let groundY = -64;
    for (let y = Math.floor(position.y); y > -64; y--) {
      const block = this.world.getBlock(Math.floor(position.x), y, Math.floor(position.z));
      if (isSolidBlock(block)) {
        groundY = y + 1.15;
        break;
      }
    }

    this.items.set(id, {
      id,
      type,
      position: position.clone(),
      rotation: new THREE.Euler(),
      scale: new THREE.Vector3(1, 1, 1),
      createdAt: Date.now(),
      pickupDelay: 2000,
      velocity,
      isGrounded: false,
      groundY,
      baseY: position.y
    });
  }

  removeDroppedItem(id: string) {
    this.items.delete(id);
  }

  update(playerPos: THREE.Vector3, delta: number, isPerformanceMode: boolean) {
    const time = Date.now() * 0.002;
    const gravity = 15;
    
    // Reset counters
    this.instancedMeshes.forEach((mesh, type) => {
      this.itemCounts.set(type, 0);
    });

    for (const item of this.items.values()) {
      const distToPlayer = item.position.distanceTo(playerPos);
      const magnetRange = 4.0;
      
      if (distToPlayer < magnetRange) {
        item.isGrounded = false;
        this._pullDirection.subVectors(playerPos, item.position).normalize();
        const pullStrength = (1.0 - distToPlayer / magnetRange) * 10;
        item.velocity.addScaledVector(this._pullDirection, pullStrength * delta);
        item.velocity.y += 2 * delta;
        if (item.velocity.lengthSq() > 400) {
          item.velocity.setLength(20);
        }
      }

      if (!item.isGrounded) {
        item.velocity.y -= gravity * delta;
        item.velocity.x *= 0.95;
        item.velocity.z *= 0.95;
        if (distToPlayer < 7.0) {
           item.velocity.y *= 0.95;
        }

        item.position.addScaledVector(item.velocity, delta);
        
        if (item.position.y <= item.groundY) {
          if (Math.abs(item.velocity.y) > 2 && !isPerformanceMode) {
            item.velocity.y *= -0.5;
            item.position.y = item.groundY + 0.01;
          } else {
            item.position.y = item.groundY;
            item.isGrounded = true;
            item.baseY = item.position.y;
          }
        }
        
        if (!isPerformanceMode) {
          item.rotation.x += delta * 5;
          item.rotation.z += delta * 3;
        }
      } else {
        if (!isPerformanceMode) {
          item.rotation.y += delta * 1.5;
          item.rotation.x *= 0.9;
          item.rotation.z *= 0.9;
        }
        item.position.y = item.baseY;

        if (Math.floor(time * 2) % 10 === 0) {
          const blockBelow = this.world.getBlock(Math.floor(item.position.x), Math.floor(item.position.y - 0.2), Math.floor(item.position.z));
          if (!isSolidBlock(blockBelow)) {
            item.isGrounded = false;
            let newGroundY = -64;
            for (let y = Math.floor(item.position.y - 0.2); y > -64; y--) {
              const block = this.world.getBlock(Math.floor(item.position.x), y, Math.floor(item.position.z));
              if (isSolidBlock(block)) {
                newGroundY = y + 1.15;
                break;
              }
            }
            item.groundY = newGroundY;
          }
        }
      }

      // Update INSTANCE MATRIX
      const count = this.itemCounts.get(item.type) || 0;
      if (count < this.MAX_INSTANCES) {
        const mesh = this.instancedMeshes.get(item.type)!;
        this.dummyQuaternion.setFromEuler(item.rotation);
        
        let renderPos = item.position.clone();
        if (item.isGrounded && !isPerformanceMode) {
          renderPos.y += Math.sin(time * 2 + item.position.x) * 0.1;
        }

        this.dummyMatrix.compose(renderPos, this.dummyQuaternion, item.scale);
        mesh.setMatrixAt(count, this.dummyMatrix);
        this.itemCounts.set(item.type, count + 1);
      }
    }

    // Apply counts to update
    this.instancedMeshes.forEach((mesh, type) => {
      mesh.count = this.itemCounts.get(type) || 0;
      if (mesh.count > 0) {
        mesh.instanceMatrix.needsUpdate = true;
      }
    });
  }

  setShadows(enabled: boolean) {
    this.instancedMeshes.forEach(mesh => {
      mesh.castShadow = enabled;
      mesh.receiveShadow = enabled;
    });
  }

  destroy() {
    this.instancedMeshes.forEach(mesh => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(m => m.dispose());
      } else {
        mesh.material.dispose();
      }
    });
    this.instancedMeshes.clear();
    this.items.clear();
  }
}
