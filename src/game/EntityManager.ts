import * as THREE from "three";
import { NPC, ShopItem } from "./NPC";
import { Minion } from "./Minion";
import { Mob, MobType } from "./Mob";
import { ItemType } from "./Inventory";
import { RemotePlayer } from "./RemotePlayer";
import { networkManager } from "./NetworkManager";
import { getBlockUVs, isSolidBlock, ATLAS_TILES } from "./TextureAtlas";
import { World } from "./World";
import { settingsManager } from "./Settings";
import { Rarity, ItemMetadata } from "./SkyBridgeManager";
import {
  DroppedItemData,
  DroppedItemInstancedManager,
} from "./DroppedItemInstancedManager";
import npcsData from "./data/npcs.json";
import { audioManager } from "./AudioManager";

export class EntityManager {
  npcs: Map<string, NPC> = new Map();
  remotePlayers: Map<string, RemotePlayer> = new Map();
  minions: Map<string, Minion> = new Map();
  mobs: Map<string, Mob> = new Map();
  scene: THREE.Scene;
  world: World;
  camera: THREE.Camera;
  textureAtlas: THREE.Texture | null = null;

  droppedItemManager: DroppedItemInstancedManager;
  private networkPlayerHitHandler = (e: any) => {
    const hits = Array.isArray(e.detail) ? e.detail : [e.detail];
    for (const hit of hits) {
      // If we are the attacker, we already played the client-side prediction
      if (hit.attackerId && hit.attackerId === networkManager.id)
        continue;

      const player = this.remotePlayers.get(hit.id);
      if (player) {
        if (hit.attackerId) {
          audioManager.playPositional("hit", player.group.position, 0.5, 0.9 + Math.random() * 0.2);
        }

        const dir = hit.knockbackDir;
        let kbDir = undefined;
        if (dir) {
          kbDir = new THREE.Vector3(dir.x, dir.y, dir.z);
        }
        player.takeDamage(kbDir);

        const { damage, isCrit } = hit;
        if (damage !== undefined && this.camera) {
          const pPos = player.group.position.clone().add(new THREE.Vector3(0, 1.5, 0));
          pPos.project(this.camera);
          // Only show if in front of camera
          if (pPos.z < 1) {
            const screenX = (pPos.x * 0.5 + 0.5) * window.innerWidth;
            const screenY = -(pPos.y * 0.5 - 0.5) * window.innerHeight;
            window.dispatchEvent(
              new CustomEvent("mobDamage", {
                detail: { amount: damage, isCrit: !!isCrit, screenX, screenY },
              }),
            );
          }
        }
      }
    }
  };

  private networkMobHitHandler = (e: any) => {
    const hits = Array.isArray(e.detail) ? e.detail : [e.detail];
    for (const hit of hits) {
      // If we are the attacker, we already played the client-side prediction
      if (hit.attackerId && hit.attackerId === networkManager.id)
        continue;

      const mob = this.mobs.get(hit.id);
      if (mob) {
        if (hit.attackerId) {
          audioManager.playPositional("hit", mob.position, 0.5, 0.9 + Math.random() * 0.2);
        }

        const dir = hit.knockbackDir;
        let kbDir = undefined;
        if (dir) {
          kbDir = new THREE.Vector3(dir.x, dir.y, dir.z);
        }
        mob.takeDamage(0, kbDir, false);
        // visual only, health updated via tick

        const { damage, isCrit } = hit;
        if (damage !== undefined && this.camera) {
          const pPos = mob.position.clone().add(new THREE.Vector3(0, 1.5, 0));
          pPos.project(this.camera);
          if (pPos.z < 1) {
            const screenX = (pPos.x * 0.5 + 0.5) * window.innerWidth;
            const screenY = -(pPos.y * 0.5 - 0.5) * window.innerHeight;
            window.dispatchEvent(
              new CustomEvent("mobDamage", {
                detail: { amount: damage, isCrit: !!isCrit, screenX, screenY },
              }),
            );
          }
        }
      }
    }
  };

