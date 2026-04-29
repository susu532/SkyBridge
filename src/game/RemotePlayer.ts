import * as THREE from 'three';
import { generateSkin, applySkinUVs } from './SkinManager';
import { createItemModel } from './ItemModels';
import { getBlockUVs, createTextureAtlas, ATLAS_TILES, isPlant, isFlatItem, isLightEmitting } from './TextureAtlas';
import { settingsManager } from './Settings';
import { ItemType } from './Inventory';

export class RemotePlayer {
  id: string;
  group: THREE.Group;
  
  headMesh!: THREE.Mesh;
  bodyMesh!: THREE.Mesh;
  leftArmMesh!: THREE.Mesh;
  rightArmMesh!: THREE.Mesh;
  leftLegMesh!: THREE.Mesh;
  rightLegMesh!: THREE.Mesh;
  capeMesh!: THREE.Mesh;
  heldItemMesh: THREE.Mesh | null = null;
  heldItemModel: THREE.Group | null = null;
  offHandItemMesh: THREE.Mesh | null = null;
  offHandItemModel: THREE.Group | null = null;
  heldItemType: number = 0;
  offHandItemType: number = 0;
  currentModelType: number | null = null;
  currentOffHandModelType: number | null = null;
  torchLight: THREE.PointLight | null = null;

  targetPosition: THREE.Vector3;
  targetRotation: THREE.Euler;
  lastNetPos: THREE.Vector3;
  interpolationTimer: number = 0;
  
  isFlying = false;
  isSwimming = false;
  isCrouching = false;
  isSprinting = false;
  isSwinging = false;
  isBlocking = false;
  isGliding = false;
  isGrounded = true;
  swingSpeed = 15;
  
  skills: any = {};
  
  walkCycle = 0;
  swingTimer = 0;
  idleTime = 0;
  capeAngle = 0.1;
  capeVelocity = 0;
  crouchTransition = 0;
  swimTransition = 0;
  blockTransition = 0;
  climbTransition = 0;
  gliderOpenAmount = 0;
  
  gliderGroup: THREE.Group | null = null;
  gliderLeftWing: THREE.Mesh | null = null;
  gliderRightWing: THREE.Mesh | null = null;
  
  health: number = 100;
  
  // Head and body rotation tracking
  name: string;
  
  headYaw = 0;
  headPitch = 0;
  bodyYaw = 0;
  
  velocity = new THREE.Vector3();
  animVelocity = new THREE.Vector3();
  knockbackVelocity = new THREE.Vector3();
  lastPos = new THREE.Vector3();
  groundedTimer = 0;
  
  // Pre-allocated vectors for math
  private _instantVelocity = new THREE.Vector3();
  private _recoilDir = new THREE.Vector3();
  visualOffset = new THREE.Vector3();
  currentPos = new THREE.Vector3();
  damageRotate = 0;
  damageRotateAxis = new THREE.Vector3(1, 0, 0);
  
  constructor(id: string, skinSeed: string, name: string, scene: THREE.Scene) {
    this.id = id;
    this.group = new THREE.Group();
    this.targetPosition = new THREE.Vector3();
    this.targetRotation = new THREE.Euler();
    this.lastNetPos = new THREE.Vector3();
    this.name = name;
    
    this.createModel(skinSeed);
    this.group.userData = { isPlayer: true, playerId: id };
    scene.add(this.group);
  }

  getHitbox(): THREE.Box3 {
    const width = 0.6;
    const height = 1.8;
    const pos = this.group.position;
    
    const min = new THREE.Vector3(
      pos.x - width / 2,
      pos.y,
      pos.z - width / 2
    );
    const max = new THREE.Vector3(
      pos.x + width / 2,
      pos.y + height,
      pos.z + width / 2
    );
    
    return new THREE.Box3(min, max);
  }

