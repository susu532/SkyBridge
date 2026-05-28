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
import { IPlayerUpdate, IMobState, IMinionState } from "../types/shared";
import { useGameStore } from "../store/gameStore";

export interface Arrow {
  group: THREE.Group;
  velocity: THREE.Vector3;
  power: number;
  shooterId: string;
  isLocalPlayer: boolean;
  dispose: () => void;
  disposeTimer?: any;
}

export class EntityManager {
  npcs: Map<string, NPC> = new Map();
  remotePlayers: Map<string, RemotePlayer> = new Map();
  minions: Map<string, Minion> = new Map();
  mobs: Map<string, Mob> = new Map();
  arrows: Set<Arrow> = new Set();
  scene: THREE.Scene;
  world: World;
  camera: THREE.Camera;
  textureAtlas: THREE.Texture | null = null;

  droppedItemManager: DroppedItemInstancedManager;
  private networkPlayerHitHandler = (e: any) => {
    if (this.world.isHub) return;
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
    networkManager.onMobSpawned = (data: IMobState) => {
      const pos = new THREE.Vector3(
        data.position.x,
        data.position.y,
        data.position.z,
      );
      const mob = new Mob(
        data.id,
        pos,
        data.level || 1,
        data.type as any,
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
          if (mob.updatePositionFromServer) {
            mob.updatePositionFromServer(data[0], data[1], data[2]);
          } else {
            // Fallback if missing
            if(mob.targetPosition) mob.targetPosition.set(data[0], data[1], data[2]);
          }
          mob.interpolationTimer = 0;
          mob.lastNetworkUpdate = now;
          mob.hasInitialPosition = true;

          if (data[3] !== undefined) {
            const serverHp = data[3] as number;
            // Prevent jitter and prioritize lowest health locally (or after timeout)
            if (now - mob.lastDamagePredictedTime > 500 || serverHp < mob.health) {
              mob.health = serverHp;
            }
          }
        }
      }
    };

    networkManager.onMobDespawned = (id) => {
      this.removeMob(id);
    };