  constructor(scene: THREE.Scene, world: World, camera: THREE.Camera) {
    this.scene = scene;
    this.world = world;
    this.camera = camera;
    this.droppedItemManager = new DroppedItemInstancedManager(
      scene,
      world,
      {} as any,
    ); // Initialize properly after setting texture Atlas

    // Only spawn hardcoded NPCs if we are not in hub mode or they are general NPCs
    // Actually, let's keep them and we'll add hub NPCs on top or instead.
    this.spawnInitialNPCs();

    // Connect network events
    networkManager.onMobSpawned = (data) => {
      const pos = new THREE.Vector3(
        data.position.x,
        data.position.y,
        data.position.z,
      );
      const mob = new Mob(
        data.id,
        pos,
        data.level || 1,
        data.type,
        this.textureAtlas,
        data.team,
      );
      if (data.health !== undefined) mob.health = data.health;
      if (data.maxHealth !== undefined) mob.maxHealth = data.maxHealth;
      if (data.scale) {
        mob.group.scale.set(data.scale, data.scale, data.scale);
      }
      this.addMob(mob);
    };

    networkManager.onMobsUpdate = (updates) => {
      const now = Date.now();
      for (const id in updates) {
        const mob = this.mobs.get(id);
        if (mob) {
          const data = updates[id]; // [x, y, z, health]
          mob.lastNetPos.copy(mob.group.position);
          mob.targetPosition.set(data[0], data[1], data[2]);
          mob.interpolationTimer = 0;
          mob.lastNetworkUpdate = now;
          mob.hasInitialPosition = true;

          if (data[3] !== undefined) {
            const serverHealth = data[3];
            if (now - mob.lastDamagePredictedTime < 500) {
              mob.health = Math.min(mob.health, serverHealth);
            } else {
              if (mob.health !== serverHealth) {
                mob.health = serverHealth;
              }
            }
          }
        }
      }
    };

    networkManager.onMobDespawned = (id) => {
      this.removeMob(id);
    };

    networkManager.onMinionSpawned = (data) => {
      const pos = new THREE.Vector3(
        data.position.x,
        data.position.y,
        data.position.z,
      );
      this.addMinionLocally(data.id, data.type, pos);
    };

    networkManager.onMinionDespawned = (id) => {
      this.removeMinionLocally(id);
    };

    networkManager.onMinionUpdate = (data) => {
      const minion = this.minions.get(data.id);
      if (minion) {
        if (data.storage > minion.storage) {
          minion.onProduce();
        }
        minion.storage = data.storage;
      }
    };

    window.addEventListener("networkPlayerHit", this.networkPlayerHitHandler);
    window.addEventListener("networkMobHit", this.networkMobHitHandler);

    window.addEventListener("networkPlayerDied", (e: Event) => {
      const customEvent = e as CustomEvent;
      const id = customEvent.detail.id;
      const player = this.remotePlayers.get(id);
      if (player) {
        player.isDead = true;
        player.group.visible = false;
      }
    });

    window.addEventListener("networkPlayerStatus", (e: Event) => {
      const customEvent = e as CustomEvent;
      const data = customEvent.detail;
      const player = this.remotePlayers.get(data.id);
      if (player) {
        if (data.isDead !== undefined) {
          player.isDead = data.isDead;
          player.group.visible = !data.isDead;
        }
        if (data.health !== undefined) player.health = data.health;
        if (data.isSpectator !== undefined)
          player.isSpectator = data.isSpectator;
      }
    });

    networkManager.onPlayerRespawn = (data) => {
      const player = this.remotePlayers.get(data.id);
      if (player) {
        player.isDead = false;
        player.isSpectator = false;
        if (data.team) {
          player.team = data.team;
          if ((player as any).updateTeam) (player as any).updateTeam(data.team);
        }
        player.targetPosition.set(
          data.position.x,
          data.position.y,
          data.position.z,
        );
        player.lastNetPos.set(
          data.position.x,
          data.position.y,
          data.position.z,
        );
        player.currentPos.set(
          data.position.x,
          data.position.y,
          data.position.z,
        );
        player.group.position.set(
          data.position.x,
          data.position.y,
          data.position.z,
        );
        if ((data as any).yaw !== undefined) {
          player.targetRotation.set(0, (data as any).yaw, 0);
          player.headYaw = (data as any).yaw;
          player.bodyYaw = (data as any).yaw;
          player.group.rotation.y = (data as any).yaw;
        }
      }
    };

    networkManager.onSkillUpdate = (data) => {
      const player = this.remotePlayers.get(data.id);
      if (player) {
        if (!player.skills) player.skills = {};
        player.skills[data.skill] = data.progress;
      }
    };
  }

