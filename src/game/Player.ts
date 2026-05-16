import { getMiningStats } from './MiningStats';
import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { World } from "./World";
import {
  BLOCK,
  isSolidBlock,
  isSlab,
  createTextureAtlas,
  getBlockUVs,
  createBreakingTexture,
  isPlant,
  ATLAS_TILES,
  isFlatItem,
  isWater,
} from "./TextureAtlas";
import { Inventory, ItemType } from "./Inventory";
import { ITEM_NAMES } from "./Constants";
import { EntityManager } from "./EntityManager";
import { generateSkin, applySkinUVs } from "./SkinManager";
import { networkManager } from "./NetworkManager";
import { settingsManager } from "./Settings";
import { skyBridgeManager, SkillType } from "./SkyBridgeManager";
import { audioManager } from "./AudioManager";
import { useGameStore } from "../store/gameStore";
import { createItemModel } from "./ItemModels";

import { PlayerRenderer } from "./PlayerRenderer";
import { PlayerInputController } from "./PlayerInputController";
import { PlayerPhysics } from "./PlayerPhysics";
import { updatePlayer } from "./PlayerUpdate";

const _rayDir = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _offset = new THREE.Vector3();

export enum Perspective {
  FIRST_PERSON = 0,
  THIRD_PERSON_BACK = 1,
  THIRD_PERSON_FRONT = 2,
}

export class Player {
  camera: THREE.PerspectiveCamera;
  controls: PointerLockControls;
  world: World;
  entityManager: EntityManager;
  renderer: PlayerRenderer;
  inputController: PlayerInputController;
  physics: PlayerPhysics;
  inventory = new Inventory(37);
  chestInventories = new Map<string, Inventory>();
  _chestInventory = new Inventory(27);
  get chestInventory() { return this._chestInventory; }
  set chestInventory(inv: Inventory) { this._chestInventory = inv; }
  private _hotbarIndex = 0;
  get hotbarIndex() {
    return this._hotbarIndex;
  }
  set hotbarIndex(val: number) {
    this._hotbarIndex = val;
    useGameStore.getState().setHotbarIndex(val);
  }

  velocity = new THREE.Vector3();
  knockbackVelocity = new THREE.Vector3();
  direction = new THREE.Vector3();

  isFlying = false;
  isGliding = false;
  isSwimming = false;
  isUnderwater = false;
  isUnderLava = false;
  isZooming = false;
  isSpectator = false;
  isDeadThisFrame = false;
  isDead = false;
  perspective: Perspective = Perspective.FIRST_PERSON;
  shakeIntensity = 0;
  shakeDecay = 5;
  canJump = false;
  hasReceivedInitialRespawn = false;
  health = 100;
  maxHealth = 100;

  currentCameraHeight = 1.6;
  targetCameraHeight = 1.6;
  baseFOV = 75;
  targetFOV = 75;
  lastAttackTime = 0;

  speed = 5.5;
  sprintSpeed = 8.5;
  flySpeed = 20.0;
  crouchSpeed = 1.3;
  jumpForce = 8.5;
  gravity = 28.0;

  standingHeight = 1.6;
  crouchHeight = 1.3;
  playerHeight = 1.6;
  playerRadius = 0.3;
  sensitivity = 0.002;
  cameraPitch = 0;
  cameraYaw = 0;
  cameraYOffset = 0;

  worldPosition = new THREE.Vector3(0, 10, 0);
  lastWorldPosition = new THREE.Vector3(0, 10, 0);
  currentModelType: ItemType | null = null;
  playerHeadPos = new THREE.Vector3();

  // Animation state
  walkCycle = 0;
  swingTimer = 0;
  swingSpeed = 18;
  isSwinging = false;
  lookSwayX = 0;
  lookSwayY = 0;
  mouseDeltaX = 0;
  mouseDeltaY = 0;
  idleTime = 0;
  capeVelocity = 0;
  capeAngle = 0.1;
  lastNetworkSyncTime = 0;
  lastStateHash = "";

