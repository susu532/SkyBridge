import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { World } from './World';
import { BLOCK, isSolidBlock, isSlab, createTextureAtlas, getBlockUVs, createBreakingTexture, isPlant, ATLAS_TILES, isFlatItem } from './TextureAtlas';
import { Inventory, ItemType } from './Inventory';
import { ITEM_NAMES } from './Constants';
import { EntityManager } from './EntityManager';
import { generateSkin, applySkinUVs } from './SkinManager';
import { networkManager } from './NetworkManager';
import { settingsManager } from './Settings';
import { skyBridgeManager, SkillType } from './SkyBridgeManager';
import { audioManager } from './AudioManager';
import { useGameStore } from '../store/gameStore';
import { createItemModel } from './ItemModels';

import { PlayerRenderer } from './PlayerRenderer';
import { PlayerInputController } from './PlayerInputController';
import { PlayerPhysics } from './PlayerPhysics';

export enum Perspective {
  FIRST_PERSON = 0,
  THIRD_PERSON_BACK = 1,
  THIRD_PERSON_FRONT = 2
}

export class Player {
  camera: THREE.PerspectiveCamera;
  controls: PointerLockControls;
  world: World;
  entityManager: EntityManager;
  renderer: PlayerRenderer;
  inputController: PlayerInputController;
  physics: PlayerPhysics;
  inventory = new Inventory();
  private _hotbarIndex = 0;
  get hotbarIndex() { return this._hotbarIndex; }
  set hotbarIndex(val: number) { 
    this._hotbarIndex = val;
    useGameStore.getState().setHotbarIndex(val);
  }
  
  velocity = new THREE.Vector3();
  knockbackVelocity = new THREE.Vector3();
  direction = new THREE.Vector3();
  
  isFlying = false;
  isSwimming = false;
  isUnderwater = false;
  isUnderLava = false;
  isZooming = false;
  isDeadThisFrame = false;
  isDead = false;
  perspective: Perspective = Perspective.FIRST_PERSON;
  shakeIntensity = 0;
  shakeDecay = 5;
  canJump = false;
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
  
  private _syncEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  private _syncPos = new THREE.Vector3();

  // Mining state
  isMining = false;
  miningTarget: THREE.Vector3 | null = null;
  miningProgress = 0;
  miningTimeRequired = 0.4; // Default base time
  canHarvestTarget = true;
  isBlocking = false;
  
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

  get headMesh() { return this.renderer.headMesh; }
  get bodyMesh() { return this.renderer.bodyMesh; }
  get modelGroup() { return this.renderer.modelGroup; }
  get leftLegMesh() { return this.renderer.leftLegMesh; }
  get rightLegMesh() { return this.renderer.rightLegMesh; }
  get leftArmMesh() { return this.renderer.leftArmMesh; }
  get rightArmMesh() { return this.renderer.rightArmMesh; }
  get capeMesh() { return this.renderer.capeMesh; }
  get fpArmGroup() { return this.renderer.fpArmGroup; }
  get fpArmMesh() { return this.renderer.fpArmMesh; }
  get fpBlockMesh() { return this.renderer.fpBlockMesh; }
  get fpHeldItemModel() { return this.renderer.fpHeldItemModel; }
  get breakingMesh() { return this.renderer.breakingMesh; }

  constructor(camera: THREE.PerspectiveCamera, controls: PointerLockControls, world: World, entityManager: EntityManager) {
    this.camera = camera;
    this.controls = controls;
    this.world = world;
    this.entityManager = entityManager;
    
    // Initial position on the bridge
    this.camera.position.set(0, 6, 0);
    
    this.renderer = new PlayerRenderer(this);
    this.world.scene.add(this.renderer.modelGroup);

    // Initialize camera rotation state
    const urlParams = new URLSearchParams(window.location.search);
    const serverName = urlParams.get('server') || 'hub';
    const isHub = serverName === 'hub';

    if (isHub) {
      this.camera.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
      this.inventory.clear();
      this.hotbarIndex = 0;
    }

    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
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

    window.addEventListener('networkPlayerHit', this.onNetworkPlayerHit);
    window.addEventListener('networkPlayerRespawn', this.onNetworkPlayerRespawn);
  }

  onNetworkPlayerHit = (e: any) => {
    if (e.detail.id === networkManager.socket.id) {
      this.takeDamage(e.detail.damage, new THREE.Vector3(e.detail.knockbackDir.x, e.detail.knockbackDir.y, e.detail.knockbackDir.z), true);
    }
  };

  onNetworkPlayerRespawn = (e: any) => {
    if (e.detail.id === networkManager.socket.id) {
      const wasDead = this.isDead;
      this.isDead = false;
      this.isDeadThisFrame = true; // For camera reset
      this.worldPosition.set(e.detail.position.x, e.detail.position.y, e.detail.position.z);
      this.velocity.set(0, 0, 0);
      skyBridgeManager.stats.health = skyBridgeManager.effectiveStats.maxHealth;
      this.health = skyBridgeManager.stats.health;
      window.dispatchEvent(new CustomEvent('playerRespawn'));
      if (wasDead) {
        window.dispatchEvent(new CustomEvent('gameMessage', { 
          detail: { text: "You respawned!", color: "#55FF55" } 
        }));
      }
    }
  };

