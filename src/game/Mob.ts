
import * as THREE from 'three';
import { World } from './World';

const _tempEuler = new THREE.Euler();
const _tempQuat = new THREE.Quaternion();
const _zAxis = new THREE.Vector3(0, 0, 1);
const _forward = new THREE.Vector3();
const _startPos = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _nextPos = new THREE.Vector3();
import { BLOCK, isSolidBlock, isSlab, ATLAS_TILES } from './TextureAtlas';
import { skyBridgeManager, SkillType } from './SkyBridgeManager';
import { networkManager } from './NetworkManager';
import { ItemType } from './Inventory';
import { audioManager } from './AudioManager';
import { settingsManager } from './Settings';

export enum MobType {
  ZOMBIE = 'Zombie',
  SLIME = 'Slime',
  SKELETON = 'Skeleton',
  CREEPER = 'Creeper',
  COW = 'Cow',
  SHEEP = 'Sheep',
  PIG = 'Pig',
  MORVANE = 'Morvane',
}

export class Mob {
  id: string;
  type: MobType;
  group: THREE.Group;
  position: THREE.Vector3;
  health: number = 100;
  maxHealth: number = 100;
  level: number = 1;
  name: string = "Zombie";
  isPassive: boolean = false;
  lastNetworkUpdate: number = Date.now();
  textureAtlas: THREE.Texture | null = null;
  
  velocity = new THREE.Vector3();
  targetPosition: THREE.Vector3 | null = null;
  lastNetPos: THREE.Vector3 = new THREE.Vector3();
  interpolationTimer: number = 0;
  lastAttackTime: number = 0;
  jumpTimer: number = 0;
  walkCycle: number = 0;
  wanderAngle: number = 0;
  wanderTimer: number = 0;
  fleeTimer: number = 0;
  idleTimer: number = 0;
  breathCycle: number = 0;
  sniffTimer: number = 0;
  tailWagCycle: number = 0;
  alertTimer: number = 0;
  knockbackTimer: number = 0;
  
  visualOffset = new THREE.Vector3();
  damageRotate = 0;
  damageRotateAxis = new THREE.Vector3(1, 0, 0);
  _recoilDir = new THREE.Vector3();
  
  // Animation parts
  head: THREE.Object3D | null = null;
  body: THREE.Object3D | null = null;
  tail: THREE.Object3D | null = null;
  leftLeg: THREE.Object3D | null = null;
  rightLeg: THREE.Object3D | null = null;
  leftArm: THREE.Object3D | null = null;
  rightArm: THREE.Object3D | null = null;
  leftArm2: THREE.Object3D | null = null;
  rightArm2: THREE.Object3D | null = null;
  legs: THREE.Object3D[] = [];
  
  constructor(id: string, position: THREE.Vector3, level: number = 1, type: MobType = MobType.ZOMBIE, textureAtlas: THREE.Texture | null = null) {
    this.id = id;
    this.type = type;
    this.position = position.clone();
    this.targetPosition = position.clone();
    this.level = level;
    this.isPassive = [MobType.COW, MobType.SHEEP, MobType.PIG].includes(type);
    this.textureAtlas = textureAtlas;
    this.wanderAngle = Math.random() * Math.PI * 2;
    
    this.maxHealth = 100 + (level - 1) * 50;
    if (type === MobType.MORVANE) {
      this.maxHealth = 25000;
      this.name = "Morvane, Guardian of Skycastle";
    }
    if (type === MobType.SLIME) this.maxHealth *= 0.5;
    if (this.isPassive) this.maxHealth = 20;
    
    this.health = this.maxHealth;
    this.group = this.createModel();
    this.enableShadows(this.group);
    
    this.group.position.copy(this.position);
    this.group.userData = { isMob: true, mobId: id };
  }

  private createNameTag() {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;
    canvas.width = 512;
    canvas.height = 128;
    context.fillStyle = 'rgba(0, 0, 0, 0.6)';
    context.fillRect(0, 0, 512, 128);
    context.font = 'bold 80px "Inter", Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#ff3333';
    context.fillText(this.name, 256, 64);
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const nameTag = new THREE.Sprite(material);
    nameTag.scale.set(4, 1, 1);
    nameTag.position.y = 2.5; // Relative to scaled group (result: ~12.5 world units)
    this.group.add(nameTag);
    this.group.userData.nameTag = nameTag;
  }

  getHitbox(): THREE.Box3 {
    let width = 0.6;
    let height = 1.8;
    
    switch (this.type) {
      case MobType.ZOMBIE:
      case MobType.SKELETON:
        width = 0.6; height = 1.95; break;
      case MobType.CREEPER:
        width = 0.6; height = 1.7; break;
      case MobType.MORVANE:
        width = 3.0; height = 9.0; break;
      case MobType.COW:
        width = 0.9; height = 1.4; break;
      case MobType.SHEEP:
        width = 0.9; height = 1.3; break;
      case MobType.SLIME:
        width = 0.8; height = 0.8; break;
    }
    
    const min = new THREE.Vector3(
      this.position.x - width / 2,
      this.position.y,
      this.position.z - width / 2
    );
    const max = new THREE.Vector3(
      this.position.x + width / 2,
      this.position.y + height,
      this.position.z + width / 2
    );
    
    return new THREE.Box3(min, max);
  }

  private getMobUVs(tx: number, ty: number) {
    const size = 1 / ATLAS_TILES;
    const uMin = tx * size;
    const uMax = (tx + 1) * size;
    const vMin = 1.0 - (ty + 1) * size;
    const vMax = 1.0 - ty * size;

    return [
      uMin, vMax,
      uMax, vMax,
      uMin, vMin,
      uMax, vMin
    ];
  }