  private spawnInitialMobs() {
    // Removed local spawning, now handled by server
  }

  // Provide getter for player backwards compatibility
  get droppedItems() {
    return this.droppedItemManager.items;
  }

  setTextureAtlas(texture: THREE.Texture) {
    this.textureAtlas = texture;
    this.droppedItemManager.textureAtlas = texture;
  }

  private spawnInitialNPCs() {
    // Spawn local NPCs immediately to prevent pop-in delay from the network
    const urlParams = new URLSearchParams(window.location.search);
    const serverName = urlParams.get("server") || "hub";
    const baseServerName = serverName.split("_")[0];

    const localNPCs = (npcsData as any)[baseServerName];
    if (localNPCs) {
      for (const npcData of localNPCs) {
        this.addNPCFromData(npcData);
      }
    }
  }

  addNPCFromData(data: any) {
    if (this.npcs.has(data.id)) return;
    const pos = new THREE.Vector3(
      data.position.x,
      data.position.y,
      data.position.z,
    );

    // Apply special settings only for the Hub NPCs (SkyBridge, SkyCastles, Voidtrail, Dungeon, Battle Royale)
    const isHubNPC = data.id.startsWith("hub_npc");
    const scale = isHubNPC ? 2.5 : data.scale || 1.0;
    const autoRotate = false; // Rotation disabled per user request

    const npc = new NPC(
      data.id,
      data.name,
      pos,
      data.shopItems || [],
      data.model,
      data.rotation || 0,
      scale,
      autoRotate,
    );
    this.addNPC(npc);
  }

  addNPC(npc: NPC) {
    this.npcs.set(npc.id, npc);
    this.scene.add(npc.group);
  }

  addMinion(id: string, type: ItemType, position: THREE.Vector3) {
    networkManager.spawnMinion(type as unknown as number, {
      x: position.x,
      y: position.y,
      z: position.z,
    });
  }

  addMinionLocally(id: string, type: ItemType, position: THREE.Vector3) {
    if (this.minions.has(id)) return;
    const minion = new Minion(id, type, position);
    this.minions.set(id, minion);
    this.scene.add(minion.mesh);
  }

  removeMinion(id: string) {
    networkManager.removeMinion(id);
  }