  destroy() {
    this.inputController.destroy();
    window.removeEventListener('networkPlayerHit', this.onNetworkPlayerHit);
    window.removeEventListener('networkPlayerRespawn', this.onNetworkPlayerRespawn);
    
    // Dispose renderer resources
    if (this.renderer.modelGroup) {
      this.renderer.modelGroup.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach(m => m.dispose());
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

  public shake(intensity: number) {
    // Camera shake disabled per user request
    // this.shakeIntensity = intensity;
  }

  public takeDamage(damage: number, knockbackDir?: THREE.Vector3, isNetworkHit: boolean = false, reason: string = "died") {
    if (this.isDead || this.world.isHub) return;
    
    const stats = skyBridgeManager.getEffectiveStats(this.inventory, this.hotbarIndex);
    
    // True SkyBridge Defense Formula
    // Damage Reduction = Defense / (Defense + 100)
    let defense = stats.defense || 0;
    
    // Sword blocking halves damage
    let blockMultiplier = 1.0;
    if (this.isBlocking) {
      blockMultiplier = 0.5;
      audioManager.play('step_stone', 0.8, 1.2); // Block sound
    }
    
    const damageReduction = defense / (defense + 100);
    const actualDamage = damage * (1 - damageReduction) * blockMultiplier;
    
    skyBridgeManager.stats.health -= actualDamage;
    this.health = skyBridgeManager.stats.health;
    audioManager.play('hurt', 0.6, 0.9 + Math.random() * 0.2);
    
    if (this.health <= 0) {
      this.die(isNetworkHit, reason);
    }
    
    if (knockbackDir) {
      // Normalize and apply a consistent, powerful knockback
      const dir = knockbackDir.clone().normalize();
      const force = 8.0; 
      
      this.knockbackVelocity.x = dir.x * force;
      this.knockbackVelocity.z = dir.z * force;
      
      // Add vertical lift to make knockback feel more impactful 
      if (this.canJump || this.isSwimming) {
        this.velocity.y = 5.5; 
      }
    }
    
    // Spawn damage particles
    for(let i=0; i<3; i++) {
      window.dispatchEvent(new CustomEvent('spawnParticles', { 
        detail: { pos: this.worldPosition.clone().add(new THREE.Vector3(0, 1.5, 0)), type: BLOCK.RED_STONE } 
      }));
    }
  }

  private die(isNetworkHit: boolean = false, reason: string = "died") {
    if (this.isDead || this.world.isHub) return;
    this.isDead = true;
    
    window.dispatchEvent(new CustomEvent('playerDied'));
    
    if (!isNetworkHit) {
      // Notify server to broadcast respawn
      networkManager.socket.emit('playerHit', { 
        id: networkManager.socket.id, 
        damage: 999999, // Force death on server
        knockbackDir: {x: 0, y: 0, z: 0},
        attackerId: networkManager.socket.id, // Self-inflicted
        reason: reason
      });
    }
  }

  public respawn() {
    networkManager.socket.emit('requestRespawn');
  }

  updateSkin(skinSeed: string) {
    this.renderer.updateSkin(skinSeed);
  }

  getMiningStats(blockType: number, toolItem: any | null): { time: number, drops: boolean } {
    let hardness = 1.5;
    let isStoneBased = false;
    let isDirtBased = false;
    let isWoodBased = false;
    let requiredTier = 0; // 0: hand, 1: wood, 2: stone, 3: iron, 4: diamond

    switch (blockType) {
      // Base materials
      case BLOCK.STONE:
      case BLOCK.BRICK:
      case BLOCK.BLUE_STONE:
      case BLOCK.RED_STONE:
      case BLOCK.TUFF:
      case BLOCK.CALCITE:
      case BLOCK.DRIPSTONE_BLOCK:
      case BLOCK.AMETHYST_BLOCK:
      case BLOCK.BUDDING_AMETHYST:
      case BLOCK.SCULK_CATALYST:
      case BLOCK.LODESTONE:
      case BLOCK.COBBLESTONE:
      case BLOCK.STONE_BRICKS:
      case BLOCK.ANDESITE:
      case BLOCK.DIORITE:
      case BLOCK.GRANITE:
        hardness = 3;
        isStoneBased = true;
        requiredTier = 1;
        break;

      case BLOCK.DEEPSLATE:
      case BLOCK.COBBLED_DEEPSLATE:
      case BLOCK.POLISHED_DEEPSLATE:
      case BLOCK.DEEPSLATE_BRICKS:
      case BLOCK.DEEPSLATE_TILES:
      case BLOCK.REINFORCED_DEEPSLATE:
        hardness = 4.5;
        isStoneBased = true;
        requiredTier = 1;
        break;
      
      // Ores (T1 = Wood)
      case BLOCK.COAL_ORE:
      case BLOCK.COPPER_ORE:
        hardness = 3;
        isStoneBased = true;
        requiredTier = 1;
        break;
      case BLOCK.DEEPSLATE_COAL_ORE:
      case BLOCK.DEEPSLATE_COPPER_ORE:
        hardness = 4.5;
        isStoneBased = true;
        requiredTier = 1;
        break;

      // Ores (T2 = Stone)
      case BLOCK.IRON_ORE:
      case BLOCK.LAPIS_ORE:
        hardness = 3;
        isStoneBased = true;
        requiredTier = 2;
        break;
      case BLOCK.DEEPSLATE_IRON_ORE:
      case BLOCK.DEEPSLATE_LAPIS_ORE:
        hardness = 4.5;
        isStoneBased = true;
        requiredTier = 2;
        break;

      // Ores (T3 = Iron)
      case BLOCK.GOLD_ORE:
      case BLOCK.REDSTONE_ORE:
      case BLOCK.DIAMOND_ORE:
      case BLOCK.EMERALD_ORE:
      case BLOCK.NETHER_QUARTZ_ORE:
      case BLOCK.NETHER_GOLD_ORE:
        hardness = 3;
        isStoneBased = true;
        requiredTier = 3;
        break;
      case BLOCK.DEEPSLATE_GOLD_ORE:
      case BLOCK.DEEPSLATE_REDSTONE_ORE:
      case BLOCK.DEEPSLATE_DIAMOND_ORE:
      case BLOCK.DEEPSLATE_EMERALD_ORE:
        hardness = 4.5;
        isStoneBased = true;
        requiredTier = 3;
        break;

      // Ores (T4 = Diamond)
      case BLOCK.OBSIDIAN:
      case BLOCK.CRYING_OBSIDIAN:
        hardness = 50;
        isStoneBased = true;
        requiredTier = 4;
        break;

      case BLOCK.WOOD:
      case BLOCK.PLANKS:
        hardness = 2;
        isWoodBased = true;
        break;
      case BLOCK.DIRT:
      case BLOCK.GRASS:
      case BLOCK.SAND:
      case BLOCK.SNOW:
      case BLOCK.MUD:
        hardness = 0.5;
        isDirtBased = true;
        break;
      case BLOCK.MOSS_BLOCK:
        hardness = 0.5;
        isDirtBased = true;
        break;
      case BLOCK.LEAVES:
      case BLOCK.BIRCH_LEAVES:
      case BLOCK.SPRUCE_LEAVES:
      case BLOCK.GLASS:
      case BLOCK.TALL_GRASS:
      case BLOCK.FLOWER_RED:
      case BLOCK.FLOWER_YELLOW:
      case BLOCK.WHEAT:
      case BLOCK.MOSS_CARPET:
      case BLOCK.SPORE_BLOSSOM:
      case BLOCK.CAVE_VINES:
      case BLOCK.AMETHYST_CLUSTER:
      case BLOCK.LARGE_AMETHYST_BUD:
      case BLOCK.CANDLE:
        hardness = 0.1;
        break;
      case BLOCK.SLAB_STONE:
      case BLOCK.SLAB_BLUE_STONE:
      case BLOCK.SLAB_RED_STONE:
        hardness = 2;
        isStoneBased = true;
        requiredTier = 1;
        break;
      case BLOCK.SLAB_WOOD:
        hardness = 2;
        isWoodBased = true;
        break;
      default:
        hardness = 1.5;
        break;
    }

    let toolSpeed = 1;
    let toolTier = 0;
    
    // Pickaxes
    const isPickaxe = toolItem && [ItemType.WOODEN_PICKAXE, ItemType.STONE_PICKAXE, ItemType.IRON_PICKAXE, ItemType.GOLDEN_PICKAXE, ItemType.DIAMOND_PICKAXE].includes(toolItem.type);
    // Axes
    const isAxe = toolItem && [ItemType.WOODEN_AXE, ItemType.STONE_AXE, ItemType.IRON_AXE, ItemType.GOLDEN_AXE, ItemType.DIAMOND_AXE].includes(toolItem.type);
    // Shovels
    const isShovel = toolItem && [ItemType.WOODEN_SHOVEL, ItemType.STONE_SHOVEL, ItemType.IRON_SHOVEL, ItemType.GOLDEN_SHOVEL, ItemType.DIAMOND_SHOVEL].includes(toolItem.type);
    // Swords
    const isSword = toolItem && [ItemType.WOODEN_SWORD, ItemType.STONE_SWORD, ItemType.IRON_SWORD, ItemType.GOLDEN_SWORD, ItemType.DIAMOND_SWORD].includes(toolItem.type);

    let isCorrectToolType = false;
    if (isStoneBased && isPickaxe) isCorrectToolType = true;
    else if (isWoodBased && isAxe) isCorrectToolType = true;
    else if (isDirtBased && isShovel) isCorrectToolType = true;
    else if (!isStoneBased) isCorrectToolType = true; // Hand can break non-stone

    if (toolItem) {
      if ([ItemType.WOODEN_PICKAXE, ItemType.WOODEN_AXE, ItemType.WOODEN_SHOVEL, ItemType.WOODEN_SWORD].includes(toolItem.type)) { toolSpeed = 2; toolTier = 1; }
      else if ([ItemType.STONE_PICKAXE, ItemType.STONE_AXE, ItemType.STONE_SHOVEL, ItemType.STONE_SWORD].includes(toolItem.type)) { toolSpeed = 4; toolTier = 2; }
      else if ([ItemType.IRON_PICKAXE, ItemType.IRON_AXE, ItemType.IRON_SHOVEL, ItemType.IRON_SWORD].includes(toolItem.type)) { toolSpeed = 6; toolTier = 3; }
      else if ([ItemType.DIAMOND_PICKAXE, ItemType.DIAMOND_AXE, ItemType.DIAMOND_SHOVEL, ItemType.DIAMOND_SWORD].includes(toolItem.type)) { toolSpeed = 8; toolTier = 4; }
      else if ([ItemType.GOLDEN_PICKAXE, ItemType.GOLDEN_AXE, ItemType.GOLDEN_SHOVEL, ItemType.GOLDEN_SWORD].includes(toolItem.type)) { toolSpeed = 12; toolTier = 1; }
      
      // Swords mine slightly faster in general (like web/leaves) but 1.5x penalty to speed compared to proper tools.
      if (isSword && (isWoodBased || isDirtBased)) {
        toolSpeed /= 1.5;
        isCorrectToolType = true; 
      }
    }

    if (isStoneBased && !isPickaxe) {
        toolSpeed = 1;
        toolTier = 0;
        isCorrectToolType = false;
    }
    if (isWoodBased && !isAxe) {
        toolSpeed = 1;
        isCorrectToolType = false;
    }
    if (isDirtBased && !isShovel) {
        toolSpeed = 1;
        isCorrectToolType = false;
    }

    let multiplier = 5.0;
    let drops = false;

    // Stone type blocks require correct tier
    if (isStoneBased) {
      if (isCorrectToolType && toolTier >= requiredTier) {
        multiplier = 1.5;
        drops = true;
      }
    } else {
      drops = true;
      multiplier = isCorrectToolType ? 1.5 : 5.0;
    }

    let time = (hardness * multiplier) / toolSpeed;

    return { time, drops };
  }

  private animateModel(delta: number) {
    const horizontalVelocity = new THREE.Vector2(this.velocity.x, this.velocity.z).length();
    const isMoving = horizontalVelocity > 0.1;
    
    this.idleTime += delta;

    if (isMoving && this.canJump && !this.isFlying) {
      const cycleSpeed = this.inputController.isSprinting ? 15 : 10;
      const oldWalkCycle = this.walkCycle;
      this.walkCycle += delta * cycleSpeed;
      
      // Play footstep sound at the peak of the walk cycle
      if (Math.sin(this.walkCycle) < 0 && Math.sin(oldWalkCycle) >= 0) {
        const blockBelow = this.world.getBlock(Math.floor(this.worldPosition.x), Math.floor(this.worldPosition.y - this.playerHeight - 0.1), Math.floor(this.worldPosition.z));
        let surface = 'grass';
        if (blockBelow === BLOCK.STONE || blockBelow === BLOCK.BLUE_STONE || blockBelow === BLOCK.RED_STONE || blockBelow === BLOCK.BRICK) surface = 'stone';
        else if (blockBelow === BLOCK.SAND) surface = 'sand';
        else if (blockBelow === BLOCK.WOOD || blockBelow === BLOCK.PLANKS) surface = 'wood';
        
        audioManager.playStep(surface);
      }
    } else {
      this.walkCycle = THREE.MathUtils.lerp(this.walkCycle, 0, 0.1);
    }

    if (this.isSwinging) {
      this.swingSpeed = 18; // Default snappy swing
      if (this.isMining) {
        // Adjust swing speed based on how long it takes to break the block
        // Faster mining = faster swings
        this.swingSpeed = 8 / this.miningTimeRequired;
      }
      
      this.swingTimer += delta * this.swingSpeed;
      if (this.swingTimer > Math.PI) {
        this.isSwinging = false;
        this.swingTimer = 0;
      }
    }

    // Update animation transitions
    this.crouchTransition = THREE.MathUtils.lerp(this.crouchTransition, this.inputController.isCrouching ? 1 : 0, delta * 10);
    this.swimTransition = THREE.MathUtils.lerp(this.swimTransition, this.isSwimming ? 1 : 0, delta * 8);
    this.flyTransition = THREE.MathUtils.lerp(this.flyTransition, this.isFlying && !this.isSwimming ? 1 : 0, delta * 8);
    this.blockTransition = THREE.MathUtils.lerp(this.blockTransition, this.inputController.isBlocking ? 1 : 0, delta * 12);

    // Climb transition: active when moving up steps/slopes
    const verticalMovement = (this.worldPosition.y - (this.lastWorldPosition?.y || this.worldPosition.y)) / delta;
    const isClimbing = isMoving && verticalMovement > 0.5 && this.canJump;
    this.climbTransition = THREE.MathUtils.lerp(this.climbTransition, isClimbing ? 1 : 0, delta * 10);
    if (!this.lastWorldPosition) this.lastWorldPosition = new THREE.Vector3();
    this.lastWorldPosition.copy(this.worldPosition);

    if (this.landingTimer > 0) {
      this.landingTimer -= delta * 5;
    }

    const swingAngle = Math.sin(this.walkCycle) * 0.5;
    const armSwingAngle = Math.sin(this.swingTimer) * 1.5;
    
    if (this.leftLegMesh && this.rightLegMesh && this.leftArmMesh && this.rightArmMesh && this.bodyMesh && this.headMesh && this.capeMesh) {
      // Reset rotations
      this.leftLegMesh.rotation.set(0, 0, 0);
      this.rightLegMesh.rotation.set(0, 0, 0);
      this.leftArmMesh.rotation.set(0, 0, 0);
      this.rightArmMesh.rotation.set(0, 0, 0);
      this.bodyMesh.rotation.set(0, 0, 0);
      
      // Apply camera pitch to head for shadow/third-person
      this.headMesh.rotation.x = this.cameraPitch;
      
      this.capeMesh.rotation.x = -0.1; // Default hang
      
      // Reset positions (relative to parents)
      this.bodyMesh.position.set(0, 0.9, 0);
      this.headMesh.position.set(0, 0.5, 0);
      this.leftArmMesh.position.set(-0.3, 0.3, 0);
      this.rightArmMesh.position.set(0.3, 0.3, 0);
      this.leftLegMesh.position.set(-0.1, 0.6, 0);
      this.rightLegMesh.position.set(0.1, 0.6, 0);
      this.capeMesh.position.set(0, 0.3, 0.1);
      this.bodyMesh.scale.set(1, 1, 1);
      this.headMesh.scale.set(1, 1, 1);
      this.leftArmMesh.scale.set(1, 1, 1);
      this.rightArmMesh.scale.set(1, 1, 1);

      // Apply landing squash effect
      if (this.landingTimer > 0) {
        const squash = Math.sin(this.landingTimer * Math.PI) * 0.2;
        this.bodyMesh.scale.y -= squash;
        this.bodyMesh.scale.x += squash * 0.5;
        this.bodyMesh.scale.z += squash * 0.5;
        this.bodyMesh.position.y -= squash * 0.3;
      }

      // Calculate target cape angle based on state
      let targetCapeAngle = -0.1;
      if (this.isFlying) {
        targetCapeAngle = -1.2 - Math.sin(this.idleTime * 10) * 0.05; // Flutter in wind
      } else if (!this.canJump) {
        targetCapeAngle = this.velocity.y < 0 ? -0.8 : -0.2; // Fall vs Jump
      } else if (isMoving) {
        targetCapeAngle = -0.2 - (horizontalVelocity / this.sprintSpeed) * 0.8 - Math.sin(this.walkCycle * 2) * 0.1;
      } else {
        const breath = Math.sin(this.idleTime * 2) * 0.02;
        targetCapeAngle = -0.1 - breath * 0.5;
      }
      
      // Smooth cape physics (spring-like)
      const capeDiff = targetCapeAngle - this.capeAngle;
      this.capeVelocity += capeDiff * 0.1;
      this.capeVelocity *= 0.8; // Dampening
      this.capeAngle += this.capeVelocity;
      this.capeMesh.rotation.x = this.capeAngle;
      
      // Cape sway when turning
      this.capeMesh.rotation.z = THREE.MathUtils.lerp(this.capeMesh.rotation.z, -this.mouseDeltaX * 0.005, 0.1);

      if (this.isFlying) {
        // Flying pose: legs trailing, arms slightly out
        this.leftLegMesh.rotation.x = 0.5;
        this.rightLegMesh.rotation.x = 0.5;
        this.leftArmMesh.rotation.x = -0.2;
        this.rightArmMesh.rotation.x = -0.2;
    } else if (this.swimTransition > 0.01) {
        const t = this.swimTransition;
        // Swimming pose: flatter body to feel like swimming (Face-down)
        this.bodyMesh.rotation.x = THREE.MathUtils.lerp(0, -1.3, t);
        this.headMesh.rotation.x += 0.6 * t; 
        this.bodyMesh.position.y = THREE.MathUtils.lerp(0.9, 0.4, t);
        
        // Breaststroke / flutter kick animation
        const swimSpeed = this.inputController.isSprinting ? 1.5 : 1.0;
        const paddleAngle = Math.sin(this.walkCycle * swimSpeed) * 0.5;
        
        // Arms extending forward and sweeping
        this.leftArmMesh.rotation.x = THREE.MathUtils.lerp(0, -1.5, t);
        this.leftArmMesh.rotation.y = THREE.MathUtils.lerp(0, -0.4 + paddleAngle, t);
        this.rightArmMesh.rotation.x = THREE.MathUtils.lerp(0, -1.5, t);
        this.rightArmMesh.rotation.y = THREE.MathUtils.lerp(0, 0.4 - paddleAngle, t);
        
        // Legs fluttering behind
        const kickAngle = Math.cos(this.walkCycle * swimSpeed * 1.5) * 0.4;
        this.leftLegMesh.rotation.x = THREE.MathUtils.lerp(0, kickAngle, t);
        this.rightLegMesh.rotation.x = THREE.MathUtils.lerp(0, -kickAngle, t);
      } else if (!this.canJump) {
        // Minecraft-style Jumping/Falling pose (Split limbs)
        const jumpProgress = THREE.MathUtils.clamp(this.velocity.y / 15, -1, 1);
        
        // Subtle body tilt
        this.bodyMesh.rotation.x = 0.15 * jumpProgress;
        
        if (jumpProgress > 0) {
          // Ascending: Pronounced split
          // Left arm forward/up, right arm back/up | Left leg back, right leg forward
          const swing = 0.8 * jumpProgress;
          this.leftArmMesh.rotation.x = -swing - 0.2;
          this.rightArmMesh.rotation.x = swing - 0.2;
          this.leftLegMesh.rotation.x = swing;
          this.rightLegMesh.rotation.x = -swing;
          
          // Arms spread out for balance
          this.leftArmMesh.rotation.z = 0.3 * jumpProgress;
          this.rightArmMesh.rotation.z = -0.3 * jumpProgress;
        } else {
          // Descending: Wide flail
          const fallFactor = Math.abs(jumpProgress);
          const swing = 0.5 * fallFactor;
          this.leftArmMesh.rotation.x = swing;
          this.rightArmMesh.rotation.x = -swing;
          this.leftLegMesh.rotation.x = -swing;
          this.rightLegMesh.rotation.x = swing;
          
          // Arms flail out wide when falling
          this.leftArmMesh.rotation.z = 0.6 * fallFactor;
          this.rightArmMesh.rotation.z = -0.6 * fallFactor;
          
          // Head looks down to spot the landing
          this.headMesh.rotation.x += 0.3 * fallFactor;
        }
      } else if (isMoving) {
        // Walking/Sprinting animation
        this.leftLegMesh.rotation.x = swingAngle;
        this.rightLegMesh.rotation.x = -swingAngle;
        this.leftArmMesh.rotation.x = -swingAngle;
        this.rightArmMesh.rotation.x = swingAngle;

        if (this.climbTransition > 0.01) {
          const t = this.climbTransition;
          // High-knee step when climbing
          const stepLift = Math.max(0, Math.sin(this.walkCycle)) * 0.5 * t;
          const stepLiftAlt = Math.max(0, Math.sin(this.walkCycle + Math.PI)) * 0.5 * t;
          this.leftLegMesh.rotation.x += stepLift;
          this.rightLegMesh.rotation.x += stepLiftAlt;
          
          // Lean forward into the climb
          this.bodyMesh.rotation.x = THREE.MathUtils.lerp(this.bodyMesh.rotation.x, 0.4, t);
        }

        if (this.inputController.isSprinting) {
          this.bodyMesh.rotation.x = 0.3;
          this.headMesh.rotation.x = -0.2;
          this.leftArmMesh.rotation.x = -swingAngle * 1.5;
          this.rightArmMesh.rotation.x = swingAngle * 1.5;
          this.leftLegMesh.rotation.x = swingAngle * 1.2;
          this.rightLegMesh.rotation.x = -swingAngle * 1.2;
        }
      } else {
        // Idle animation (breathing)
        const breath = Math.sin(this.idleTime * 2) * 0.02;
        this.bodyMesh.scale.y = 1.0 + breath;
        this.headMesh.position.y += breath * 0.8;
        this.leftArmMesh.position.y += breath * 0.8;
        this.rightArmMesh.position.y += breath * 0.8;
      }

      if (this.crouchTransition > 0.01) {
        const t = this.crouchTransition;
        
        // Lower the body mesh specifically to simulate the crouch
        const crouchDrop = 0.15 * t; // Reduced to elevate torso
        this.bodyMesh.position.y -= crouchDrop;
        this.bodyMesh.position.z -= 0.1 * t; // Move torso forward
        
        // Squash torso to look shorter
        const bodyScaleY = 1.0 - 0.2 * t;
        this.bodyMesh.scale.y = bodyScaleY;
        // Inverse scale children to keep them uniform
        this.headMesh.scale.y = 1.0 / bodyScaleY;
        this.leftArmMesh.scale.y = 1.0 / bodyScaleY;
        this.rightArmMesh.scale.y = 1.0 / bodyScaleY;

        // Elevate head and arms slightly on the torso
        this.headMesh.position.y += 0.05 * t;
        this.leftArmMesh.position.y += 0.05 * t;
        this.rightArmMesh.position.y += 0.05 * t;
        
        // Lean body forward (head and arms follow because they are children)
        this.bodyMesh.rotation.x = THREE.MathUtils.lerp(this.bodyMesh.rotation.x, -0.5, t);
        // Counter-rotate head to look forward
        this.headMesh.rotation.x += 0.4 * t;
        
        // Bend legs (simulated by rotating them forward and shifting up)
        this.leftLegMesh.rotation.x = THREE.MathUtils.lerp(this.leftLegMesh.rotation.x, 0.3, t);
        this.rightLegMesh.rotation.x = THREE.MathUtils.lerp(this.rightLegMesh.rotation.x, 0.3, t);
        this.leftLegMesh.position.y += 0.0 * t;
        this.rightLegMesh.position.y += 0.0 * t;

        if (isMoving) {
          // Tactical sneak walk
          const sneakStride = this.walkCycle * 0.8;
          const sneakSwing = Math.sin(sneakStride) * 0.4 * t;
          
          this.leftLegMesh.rotation.x += sneakSwing;
          this.rightLegMesh.rotation.x -= sneakSwing;
          
          // Arms held in a ready/tactical position (Minecraft-style sneak arms)
          // Arms are held slightly back and out
          const baseArmX = -0.4 * t;
          const baseArmZ = 0.15 * t;
          
          this.leftArmMesh.rotation.x = THREE.MathUtils.lerp(this.leftArmMesh.rotation.x, baseArmX - sneakSwing * 0.3, t);
          this.rightArmMesh.rotation.x = THREE.MathUtils.lerp(this.rightArmMesh.rotation.x, baseArmX + sneakSwing * 0.3, t);
          this.leftArmMesh.rotation.z = THREE.MathUtils.lerp(this.leftArmMesh.rotation.z, baseArmZ, t);
          this.rightArmMesh.rotation.z = THREE.MathUtils.lerp(this.rightArmMesh.rotation.z, -baseArmZ, t);
        } else {
          // Idle crouch pose - subtle breathing sway
          const sway = Math.sin(this.idleTime * 2) * 0.05 * t;
          this.leftArmMesh.rotation.x = THREE.MathUtils.lerp(this.leftArmMesh.rotation.x, 0.2 + sway, t);
          this.rightArmMesh.rotation.x = THREE.MathUtils.lerp(this.rightArmMesh.rotation.x, 0.2 + sway, t);
          this.leftArmMesh.rotation.z = THREE.MathUtils.lerp(this.leftArmMesh.rotation.z, 0.15, t);
          this.rightArmMesh.rotation.z = THREE.MathUtils.lerp(this.rightArmMesh.rotation.z, -0.15, t);
        }
      }

      if (this.blockTransition > 0.01 && this.renderer.heldItemModel) {
        const t = this.blockTransition;
        // 3rd Person Sword Block Animation
        this.rightArmMesh.rotation.x = THREE.MathUtils.lerp(this.rightArmMesh.rotation.x, -0.5, t);
        this.rightArmMesh.rotation.y = THREE.MathUtils.lerp(this.rightArmMesh.rotation.y, -0.3, t);
        this.rightArmMesh.rotation.z = THREE.MathUtils.lerp(this.rightArmMesh.rotation.z, 0.5, t);

        if (this.isSwinging) {
          this.rightArmMesh.rotation.x += Math.sin(this.swingTimer) * 0.5 * t;
        }
      }

      // Apply arm swing (overrides walk/crouch swing for right arm)
      // Moved to the end to prevent being overridden by crouch logic
      if (this.isSwinging && this.blockTransition < 0.5) {
        const t = this.swingTimer / Math.PI;
        // Use a power curve for more "snap" at the start of the swing
        const swingProgress = Math.sin(Math.pow(t, 0.4) * Math.PI);
        
        const equippedItem = this.inventory.slots[this.hotbarIndex];
        const isSword = equippedItem && (
          (equippedItem.type >= ItemType.WOODEN_SWORD && equippedItem.type <= ItemType.DIAMOND_SWORD) ||
          equippedItem.type === ItemType.ASPECT_OF_THE_END
        );

        if (isSword) {
          // Upside down swipe (Underhand/Upward slash)
          // Starts from behind/down and swipes upwards
          this.rightArmMesh.rotation.x = THREE.MathUtils.lerp(this.rightArmMesh.rotation.x, 0.4 - swingProgress * 2.0, 0.8);
          this.rightArmMesh.rotation.y = THREE.MathUtils.lerp(this.rightArmMesh.rotation.y, swingProgress * 0.8, 0.5);
          this.rightArmMesh.rotation.z = THREE.MathUtils.lerp(this.rightArmMesh.rotation.z, swingProgress * 0.4, 0.5);
        } else {
          // Diagonal slash motion for tools
          this.rightArmMesh.rotation.x = THREE.MathUtils.lerp(this.rightArmMesh.rotation.x, swingProgress * 1.5 - 0.2, 0.8);
          this.rightArmMesh.rotation.y = THREE.MathUtils.lerp(this.rightArmMesh.rotation.y, -swingProgress * 0.8, 0.5);
          this.rightArmMesh.rotation.z = THREE.MathUtils.lerp(this.rightArmMesh.rotation.z, -swingProgress * 0.4, 0.5);
        }
        
        // If crouching, make the swing slightly more forward-leaning
        if (this.inputController.isCrouching) {
          this.rightArmMesh.rotation.x -= 0.2;
        }
      }
    }
  }

  update(delta: number) {
    const isLocked = this.controls.isLocked;

    if (this.isDead) {
      this.inputController.moveForward = false;
      this.inputController.moveBackward = false;
      this.inputController.moveLeft = false;
      this.inputController.moveRight = false;
      this.inputController.moveUp = false;
      this.inputController.moveDown = false;
      this.inputController.isSprinting = false;
    }

    // Apply rotation manually to support sensitivity and invert mouse
    // PointerLockControls is used for the lock state, but we handle rotation
    if (isLocked) {
      const settings = settingsManager.getSettings();
      const factor = settings.sensitivity / 0.002; // Scale relative to default
      
      this.cameraYaw -= this.mouseDeltaX * 0.002 * factor;
      const invertFactor = settings.invertMouse ? -1 : 1;
      this.cameraPitch -= this.mouseDeltaY * 0.002 * factor * invertFactor;
      
      // Clamp pitch
      this.cameraPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.cameraPitch));
      
      this.camera.quaternion.setFromEuler(new THREE.Euler(this.cameraPitch, this.cameraYaw, 0, 'YXZ'));
    }
    
    // Reset deltas so they don't accumulate
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;

    // Check for picking up items
    const currentTime = Date.now();
    for (const item of this.entityManager.droppedItems.values()) {
      // Don't pick up items that were just dropped
      if (currentTime - item.createdAt < item.pickupDelay) continue;

      const dist = this.worldPosition.distanceTo(item.position);
      if (dist < 2.2) {
        // Pick up item
        this.inventory.addItem(item.type, 1);
        networkManager.pickupItem(item.id);
        audioManager.play('pop', 0.4, 0.8 + Math.random() * 0.4);
        // Optimistically remove locally
        this.entityManager.removeDroppedItem(item.id);
      }
    }

    // Handle crouching height
    const targetHeight = this.inputController.isCrouching ? this.crouchHeight : this.standingHeight;
    this.playerHeight = targetHeight;

    // Handle Zoom
    const targetFov = this.isZooming ? 30 : this.baseFOV;
    if (this.camera.fov !== targetFov) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 0.2);
      this.camera.updateProjectionMatrix();
    }

    // Handle Mining
    if (this.isMining && this.miningTarget) {
      const direction = new THREE.Vector3();
      this.camera.getWorldDirection(direction);
      const rayOrigin = this.playerHeadPos.clone();
      const hitResult = this.world.raycast(rayOrigin, direction, 5);

      if (hitResult.hit && hitResult.blockPos && hitResult.blockPos.equals(this.miningTarget)) {
        let speedMultiplier = 1.0;
        
        // Apply SkyBridge Mining Speed
        const effectiveStats = skyBridgeManager.getEffectiveStats(this.inventory, this.hotbarIndex);
        if (effectiveStats.miningSpeed > 0) {
          // Mining speed formula: base + speed/50
          speedMultiplier += effectiveStats.miningSpeed / 50;
        }

        // Air penalty
        if (!this.canJump && !this.isFlying) {
          speedMultiplier *= 0.2; // 5x slower in air
        }
        
        // Water penalty
        const headBlock = this.world.getBlock(Math.floor(this.worldPosition.x), Math.floor(this.worldPosition.y), Math.floor(this.worldPosition.z));
        if (headBlock === BLOCK.WATER) {
          speedMultiplier *= 0.2; // 5x slower in water
        }
        
        this.miningProgress += (delta * speedMultiplier) / this.miningTimeRequired;
        
        // Play mining sound periodically
        if (Math.floor(this.miningProgress * 5) > Math.floor((this.miningProgress - delta * speedMultiplier / this.miningTimeRequired) * 5)) {
          const blockType = this.world.getBlock(this.miningTarget.x, this.miningTarget.y, this.miningTarget.z);
          let surface = 'stone';
          if (blockType === BLOCK.GRASS || blockType === BLOCK.DIRT) surface = 'grass';
          else if (blockType === BLOCK.SAND) surface = 'sand';
          else if (blockType === BLOCK.WOOD || blockType === BLOCK.PLANKS) surface = 'wood';
          
          audioManager.playPositional('break', this.miningTarget.clone().addScalar(0.5), 0.6, 0.8 + Math.random() * 0.4, 20);
        }
        
        // Keep swinging while mining
        if (!this.isSwinging) {
          this.isSwinging = true;
          this.swingTimer = 0;
        }

        if (this.breakingMesh) {
          this.breakingMesh.visible = true;
          this.breakingMesh.position.set(
            this.miningTarget.x + 0.5,
            this.miningTarget.y + 0.5,
            this.miningTarget.z + 0.5
          );
          // Increase opacity based on progress
          (this.breakingMesh.material as THREE.MeshBasicMaterial).opacity = this.miningProgress * 0.9;
        }

        if (this.miningProgress >= 1.0) {
          // Break block
          const blockType = this.world.getBlock(this.miningTarget.x, this.miningTarget.y, this.miningTarget.z);
          if (blockType !== BLOCK.AIR) {
            const success = this.world.setBlock(this.miningTarget.x, this.miningTarget.y, this.miningTarget.z, BLOCK.AIR, true, this.isFlying);
            if (success) {
              audioManager.playPositional('pop', this.miningTarget.clone().addScalar(0.5), 0.8, 0.8 + Math.random() * 0.4, 20);
              window.dispatchEvent(new CustomEvent('spawnParticles', { 
                detail: { pos: this.miningTarget.clone().addScalar(0.5), type: blockType } 
              }));
              
              networkManager.setBlock(this.miningTarget.x, this.miningTarget.y, this.miningTarget.z, 0, this.isFlying);
              
              // Apply Mining Fortune
              const fortune = effectiveStats.miningFortune || 0;
              const dropCount = 1 + Math.floor(fortune / 100) + (Math.random() < (fortune % 100) / 100 ? 1 : 0);
              
              if (this.canHarvestTarget && dropCount > 1) {
                window.dispatchEvent(new CustomEvent('gameMessage', { 
                  detail: { text: `☘ Mining Fortune triggered! (+${dropCount - 1} drops)`, color: "#FFAA00" } 
                }));
              }

              // Add directly to inventory
              let remaining = 0;
              if (this.canHarvestTarget) {
                let dropItemType = blockType as unknown as ItemType;
                
                // Ore Drop Mapping
                if (blockType === BLOCK.DIAMOND_ORE || blockType === BLOCK.DEEPSLATE_DIAMOND_ORE) dropItemType = ItemType.DIAMOND;
                else if (blockType === BLOCK.EMERALD_ORE || blockType === BLOCK.DEEPSLATE_EMERALD_ORE) dropItemType = ItemType.EMERALD;
                else if (blockType === BLOCK.COAL_ORE || blockType === BLOCK.DEEPSLATE_COAL_ORE) dropItemType = ItemType.COAL;
                else if (blockType === BLOCK.LAPIS_ORE || blockType === BLOCK.DEEPSLATE_LAPIS_ORE) dropItemType = ItemType.LAPIS_LAZULI;
                else if (blockType === BLOCK.REDSTONE_ORE || blockType === BLOCK.DEEPSLATE_REDSTONE_ORE) dropItemType = ItemType.REDSTONE;
                else if (blockType === BLOCK.COPPER_ORE || blockType === BLOCK.DEEPSLATE_COPPER_ORE) dropItemType = ItemType.COPPER_INGOT;
                else if (blockType === BLOCK.IRON_ORE || blockType === BLOCK.DEEPSLATE_IRON_ORE) dropItemType = ItemType.IRON_INGOT;
                else if (blockType === BLOCK.GOLD_ORE || blockType === BLOCK.DEEPSLATE_GOLD_ORE) dropItemType = ItemType.GOLD_INGOT;
                else if (blockType === BLOCK.STONE) dropItemType = ItemType.COBBLESTONE;
                else if (blockType === BLOCK.DEEPSLATE) dropItemType = ItemType.COBBLED_DEEPSLATE;
                 else if (blockType === ItemType.TORCH_WALL_X_POS || blockType === ItemType.TORCH_WALL_X_NEG || blockType === ItemType.TORCH_WALL_Z_POS || blockType === ItemType.TORCH_WALL_Z_NEG) dropItemType = ItemType.TORCH;

                remaining = this.inventory.addItem(dropItemType, dropCount);
                
                // Add mining XP
                if ([ItemType.DIAMOND, ItemType.EMERALD].includes(dropItemType)) {
                     skyBridgeManager.addXp(SkillType.MINING, 15);
                } else if ([ItemType.COAL, ItemType.LAPIS_LAZULI, ItemType.REDSTONE].includes(dropItemType)) {
                     skyBridgeManager.addXp(SkillType.MINING, 10);
                } else if ([ItemType.IRON_INGOT, ItemType.GOLD_INGOT, ItemType.COPPER_INGOT].includes(dropItemType)) {
                     skyBridgeManager.addXp(SkillType.MINING, 5);
                } else if (dropItemType === ItemType.COBBLESTONE || dropItemType === ItemType.COBBLED_DEEPSLATE) {
                     skyBridgeManager.addXp(SkillType.MINING, 1);
                }
              }
              
              // Damage tool
              const equippedItem = this.inventory.slots[this.hotbarIndex];
              if (equippedItem && equippedItem.type >= ItemType.WOODEN_PICKAXE && equippedItem.type <= ItemType.DIAMOND_AXE) {
                const broke = this.inventory.damageItem(this.hotbarIndex, 1);
                if (broke) {
                  audioManager.play('pop', 0.8, 0.4); // Break sound
                  window.dispatchEvent(new CustomEvent('updateHotbar'));
                }
              }

              if (remaining > 0) {
                // If inventory is full, drop the remaining items
                for (let i = 0; i < remaining; i++) {
                  networkManager.dropItem(blockType, {
                    x: this.miningTarget.x + 0.5 + (Math.random() - 0.5) * 0.2,
                    y: this.miningTarget.y + 0.5,
                    z: this.miningTarget.z + 0.5 + (Math.random() - 0.5) * 0.2
                  });
                }
                window.dispatchEvent(new CustomEvent('gameMessage', { 
                  detail: { text: "Inventory full! Some items were dropped.", color: "#FF5555" } 
                }));
              }
              
              // Reward SkyBridge XP
              skyBridgeManager.addXp(SkillType.MINING, 10);
            }
          }
          this.isMining = false;
          this.miningTarget = null;
          this.miningProgress = 0;
          if (this.breakingMesh) this.breakingMesh.visible = false;
        }
      } else {
        // Looked away
        this.isMining = false;
        this.miningTarget = null;
        this.miningProgress = 0;
        if (this.breakingMesh) this.breakingMesh.visible = false;
      }
    }
    
    this.physics.applyGravityAndCollision(delta);

    const input = this.inputController;
    const horizontalVelocity = new THREE.Vector2(this.velocity.x, this.velocity.z).length();
    const isMoving = horizontalVelocity > 0.1;

    // Smooth camera height for crouching
    this.targetCameraHeight = input.isCrouching ? this.crouchHeight : this.standingHeight;
    this.currentCameraHeight = THREE.MathUtils.lerp(this.currentCameraHeight, this.targetCameraHeight, 0.15);
    
    // Smooth FOV for sprinting/zooming
    let desiredFOV = this.baseFOV;
    if (this.isZooming) desiredFOV = 30;
    else if (input.isSprinting && isMoving) desiredFOV = this.baseFOV + 10;
    
    // Dynamic FOV when falling at high speeds
    if (!this.canJump && this.velocity.y < -15) {
      const fallSpeed = Math.abs(this.velocity.y);
      const fovIncrease = Math.min((fallSpeed - 15) * 0.5, 30); // Max +30 FOV
      desiredFOV += fovIncrease;
    }
    
    this.targetFOV = THREE.MathUtils.lerp(this.targetFOV, desiredFOV, 0.1);
    if (Math.abs(this.camera.fov - this.targetFOV) > 0.1) {
      this.camera.fov = this.targetFOV;
      this.camera.updateProjectionMatrix();
    }

    // Update first person held item
    if (this.fpBlockMesh && this.fpArmMesh && this.fpHeldItemModel) {
      const selectedStack = this.inventory.getStackInSlot(this.hotbarIndex);
      if (selectedStack && selectedStack.count > 0 && selectedStack.type !== ItemType.AIR) {
        const itemTypeNum = selectedStack.type as unknown as number;
        
        // Update 3rd person and 1st person renderer
        const offHandItem = this.inventory.slots[Inventory.OFF_HAND_SLOT]?.type || 0;
        this.renderer.setHeldItem(itemTypeNum, offHandItem);
        
        const isMinion = selectedStack.type === ItemType.MINION;
        const isTorch = itemTypeNum === ItemType.TORCH;
        const isSelectedPlant = isPlant(itemTypeNum);
        const isFlat = isFlatItem(itemTypeNum);
        const isTool = (itemTypeNum >= 436 && itemTypeNum <= 455) || (itemTypeNum >= 460 && itemTypeNum <= 472) || itemTypeNum === 54;
        const isFood = (itemTypeNum >= 456 && itemTypeNum <= 459);
        const isMaterial = itemTypeNum === 13 || (itemTypeNum >= 500 && itemTypeNum <= 509) || itemTypeNum === 29 || itemTypeNum === 303 || itemTypeNum === 300 || itemTypeNum === 319 || itemTypeNum === 321 || itemTypeNum === 43 || itemTypeNum === 44 || isTorch;
        const use3DModel = isTool || isFood || isMaterial;

        if (use3DModel) {
          this.fpBlockMesh.visible = false;
          this.fpHeldItemModel.visible = true;
          this.fpArmMesh.visible = false; // Hide hand when holding item
          
          if (this.currentModelType !== selectedStack.type) {
            this.fpHeldItemModel.clear();
            const model = createItemModel(selectedStack.type);
            this.fpHeldItemModel.add(model);
            this.currentModelType = selectedStack.type;
            
            // Positioning override based on type
            if (isFood) {
              this.fpHeldItemModel.position.set(0.4, -0.4, -0.7);
              this.fpHeldItemModel.rotation.set(-0.2, -Math.PI / 4, 0.4);
              this.fpHeldItemModel.scale.set(0.8, 0.8, 0.8);
            } else if (isTorch) {
              this.fpHeldItemModel.position.set(0.55, -0.5, -0.7);
              this.fpHeldItemModel.rotation.set(0, -Math.PI / 8, 0);
              this.fpHeldItemModel.scale.set(1.2, 1.2, 1.2);
            } else if (isMaterial && !isTool) {
               // Ingots, gems, sticks
              this.fpHeldItemModel.position.set(0.5, -0.45, -0.7);
              this.fpHeldItemModel.rotation.set(-0.3, -Math.PI / 4, 0.6);
              this.fpHeldItemModel.scale.set(0.9, 0.9, 0.9);
            } else {
              // Standard tool position
              this.fpHeldItemModel.position.set(0.55, -0.4, -0.75);
              this.fpHeldItemModel.rotation.set(-0.35, -Math.PI / 3.5, 0.5);
              this.fpHeldItemModel.scale.set(1.1, 1.1, 1.1);
            }
          }
        } else {
          this.fpBlockMesh.visible = true;
          this.fpHeldItemModel.visible = false;
          this.currentModelType = null;
          this.fpArmMesh.visible = false; // Hide hand when holding block/sprite
          
          // Position block at the end of the hand
          this.fpBlockMesh.position.set(0.6, -0.5, -0.7);

          if (isMinion) {
            // Special look for minion in hand
            this.fpBlockMesh.scale.set(0.5, 0.8, 0.3);
            this.fpBlockMesh.rotation.set(0, 0, 0);
            (this.fpBlockMesh.material as THREE.MeshLambertMaterial).color.setHex(0xFFFF55);
            (this.fpBlockMesh.material as THREE.MeshLambertMaterial).map = null;
          } else if (isSelectedPlant || isFlat) {
            if (isFlat) {
              this.fpBlockMesh.scale.set(1.3, 1.3, 0.02);
              this.fpBlockMesh.position.set(0.5, -0.3, -0.6);
              // Tilt for a tool-holding perspective (Diagonal hold)
              this.fpBlockMesh.rotation.set(-0.5, 0.5, 0.5);
            } else {
              this.fpBlockMesh.scale.set(1, 1, 0.01);
              this.fpBlockMesh.position.set(0.6, -0.5, -0.7);
              this.fpBlockMesh.rotation.set(0, 0, 0);
            }
            (this.fpBlockMesh.material as THREE.MeshLambertMaterial).color.setHex(0xFFFFFF);
            (this.fpBlockMesh.material as THREE.MeshLambertMaterial).map = this.world.opaqueMaterial.map;
            (this.fpBlockMesh.material as THREE.MeshLambertMaterial).side = THREE.DoubleSide;
            
            // Update UVs for the front face only (all faces same for simplicity)
            const uvs = this.fpBlockMesh.geometry.attributes.uv;
            const blockUVs = getBlockUVs(itemTypeNum);
            if (blockUVs) {
              const [x, y] = blockUVs[4]; // Front face
              const u1 = x / ATLAS_TILES;
              const v1 = 1.0 - ((y + 1) / ATLAS_TILES);
              const u2 = (x + 1) / ATLAS_TILES;
              const v2 = 1.0 - (y / ATLAS_TILES);
              
              for (let i = 0; i < 6; i++) {
                const offset = i * 4;
                uvs.setXY(offset + 0, u1, v2); // TL
                uvs.setXY(offset + 1, u2, v2); // TR
                uvs.setXY(offset + 2, u1, v1); // BL
                uvs.setXY(offset + 3, u2, v1); // BR
              }
              uvs.needsUpdate = true;
            }
          } else {
            this.fpBlockMesh.scale.set(1, 1, 1);
            this.fpBlockMesh.position.set(0.6, -0.5, -0.7);
            this.fpBlockMesh.rotation.set(0, 0, 0);
            (this.fpBlockMesh.material as THREE.MeshLambertMaterial).color.setHex(0xFFFFFF);
            (this.fpBlockMesh.material as THREE.MeshLambertMaterial).map = this.world.opaqueMaterial.map;
            (this.fpBlockMesh.material as THREE.MeshLambertMaterial).side = THREE.FrontSide;
            
            // Update UVs for the block
            const uvs = this.fpBlockMesh.geometry.attributes.uv;
            const blockUVs = getBlockUVs(selectedStack.type as unknown as number);
            if (blockUVs) {
              for (let i = 0; i < 6; i++) {
                const [x, y] = blockUVs[i];
                const u1 = x / ATLAS_TILES;
                const v1 = 1.0 - ((y + 1) / ATLAS_TILES);
                const u2 = (x + 1) / ATLAS_TILES;
                const v2 = 1.0 - (y / ATLAS_TILES);
                
                const offset = i * 4;
                uvs.setXY(offset + 0, u1, v2); // TL
                uvs.setXY(offset + 1, u2, v2); // TR
                uvs.setXY(offset + 2, u1, v1); // BL
                uvs.setXY(offset + 3, u2, v1); // BR
              }
              uvs.needsUpdate = true;
            }
          }
        }
      } else {
        this.fpBlockMesh.visible = false;
        this.fpHeldItemModel.visible = false;
        this.fpArmMesh.visible = true;
        this.currentModelType = null;
        
        // Update 3rd person and 1st person renderer
        const offHandItem = this.inventory.slots[Inventory.OFF_HAND_SLOT]?.type || 0;
        this.renderer.setHeldItem(0, offHandItem);
      }
    }

    // Animate character model
    this.animateModel(delta);

    // Smooth camera step offsets
    if (this.cameraYOffset < 0) {
       this.cameraYOffset = THREE.MathUtils.lerp(this.cameraYOffset, 0, delta * 15);
       if (Math.abs(this.cameraYOffset) < 0.01) this.cameraYOffset = 0;
    }

    // Update camera and model based on perspective
    this.modelGroup.rotation.y = this.cameraYaw;
    
    // Smooth model position using cameraYOffset to prevent snapping on steps
    const smoothedModelY = this.worldPosition.y - this.playerHeight + this.cameraYOffset;
    this.modelGroup.position.set(this.worldPosition.x, smoothedModelY, this.worldPosition.z);

    if (this.perspective !== Perspective.FIRST_PERSON) {
      this.modelGroup.visible = true;
      this.fpArmGroup.visible = false;
      
      // Position camera based on perspective
      const offset = new THREE.Vector3();
      if (this.perspective === Perspective.THIRD_PERSON_BACK) {
        offset.set(0, 0.5, 4);
      } else {
        // Front view
        offset.set(0, 0.5, -4);
      }
      
      offset.applyQuaternion(this.camera.quaternion);
      const smoothedPos = this.worldPosition.clone();
      smoothedPos.y += this.cameraYOffset;
      this.camera.position.copy(smoothedPos).add(offset);
      
      if (this.perspective === Perspective.THIRD_PERSON_FRONT) {
        // Look back at the player
        // We need to calculate the lookAt point based on player position
        const lookTarget = smoothedPos.clone();
        lookTarget.y -= 0.5; // Look at chest level
        this.camera.lookAt(lookTarget);
      }
    } else {
      this.modelGroup.visible = false;
      this.fpArmGroup.visible = this.renderer.isHandVisible;
      
      // Apply smooth camera height (halved bobbing for less motion sickness)
      const bobY = (isMoving && this.canJump) ? Math.sin(this.walkCycle * 2) * 0.001: 0;
      const bobX = (isMoving && this.canJump) ? Math.cos(this.walkCycle) * 0.001 : 0;
      
      this.camera.position.set(
        this.worldPosition.x + bobX,
        this.worldPosition.y - (this.standingHeight - this.currentCameraHeight) + bobY + this.cameraYOffset,
        this.worldPosition.z
      );
      
      // Hand Inertia / Sway (More pronounced for "refined" feel)
      this.lookSwayX = THREE.MathUtils.lerp(this.lookSwayX, this.mouseDeltaX * 0.0015, 0.15);
      this.lookSwayY = THREE.MathUtils.lerp(this.lookSwayY, this.mouseDeltaY * 0.0015, 0.15);
      
      // Reset mouse delta after applying
      this.mouseDeltaX = 0;
      this.mouseDeltaY = 0;

      // Calculate target swing values
      let swingRotX = 0, swingRotY = 0, swingRotZ = 0;
      let swingPosX = 0, swingPosY = 0, swingPosZ = 0;

      if (this.isSwinging) {
        // Minecraft-like snappy swing
        const t = this.swingTimer / Math.PI;
        // Faster "flick"
        const swingProgress = Math.sin(Math.sqrt(t) * Math.PI);
        
        swingRotX = -swingProgress * 0.5;
        swingRotY = swingProgress * 0.3;
        swingRotZ = swingProgress * 0.3;
        swingPosX = -swingProgress * 0.2;
        swingPosY = -swingProgress * 0.1;
        swingPosZ = swingProgress * 0.1;
      }

      if (this.inputController.isBlocking && this.renderer.fpHeldItemModel) {
        // Overlay block animation
        swingRotY -= 0.6;
        swingRotZ -= 0.3;
        swingPosX -= 0.15;
      }

      // Idle breathing and walk bobbing (more natural movement)
      const idleBobY = Math.sin(performance.now() * 0.002) * 0.01;
      const walkBobX = isMoving ? Math.cos(this.walkCycle) * 0.04 : 0;
      const walkBobY = isMoving ? Math.sin(this.walkCycle * 2) * 0.04 : 0;

      // Apply rotations
      this.fpArmGroup.rotation.x = THREE.MathUtils.lerp(this.fpArmGroup.rotation.x, swingRotX, 0.25);
      this.fpArmGroup.rotation.y = THREE.MathUtils.lerp(this.fpArmGroup.rotation.y, swingRotY + this.lookSwayX * 0.8, 0.25);
      this.fpArmGroup.rotation.z = THREE.MathUtils.lerp(this.fpArmGroup.rotation.z, swingRotZ + this.lookSwayX * 0.3, 0.25);
      
      // Apply positions (including sway and bob)
      this.fpArmGroup.position.x = THREE.MathUtils.lerp(this.fpArmGroup.position.x, swingPosX - this.lookSwayX * 2.0 + walkBobX, 0.2);
      this.fpArmGroup.position.y = THREE.MathUtils.lerp(this.fpArmGroup.position.y, swingPosY + this.lookSwayY * 1.5 + walkBobY + idleBobY, 0.2);
      this.fpArmGroup.position.z = THREE.MathUtils.lerp(this.fpArmGroup.position.z, swingPosZ, 0.2);

      if (this.renderer.fpOffHandArmGroup) {
        const offHand = this.renderer.fpOffHandArmGroup;
        offHand.rotation.x = THREE.MathUtils.lerp(offHand.rotation.x, -0.1, 0.25);
        offHand.rotation.y = THREE.MathUtils.lerp(offHand.rotation.y, this.lookSwayX * 0.8, 0.25);
        offHand.rotation.z = THREE.MathUtils.lerp(offHand.rotation.z, this.lookSwayX * 0.3, 0.25);
        
        offHand.position.x = THREE.MathUtils.lerp(offHand.position.x, -0.6 - this.lookSwayX * 2.0 - walkBobX, 0.2);
        offHand.position.y = THREE.MathUtils.lerp(offHand.position.y, -0.6 + this.lookSwayY * 1.5 + walkBobY + idleBobY, 0.2);
        offHand.position.z = THREE.MathUtils.lerp(offHand.position.z, -0.5, 0.2);
      }
    }

    // Sync to network (Adaptive frequency)
    const now = performance.now();
    const syncInterval = settingsManager.getSettings().performanceMode ? 100 : 50;

    if (now - this.lastNetworkSyncTime > syncInterval) {
      this._syncEuler.set(this.cameraPitch, this.cameraYaw, 0, 'YXZ');
      this._syncPos.set(this.worldPosition.x, this.worldPosition.y - this.playerHeight, this.worldPosition.z);
      networkManager.move(this._syncPos, this._syncEuler, {
        isFlying: this.isFlying,
        isSwimming: this.isSwimming,
        isCrouching: this.inputController.isCrouching,
        isSprinting: this.inputController.isSprinting,
        isSwinging: this.isSwinging,
        isBlocking: this.inputController.isBlocking,
        swingSpeed: this.swingSpeed,
        isGrounded: this.canJump,
        heldItem: this.inventory.slots[this.hotbarIndex]?.type || 0,
        offHandItem: this.inventory.slots[Inventory.OFF_HAND_SLOT]?.type || 0,
        defense: skyBridgeManager.effectiveStats.defense || 0
      });
      this.lastNetworkSyncTime = now;
    }
  }
}