  private applyTexture(mesh: THREE.Mesh, tx: number, ty: number, isFace: boolean = false) {
    if (!this.textureAtlas) return;
    
    const geometry = mesh.geometry as THREE.BoxGeometry;
    const uvAttribute = geometry.attributes.uv;
    const uvs = this.getMobUVs(tx, ty);
    
    if (isFace) {
      // Front face is index 4 (indices 8,9,10,11 in UV array for BoxGeometry)
      const startIdx = 4 * 4;
      uvAttribute.setXY(startIdx, uvs[0], uvs[1]);
      uvAttribute.setXY(startIdx + 1, uvs[2], uvs[3]);
      uvAttribute.setXY(startIdx + 2, uvs[4], uvs[5]);
      uvAttribute.setXY(startIdx + 3, uvs[6], uvs[7]);
    } else {
      // Apply to all faces
      for (let i = 0; i < 6; i++) {
        const startIdx = i * 4;
        uvAttribute.setXY(startIdx, uvs[0], uvs[1]);
        uvAttribute.setXY(startIdx + 1, uvs[2], uvs[3]);
        uvAttribute.setXY(startIdx + 2, uvs[4], uvs[5]);
        uvAttribute.setXY(startIdx + 3, uvs[6], uvs[7]);
      }
    }
    
    uvAttribute.needsUpdate = true;
    (mesh.material as THREE.MeshStandardMaterial).map = this.textureAtlas;
    (mesh.material as THREE.MeshStandardMaterial).needsUpdate = true;
  }

  private enableShadows(group: THREE.Group) {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }

  private createModel(): THREE.Group {
    const group = new THREE.Group();

    if (this.type === MobType.ZOMBIE || this.type === MobType.SKELETON || this.type === MobType.MORVANE) {
      this.createHumanoidModel(group);
    } else if (this.type === MobType.CREEPER) {
      this.createCreeperModel(group);
    } else if (this.isPassive) {
      this.createPassiveModel(group);
    } else if (this.type === MobType.SLIME) {
      this.createSlimeModel(group);
    }

    return group;
  }