  syncEuler = new THREE.Euler(0, 0, 0, "YXZ");
  syncPos = new THREE.Vector3();
  lastSyncPos?: THREE.Vector3;
  lastSyncEuler?: THREE.Euler;

  // Mining state
  isLeftMouseDown = false;
  isMining = false;
  miningTarget: THREE.Vector3 | null = null;
  miningProgress = 0;
  miningTimeRequired = 0.4; // Default base time
  canHarvestTarget = true;
  isBlocking = false;
  lastCreativeBreakTime = 0;

  // Animation states
  wasInAir = false;
  landingTimer = 0;
  crouchTransition = 0;
  highestY = 0;

  // Animation transitions
  swimTransition = 0;
  flyTransition = 0;
  blockTransition = 0;
  climbTransition = 0;
  rightClickTimer = 0;

  get headMesh() {
    return this.renderer.headMesh;
  }
  get neckMesh() {
    return this.renderer.neckMesh;
  }
  get bodyMesh() {
    return this.renderer.bodyMesh;
  }
  get modelGroup() {
    return this.renderer.modelGroup;
  }
  get leftLegMesh() {
    return this.renderer.leftLegMesh;
  }
  get rightLegMesh() {
    return this.renderer.rightLegMesh;
  }
  get leftArmMesh() {
    return this.renderer.leftArmMesh;
  }
  get rightArmMesh() {
    return this.renderer.rightArmMesh;
  }
  get capeMesh() {
    return this.renderer.capeMesh;
  }
  get fpArmGroup() {
    return this.renderer.fpArmGroup;
  }
  get fpArmMesh() {
    return this.renderer.fpArmMesh;
  }
  get fpBlockMesh() {
    return this.renderer.fpBlockMesh;
  }
  get fpHeldItemModel() {
    return this.renderer.fpHeldItemModel;
  }
  get fpOffHandArmGroup() {
    return this.renderer.fpOffHandArmGroup;
  }
  get breakingMesh() {
    return this.renderer.breakingMesh;
  }

  team?: string;

  constructor(
    camera: THREE.PerspectiveCamera,
    controls: PointerLockControls,
    world: World,
    entityManager: EntityManager,
  ) {
    this.camera = camera;
    this.controls = controls;
    this.world = world;
    this.entityManager = entityManager;

    // Add random offsets so players don't all spawn exactly inside each other
    const rx = (Math.random() - 0.5) * 4;
    const rz = (Math.random() - 0.5) * 4;

    this.worldPosition = new THREE.Vector3(rx, 10, rz);

    // Initial position on the bridge
    this.camera.position.set(rx, 6, rz);

    this.renderer = new PlayerRenderer(this);
    this.world.scene.add(this.renderer.modelGroup);

    // Initialize camera rotation state
    const urlParams = new URLSearchParams(window.location.search);
    const serverName = urlParams.get("server") || "hub";
    const isHub = serverName.startsWith("hub");

    if (isHub) {
      this.camera.quaternion.setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        Math.PI,
      );
      this.inventory.clear();
      this.hotbarIndex = 0;
    } else if (serverName.startsWith("skycastles")) {
      this.setupSkyCastlesInventory();
    }

    const euler = new THREE.Euler(0, 0, 0, "YXZ");
    euler.setFromQuaternion(this.camera.quaternion);
    this.cameraYaw = euler.y;
    this.cameraPitch = euler.x;

    this.camera.add(this.renderer.fpArmGroup);
    // Ensure camera is in scene so its children (arm) render
    this.world.scene.add(this.camera);
    if (this.renderer.breakingMesh) {
      this.world.scene.add(this.renderer.breakingMesh);
    }

    this.inputController = new PlayerInputController(this);
    this.physics = new PlayerPhysics(this);
    this.inputController.bindEvents();