    networkManager.onMinionSpawned = (data: IMinionState) => {
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

    networkManager.onPlayerRespawn = (data: IPlayerUpdate & { position: { x: number, y: number, z: number }, yaw?: number }) => {
      const player = this.remotePlayers.get(data.id);
      if (player) {
        player.isDead = false;
        player.isSpectator = false;
        player.group.visible = true;
        if (data.team !== undefined) {
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
    const serverName = urlParams.get("server") || "dungeondelver";
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

  private mobPool: Map<string, Mob[]> = new Map();

  createMob(id: string, startPos: THREE.Vector3, level: number, type: any, textureAtlas: THREE.Texture | null, team?: string): Mob {
    let pool = this.mobPool.get(type);
    if (!pool) {
      pool = [];
      this.mobPool.set(type, pool);
    }
    const mob = pool.pop();
    if (mob) {
      mob.id = id;
      mob.level = level;
      mob.team = team;
      mob.group.position.copy(startPos);
      mob.group.rotation.set(0,0,0);
      mob.currentPos.copy(startPos);
      mob.lastNetPos.copy(startPos);
      mob.targetPosition?.copy(startPos);
      mob.health = mob.maxHealth = 100; // placeholder reset
      mob.isDead = false;
      mob.isDying = false;
      mob.deathTimer = 0;
      mob.interpolationTimer = 0;
      mob.group.scale.set(1,1,1);
      
      // Reset rotation of children to 0
      mob.group.children.forEach(child => {
        child.rotation.set(0,0,0);
      });
      // specific limbs are inside Mob.head etc, their rotations will be overwritten by animation anyway
      return mob;
    }
    return new Mob(id, startPos, level, type, textureAtlas, team);
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
      this.scene.remove(mob.group);
      this.mobs.delete(id);
      
      const type = mob.type;
      let pool = this.mobPool.get(type);
      if (!pool) {
        pool = [];
        this.mobPool.set(type, pool);
      }
      pool.push(mob);
    }
  }

  private remotePlayerPool: RemotePlayer[] = [];

  addRemotePlayer(id: string, skinSeed: string, name: string, team?: string) {
    if (!this.remotePlayers.has(id)) {
      let player = this.remotePlayerPool.pop();
      if (player) {
         player.id = id;
         player.name = name;
         player.skinSeed = skinSeed;
         player.team = team;
       
         if (typeof (player as any).updateTeam === 'function') {
            (player as any).updateTeam(team);
         }
         player.updateSkin(skinSeed);
         player.updateNametag(name);
         player.health = 100;
         player.isDead = false;
         player.isSpectator = false;
         player.group.position.set(0,0,0);
         player.currentPos.set(0,0,0);
         player.lastNetPos.set(0,0,0);
         player.targetPosition.set(0,0,0);
         player.group.visible = true;
         this.scene.add(player.group);
         this.remotePlayers.set(id, player);
      } else {
         player = new RemotePlayer(id, skinSeed, name, this.scene, team);
         
         this.remotePlayers.set(id, player);
      }
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
         if (player.team !== team && typeof (player as any).updateTeam === 'function') {
            (player as any).updateTeam(team);
         }
      }
    }
  }

  removeRemotePlayer(id: string) {
    const player = this.remotePlayers.get(id);
    if (player) {
      this.scene.remove(player.group);
      this.remotePlayers.delete(id);
      this.remotePlayerPool.push(player);
    }
  }

  updateRemotePlayer(id: string, data: Partial<IPlayerUpdate> & { position?: { x: number, y: number, z: number }, rotation?: { x: number, y: number, z: number }, isFlying?: boolean, isSwimming?: boolean, isCrouching?: boolean, isSprinting?: boolean, isSwinging?: boolean, isGliding?: boolean, isInvulnerable?: boolean, swingSpeed?: number, isGrounded?: boolean, heldItem?: number, offHandItem?: number, isBlocking?: boolean }) {
    const player = this.remotePlayers.get(id);
    if (player) {
      player.lastNetPos.copy(player.currentPos);
      player.targetPosition.set(
        data.position.x,
        data.position.y,
        data.position.z,
      );
      
      const rotEuler = new THREE.Euler(
        data.rotation!.x,
        data.rotation!.y,
        data.rotation!.z,
      );
      player.addSnapshot(player.targetPosition, rotEuler);
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
      player.isInvulnerable = data.isInvulnerable;
      if (data.team !== undefined && data.team !== player.team) {
        player.updateTeam(data.team);
      }
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
    const projScreenMatrix = new THREE.Matrix4();
    projScreenMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    const frustum = new THREE.Frustum();
    frustum.setFromProjectionMatrix(projScreenMatrix);

    for (const npc of this.npcs.values()) {
      npc.update(playerPos, delta);
    }
    const isPerformanceMode = settingsManager.getSettings().performanceMode;
    const isMobile = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    
    for (const player of this.remotePlayers.values()) {
      let isVisible = true;
      const distSq = player.group.position.distanceToSquared(playerPos);
      if (distSq > 64) { // 8 blocks distance minimum
          isVisible = frustum.intersectsSphere(new THREE.Sphere(player.group.position, 3.0));
      }
      
      if (isPerformanceMode && distSq > (isMobile ? 900 : 2500)) { // 30 or 50 blocks
          isVisible = false;
      }
      
      player.group.visible = isVisible;
      if (isVisible) {
          player.update(delta, playerPos, this.world);
      } else {
          // Keep internal tracking minimal
          player.currentPos.copy(player.targetPosition);
          player.group.position.copy(player.currentPos);
      }
    }
    for (const minion of this.minions.values()) {
      minion.update(Date.now());
    }
    const now = Date.now();
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

    const scale = delta / 0.05;
    const localAdd = new THREE.Vector3();
    const toRemove: Arrow[] = [];
    for (const arrow of this.arrows) {
      if (arrow.disposeTimer) continue;

      const oldPos = arrow.group.position.clone();
      localAdd.copy(arrow.velocity).multiplyScalar(0.05 * scale);
      arrow.group.position.add(localAdd);
      arrow.velocity.y -= 0.5 * scale;
      localAdd.copy(arrow.group.position).add(arrow.velocity);
      arrow.group.lookAt(localAdd);

      if (arrow.isLocalPlayer) {
        let hitSomething = false;
        const hitSteps = Math.max(1, Math.ceil(oldPos.distanceTo(arrow.group.position) / 0.1));

        for (let step = 1; step <= hitSteps; step++) {
          const t = step / hitSteps;
          const testPos = oldPos.clone().lerp(arrow.group.position, t);

          // Check if arrow hit a solid block/wall before scanning targets behind it
          const blockAtPos = this.world.getBlock(Math.floor(testPos.x), Math.floor(testPos.y), Math.floor(testPos.z));
          if (blockAtPos !== 0 && isSolidBlock(blockAtPos)) {
            hitSomething = true;
            arrow.group.position.copy(testPos);
            break;
          }

          // Check player hits
          for (const [id, rp] of this.remotePlayers.entries()) {
            const dy = testPos.y - rp.currentPos.y;
            const dx = testPos.x - rp.currentPos.x;
            const dz = testPos.z - rp.currentPos.z;
            const horizontalDist = Math.sqrt(dx * dx + dz * dz);

            if (horizontalDist < 0.6 && dy >= 0 && dy <= 1.9) {
              const localPlayerTeam = useGameStore.getState().playerTeam;
              const isSkyCastles = networkManager.serverName.startsWith('skycastles');
              if (isSkyCastles && localPlayerTeam && rp.team && rp.team === localPlayerTeam) {
                 continue; // Friendly fire disabled
              }
              const damage = 20 * arrow.power;
              const isCrit = arrow.power > 0.9;
              const kbDir = arrow.velocity.clone().normalize();
              // Attack the remote player
              networkManager.attack(id, false, kbDir, false, damage, isCrit, true);
              // Local prediction for visual feedback
              rp.takeDamage(kbDir);
              
              if (this.camera) {
                const pPos = rp.group.position.clone().add(new THREE.Vector3(0, 1.5, 0));
                pPos.project(this.camera);
                const screenX = (pPos.x * 0.5 + 0.5) * window.innerWidth;
                const screenY = -(pPos.y * 0.5 - 0.5) * window.innerHeight;
                window.dispatchEvent(new CustomEvent('mobDamage', { detail: { amount: Math.floor(damage), isCrit, screenX, screenY } }));
              }
              
              hitSomething = true;
              break;
            }
          }
          if (hitSomething) break;

          // Check mob hits
          for (const [id, mob] of this.mobs.entries()) {
            const dy = testPos.y - mob.position.y;
            const dx = testPos.x - mob.position.x;
            const dz = testPos.z - mob.position.z;
            const horizontalDist = Math.sqrt(dx * dx + dz * dz);

            const isMorvane = mob.type === "Morvane";
            const maxHorizontalDist = isMorvane ? 3.0 : 0.8;
            // Morvane's mesh visually floats by ~2-3 units, and has height 9, so arrows hit up to dy=12
            const maxHeight = isMorvane ? 12.0 : 2.2;
            const minHeight = isMorvane ? -1.0 : 0;

            if (horizontalDist < maxHorizontalDist && dy >= minHeight && dy <= maxHeight) {
              const localPlayerTeam = useGameStore.getState().playerTeam;
              const isSkyCastles = networkManager.serverName.startsWith('skycastles');
              if (isSkyCastles && localPlayerTeam && mob.team && mob.team === localPlayerTeam) {
                 continue; // Friendly fire disabled
              }
              const damage = 20 * arrow.power;
              const kbDir = arrow.velocity.clone().normalize();
              // Attack the mob
              networkManager.attack(id, true, kbDir, false, damage, arrow.power > 0.9, true);
              // Local prediction for visual feedback
              mob.takeDamage(damage, kbDir);
              hitSomething = true;
              break;
            }
          }
          if (hitSomething) break;
        }

        if (hitSomething) {
          toRemove.push(arrow);
          continue;
        }
      }

      const b = this.world.getBlock(Math.floor(arrow.group.position.x), Math.floor(arrow.group.position.y), Math.floor(arrow.group.position.z));
      if (b !== 0 && isSolidBlock(b)) {
        arrow.disposeTimer = setTimeout(() => {
          arrow.dispose();
        }, 1000);
      }
    }
    
    for (const arrow of toRemove) {
        arrow.dispose();
    }

    // Animate dropped items via instanced manager
    this.droppedItemManager.update(playerPos, delta, isPerformanceMode);
  }

  shootArrow(shooterId: string, startPos: THREE.Vector3, velocity: THREE.Vector3, power: number, isLocalPlayer: boolean) {
    const arrowGroup = new THREE.Group();
    // Shaft
    const shaftGeo = new THREE.BoxGeometry(0.05, 0.05, 0.6);
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    arrowGroup.add(shaft);
    // Head
    const headGeo = new THREE.BoxGeometry(0.08, 0.08, 0.1);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xaabbcc });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.z = -0.3;
    arrowGroup.add(head);

    arrowGroup.position.copy(startPos);
    
    // Calculate look target from velocity vector
    const lookTarget = startPos.clone().add(velocity);
    arrowGroup.lookAt(lookTarget);
    
    this.scene.add(arrowGroup);
    
    audioManager.playPositional("bow_shoot", startPos, 0.6, 0.9 + Math.random() * 0.2, 30);

    const arrowObj: Arrow = {
      group: arrowGroup,
      velocity: velocity.clone(),
      power: power,
      shooterId: shooterId,
      isLocalPlayer: isLocalPlayer,
      dispose: () => {
        if (arrowGroup.parent) arrowGroup.parent.remove(arrowGroup);
        shaftGeo.dispose();
        shaftMat.dispose();
        headGeo.dispose();
        headMat.dispose();
        this.arrows.delete(arrowObj);
      }
    };

    this.arrows.add(arrowObj);
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
    let closestDistance = Infinity;

    for (const mob of this.mobs.values()) {
      const box = mob.getHitbox();
      const target = new THREE.Vector3();
      if (ray.intersectBox(box, target)) {
        const dist = origin.distanceTo(target);
        const limit = mob.type === MobType.MORVANE ? 7 : maxDistance;
        if (dist < limit) {
          if (dist < closestDistance) {
            closestDistance = dist;
            closestMob = mob;
          }
        }
      }
    }

    if (closestMob && closestDistance !== Infinity) {
      // Check for solid wall blocking line of sight
      const blockHit = this.world.raycast(origin, direction, closestDistance, true);
      if (blockHit.hit) {
        return null; // Blocked by wall
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

    if (closestPlayer) {
      // Check for solid wall blocking line of sight
      const blockHit = this.world.raycast(origin, direction, closestDistance, true);
      if (blockHit.hit) {
        return null; // Blocked by wall
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