  private createModel(skinSeed: string) {
    const skinTexture = generateSkin(skinSeed);
    const skinMaterial = new THREE.MeshStandardMaterial({ 
      map: skinTexture,
      roughness: 0.8,
      metalness: 0.1
    });
    const outerMaterial = new THREE.MeshStandardMaterial({ 
      map: skinTexture, 
      transparent: true, 
      alphaTest: 0.1, 
      side: THREE.DoubleSide,
      roughness: 0.8,
      metalness: 0.1
    });

    // Body (The central pivot for the upper body)
    const bodyGeo = new THREE.BoxGeometry(0.4, 0.6, 0.2);
    applySkinUVs(bodyGeo, 'body');
    this.bodyMesh = new THREE.Mesh(bodyGeo, skinMaterial);
    this.bodyMesh.position.y = 0.9;
    this.bodyMesh.castShadow = true;
    this.bodyMesh.receiveShadow = true;
    this.group.add(this.bodyMesh);

    const bodyOuterGeo = new THREE.BoxGeometry(0.42, 0.62, 0.22);
    applySkinUVs(bodyOuterGeo, 'body', true);
    const bodyOuter = new THREE.Mesh(bodyOuterGeo, outerMaterial);
    this.bodyMesh.add(bodyOuter);
    
    // Backpack
    const packGeo = new THREE.BoxGeometry(0.3, 0.4, 0.15);
    const packMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
    const backpack = new THREE.Mesh(packGeo, packMat);
    backpack.position.set(0, 0, 0.18);
    backpack.castShadow = true;
    this.bodyMesh.add(backpack);

    // Head (Child of Body)
    const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    applySkinUVs(headGeo, 'head');
    this.headMesh = new THREE.Mesh(headGeo, skinMaterial);
    this.headMesh.position.y = 0.5; // Relative to body center (0.9 + 0.5 = 1.4)
    this.headMesh.castShadow = true;
    this.headMesh.receiveShadow = true;
    this.bodyMesh.add(this.headMesh);
    
    const headOuterGeo = new THREE.BoxGeometry(0.42, 0.42, 0.42);
    applySkinUVs(headOuterGeo, 'head', true);
    const headOuter = new THREE.Mesh(headOuterGeo, outerMaterial);
    this.headMesh.add(headOuter);

    // Arms (Children of Body)
    const armGeoL = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    applySkinUVs(armGeoL, 'armL');
    this.leftArmMesh = new THREE.Mesh(armGeoL, skinMaterial);
    this.leftArmMesh.position.set(-0.3, 0.3, 0); // Relative to body center
    this.leftArmMesh.geometry.translate(0, -0.3, 0);
    this.leftArmMesh.castShadow = true;
    this.leftArmMesh.receiveShadow = true;
    this.bodyMesh.add(this.leftArmMesh);

    const armOuterGeoL = new THREE.BoxGeometry(0.22, 0.62, 0.22);
    applySkinUVs(armOuterGeoL, 'armL', true);
    const armOuterL = new THREE.Mesh(armOuterGeoL, outerMaterial);
    armOuterL.position.y = -0.3;
    this.leftArmMesh.add(armOuterL);

    const armGeoR = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    applySkinUVs(armGeoR, 'armR');
    this.rightArmMesh = new THREE.Mesh(armGeoR, skinMaterial);
    this.rightArmMesh.position.set(0.3, 0.3, 0); // Relative to body center
    this.rightArmMesh.geometry.translate(0, -0.3, 0);
    this.rightArmMesh.castShadow = true;
    this.rightArmMesh.receiveShadow = true;
    this.bodyMesh.add(this.rightArmMesh);

    const armOuterGeoR = new THREE.BoxGeometry(0.22, 0.62, 0.22);
    applySkinUVs(armOuterGeoR, 'armR', true);
    const armOuterR = new THREE.Mesh(armOuterGeoR, outerMaterial);
    armOuterR.position.y = -0.3;
    this.rightArmMesh.add(armOuterR);

    // Legs (Children of Group)
    const legGeoL = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    applySkinUVs(legGeoL, 'legL');
    this.leftLegMesh = new THREE.Mesh(legGeoL, skinMaterial);
    this.leftLegMesh.position.set(-0.1, 0.6, 0);
    this.leftLegMesh.geometry.translate(0, -0.3, 0);
    this.leftLegMesh.castShadow = true;
    this.leftLegMesh.receiveShadow = true;
    this.group.add(this.leftLegMesh);
    
    const legOuterGeoL = new THREE.BoxGeometry(0.22, 0.62, 0.22);
    applySkinUVs(legOuterGeoL, 'legL', true);
    const legOuterL = new THREE.Mesh(legOuterGeoL, outerMaterial);
    legOuterL.position.y = -0.3;
    this.leftLegMesh.add(legOuterL);

    const legGeoR = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    applySkinUVs(legGeoR, 'legR');
    this.rightLegMesh = new THREE.Mesh(legGeoR, skinMaterial);
    this.rightLegMesh.position.set(0.1, 0.6, 0);
    this.rightLegMesh.geometry.translate(0, -0.3, 0);
    this.rightLegMesh.castShadow = true;
    this.rightLegMesh.receiveShadow = true;
    this.group.add(this.rightLegMesh);

    const legOuterGeoR = new THREE.BoxGeometry(0.22, 0.62, 0.22);
    applySkinUVs(legOuterGeoR, 'legR', true);
    const legOuterR = new THREE.Mesh(legOuterGeoR, outerMaterial);
    legOuterR.position.y = -0.3;
    this.rightLegMesh.add(legOuterR);

    // Cape (Child of Body)
    const capeGeo = new THREE.BoxGeometry(0.4, 1.0, 0.05);
    const capeMat = new THREE.MeshStandardMaterial({ color: 0xcc3333, roughness: 0.7 });
    this.capeMesh = new THREE.Mesh(capeGeo, capeMat);
    this.capeMesh.position.set(0, 0.3, 0.1); // Relative to body center
    this.capeMesh.geometry.translate(0, -0.5, 0);
    this.capeMesh.castShadow = true;
    this.capeMesh.receiveShadow = true;
    this.bodyMesh.add(this.capeMesh);

    // Glider
    this.createGlider();

    // Held Item (Child of Right Arm)
    const itemGeo = new THREE.BoxGeometry(0.25, 0.25, 0.25);
    const itemMat = new THREE.MeshStandardMaterial({ 
      transparent: true, 
      alphaTest: 0.5,
      roughness: 0.8
    });
    this.heldItemMesh = new THREE.Mesh(itemGeo, itemMat);
    this.heldItemMesh.position.set(0, -0.45, -0.15);
    this.heldItemMesh.visible = false;
    this.heldItemModel = new THREE.Group();
    this.rightArmMesh.add(this.heldItemModel);
    this.rightArmMesh.add(this.heldItemMesh);

    this.torchLight = new THREE.PointLight(0xffbd5c, 160.0, 35); 
    this.torchLight.visible = false;
    this.group.add(this.torchLight);
  }