  removeMinionLocally(id: string) {
    const minion = this.minions.get(id);
    if (minion) {
      minion.mesh.traverse?.((child: any) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material)
          Array.isArray(child.material)
            ? child.material.forEach((m: any) => m.dispose())
            : child.material.dispose();
      });
      this.scene.remove(minion.mesh);
      this.minions.delete(id);
    }
  }

  addMob(mob: Mob) {
    if (this.mobs.has(mob.id)) {
      this.removeMob(mob.id);
    }
    this.mobs.set(mob.id, mob);
    this.scene.add(mob.group);
  }

  removeMob(id: string) {
    const mob = this.mobs.get(id);
    if (mob) {
      mob.group.traverse?.((child: any) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material)
          Array.isArray(child.material)
            ? child.material.forEach((m: any) => m.dispose())
            : child.material.dispose();
      });
      this.scene.remove(mob.group);
      this.mobs.delete(id);
    }
  }

  addRemotePlayer(id: string, skinSeed: string, name: string, team?: string) {
    if (!this.remotePlayers.has(id)) {
      const player = new RemotePlayer(id, skinSeed, name, this.scene, team);
      this.remotePlayers.set(id, player);
    } else {
      const player = this.remotePlayers.get(id);
      if (player) {
         if (player.name !== name) {
            player.name = name;
            player.updateNametag(name);
         }
         if (player.skinSeed !== skinSeed) {
            player.skinSeed = skinSeed;
            player.updateSkin(skinSeed);
         }
      }
    }
  }

  removeRemotePlayer(id: string) {
    const player = this.remotePlayers.get(id);
    if (player) {
      player.group.traverse?.((child: any) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material)
          Array.isArray(child.material)
            ? child.material.forEach((m: any) => m.dispose())
            : child.material.dispose();
      });
      this.scene.remove(player.group);
      this.remotePlayers.delete(id);
    }
  }

  updateRemotePlayer(id: string, data: any) {
    const player = this.remotePlayers.get(id);
    if (player) {
      player.lastNetPos.copy(player.currentPos);
      player.targetPosition.set(
        data.position.x,
        data.position.y,
        data.position.z,
      );
      player.interpolationTimer = 0;

      player.targetRotation.set(
        data.rotation.x,
        data.rotation.y,
        data.rotation.z,
      );
      player.isFlying = data.isFlying;
      player.isSwimming = data.isSwimming;
      player.isCrouching = data.isCrouching;
      player.isSprinting = data.isSprinting;
      player.isSwinging = data.isSwinging;
      player.isGliding = data.isGliding;
      player.swingSpeed = data.swingSpeed || 15;
      player.isGrounded =
        data.isGrounded !== undefined ? data.isGrounded : true;
      if (data.heldItem !== undefined) {
        player.setHeldItem(data.heldItem, data.offHandItem || 0);
      }
      if (data.skills) {
        player.skills = data.skills;
      }
      if (data.isSwinging && !player.isSwinging) {
        player.isSwinging = true;
        player.swingTimer = 0;
      }
      player.isBlocking = !!data.isBlocking;
      if (data.health !== undefined) {
        player.health = data.health;
      }
    }
  }

  addDroppedItem(
    id: string,
    type: ItemType,
    position: THREE.Vector3,
    initialVelocity?: THREE.Vector3,
  ) {
    this.droppedItemManager.addDroppedItem(id, type, position, initialVelocity);
  }

  removeDroppedItem(id: string) {
    this.droppedItemManager.removeDroppedItem(id);
  }

  setShadows(enabled: boolean) {
    const traverse = (group: THREE.Group | THREE.Object3D) => {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = enabled;
          child.receiveShadow = enabled;
        }
      });
    };

    this.npcs.forEach((npc) => traverse(npc.group));
    this.remotePlayers.forEach((player) => traverse(player.group));
    this.minions.forEach((minion) => traverse(minion.mesh));
    this.mobs.forEach((mob) => traverse(mob.group));
    this.droppedItemManager.setShadows(enabled);
  }

  update(playerPos: THREE.Vector3, delta: number) {
    for (const npc of this.npcs.values()) {
      npc.update(playerPos, delta);
    }
    for (const player of this.remotePlayers.values()) {
      player.update(delta, playerPos);
    }
    for (const minion of this.minions.values()) {
      minion.update(Date.now());
    }
    const now = Date.now();
    const isPerformanceMode = settingsManager.getSettings().performanceMode;
    for (const mob of this.mobs.values()) {
      // 10 seconds without updates = probably out of range or dead, despawn locally (except for bosses like Morvane)
      if (
        mob.type !== MobType.MORVANE &&
        now - (mob.lastNetworkUpdate || Date.now()) > 10000
      ) {
        this.removeMob(mob.id);
        continue;
      }

      // Distance based optimization for performance mode
      if (isPerformanceMode && playerPos) {
        const distSq = mob.position.distanceToSquared(playerPos);
        if (distSq > 900 && mob.type !== MobType.MORVANE) {
          // > 30 blocks
          mob.group.visible = false;
          continue;
        }
        mob.group.visible = true;
      }

      mob.update(playerPos, delta, this.world);
    }

    // Animate dropped items via instanced manager
    this.droppedItemManager.update(playerPos, delta, isPerformanceMode);
  }

  raycastNPC(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number,
    camera?: THREE.Camera,
  ): NPC | null {
    const ray = new THREE.Ray(origin, direction);
    let closestNPC: NPC | null = null;
    let closestDistance = maxDistance;

    for (const npc of this.npcs.values()) {
      const box = npc.getHitbox();
      const target = new THREE.Vector3();
      if (ray.intersectBox(box, target)) {
        const dist = origin.distanceTo(target);
        if (dist < closestDistance) {
          closestDistance = dist;
          closestNPC = npc;
        }
      }
    }
    return closestNPC;
  }

  raycastMob(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number,
    camera?: THREE.Camera,
  ): Mob | null {
    const ray = new THREE.Ray(origin, direction);
    let closestMob: Mob | null = null;
    let closestDistance = maxDistance;

    for (const mob of this.mobs.values()) {
      const box = mob.getHitbox();
      const target = new THREE.Vector3();
      if (ray.intersectBox(box, target)) {
        const dist = origin.distanceTo(target);
        const limit = mob.type === MobType.MORVANE ? 50 : maxDistance;
        if (dist < limit) {
          if (dist < closestDistance) {
            closestDistance = dist;
            closestMob = mob;
          }
        }
      }
    }
    return closestMob;
  }

  raycastMinion(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number,
    camera?: THREE.Camera,
  ): Minion | null {
    const ray = new THREE.Ray(origin, direction);
    let closestMinion: Minion | null = null;
    let closestDistance = maxDistance;

    for (const minion of this.minions.values()) {
      const box = minion.getHitbox();
      const target = new THREE.Vector3();
      if (ray.intersectBox(box, target)) {
        const dist = origin.distanceTo(target);
        if (dist < closestDistance) {
          closestDistance = dist;
          closestMinion = minion;
        }
      }
    }
    return closestMinion;
  }

  raycastPlayer(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number,
    camera?: THREE.Camera,
  ): RemotePlayer | null {
    const ray = new THREE.Ray(origin, direction);
    let closestPlayer: RemotePlayer | null = null;
    let closestDistance = maxDistance;

    for (const player of this.remotePlayers.values()) {
      const box = player.getHitbox();
      const target = new THREE.Vector3();
      if (ray.intersectBox(box, target)) {
        const dist = origin.distanceTo(target);
        if (dist < closestDistance) {
          closestDistance = dist;
          closestPlayer = player;
        }
      }
    }
    return closestPlayer;
  }

  clearEntities() {
    const disposeObject = (obj: any) => {
      if (!obj) return;
      obj.traverse?.((child: any) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m: any) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      if (obj.parent) obj.parent.remove(obj);
    };

    this.npcs.forEach((npc) => disposeObject(npc.group));
    this.minions.forEach((minion) => disposeObject(minion.mesh));
    this.mobs.forEach((mob) => disposeObject(mob.group));
    this.remotePlayers.forEach((player) => disposeObject(player.group));

    this.npcs.clear();
    this.minions.clear();
    this.mobs.clear();
    this.remotePlayers.clear();

    const oldTexture = this.droppedItemManager?.textureAtlas;
    if (this.droppedItemManager) {
      this.droppedItemManager.destroy();
    }
    this.droppedItemManager = new DroppedItemInstancedManager(
      this.scene,
      this.world,
      {} as any,
    );
    if (oldTexture) {
      this.droppedItemManager.textureAtlas = oldTexture;
    }
  }

  destroy() {
    window.removeEventListener(
      "networkPlayerHit",
      this.networkPlayerHitHandler,
    );
    window.removeEventListener("networkMobHit", this.networkMobHitHandler);

    // Clear network handlers we set
    if (networkManager) {
      networkManager.onMobSpawned = undefined;
      networkManager.onMobsUpdate = undefined;
      networkManager.onMobDespawned = undefined;
      networkManager.onRequestSpawnCheck = undefined;
      networkManager.onMinionSpawned = undefined;
      networkManager.onMinionDespawned = undefined;
      networkManager.onMinionUpdate = undefined;
      networkManager.onMinionCollected = undefined;
    }

    const disposeObject = (obj: any) => {
      if (!obj) return;
      obj.traverse?.((child: any) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m: any) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      if (obj.parent) obj.parent.remove(obj);
    };

    this.npcs.forEach((npc) => disposeObject(npc.group));
    this.remotePlayers.forEach((player) => disposeObject(player.group));
    this.minions.forEach((minion) => disposeObject(minion.mesh));
    this.mobs.forEach((mob) => disposeObject(mob.group));

    this.npcs.clear();
    this.remotePlayers.clear();
    this.minions.clear();
    this.mobs.clear();

    this.droppedItemManager.destroy(); // Optional, but good practice
  }
}