    window.addEventListener("networkPlayerHit", this.onNetworkPlayerHit);
    window.addEventListener(
      "networkPlayerRespawn",
      this.onNetworkPlayerRespawn,
    );
    window.addEventListener("networkPlayerDied", this.onNetworkPlayerDied);
    window.addEventListener("becomeSpectator", this.onBecomeSpectator);
    window.addEventListener(
      "itemAcquired",
      this.onItemAcquired as EventListener,
    );
  }

  onItemAcquired = (e: any) => {
    this.inventory.addItem(e.detail.type, e.detail.count);
  };

  onNetworkPlayerDied = (e: any) => {
    if (e.detail.id === networkManager.id) {
      if (!this.isDead && !this.isSpectator) {
        this.takeDamage(1000000, undefined, true); // Instantly die locally without bouncing back to server
      }
    }
  };

  onBecomeSpectator = () => {
    this.isSpectator = true;
    this.isDead = false;
    this.isFlying = true;
    window.dispatchEvent(new CustomEvent("playerRespawn")); // Hide death screen
    useGameStore
      .getState()
      .addMessage("You are now spectating. Fly around!", "#FFFF55");
  };

  onNetworkPlayerHit = (e: any) => {
    if (e.detail.id === networkManager.id) {
      this.takeDamage(
        e.detail.damage,
        new THREE.Vector3(
          e.detail.knockbackDir.x,
          e.detail.knockbackDir.y,
          e.detail.knockbackDir.z,
        ),
        true,
      );
    }
  };

  onNetworkPlayerRespawn = (e: any) => {
    if (e.detail.id === networkManager.id) {
      if (e.detail.team !== undefined) {
        this.team = e.detail.team;
        this.renderer.updateTeam(this.team);
        useGameStore.getState().setPlayerTeam(this.team || null);
      }

      const wasDead = this.isDead || this.isSpectator;
      this.isDead = false;
      this.isSpectator = false;
      this.isFlying = false;
      this.isDeadThisFrame = true; // For camera reset
      this.worldPosition.set(
        e.detail.position.x,
        e.detail.position.y + this.playerHeight,
        e.detail.position.z,
      );
      this.velocity.set(0, 0, 0);

      if (e.detail.yaw !== undefined) {
        this.cameraYaw = e.detail.yaw;
        this.cameraPitch = 0;
        this.camera.quaternion.setFromEuler(
          new THREE.Euler(this.cameraPitch, this.cameraYaw, 0, "YXZ"),
        );
        if (this.modelGroup) {
          this.modelGroup.rotation.y = this.cameraYaw;
        }
      }
      this.hasReceivedInitialRespawn = true;
      skyBridgeManager.stats.health = skyBridgeManager.effectiveStats.maxHealth;
      this.health = skyBridgeManager.stats.health;

      if (useGameStore.getState().currentMode.startsWith('battleroyale') && e.detail.position.y >= 50) {
        this.isGliding = true;
      }

      const modeWithoutNum = useGameStore.getState().currentMode.split('_')[0];
      let itemsAdded = false;

      const getInventoryCount = (type: ItemType) => {
        let cnt = 0;
        for (const slot of this.inventory.slots) {
          if (slot && slot.type === type) cnt += slot.count;
        }
        return cnt;
      };

      if (modeWithoutNum === 'skycastles') {
        if (getInventoryCount(ItemType.WOODEN_SWORD) === 0) {
          this.inventory.addItem(ItemType.WOODEN_SWORD, 1);
          itemsAdded = true;
        }
        if (getInventoryCount(ItemType.TORCH) === 0) {
          this.inventory.addItem(ItemType.TORCH, 1);
          itemsAdded = true;
        }
        const planksCount = getInventoryCount(ItemType.PLANKS);
        if (planksCount < 10) {
          this.inventory.addItem(ItemType.PLANKS, 10 - planksCount);
          itemsAdded = true;
        }
      } else if (modeWithoutNum === 'dungeondelver') {
        if (getInventoryCount(ItemType.STONE_SWORD) === 0) {
          this.inventory.addItem(ItemType.STONE_SWORD, 1);
          itemsAdded = true;
        }
        const appleCount = getInventoryCount(ItemType.APPLE);
        if (appleCount < 8) {
          this.inventory.addItem(ItemType.APPLE, 8 - appleCount);
          itemsAdded = true;
        }
        if (!this.inventory.slots[Inventory.OFF_HAND_SLOT] || this.inventory.slots[Inventory.OFF_HAND_SLOT]?.type !== ItemType.TORCH) {
           this.inventory.slots[Inventory.OFF_HAND_SLOT] = { type: ItemType.TORCH, count: 1 };
           itemsAdded = true;
        }
      }
      
      if (itemsAdded) {
        useGameStore.getState().incrementInventoryVersion();
      }

      window.dispatchEvent(new CustomEvent("playerRespawn"));
      if (wasDead) {
        useGameStore.getState().addMessage("You respawned!", "#55FF55");
      }
    }
  };

  destroy() {
    this.inputController.destroy();
    window.removeEventListener("networkPlayerHit", this.onNetworkPlayerHit);
    window.removeEventListener(
      "networkPlayerRespawn",
      this.onNetworkPlayerRespawn,
    );
    window.removeEventListener("becomeSpectator", this.onBecomeSpectator);

    // Dispose renderer resources
    if (this.renderer.modelGroup) {
      this.renderer.modelGroup.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((m) => m.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    }
  }

  get position() {
    return this.worldPosition;
  }

  setupSkyCastlesInventory() {
    this.inventory.clear();
    this.chestInventories.clear();
    this.chestInventory = new Inventory(27);
    this.inventory.addItem(ItemType.WOODEN_SWORD, 1);
    this.inventory.addItem(ItemType.TORCH, 1);
    this.inventory.addItem(ItemType.PLANKS, 10);
    this.hotbarIndex = 0;
    useGameStore.getState().incrementInventoryVersion();
  }

  setupDungeonDelverInventory() {
    this.inventory.clear();
    this.chestInventories.clear();
    this.chestInventory = new Inventory(27);
    
    // Core starter gear for Delver
    this.inventory.addItem(ItemType.STONE_SWORD, 1);
    this.inventory.addItem(ItemType.APPLE, 8);
    
    // The requested Off-hand Torch (exactly 1)
    this.inventory.slots[Inventory.OFF_HAND_SLOT] = {
      type: ItemType.TORCH,
      count: 1
    };
    
    this.hotbarIndex = 0;
    useGameStore.getState().incrementInventoryVersion();
  }

  public shake(intensity: number) {
    // Camera shake disabled per user request
    // this.shakeIntensity = intensity;
  }

  public takeDamage(
    damage: number,
    knockbackDir?: THREE.Vector3,
    isNetworkHit: boolean = false,
    reason: string = "died",
  ) {
    if (this.isDead || this.isSpectator || this.world.isHub) return;

    // Play block sound if blocking, regardless of network hit origin
    if (this.isBlocking && isNetworkHit) {
      audioManager.play("step_stone", 0.8, 1.2);
    }

    let actualDamage = damage;

    if (!isNetworkHit) {
      const stats = skyBridgeManager.getEffectiveStats(
        this.inventory,
        this.hotbarIndex,
      );

      // True SkyBridge Defense Formula
      // Damage Reduction = Defense / (Defense + 100)
      let defense = stats.defense || 0;

      // Sword blocking halves damage
      let blockMultiplier = 1.0;
      if (this.isBlocking) {
        blockMultiplier = 0.5;
        audioManager.play("step_stone", 0.8, 1.2); // Block sound
      }

      const damageReduction = defense / (defense + 100);
      actualDamage = damage * (1 - damageReduction) * blockMultiplier;

      const id = networkManager.id;
      if (id && actualDamage > 0) {
        networkManager.playerHit(
          id,
          actualDamage,
          knockbackDir || { x: 0, y: 0, z: 0 },
          id,
        );
      }
    }

    skyBridgeManager.stats.health -= actualDamage;
    if (actualDamage > 0) {
      skyBridgeManager.lastDamageTime = performance.now();
    }
    if (skyBridgeManager.stats.health < 0) skyBridgeManager.stats.health = 0;
    this.health = skyBridgeManager.stats.health;
    audioManager.play("hurt", 0.6, 0.9 + Math.random() * 0.2);

    if (this.health <= 0) {
      this.die(isNetworkHit, reason);
    }

    if (knockbackDir) {
      // Normalize and apply a consistent, powerful knockback
      const force = Math.max(8.0, knockbackDir.length());
      const dir = knockbackDir.clone().normalize();

      this.knockbackVelocity.x = dir.x * force;
      this.knockbackVelocity.z = dir.z * force;

      // Add vertical lift to make knockback feel more impactful
      if (this.canJump || this.isSwimming) {
        this.velocity.y = Math.min(8.0, 5.5 + (force - 8.0) * 0.5);
      }
    }
  }

  private die(isNetworkHit: boolean = false, reason: string = "died") {
    if (this.isDead || this.isSpectator || this.world.isHub) return;
    this.isDead = true;

    window.dispatchEvent(new CustomEvent("playerDied"));
  }

  public respawn() {
    networkManager.requestRespawn();
  }

  public performBlockBreak(pos: THREE.Vector3, blockType: number) {
    const serverName =
      new URLSearchParams(window.location.search).get("server") || "hub";
    const isSkyCastles = serverName.startsWith("skycastles");

    // Prevent breaking the chest
    if (isSkyCastles && pos.x === 5 && pos.y === 66 && pos.z === 190) return;

    const success = this.world.setBlock(
      pos.x,
      pos.y,
      pos.z,
      BLOCK.AIR,
      true,
      this.isFlying,
    );
    if (success) {
      audioManager.playPositional(
        "pop",
        pos.clone().addScalar(0.5),
        0.8,
        0.8 + Math.random() * 0.4,
        20,
      );
      window.dispatchEvent(
        new CustomEvent("spawnParticles", {
          detail: { pos: pos.clone().addScalar(0.5), type: blockType },
        }),
      );

      networkManager.setBlock(pos.x, pos.y, pos.z, 0, this.isFlying);

      // In flying mode (creative), we skip drops and item damage
      if (this.isFlying) {
        return true;
      }

      const effectiveStats = skyBridgeManager.getEffectiveStats(
        this.inventory,
        this.hotbarIndex,
      );

      // Apply Mining Fortune
      const fortune = effectiveStats.miningFortune || 0;
      const dropCount =
        1 +
        Math.floor(fortune / 100) +
        (Math.random() < (fortune % 100) / 100 ? 1 : 0);

      if (this.canHarvestTarget && dropCount > 1) {
        useGameStore
          .getState()
          .addMessage(
            `☘ Mining Fortune triggered! (+${dropCount - 1} drops)`,
            "#FFAA00",
          );
      }

      // Add directly to inventory
      let remaining = 0;
      let dropItemType = blockType as unknown as ItemType;

      if (this.canHarvestTarget) {
        // Ore Drop Mapping
        if (
          blockType === BLOCK.DIAMOND_ORE ||
          blockType === BLOCK.DEEPSLATE_DIAMOND_ORE
        )
          dropItemType = ItemType.DIAMOND;
        else if (
          blockType === BLOCK.EMERALD_ORE ||
          blockType === BLOCK.DEEPSLATE_EMERALD_ORE
        )
          dropItemType = ItemType.EMERALD;
        else if (
          blockType === BLOCK.COAL_ORE ||
          blockType === BLOCK.DEEPSLATE_COAL_ORE
        )
          dropItemType = ItemType.COAL;
        else if (
          blockType === BLOCK.LAPIS_ORE ||
          blockType === BLOCK.DEEPSLATE_LAPIS_ORE
        )
          dropItemType = ItemType.LAPIS_LAZULI;
        else if (
          blockType === BLOCK.REDSTONE_ORE ||
          blockType === BLOCK.DEEPSLATE_REDSTONE_ORE
        )
          dropItemType = ItemType.REDSTONE;
        else if (
          blockType === BLOCK.COPPER_ORE ||
          blockType === BLOCK.DEEPSLATE_COPPER_ORE
        )
          dropItemType = ItemType.COPPER_INGOT;
        else if (
          blockType === BLOCK.IRON_ORE ||
          blockType === BLOCK.DEEPSLATE_IRON_ORE
        )
          dropItemType = ItemType.IRON_INGOT;
        else if (
          blockType === BLOCK.GOLD_ORE ||
          blockType === BLOCK.DEEPSLATE_GOLD_ORE
        )
          dropItemType = ItemType.GOLD_INGOT;
        else if (blockType === BLOCK.STONE) dropItemType = ItemType.COBBLESTONE;
        else if (blockType === BLOCK.DEEPSLATE)
          dropItemType = ItemType.COBBLED_DEEPSLATE;
        else if (
          blockType === ItemType.TORCH_WALL_X_POS ||
          blockType === ItemType.TORCH_WALL_X_NEG ||
          blockType === ItemType.TORCH_WALL_Z_POS ||
          blockType === ItemType.TORCH_WALL_Z_NEG
        )
          dropItemType = ItemType.TORCH;

        remaining = this.inventory.addItem(dropItemType, dropCount);

        // Add mining XP
        if ([ItemType.DIAMOND, ItemType.EMERALD].includes(dropItemType)) {
          skyBridgeManager.addXp(SkillType.MINING, 15);
        } else if (
          [ItemType.COAL, ItemType.LAPIS_LAZULI, ItemType.REDSTONE].includes(
            dropItemType,
          )
        ) {
          skyBridgeManager.addXp(SkillType.MINING, 10);
        } else if (
          [
            ItemType.IRON_INGOT,
            ItemType.GOLD_INGOT,
            ItemType.COPPER_INGOT,
          ].includes(dropItemType)
        ) {
          skyBridgeManager.addXp(SkillType.MINING, 5);
        } else if (
          dropItemType === ItemType.COBBLESTONE ||
          dropItemType === ItemType.COBBLED_DEEPSLATE
        ) {
          skyBridgeManager.addXp(SkillType.MINING, 1);
        }
      }

      // Damage tool (except in skycastles mode)
      const serverName =
        new URLSearchParams(window.location.search).get("server") || "hub";
      const isSkyCastles = serverName.startsWith("skycastles");
      const equippedItem = this.inventory.slots[this.hotbarIndex];
      if (
        !isSkyCastles &&
        equippedItem &&
        equippedItem.type >= ItemType.WOODEN_PICKAXE &&
        equippedItem.type <= ItemType.DIAMOND_AXE
      ) {
        const isSword =
          equippedItem.type >= ItemType.WOODEN_SWORD &&
          equippedItem.type <= ItemType.DIAMOND_SWORD;
        if (!isSword) {
          const broke = this.inventory.damageItem(this.hotbarIndex, 1);
          if (broke) {
            audioManager.play("pop", 0.8, 0.4); // Break sound
            window.dispatchEvent(new CustomEvent("updateHotbar"));
          }
        }
      }

      if (remaining > 0) {
        // If inventory is full, drop the remaining items
        for (let i = 0; i < remaining; i++) {
          networkManager.dropItem(dropItemType, {
            x: pos.x + 0.5 + (Math.random() - 0.5) * 0.2,
            y: pos.y + 0.5,
            z: pos.z + 0.5 + (Math.random() - 0.5) * 0.2,
          });
        }
        useGameStore
          .getState()
          .addMessage("Inventory full! Some items were dropped.", "#FF5555");
      }

      // Reward SkyBridge XP
      skyBridgeManager.addXp(SkillType.MINING, 10);
      return true;
    }
    return false;
  }

  updateSkin(skinSeed: string) {
    this.renderer.updateSkin(skinSeed);
  }




  update(delta: number) {
    updatePlayer(this, delta);
  }
}