  private createGlider() {
    this.gliderGroup = new THREE.Group();
    this.gliderGroup.position.set(0, 0.45, 0.1);
    this.bodyMesh.add(this.gliderGroup);

    // Main Wings
    const wingSizeX = 2.4;
    const wingSizeY = 1.2;
    const wingGeo = new THREE.PlaneGeometry(wingSizeX, wingSizeY);
    wingGeo.translate(wingSizeX / 2, -wingSizeY / 4, 0); // Pivot at top-inner corner
    
    const wingMat = new THREE.MeshStandardMaterial({ 
      color: 0x33ccff, 
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      roughness: 0.4,
      metalness: 0.1
    });

    // Frame/Spar
    const sparGeo = new THREE.BoxGeometry(wingSizeX, 0.1, 0.1);
    sparGeo.translate(wingSizeX / 2, 0, 0.05);
    const sparMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f });

    this.gliderLeftWing = new THREE.Group() as any;
    const leftCanvas = new THREE.Mesh(wingGeo, wingMat);
    const leftSpar = new THREE.Mesh(sparGeo, sparMat);
    this.gliderLeftWing!.add(leftCanvas);
    this.gliderLeftWing!.add(leftSpar);
    this.gliderLeftWing!.rotation.y = Math.PI;
    this.gliderGroup.add(this.gliderLeftWing!);

    this.gliderRightWing = new THREE.Group() as any;
    const rightCanvas = new THREE.Mesh(wingGeo, wingMat);
    const rightSpar = new THREE.Mesh(sparGeo, sparMat);
    this.gliderRightWing!.add(rightCanvas);
    this.gliderRightWing!.add(rightSpar);
    this.gliderGroup.add(this.gliderRightWing!);

    this.gliderGroup.visible = false;
  }

  setHeldItem(type: number, offHandType: number = 0) {
    this.updateItem(type, false);
    this.updateItem(offHandType, true);

    const isTorch = type === ItemType.TORCH || offHandType === ItemType.TORCH;
    if (this.torchLight) {
      this.torchLight.visible = isTorch;
      if (isTorch) {
        if (offHandType === ItemType.TORCH) {
          this.torchLight.position.set(-0.3, 1.2, 0); 
        } else {
          this.torchLight.position.set(0.3, 1.2, 0);
        }
      }
    }
  }

  private updateItem(type: number, isOffHand: boolean) {
    const currentType = isOffHand ? this.offHandItemType : this.heldItemType;
    if (currentType === type) return;
    
    if (isOffHand) this.offHandItemType = type;
    else this.heldItemType = type;
    
    const mesh = isOffHand ? this.offHandItemMesh : this.heldItemMesh;
    const model = isOffHand ? this.offHandItemModel : this.heldItemModel;
    const currentModelType = isOffHand ? this.currentOffHandModelType : this.currentModelType;
    
    if (!mesh || !model) return;

    if (type === 0) {
      mesh.visible = false;
      model.visible = false;
      return;
    }
    
    const isPickaxe = type >= ItemType.WOODEN_PICKAXE && type <= ItemType.DIAMOND_PICKAXE;
    const isSword = type >= ItemType.WOODEN_SWORD && type <= ItemType.DIAMOND_SWORD;
    const isShovel = type >= ItemType.WOODEN_SHOVEL && type <= ItemType.DIAMOND_SHOVEL;
    const isAxe = type >= ItemType.WOODEN_AXE && type <= ItemType.DIAMOND_AXE;
    const isTorch = type === ItemType.TORCH;
    const isTool = isPickaxe || isSword || isShovel || isAxe || (type >= 460 && type <= 472) || type === 54;
    const isFood = (type >= 456 && type <= 459);
    const isMaterial = type === 13 || (type >= 500 && type <= 509) || type === 29 || type === 303 || type === 300 || type === 319 || type === 321 || type === 43 || type === 44 || isTorch;
    const use3DModel = isTool || isFood || isMaterial;

    if (use3DModel) {
      mesh.visible = false;
      model.visible = true;
      
      if (currentModelType !== type) {
        model.clear();
        const itemModel = createItemModel(type as ItemType);
        model.add(itemModel);
        if (isOffHand) this.currentOffHandModelType = type;
        else this.currentModelType = type;

        if (isFood) {
          model.position.set(0, -0.42, 0);
          model.scale.set(0.8, 0.8, 0.8);
        } else if (isTorch) {
          model.position.set(0, -0.3, -0.1);
          model.scale.set(1.2, 1.2, 1.2);
          model.rotation.set(0, 0, 0);
        } else if (isMaterial && !isTool) {
          model.position.set(0, -0.45, -0.05);
          model.scale.set(0.9, 0.9, 0.9);
        } else {
          model.position.set(0, -0.4, -0.1);
          model.scale.set(1.1, 1.1, 1.1);
          model.rotation.set(-Math.PI / 4, Math.PI / 8, Math.PI / 16);
        }
      }
    } else {
      model.visible = false;
      mesh.visible = true;
      
      const uvs = getBlockUVs(type);
      if (uvs) {
        const isFlat = isFlatItem(type);
        const plant = isPlant(type);

        if (isFlat) {
          mesh.scale.set(1.4, 1.4, 0.05);
          mesh.position.set(0, -0.4, -0.1);
          mesh.rotation.set(Math.PI / 8, Math.PI / 4, 0); 
          (mesh.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
        } else if (plant) {
          mesh.scale.set(1, 1, 0.05);
          mesh.position.set(0, -0.45, -0.15);
          mesh.rotation.set(0, 0, 0);
          (mesh.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
        } else {
          mesh.scale.set(1, 1, 1);
          mesh.position.set(0, -0.45, -0.15);
          mesh.rotation.set(0, 0, 0);
          (mesh.material as THREE.MeshStandardMaterial).side = THREE.FrontSide;
        }

        const uvAttribute = mesh.geometry.getAttribute('uv') as THREE.BufferAttribute;
        const atlasSize = ATLAS_TILES;
        const step = 1 / atlasSize;
        
        for (let i = 0; i < 6; i++) {
          const faceUVs = uvs[i];
          const u = faceUVs[0] * step;
          const v = 1.0 - (faceUVs[1] + 1) * step;
          
          const startIdx = i * 4;
          uvAttribute.setXY(startIdx, u, v + step);
          uvAttribute.setXY(startIdx + 1, u + step, v + step);
          uvAttribute.setXY(startIdx + 2, u, v);
          uvAttribute.setXY(startIdx + 3, u + step, v);
        }
        uvAttribute.needsUpdate = true;
        
        if (!(mesh.material as THREE.MeshStandardMaterial).map) {
          (mesh.material as THREE.MeshStandardMaterial).map = createTextureAtlas();
        }
      }
    }
  }

  knockback(dir: THREE.Vector3, force: number) {
    this.knockbackVelocity.copy(dir).multiplyScalar(force);
    this.knockbackVelocity.y = 8; // Lift
  }

  update(delta: number, localPlayerPos?: THREE.Vector3) {
    if (localPlayerPos) {
      const distSq = this.currentPos.distanceToSquared(localPlayerPos);
      if (distSq > 10000) { // > 100 blocks
        this.group.visible = false;
        return; // Don't even interpolate if too far
      }
      
      this.group.visible = true;
      
      // Stop animating limbs if > 60 blocks, just move them
      if (distSq > 3600) {
        this.currentPos.copy(this.targetPosition);
        this.group.position.copy(this.currentPos);
        return;
      }
    }

    // Apply visual knockback decay
    if (this.knockbackVelocity.lengthSq() > 0.01) {
      this.visualOffset.addScaledVector(this.knockbackVelocity, delta);
      this.knockbackVelocity.multiplyScalar(1.0 - 5.0 * delta);
    }

    // Networked movement interpolation
    const dist = this.currentPos.distanceTo(this.targetPosition);
    if (dist > 10) {
      this.currentPos.copy(this.targetPosition);
    } else {
      const moveFactor = 1.0 - Math.exp(-20 * delta);
      this.currentPos.lerp(this.targetPosition, moveFactor);
    }

    const decay = 1.0 - Math.exp(-15 * delta); // Snappy exponential decay
    this.visualOffset.lerp(new THREE.Vector3(0, 0, 0), decay);
    this.damageRotate = THREE.MathUtils.lerp(this.damageRotate, 0, decay);
    
    this.group.position.copy(this.currentPos).add(this.visualOffset);

    const lerpFactor = 1.0 - Math.exp(-25 * delta);
    
    // Minecraft-style head and body rotation sync
    // targetRotation.y is the total look yaw
    // targetRotation.x is the look pitch
    
    // 1. Interpolate head look angles
    let diffYaw = this.targetRotation.y - this.headYaw;
    while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
    while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
    this.headYaw += diffYaw * lerpFactor;

    let diffPitch = this.targetRotation.x - this.headPitch;
    while (diffPitch < -Math.PI) diffPitch += Math.PI * 2;
    while (diffPitch > Math.PI) diffPitch -= Math.PI * 2;
    this.headPitch += diffPitch * lerpFactor;

    // 2. Body yaw logic: body follows head but can lag behind
    // If moving, body faces look direction
    // If still, body only turns if head turns too far (> 50 degrees)
    this._instantVelocity.copy(this.group.position).sub(this.lastPos).divideScalar(delta);
    this.velocity.copy(this._instantVelocity);
    
    // Smoothed velocity for animations to prevent jitter
    const animLerp = 1.0 - Math.pow(0.0001, delta);
    this.animVelocity.lerp(this._instantVelocity, animLerp);
    
    const horizontalVelocity = new THREE.Vector2(this.animVelocity.x, this.animVelocity.z).length();
    const isMoving = horizontalVelocity > 0.1;

    // Grounded state smoothing
    if (this.isGrounded) {
      this.groundedTimer = THREE.MathUtils.lerp(this.groundedTimer, 1, delta * 15);
    } else {
      this.groundedTimer = THREE.MathUtils.lerp(this.groundedTimer, 0, delta * 15);
    }

    if (isMoving || this.isSwinging) {
      // Body follows head closely when moving or acting
      let diffBody = this.headYaw - this.bodyYaw;
      while (diffBody < -Math.PI) diffBody += Math.PI * 2;
      while (diffBody > Math.PI) diffBody -= Math.PI * 2;
      this.bodyYaw += diffBody * lerpFactor;
    } else {
      // Body stays still until head turns too far
      let diffBody = this.headYaw - this.bodyYaw;
      while (diffBody < -Math.PI) diffBody += Math.PI * 2;
      while (diffBody > Math.PI) diffBody -= Math.PI * 2;
      
      const threshold = 0.8; // ~45 degrees
      if (Math.abs(diffBody) > threshold) {
        const excess = diffBody > 0 ? diffBody - threshold : diffBody + threshold;
        this.bodyYaw += excess * lerpFactor;
      }
    }

    // Apply rotations
    this.group.rotation.set(0, this.bodyYaw, 0);
    
    // Add visual damage tilt (Minecraft red-flash flinch style)
    if (this.damageRotate > 0.01) {
      this.group.rotateOnWorldAxis(this.damageRotateAxis, this.damageRotate);
    }
    
    // Head Y rotation is relative to body
    let relativeHeadYaw = this.headYaw - this.bodyYaw;
    while (relativeHeadYaw < -Math.PI) relativeHeadYaw += Math.PI * 2;
    while (relativeHeadYaw > Math.PI) relativeHeadYaw -= Math.PI * 2;
    
    // We'll apply these in animateModel to avoid being overwritten
    
    this.lastPos.copy(this.group.position);

    this.idleTime += delta;
    if (isMoving) {
      let cycleSpeed = this.isSprinting ? 15 : 10;
      if (this.isCrouching) cycleSpeed = 8; // Slower steps when crouching
      this.walkCycle += delta * cycleSpeed;
    } else {
      this.walkCycle = 0;
    }

    if (this.isSwinging) {
      this.swingTimer += delta * this.swingSpeed; // Make swing smooth
      if (this.swingTimer > Math.PI) {
        this.swingTimer = 0;
        this.isSwinging = false;
      }
    } else {
      this.swingTimer = 0;
    }

    this.crouchTransition = THREE.MathUtils.lerp(this.crouchTransition, this.isCrouching ? 1 : 0, delta * 10);
    this.swimTransition = THREE.MathUtils.lerp(this.swimTransition, this.isSwimming ? 1 : 0, delta * 8);
    this.blockTransition = THREE.MathUtils.lerp(this.blockTransition, this.isBlocking ? 1 : 0, delta * 12);

    const isClimbing = isMoving && this.animVelocity.y > 0.5 && this.groundedTimer > 0.5;
    this.climbTransition = THREE.MathUtils.lerp(this.climbTransition, isClimbing ? 1 : 0, delta * 10);

    this.animateModel(delta, isMoving, horizontalVelocity);
    this.updateGlider(delta);
  }

  private updateGlider(delta: number) {
    if (!this.gliderGroup || !this.gliderLeftWing || !this.gliderRightWing) return;

    const targetOpen = this.isGliding ? 1 : 0;
    this.gliderOpenAmount = THREE.MathUtils.lerp(
      this.gliderOpenAmount,
      targetOpen,
      delta * (this.isGliding ? 8 : 4)
    );

    if (this.gliderOpenAmount > 0.01) {
      this.gliderGroup.visible = true;
      
      // Aerodynamic pitch
      this.gliderGroup.rotation.x = THREE.MathUtils.lerp(0.5, -0.2, this.gliderOpenAmount);

      const openAngle = 1.3;
      const closedAngle = 0.15;
      const angle = THREE.MathUtils.lerp(closedAngle, openAngle, this.gliderOpenAmount);

      this.gliderRightWing.rotation.y = angle;
      this.gliderLeftWing.rotation.y = Math.PI - angle;

      if (this.isGliding) {
        const time = performance.now() * 0.005;
        const flap = Math.sin(time) * 0.05;
        this.gliderRightWing.rotation.z = flap;
        this.gliderLeftWing.rotation.z = -flap;
        this.gliderGroup.rotation.z = Math.sin(time * 0.5) * 0.03;
      } else {
        this.gliderRightWing.rotation.z = 0;
        this.gliderLeftWing.rotation.z = 0;
        this.gliderGroup.rotation.z = 0;
      }
      const scale = this.gliderOpenAmount;
      this.gliderGroup.scale.set(scale, scale, scale);
    } else {
      this.gliderGroup.visible = false;
    }
  }

  private animateModel(delta: number, isMoving: boolean, horizontalVelocity: number) {
    const isPerformanceMode = settingsManager.getSettings().performanceMode;
    const swingAngle = Math.sin(this.walkCycle) * 0.5;
    const armSwingAngle = Math.sin(this.swingTimer) * 1.5;
    
    // Reset rotations
    this.leftLegMesh.rotation.set(0, 0, 0);
    this.rightLegMesh.rotation.set(0, 0, 0);
    this.leftArmMesh.rotation.set(0, 0, 0);
    this.rightArmMesh.rotation.set(0, 0, 0);
    this.bodyMesh.rotation.set(0, 0, 0);
    
    // Apply synced look rotation as base
    let relativeHeadYaw = this.headYaw - this.bodyYaw;
    while (relativeHeadYaw < -Math.PI) relativeHeadYaw += Math.PI * 2;
    while (relativeHeadYaw > Math.PI) relativeHeadYaw -= Math.PI * 2;
    
    this.headMesh.rotation.set(this.headPitch, relativeHeadYaw, 0);
    
    if (isPerformanceMode) {
      // Minimal animations for performance mode
      if (isMoving) {
        this.leftLegMesh.rotation.x = swingAngle;
        this.rightLegMesh.rotation.x = -swingAngle;
        this.leftArmMesh.rotation.x = -swingAngle;
        this.rightArmMesh.rotation.x = swingAngle;
      }
      if (this.isSwinging) {
        this.rightArmMesh.rotation.x = Math.sin(this.swingTimer) * 2.0;
      }
      return;
    }

    // Reset positions (relative to parents)
    this.bodyMesh.position.set(0, 0.9, 0);
    this.headMesh.position.set(0, 0.5, 0);
    this.leftArmMesh.position.set(-0.3, 0.3, 0);
    this.rightArmMesh.position.set(0.3, 0.3, 0);
    this.leftLegMesh.position.set(-0.1, 0.6, 0);
    this.rightLegMesh.position.set(0.1, 0.6, 0);
    this.capeMesh.position.set(0, 0.3, 0.1);
    this.bodyMesh.scale.y = 1.0;
    this.headMesh.scale.y = 1.0;
    this.leftArmMesh.scale.y = 1.0;
    this.rightArmMesh.scale.y = 1.0;

    // Calculate target cape angle
    let targetCapeAngle = -0.1;
    if (this.isFlying) {
      targetCapeAngle = -1.2 - Math.sin(this.idleTime * 10) * 0.05;
    } else if (Math.abs(this.animVelocity.y) > 2) {
      targetCapeAngle = this.animVelocity.y < 0 ? -0.8 : -0.2;
    } else if (isMoving) {
      targetCapeAngle = -0.2 - (horizontalVelocity / 10) * 0.8 - Math.sin(this.walkCycle * 2) * 0.1;
    } else {
      const breath = Math.sin(this.idleTime * 2) * 0.02;
      targetCapeAngle = -0.1 - breath * 0.5;
    }
    
    const capeDiff = targetCapeAngle - this.capeAngle;
    this.capeVelocity += capeDiff * 0.1;
    this.capeVelocity *= 0.8;
    this.capeAngle += this.capeVelocity;
    this.capeMesh.rotation.x = this.capeAngle;

    if (this.isFlying) {
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
      
      const paddleAngle = Math.sin(this.walkCycle) * 0.5;
      this.leftArmMesh.rotation.x = THREE.MathUtils.lerp(0, -1.5, t);
      this.rightArmMesh.rotation.x = THREE.MathUtils.lerp(0, -1.5, t);
      this.leftArmMesh.rotation.y = THREE.MathUtils.lerp(0, -0.4 + paddleAngle, t);
      this.rightArmMesh.rotation.y = THREE.MathUtils.lerp(0, 0.4 - paddleAngle, t);
      
      const kickAngle = Math.cos(this.walkCycle * 1.5) * 0.4;
      this.leftLegMesh.rotation.x = THREE.MathUtils.lerp(0, kickAngle, t);
      this.rightLegMesh.rotation.x = THREE.MathUtils.lerp(0, -kickAngle, t);
    } else if (this.groundedTimer < 0.5) {
      // Minecraft-style Jumping/Falling pose (Split limbs)
      const jumpProgress = THREE.MathUtils.clamp(this.animVelocity.y / 10, -1, 1);
      
      // Subtle body tilt
      this.bodyMesh.rotation.x = 0.15 * jumpProgress;
      
      if (jumpProgress > 0.1) {
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
      } else if (jumpProgress < -0.1) {
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

      if (this.isSprinting) {
        this.bodyMesh.rotation.x = 0.3;
        this.headMesh.rotation.x = -0.2;
        this.leftArmMesh.rotation.x = -swingAngle * 1.5;
        this.rightArmMesh.rotation.x = swingAngle * 1.5;
        this.leftLegMesh.rotation.x = swingAngle * 1.2;
        this.rightLegMesh.rotation.x = -swingAngle * 1.2;
      }
    } else {
      const breath = Math.sin(this.idleTime * 2) * 0.02;
      this.bodyMesh.scale.y = 1.0 + breath;
      this.headMesh.position.y += breath * 0.8;
      this.leftArmMesh.position.y += breath * 0.8;
      this.rightArmMesh.position.y += breath * 0.8;
    }

    if (this.crouchTransition > 0.01) {
      const t = this.crouchTransition;
      
      // Lower the body mesh specifically to simulate the crouch
      const crouchDrop = 0.35 * t; // More obvious drop
      this.bodyMesh.position.y -= crouchDrop;
      this.bodyMesh.position.z -= 0.15 * t; // Move torso forward
      
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

    if (this.blockTransition > 0.01 && this.heldItemModel) {
      const t = this.blockTransition;
      // Minecraft sword block animation style
      this.rightArmMesh.rotation.x = THREE.MathUtils.lerp(this.rightArmMesh.rotation.x, -0.5, t);
      this.rightArmMesh.rotation.y = THREE.MathUtils.lerp(this.rightArmMesh.rotation.y, -0.3, t);
      this.rightArmMesh.rotation.z = THREE.MathUtils.lerp(this.rightArmMesh.rotation.z, 0.5, t);
      
      // Override idle sway logic
      if (this.crouchTransition <= 0.01 && !isMoving && !this.isFlying && !this.isSwimming && this.groundedTimer > 0.5) {
        const breath = Math.sin(this.idleTime * 2) * 0.02;
        this.rightArmMesh.position.y += breath * 0.8;
      }
      
      if (this.isSwinging) {
        this.rightArmMesh.rotation.x += Math.sin(this.swingTimer) * 0.5 * t;
      }
    } else if (this.isSwinging) {
      const t = this.swingTimer / Math.PI;
      // Use a power curve for more "snap" at the start of the swing
      const swingProgress = Math.sin(Math.pow(t, 0.4) * Math.PI);
      
      const isSword = (this.heldItemType >= ItemType.WOODEN_SWORD && this.heldItemType <= ItemType.DIAMOND_SWORD) || 
                      this.heldItemType === ItemType.ASPECT_OF_THE_END;

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
      if (this.isCrouching) {
        this.rightArmMesh.rotation.x -= 0.2;
      }
    }
  }

  takeDamage(knockbackDir?: THREE.Vector3) {
    // Visual feedback: red flash and recoil
    if (knockbackDir && knockbackDir.lengthSq() > 0) {
      const kDir = knockbackDir.clone().normalize();
      this.visualOffset.addScaledVector(kDir, 0.4);
      // Tilt backwards relative to knockback
      this.damageRotateAxis.set(-kDir.z, 0, kDir.x).normalize();
      this.damageRotate = 0.4;
    } else {
      this._recoilDir.set(0, 0, 1).applyQuaternion(this.group.quaternion).negate();
      this.visualOffset.addScaledVector(this._recoilDir, 0.4);
      this.damageRotateAxis.set(-this._recoilDir.z, 0, this._recoilDir.x).normalize();
      this.damageRotate = 0.4;
    }
    this.visualOffset.y += 0.2;

    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
        obj.material.emissive.setHex(0xff0000);
        obj.material.emissiveIntensity = 0.5;
        
        // Use a local timeout for this specific material to ensure it resets
        setTimeout(() => {
          if (obj.material instanceof THREE.MeshStandardMaterial) {
            obj.material.emissive.setHex(0x000000);
            obj.material.emissiveIntensity = 0;
          }
        }, 200);
      }
    });
  }
}