  private createHumanoidModel(group: THREE.Group) {
    const isSkeleton = this.type === MobType.SKELETON;
    const isMorvane = this.type === MobType.MORVANE;
    const skinColor = (this.textureAtlas) ? 0xffffff : (isSkeleton ? 0xdddddd : (isMorvane ? 0x0a0a0a : 0x3b511a));
    const shirtColor = (this.textureAtlas) ? 0xffffff : (isSkeleton ? 0xdddddd : (isMorvane ? 0x000000 : 0x00aaaa));
    const pantsColor = (this.textureAtlas) ? 0xffffff : (isSkeleton ? 0xdddddd : (isMorvane ? 0x000000 : 0x2d2d88));

    const matSkin = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.9 });
    const matShirt = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 1.0, metalness: isMorvane ? 0.0 : 0 });
    const matPants = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 1.0 });
    
    // Body
    const bodyWidth = isSkeleton ? 0.4 : 0.6;
    const bodyGeo = new THREE.BoxGeometry(bodyWidth, 0.7, 0.3);
    const body = new THREE.Mesh(bodyGeo, matShirt);
    body.position.y = 1.05;
    if (this.textureAtlas) {
      if (isSkeleton) this.applyTexture(body, 4, 22); // Skeleton Bone
      else if (isMorvane) this.applyTexture(body, 15, 9); // Black Concrete for body
      else this.applyTexture(body, 12, 22); // Zombie Shirt
    }
    group.add(body);

    // Head
    this.head = new THREE.Group();
    this.head.position.y = 1.4;
    const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const headMesh = new THREE.Mesh(headGeo, matSkin);
    headMesh.position.y = 0.25;
    this.head.add(headMesh);
    group.add(this.head);

    if (this.textureAtlas) {
      // Apply plain skin to all sides first
      if (isMorvane) this.applyTexture(headMesh, 15, 9, false);
      else this.applyTexture(headMesh, isSkeleton ? 4 : 3, 22, false);
      // Then apply face strictly to front (index 4)
      if (isMorvane) this.applyTexture(headMesh, 16, 24, true); // Keep the scary face
      else this.applyTexture(headMesh, isSkeleton ? 1 : 0, 22, true);
    } 

    // Always create eyes and mouth for humanoid mobs so they have a face
    const eyeGeo = new THREE.BoxGeometry(0.12, 0.12, 0.05);
    const eyeMat = new THREE.MeshStandardMaterial({ color: isMorvane ? 0xff0000 : (isSkeleton ? 0x222222 : 0x000000), emissive: isMorvane ? 0xff0000 : 0x000000, emissiveIntensity: isMorvane ? 2 : 1 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.15, 0.3, 0.26);
    this.head.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.15, 0.3, 0.26);
    this.head.add(rightEye);
    
    // Arms
    const armSize = isSkeleton ? 0.15 : 0.2;
    const armGeo = new THREE.BoxGeometry(armSize, 0.7, armSize);
    
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(isSkeleton ? -0.3 : -0.4, 1.4, 0);
    const leftArmMesh = new THREE.Mesh(armGeo, matSkin);
    leftArmMesh.position.y = -0.35;
    if (this.textureAtlas) {
      if (isSkeleton) this.applyTexture(leftArmMesh, 4, 22);
      else if (isMorvane) this.applyTexture(leftArmMesh, 15, 9);
      else this.applyTexture(leftArmMesh, 3, 22);
    }
    this.leftArm.add(leftArmMesh);
    group.add(this.leftArm);

    this.rightArm = new THREE.Group();
    this.rightArm.position.set(isSkeleton ? 0.3 : 0.4, 1.4, 0);
    const rightArmMesh = new THREE.Mesh(armGeo, matSkin);
    rightArmMesh.position.y = -0.35;
    if (this.textureAtlas) {
      if (isSkeleton) this.applyTexture(rightArmMesh, 4, 22);
      else if (isMorvane) this.applyTexture(rightArmMesh, 15, 9);
      else this.applyTexture(rightArmMesh, 3, 22);
    }
    this.rightArm.add(rightArmMesh);
    group.add(this.rightArm);

    if (isMorvane) {
      // Second set of arms
      this.leftArm2 = new THREE.Group();
      this.leftArm2.position.set(-0.4, 1.1, 0);
      const leftArmMesh2 = new THREE.Mesh(armGeo, matSkin);
      leftArmMesh2.position.y = -0.35;
      if (this.textureAtlas) this.applyTexture(leftArmMesh2, 15, 9);
      this.leftArm2.add(leftArmMesh2);
      group.add(this.leftArm2);

      this.rightArm2 = new THREE.Group();
      this.rightArm2.position.set(0.4, 1.1, 0);
      const rightArmMesh2 = new THREE.Mesh(armGeo, matSkin);
      rightArmMesh2.position.y = -0.35;
      if (this.textureAtlas) this.applyTexture(rightArmMesh2, 15, 9);
      this.rightArm2.add(rightArmMesh2);
      group.add(this.rightArm2);
    }
    
    // Legs
    if (!isMorvane) {
      const legSize = isSkeleton ? 0.15 : 0.2;
      const legGeo = new THREE.BoxGeometry(legSize, 0.7, legSize);
      
      this.leftLeg = new THREE.Group();
      this.leftLeg.position.set(-0.15, 0.7, 0);
      const leftLegMesh = new THREE.Mesh(legGeo, matPants);
      leftLegMesh.position.y = -0.35;
      if (this.textureAtlas) {
        if (isSkeleton) this.applyTexture(leftLegMesh, 4, 22);
        else this.applyTexture(leftLegMesh, 13, 22); // Zombie Pants
      }
      this.leftLeg.add(leftLegMesh);
      group.add(this.leftLeg);

      this.rightLeg = new THREE.Group();
      this.rightLeg.position.set(0.15, 0.7, 0);
      const rightLegMesh = new THREE.Mesh(legGeo, matPants);
      rightLegMesh.position.y = -0.35;
      if (this.textureAtlas) {
        if (isSkeleton) this.applyTexture(rightLegMesh, 4, 22);
        else this.applyTexture(rightLegMesh, 13, 22); // Zombie Pants
      }
      this.rightLeg.add(rightLegMesh);
      group.add(this.rightLeg);
    }
  }

  private createCreeperModel(group: THREE.Group) {
    const creeperColor = (this.textureAtlas) ? 0xffffff : 0x0da82e;
    const creeperMat = new THREE.MeshStandardMaterial({ color: creeperColor, roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3), creeperMat);
    body.position.y = 0.7;
    if (this.textureAtlas) this.applyTexture(body, 5, 22);
    group.add(body);
    
    this.head = new THREE.Group();
    this.head.position.y = 1.1;
    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), creeperMat);
    headMesh.position.y = 0.25;
    this.head.add(headMesh);
    group.add(this.head);

    if (this.textureAtlas) {
      this.applyTexture(headMesh, 5, 22); // Use plain creeper skin for sides
      this.applyTexture(headMesh, 2, 22, true); // Face on front
    } 

    // Always create eyes and mouth for creepers so they have a face
    const faceMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const eyeGeo = new THREE.BoxGeometry(0.12, 0.12, 0.05);
    const leftEye = new THREE.Mesh(eyeGeo, faceMat);
    leftEye.position.set(-0.12, 0.3, 0.26);
    this.head.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, faceMat);
    rightEye.position.set(0.12, 0.3, 0.26);
    this.head.add(rightEye);
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.05), faceMat);
    mouth.position.set(0, 0.15, 0.26);
    this.head.add(mouth);
    const mouthDropGeo = new THREE.BoxGeometry(0.05, 0.15, 0.05);
    const leftDrop = new THREE.Mesh(mouthDropGeo, faceMat);
    leftDrop.position.set(-0.1, 0.05, 0.26);
    this.head.add(leftDrop);
    const rightDrop = new THREE.Mesh(mouthDropGeo, faceMat);
    rightDrop.position.set(0.1, 0.05, 0.26);
    this.head.add(rightDrop);

    const legGeo = new THREE.BoxGeometry(0.25, 0.3, 0.25);
    for(let i=0; i<4; i++) {
      const legGroup = new THREE.Group();
      const isFront = i < 2;
      const isLeft = i % 2 === 0;
      legGroup.position.set(isLeft ? -0.15 : 0.15, 0.3, isFront ? 0.15 : -0.15);
      
      const legMesh = new THREE.Mesh(legGeo, creeperMat);
      legMesh.position.y = -0.15;
      if (this.textureAtlas) this.applyTexture(legMesh, 2, 22);
      
      legGroup.add(legMesh);
      this.legs.push(legGroup);
      group.add(legGroup);
    }
  }

  private createPassiveModel(group: THREE.Group) {
    let bodyColor = 0xffffff;
    let headColor = 0xffffff;
    let legColor = 0xffffff;
    
    // Rows 22 layout: 
    // 6: Cow Body, 7: Cow Face, 10: Cow Leg
    // 8: Sheep Body, 9: Sheep Face, 11: Sheep Leg
    let bodyIdx = 6, faceIdx = 7, legIdx = 10;
    
    if (this.type === MobType.COW) { 
      bodyIdx = 6; faceIdx = 7; legIdx = 10;
      bodyColor = this.textureAtlas ? 0xffffff : 0x4b3b2a;
      headColor = this.textureAtlas ? 0xffffff : 0x4b3b2a;
      legColor = this.textureAtlas ? 0xffffff : 0x4b3b2a;
    } else if (this.type === MobType.SHEEP) {
      bodyIdx = 8; faceIdx = 9; legIdx = 11;
      bodyColor = this.textureAtlas ? 0xffffff : 0xffffff;
      headColor = this.textureAtlas ? 0xffffff : 0xe3c5a8;
      legColor = this.textureAtlas ? 0xffffff : 0xe3c5a8;
    }
    
    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 1.0 });
    const headMat = new THREE.MeshStandardMaterial({ color: headColor, roughness: 0.8 });
    const legMat = new THREE.MeshStandardMaterial({ color: legColor, roughness: 0.9 });

    const bodyWidth = this.type === MobType.SHEEP ? 0.8 : 0.6;
    const bodyHeight = this.type === MobType.SHEEP ? 0.8 : 0.6;
    const bodyDepth = this.type === MobType.SHEEP ? 1.1 : 0.9;
    
    const bodyGeo = new THREE.BoxGeometry(bodyWidth, bodyHeight, bodyDepth);
    this.body = new THREE.Mesh(bodyGeo, bodyMat);
    this.body.position.y = 0.7;
    if (this.textureAtlas) {
      this.applyTexture(this.body as THREE.Mesh, bodyIdx, 22);
    }
    group.add(this.body);

    // Add Tail
    const tailGeo = new THREE.BoxGeometry(0.1, 0.4, 0.1);
    const tailMat = new THREE.MeshStandardMaterial({ color: legColor, roughness: 0.9 });
    this.tail = new THREE.Mesh(tailGeo, tailMat);
    this.tail.position.set(0, 0.2, -bodyDepth / 2);
    this.tail.rotation.x = -0.5;
    this.body.add(this.tail);

    this.head = new THREE.Group();
    this.head.position.set(0, 0.9, 0.45);
    
    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), headMat);
    headMesh.position.set(0, 0.1, 0.2);
    this.head.add(headMesh);
    
    if (this.type === MobType.SHEEP) {
      const woolCap = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.2, 0.45), bodyMat);
      woolCap.position.set(0, 0.25, 0.15);
      this.head.add(woolCap);
      if (this.textureAtlas) this.applyTexture(woolCap, bodyIdx, 22);
    }
    
    group.add(this.head);

    if (this.textureAtlas) {
      // Body on all sides of head
      this.applyTexture(headMesh, bodyIdx, 22);
      // Face on front (index 4)
      this.applyTexture(headMesh, faceIdx, 22, true);
      
      // Add 3D snout for depth even with textures
      if (this.type === MobType.COW) {
        const snoutColor = 0x8b6b4a;
        const snoutMat = new THREE.MeshStandardMaterial({ color: snoutColor });
        const snoutGeo = new THREE.BoxGeometry(0.25, 0.18, 0.12);
        const snout = new THREE.Mesh(snoutGeo, snoutMat);
        snout.position.set(0, 0.0, 0.25);
        this.head.add(snout);
        if (this.textureAtlas) this.applyTexture(snout, faceIdx, 4); // Use face texture for snout too
      }

      if (this.type === MobType.COW) {
        const hornMat = new THREE.MeshStandardMaterial({ color: 0xdddddd });
        const hornGeo = new THREE.BoxGeometry(0.1, 0.2, 0.1);
        const leftHorn = new THREE.Mesh(hornGeo, hornMat);
        leftHorn.position.set(-0.25, 0.3, 0.1);
        this.head.add(leftHorn);
        const rightHorn = new THREE.Mesh(hornGeo, hornMat);
        rightHorn.position.set(0.25, 0.3, 0.1);
        this.head.add(rightHorn);
      }
    } else {
      const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.05);
      const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
      const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
      leftEye.position.set(-0.15, 0.15, 0.41);
      this.head.add(leftEye);
      const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
      rightEye.position.set(0.15, 0.15, 0.41);
      this.head.add(rightEye);
      
      if (this.type === MobType.COW) {
        const snoutColor = 0x332211;
        const snoutMat = new THREE.MeshStandardMaterial({ color: snoutColor });
        const snoutGeo = new THREE.BoxGeometry(0.2, 0.15, 0.1);
        const snout = new THREE.Mesh(snoutGeo, snoutMat);
        snout.position.set(0, 0.0, 0.45);
        this.head.add(snout);
      }
      
      if (this.type === MobType.COW) {
        const hornMat = new THREE.MeshStandardMaterial({ color: 0xdddddd });
        const hornGeo = new THREE.BoxGeometry(0.05, 0.15, 0.05);
        const leftHorn = new THREE.Mesh(hornGeo, hornMat);
        leftHorn.position.set(-0.2, 0.35, 0.2);
        this.head.add(leftHorn);
        const rightHorn = new THREE.Mesh(hornGeo, hornMat);
        rightHorn.position.set(0.2, 0.35, 0.2);
        this.head.add(rightHorn);
      }
    }

    const legGeo = new THREE.BoxGeometry(0.15, 0.4, 0.15);
    for(let i=0; i<4; i++) {
      const legGroup = new THREE.Group();
      const isFront = i < 2;
      const isLeft = i % 2 === 0;
      
      legGroup.position.set(isLeft ? -0.2 : 0.2, 0.4, isFront ? 0.3 : -0.3);
      
      const legMesh = new THREE.Mesh(legGeo, legMat);
      legMesh.position.y = -0.2;
      if (this.textureAtlas) {
        this.applyTexture(legMesh, legIdx, 22);
      }
      
      legGroup.add(legMesh);
      this.legs.push(legGroup);
      group.add(legGroup);
    }
  }

  private createSlimeModel(group: THREE.Group) {
    const slimeGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const slimeMat = new THREE.MeshPhysicalMaterial({ 
      color: 0x55FF55, 
      transparent: true, 
      opacity: 0.7,
      roughness: 0.1,
      transmission: 0.5,
      thickness: 0.5
    });
    const slime = new THREE.Mesh(slimeGeo, slimeMat);
    slime.position.y = 0.4;
    if (this.textureAtlas) {
      this.applyTexture(slime, 6, 5); // Body on all sides first
      this.applyTexture(slime, 6, 4, true); // Then face on front
    }
    group.add(slime);

    const coreGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const coreMat = new THREE.MeshStandardMaterial({ color: 0x22AA22, roughness: 0.8 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.y = 0.4;
    if (this.textureAtlas) this.applyTexture(core, 6, 5);
    group.add(core);

    if (!this.textureAtlas) {
      const eyeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.05);
      const eyeMat = new THREE.MeshStandardMaterial({ color: 0x003300 });
      const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
      leftEye.position.set(-0.2, 0.5, 0.41);
      group.add(leftEye);
      const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
      rightEye.position.set(0.2, 0.5, 0.41);
      group.add(rightEye);
      
      const mouthGeo = new THREE.BoxGeometry(0.1, 0.1, 0.05);
      const mouth = new THREE.Mesh(mouthGeo, eyeMat);
      mouth.position.set(0, 0.35, 0.41);
      group.add(mouth);
    }
  }

  private animateLimbs(delta: number) {
    if (settingsManager.getSettings().performanceMode) {
      // Minimal animation for performance mode
      const swing = Math.sin(this.walkCycle) * 0.8;
      if (this.leftLeg && this.rightLeg) {
        this.leftLeg.rotation.x = swing;
        this.rightLeg.rotation.x = -swing;
      }
      if (this.legs.length === 4) {
        this.legs[0].rotation.x = swing;
        this.legs[1].rotation.x = -swing;
        this.legs[2].rotation.x = -swing;
        this.legs[3].rotation.x = swing;
      }
      return;
    }

    const swing = Math.sin(this.walkCycle) * 0.8;
    const speed = this.velocity.length();
    
    // Breathing animation
    this.breathCycle += delta * 2;
    const breathScale = 1 + Math.sin(this.breathCycle) * 0.02;
    if (this.body) {
      this.body.scale.y = breathScale;
      this.body.scale.x = 1 / breathScale; // Compensate to keep volume
    }

    // Tail wagging
    if (this.tail) {
      this.tailWagCycle += delta * (speed > 0.1 ? 15 : 3);
      this.tail.rotation.z = Math.sin(this.tailWagCycle) * 0.3;
      if (this.fleeTimer > 0) {
        this.tail.rotation.z = Math.sin(this.tailWagCycle * 2) * 0.6; // Fast wag when scared
      }
    }

    if (this.leftArm && this.rightArm) {
      if (this.type === MobType.MORVANE) {
        const time = Date.now() * 0.001;
        this.leftArm.rotation.x = Math.sin(time * 2.0) * 0.5 + 0.2;
        this.rightArm.rotation.x = Math.cos(time * 2.0) * 0.5 + 0.2;
        if (this.leftArm2 && this.rightArm2) {
          this.leftArm2.rotation.x = Math.sin(time * 2.0 + Math.PI) * 0.5 - 0.2;
          this.rightArm2.rotation.x = Math.cos(time * 2.0 + Math.PI) * 0.5 - 0.2;
          
          this.leftArm.rotation.z = Math.sin(time * 1.0) * 0.2 - 0.4;
          this.rightArm.rotation.z = -Math.sin(time * 1.0) * 0.2 + 0.4;
          this.leftArm2.rotation.z = Math.sin(time * 1.2) * 0.2 - 0.6;
          this.rightArm2.rotation.z = -Math.sin(time * 1.2) * 0.2 + 0.6;
        }
      } else if (this.type === MobType.ZOMBIE) {
        this.leftArm.rotation.x = -1.5 + swing * 0.2;
        this.rightArm.rotation.x = -1.5 - swing * 0.2;
      } else if (this.type === MobType.SKELETON) {
        this.leftArm.rotation.x = swing;
        this.rightArm.rotation.x = -swing;
      } else {
        this.leftArm.rotation.x = -swing;
        this.rightArm.rotation.x = swing;
      }
    }
    if (this.leftLeg && this.rightLeg) {
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
    }
    if (this.legs.length === 4) {
      this.legs[0].rotation.x = swing;
      this.legs[1].rotation.x = -swing;
      this.legs[2].rotation.x = -swing;
      this.legs[3].rotation.x = swing;
    }
  }

  checkCollision(pos: THREE.Vector3, world: World): boolean {
    const radius = 0.3;
    const height = this.type === MobType.SLIME ? 0.8 : (this.isPassive ? 1.2 : 1.8);
    
    const minX = Math.floor(pos.x - radius);
    const maxX = Math.floor(pos.x + radius);
    const minY = Math.floor(pos.y);
    const maxY = Math.floor(pos.y + height - 0.1);
    const minZ = Math.floor(pos.z - radius);
    const maxZ = Math.floor(pos.z + radius);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const block = world.getBlock(x, y, z);
          if (block !== 0 && isSolidBlock(block)) {
            if (isSlab(block)) {
              const mobBottom = pos.y;
              const slabTop = y + 0.5;
              if (mobBottom < slabTop && pos.y + height > y) {
                return true;
              }
            } else {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  update(playerPos: THREE.Vector3, delta: number, world: World) {
    if (this.targetPosition) {
      if (this.lastNetPos.lengthSq() === 0) {
         this.lastNetPos.copy(this.targetPosition);
      }
      
      // Networked movement interpolation
      const dist = this.position.distanceTo(this.targetPosition);
      if (dist > 10) {
        this.position.copy(this.targetPosition);
      } else {
        const moveFactor = 1.0 - Math.exp(-20 * delta);
        this.position.lerp(this.targetPosition, moveFactor);
      }
      
      const decay = 1.0 - Math.exp(-15 * delta); 
      this.visualOffset.lerp(new THREE.Vector3(0, 0, 0), decay);
      this.damageRotate = THREE.MathUtils.lerp(this.damageRotate, 0, decay);
      
      this.group.position.copy(this.position).add(this.visualOffset);
      
      // Face movement direction
      const moveDir = this.targetPosition.clone().sub(this.lastNetPos);
      if (moveDir.length() > 0.001) {
        const targetRotation = Math.atan2(moveDir.x, moveDir.z);
        
        let diff = targetRotation - this.group.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        
        this.group.rotation.set(0, this.group.rotation.y + diff * delta * 15, 0);
        this.walkCycle += delta * 10;
      } else {
        this.group.rotation.set(0, this.group.rotation.y, 0);
        this.walkCycle = 0;
      }
      
      if (this.damageRotate > 0.01) {
        this.group.rotateOnWorldAxis(this.damageRotateAxis, this.damageRotate);
      }

      // Head look at player (only for passive mobs)
      if (this.head) {
        if (this.isPassive) {
          const distToPlayer = this.position.distanceTo(playerPos);
          
          // Use a local curiosity timer for networked mobs too
          if (this.idleTimer > 0) {
            this.idleTimer -= delta;
            const localPlayerPos = this.group.worldToLocal(playerPos.clone());
            const targetHeadRot = new THREE.Euler().setFromQuaternion(
              new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 0, 1),
                localPlayerPos.normalize()
              )
            );
            
            this.head.rotation.x = THREE.MathUtils.lerp(this.head.rotation.x, THREE.MathUtils.clamp(targetHeadRot.x, -0.5, 0.5), 0.05);
            this.head.rotation.y = THREE.MathUtils.lerp(this.head.rotation.y, THREE.MathUtils.clamp(targetHeadRot.y, -0.8, 0.8), 0.05);
          } else if (distToPlayer < 10 && Math.random() < 0.005) {
            this.idleTimer = 2 + Math.random() * 3;
          } else {
            // Reset head slowly
            this.head.rotation.x = THREE.MathUtils.lerp(this.head.rotation.x, 0, 0.02);
            this.head.rotation.y = THREE.MathUtils.lerp(this.head.rotation.y, 0, 0.02);
          }
        } else {
          this.head.rotation.set(0, 0, 0);
        }
      }

      this.animateLimbs(delta);

      // Ambient sounds
      if (Math.random() < 0.001) {
        const distToPlayer = this.position.distanceTo(playerPos);
        if (distToPlayer < 20) {
          if (this.type === MobType.ZOMBIE) audioManager.play('zombie_idle', 0.2);
          else if (this.type === MobType.SKELETON) audioManager.play('skeleton_idle', 0.2);
          else if (this.type === MobType.COW) audioManager.play('cow_idle', 0.2);
          else if (this.type === MobType.SHEEP) audioManager.play('sheep_idle', 0.2);
        }
      }

      // Slime squish animation still local
      if (this.type === MobType.SLIME) {
        const time = Date.now();
        const squish = 1 + Math.sin(time * 0.01) * 0.1;
        this.group.scale.set(1.2 - squish * 0.2, squish, 1.2 - squish * 0.2);
      }
      
      // Local attack check (still needed for player health)
      const dx = playerPos.x - this.position.x;
      const dz = playerPos.z - this.position.z;
      const horizontalDistSq = dx * dx + dz * dz;
      const dy = Math.abs(playerPos.y - this.position.y);

      if (!this.isPassive && horizontalDistSq < 1.69 && dy < 1.3 && Date.now() - this.lastAttackTime > 1000) {
        // Line of sight check
        const start = this.position.clone().add(new THREE.Vector3(0, 1.5, 0));
        const target = playerPos.clone().add(new THREE.Vector3(0, 1.0, 0));
        const dir = new THREE.Vector3().subVectors(target, start).normalize();
        const distToPlayer = start.distanceTo(target);
        const hit = world.raycast(start, dir, distToPlayer);

        if (false && !hit) { // Disabled in favor of server-authoritative combat
          this.lastAttackTime = Date.now();
          
          // Calculate knockback direction from mob to player
          const kbDir = new THREE.Vector3().subVectors(playerPos, this.position).normalize();
          
          window.dispatchEvent(new CustomEvent('playerTakeDamage', {
            detail: {
              damage: 10,
              knockbackDir: { x: kbDir.x, y: 0, z: kbDir.z }
            }
          }));
        }
      }
      return;
    }

    const dist = this.position.distanceTo(playerPos);
    const time = Date.now();
    
    // Update timers
    if (this.fleeTimer > 0) this.fleeTimer -= delta;
    if (this.wanderTimer > 0) this.wanderTimer -= delta;
    if (this.idleTimer > 0) this.idleTimer -= delta;
    if (this.sniffTimer > 0) this.sniffTimer -= delta;
    if (this.alertTimer > 0) this.alertTimer -= delta;
    if (this.knockbackTimer > 0) this.knockbackTimer -= delta;

    const chaseForce = new THREE.Vector3();
    if (!this.isPassive && dist < 15) {
      // Alert state when first seeing player
      if (this.alertTimer <= 0 && dist > 10) {
        this.alertTimer = 1.0;
        if (this.type === MobType.ZOMBIE) audioManager.play('zombie_idle', 0.5);
        else if (this.type === MobType.SKELETON) audioManager.play('skeleton_idle', 0.5);
      }

      // Chase player
      const dir = playerPos.clone().sub(this.position).normalize();
      dir.y = 0;
      
      if (this.type === MobType.SLIME) {
        this.jumpTimer += delta;
        if (this.jumpTimer > 2 && this.velocity.y === 0) {
          this.jumpTimer = 0;
          this.velocity.y = 8;
          this.velocity.x = dir.x * 10;
          this.velocity.z = dir.z * 10;
        }
      } else if (this.alertTimer <= 0) {
        chaseForce.copy(dir.multiplyScalar(3));
      }
      
      const targetRotation = Math.atan2(dir.x, dir.z);
      this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, targetRotation, 0.1);
    } else if (this.isPassive) {
      if (this.fleeTimer > 0) {
        // Flee from player (slower, as requested)
        const dir = this.position.clone().sub(playerPos).normalize();
        dir.y = 0;
        chaseForce.copy(dir.multiplyScalar(3.5));
        const targetRotation = Math.atan2(dir.x, dir.z);
        this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, targetRotation, 0.15);
        
        // Panic jump (less frequent)
        if (Math.random() < 0.02 && this.velocity.y === 0) {
          this.velocity.y = 5;
        }
      } else {
        // Normal passive behavior
        if (dist < 8 && this.idleTimer <= 0) {
          // Occasionally decide to look at the player
          if (Math.random() < 0.005) {
            this.idleTimer = 2 + Math.random() * 3;
            this.wanderAngle = -2; // Special value for "staring at player"
          }
        }
        
        // Wander logic
        if (this.wanderTimer <= 0 && this.idleTimer <= 0) {
          this.wanderTimer = 3 + Math.random() * 7;
          if (Math.random() < 0.4) {
            // Stop and idle
            this.wanderAngle = -1; 
            if (Math.random() < 0.6) this.sniffTimer = 2 + Math.random() * 3;
          } else {
            this.wanderAngle = Math.random() * Math.PI * 2;
          }
        }

        if (this.wanderAngle === -2) {
          // Staring at player
          const dir = playerPos.clone().sub(this.position).normalize();
          const targetRotation = Math.atan2(dir.x, dir.z);
          this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, targetRotation, 0.05);
        } else if (this.wanderAngle !== -1 && this.sniffTimer <= 0) {
          chaseForce.set(Math.cos(this.wanderAngle), 0, Math.sin(this.wanderAngle)).multiplyScalar(1.0);
          const targetRotation = -this.wanderAngle + Math.PI / 2;
          this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, targetRotation, 0.03);
        }
      }
    }

    // Head tracking logic (only for passive mobs)
    if (this.head) {
      if (this.isPassive && this.sniffTimer > 0) {
        // Sniffing ground animation
        this.head.rotation.x = THREE.MathUtils.lerp(this.head.rotation.x, 0.8, 0.1);
        this.head.rotation.y = THREE.MathUtils.lerp(this.head.rotation.y, Math.sin(Date.now() * 0.01) * 0.2, 0.1);
      } else if ((this.isPassive || this.type === MobType.MORVANE) && (dist < 20 || this.wanderAngle === -2 || this.type === MobType.MORVANE)) {
        // Look at player
        const localPlayerPos = this.group.worldToLocal(playerPos.clone());
        _tempQuat.setFromUnitVectors(_zAxis, localPlayerPos.normalize());
        _tempEuler.setFromQuaternion(_tempQuat);
        
        this.head.rotation.x = THREE.MathUtils.lerp(this.head.rotation.x, THREE.MathUtils.clamp(_tempEuler.x, -0.5, 0.5), 0.05);
        this.head.rotation.y = THREE.MathUtils.lerp(this.head.rotation.y, THREE.MathUtils.clamp(_tempEuler.y, -0.8, 0.8), 0.05);
      } else {
        // Reset head slowly
        this.head.rotation.x = THREE.MathUtils.lerp(this.head.rotation.x, 0, 0.02);
        this.head.rotation.y = THREE.MathUtils.lerp(this.head.rotation.y, 0, 0.02);
      }
    }

    if (this.type !== MobType.SLIME) {
      if (this.knockbackTimer > 0) {
        // Apply friction during knockback (framerate independent)
        const friction = Math.pow(0.05, delta);
        this.velocity.x *= friction;
        this.velocity.z *= friction;
      } else {
        const speedRatio = this.fleeTimer > 0 ? 0.0001 : 0.001; // Chase speed factor
        const chaseLerp = 1.0 - Math.pow(speedRatio, delta);
        this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, chaseForce.x, chaseLerp);
        this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, chaseForce.z, chaseLerp);
      }
      
      if (this.velocity.lengthSq() > 0.1) {
        this.walkCycle += delta * 10;
      } else {
        this.walkCycle = 0;
      }
    } else {
      // Slime friction
      this.velocity.x *= 0.95;
      this.velocity.z *= 0.95;
      
      // Squish animation
      const squish = 1 + Math.sin(time * 0.01) * 0.1;
      this.group.scale.set(1.2 - squish * 0.2, squish, 1.2 - squish * 0.2);
    }

    this.animateLimbs(delta);

    if (this.targetPosition) {
      const lerpFactor = 1.0 - Math.pow(0.001, delta);
      
      // Calculate velocity for animation
      const prevPos = this.position.clone();
      this.position.lerp(this.targetPosition, lerpFactor);
      
      this.velocity.x = (this.position.x - prevPos.x) / delta;
      this.velocity.y = (this.position.y - prevPos.y) / delta;
      this.velocity.z = (this.position.z - prevPos.z) / delta;
    }

    if (this.knockbackTimer > 0) {
      const tilt = (this.knockbackTimer / 0.5) * 0.4;
      this.group.rotation.z = Math.sin(this.knockbackTimer * 20) * tilt;
    } else if (this.health > 0) {
      this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, 0, delta * 10);
    }

    if (this.health <= 0) {
      // Death effect interpolation
      this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, Math.PI / 2, delta * 10);
    }

    this.group.position.copy(this.position);
    
    // Floating animation for Morvane
    if (this.type === MobType.MORVANE && this.health > 0) {
      const time = Date.now() * 0.001;
      const floatY = Math.sin(time * 1.5) * 0.8;
      this.group.position.y += 2.0 + floatY; // Start higher and bob
    }

    // Attack player
    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    const horizontalDistSq = dx * dx + dz * dz;
    const dy = Math.abs(playerPos.y - this.position.y);
    const distToPlayer = this.position.distanceTo(playerPos);

    const isSkeleton = this.type === MobType.SKELETON;
    const attackDistSq = isSkeleton ? 144 : 1.69; // Skeletons attack from 12 blocks away

    if (!this.isPassive && horizontalDistSq < attackDistSq && dy < (isSkeleton ? 15 : 1.3) && Date.now() - this.lastAttackTime > (isSkeleton ? 2000 : 1000)) {
      // Line of sight check
      _startPos.copy(this.position);
      _startPos.y += 1.5;
      _targetPos.copy(playerPos);
      _targetPos.y += 1.0;
      _forward.subVectors(_targetPos, _startPos).normalize();
      
      const hit = world.raycast(_startPos, _forward, distToPlayer);

      if (!hit.hit) {
        this.lastAttackTime = Date.now();
        
        if (isSkeleton) {
          // Shoot an arrow!
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
          head.position.z = 0.3;
          arrowGroup.add(head);
          
          arrowGroup.position.copy(_startPos);
          // Look in direction of travel
          arrowGroup.lookAt(_targetPos);
          this.group.parent?.add(arrowGroup);
          
          audioManager.playPositional('bow_shoot', _startPos, 0.6, 0.9 + Math.random() * 0.2, 30);
          
          const disposeArrow = () => {
             if (arrowGroup.parent) arrowGroup.parent.remove(arrowGroup);
             shaftGeo.dispose();
             shaftMat.dispose();
             headGeo.dispose();
             headMat.dispose();
          };
          
          const velocity = _forward.clone().multiplyScalar(15);
          const localAdd = new THREE.Vector3();
          // Simple local tick for the arrow
          const arrowTick = setInterval(() => {
             localAdd.copy(velocity).multiplyScalar(0.05);
             arrowGroup.position.add(localAdd);
             // Gravity
             velocity.y -= 0.5;
             localAdd.copy(arrowGroup.position).add(velocity);
             arrowGroup.lookAt(localAdd);
             
             // Check hit player
             if (arrowGroup.position.distanceTo(playerPos) < 1.0) {
               clearInterval(arrowTick);
               disposeArrow();
               
               const damage = 12 * (1 + (this.level - 1) * 0.1);
               window.dispatchEvent(new CustomEvent('playerTakeDamage', {
                 detail: {
                   damage: damage,
                   knockbackDir: new THREE.Vector3(_forward.x, 0, _forward.z).normalize()
                 }
               }));
               return;
             }
             
             // Check hit block
             const b = world.getBlock(Math.floor(arrowGroup.position.x), Math.floor(arrowGroup.position.y), Math.floor(arrowGroup.position.z));
             if (b !== 0 && isSolidBlock(b)) {
               clearInterval(arrowTick);
               setTimeout(() => { disposeArrow(); }, 5000);
               return;
             }
          }, 50);
          
          // Cleanup max lifetime
          setTimeout(() => {
             clearInterval(arrowTick);
             disposeArrow();
          }, 4000);
          
        } else {
          // Base damage for melee mobs
          let baseDamage = 10;
          if (this.type === MobType.ZOMBIE) baseDamage = 15;
          else if (this.type === MobType.CREEPER) baseDamage = 30;
          
          const damage = baseDamage * (1 + (this.level - 1) * 0.1);
          
          window.dispatchEvent(new CustomEvent('playerTakeDamage', {
            detail: {
              damage: damage,
              knockbackDir: new THREE.Vector3().subVectors(playerPos, this.position).normalize()
            }
          }));
        }
      }
    }
  }

  knockback(dir: THREE.Vector3, force: number) {
    this.velocity.x = dir.x * force;
    this.velocity.z = dir.z * force;
    this.velocity.y = 6; // Upward pop (lift)
    this.knockbackTimer = 0.5; // 500ms of knockback where AI movement is disabled
  }

  takeDamage(amount: number, knockbackDir?: THREE.Vector3) {
    this.health -= amount;
    if (this.isPassive) this.fleeTimer = 5.0;
    
    if (knockbackDir && knockbackDir.lengthSq() > 0) {
      const kDir = knockbackDir.clone().normalize();
      this.visualOffset.addScaledVector(kDir, 0.4);
      this.damageRotateAxis.set(-kDir.z, 0, kDir.x).normalize();
      this.damageRotate = 0.4;
    } else {
      this._recoilDir.set(0, 0, 1).applyQuaternion(this.group.quaternion).negate();
      this.visualOffset.addScaledVector(this._recoilDir, 0.4);
      this.damageRotateAxis.set(-this._recoilDir.z, 0, this._recoilDir.x).normalize();
      this.damageRotate = 0.4;
    }
    this.visualOffset.y += 0.2;
    
    // Play hurt sound
    const soundPrefix = this.type.toLowerCase();
    if (this.type === MobType.ZOMBIE) audioManager.play('zombie_hurt', 0.3);
    else if (this.type === MobType.SKELETON) audioManager.play('skeleton_hurt', 0.3);
    else audioManager.play('hit', 0.3);

    // Emit hit to network
    networkManager.mobHit(this.id, amount, knockbackDir ? { x: knockbackDir.x, y: knockbackDir.y, z: knockbackDir.z } : { x: 0, y: 0, z: 0 });
    
    // Red flash effect
    this.group.traverse(child => {
      if (child instanceof THREE.Mesh && child.material) {
        const mat = child.material as THREE.MeshStandardMaterial;
        
        // Don't clone current state as it might already be red from a previous hit
        mat.emissive.setHex(0xff0000);
        mat.emissiveIntensity = 1.0;
        
        setTimeout(() => {
          if (child.material) {
            const m = child.material as THREE.MeshStandardMaterial;
            m.emissive.setHex(0x000000);
            m.emissiveIntensity = 0;
          }
        }, 150);
      }
    });

    if (this.health <= 0) {
      skyBridgeManager.addXp(SkillType.COMBAT, 25);
      
      // Play death sound
      if (this.type === MobType.ZOMBIE) audioManager.play('zombie_death', 0.3);
      else if (this.type === MobType.SKELETON) audioManager.play('skeleton_death', 0.3);
      else audioManager.play('pop', 0.3);

      // Determine loot
      let lootType = ItemType.DIRT;
      
      switch (this.type) {
        case MobType.ZOMBIE:
          lootType = Math.random() > 0.5 ? ItemType.DIRT : ItemType.WOOD;
          break;
        case MobType.SKELETON:
          lootType = Math.random() > 0.5 ? ItemType.STICK : ItemType.STONE;
          break;
        case MobType.CREEPER:
          lootType = ItemType.RED_STONE;
          break;
        case MobType.SLIME:
          lootType = ItemType.BLUE_STONE;
          break;
        case MobType.COW:
          lootType = ItemType.WOOD;
          break;
        case MobType.SHEEP:
          lootType = ItemType.GRASS;
          break;
      }
      
      return lootType; // Return loot type to caller (Player) for auto-pickup
    }
    return null;
  }
}
