import * as THREE from "three";
import { Mob, MobType } from "./Mob";
import { ATLAS_TILES } from "./TextureAtlas";
import { settingsManager } from "./Settings";

export class MobRenderer {
    mob: Mob;

    constructor(mob: Mob) {
        this.mob = mob;
    }

  getMobUVs(tx: number, ty: number) {
    const size = 1 / ATLAS_TILES;
    const uMin = tx * size;
    const uMax = (tx + 1) * size;
    const vMin = 1.0 - (ty + 1) * size;
    const vMax = 1.0 - ty * size;

    return [uMin, vMax, uMax, vMax, uMin, vMin, uMax, vMin];
  }

  applyTexture(
    mesh: THREE.Mesh,
    tx: number,
    ty: number,
    isFace: boolean = false,
  ) {
    if (!this.mob.textureAtlas) return;

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
    (mesh.material as THREE.MeshStandardMaterial).map = this.mob.textureAtlas;
    (mesh.material as THREE.MeshStandardMaterial).needsUpdate = true;
  }

  enableShadows(group: THREE.Group) {
    const isPerformance = settingsManager.getSettings().performanceMode;
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = !isPerformance;
        child.receiveShadow = !isPerformance;
      }
    });
  }

  createModel(): THREE.Group {
    const group = new THREE.Group();

    if (
      this.mob.type === MobType.ZOMBIE ||
      this.mob.type === MobType.SKELETON ||
      this.mob.type === MobType.MORVANE
    ) {
      this.createHumanoidModel(group);
    } else if (this.mob.type === MobType.CREEPER) {
      this.createCreeperModel(group);
    } else if (this.mob.isPassive) {
      this.createPassiveModel(group);
    } else if (this.mob.type === MobType.SLIME) {
      this.createSlimeModel(group);
    }

    return group;
  }

  createHumanoidModel(group: THREE.Group) {
    const isSkeleton = this.mob.type === MobType.SKELETON;
    const isMorvane = this.mob.type === MobType.MORVANE;
    const skinColor = this.mob.textureAtlas
      ? 0xffffff
      : isSkeleton
        ? 0xdddddd
        : isMorvane
          ? 0x0a0a0a
          : 0x3b511a;
    const shirtColor = this.mob.textureAtlas
      ? 0xffffff
      : isSkeleton
        ? 0xdddddd
        : isMorvane
          ? 0x000000
          : 0x00aaaa;
    const pantsColor = this.mob.textureAtlas
      ? 0xffffff
      : isSkeleton
        ? 0xdddddd
        : isMorvane
          ? 0x000000
          : 0x2d2d88;

    const isPerformance = settingsManager.getSettings().performanceMode;
    const matSkin = isPerformance
      ? new THREE.MeshBasicMaterial({ color: skinColor })
      : new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.9 });
    const matShirt = isPerformance
      ? new THREE.MeshBasicMaterial({ color: shirtColor })
      : new THREE.MeshStandardMaterial({
          color: shirtColor,
          roughness: 1.0,
          metalness: isMorvane ? 0.0 : 0,
        });
    const matPants = isPerformance
      ? new THREE.MeshBasicMaterial({ color: pantsColor })
      : new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 1.0 });

    // Body
    const bodyWidth = isSkeleton ? 0.4 : 0.6;
    const bodyGeo = new THREE.BoxGeometry(bodyWidth, 0.7, 0.3);
    const body = new THREE.Mesh(bodyGeo, matShirt);
    body.position.y = 1.05;
    if (this.mob.textureAtlas) {
      if (isSkeleton)
        this.applyTexture(body, 4, 22); // Skeleton Bone
      else if (isMorvane)
        this.applyTexture(body, 15, 9); // Black Concrete for body
      else this.applyTexture(body, 12, 22); // Zombie Shirt
    }
    group.add(body);

    // Head
    this.mob.head = new THREE.Group();
    this.mob.head.position.y = 1.4;
    const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const headMesh = new THREE.Mesh(headGeo, matSkin);
    headMesh.position.y = 0.25;
    this.mob.head.add(headMesh);
    group.add(this.mob.head);

    if (this.mob.textureAtlas) {
      // Apply plain skin to all sides first
      if (isMorvane) this.applyTexture(headMesh, 15, 9, false);
      else this.applyTexture(headMesh, isSkeleton ? 4 : 3, 22, false);
      // Then apply face strictly to front (index 4)
      if (isMorvane)
        this.applyTexture(headMesh, 16, 24, true); // Keep the scary face
      else this.applyTexture(headMesh, isSkeleton ? 1 : 0, 22, true);
    }

    // Always create eyes and mouth for humanoid mobs so they have a face
    const eyeGeo = new THREE.BoxGeometry(0.12, 0.12, 0.05);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: isMorvane ? 0xff0000 : isSkeleton ? 0x222222 : 0x000000,
      emissive: isMorvane ? 0xff0000 : 0x000000,
      emissiveIntensity: isMorvane ? 2 : 1,
    });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.15, 0.3, 0.26);
    this.mob.head.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.15, 0.3, 0.26);
    this.mob.head.add(rightEye);

    // Arms
    const armSize = isSkeleton ? 0.15 : 0.2;
    const armGeo = new THREE.BoxGeometry(armSize, 0.7, armSize);

    this.mob.leftArm = new THREE.Group();
    this.mob.leftArm.position.set(isSkeleton ? -0.3 : -0.4, 1.4, 0);
    const leftArmMesh = new THREE.Mesh(armGeo, matSkin);
    leftArmMesh.position.y = -0.35;
    if (this.mob.textureAtlas) {
      if (isSkeleton) this.applyTexture(leftArmMesh, 4, 22);
      else if (isMorvane) this.applyTexture(leftArmMesh, 15, 9);
      else this.applyTexture(leftArmMesh, 3, 22);
    }
    this.mob.leftArm.add(leftArmMesh);
    group.add(this.mob.leftArm);

    this.mob.rightArm = new THREE.Group();
    this.mob.rightArm.position.set(isSkeleton ? 0.3 : 0.4, 1.4, 0);
    const rightArmMesh = new THREE.Mesh(armGeo, matSkin);
    rightArmMesh.position.y = -0.35;
    if (this.mob.textureAtlas) {
      if (isSkeleton) this.applyTexture(rightArmMesh, 4, 22);
      else if (isMorvane) this.applyTexture(rightArmMesh, 15, 9);
      else this.applyTexture(rightArmMesh, 3, 22);
    }
    this.mob.rightArm.add(rightArmMesh);
    group.add(this.mob.rightArm);

    if (isMorvane) {
      // Second set of arms
      this.mob.leftArm2 = new THREE.Group();
      this.mob.leftArm2.position.set(-0.4, 1.1, 0);
      const leftArmMesh2 = new THREE.Mesh(armGeo, matSkin);
      leftArmMesh2.position.y = -0.35;
      if (this.mob.textureAtlas) this.applyTexture(leftArmMesh2, 15, 9);
      this.mob.leftArm2.add(leftArmMesh2);
      group.add(this.mob.leftArm2);

      this.mob.rightArm2 = new THREE.Group();
      this.mob.rightArm2.position.set(0.4, 1.1, 0);
      const rightArmMesh2 = new THREE.Mesh(armGeo, matSkin);
      rightArmMesh2.position.y = -0.35;
      if (this.mob.textureAtlas) this.applyTexture(rightArmMesh2, 15, 9);
      this.mob.rightArm2.add(rightArmMesh2);
      group.add(this.mob.rightArm2);
    }

    // Legs
    if (!isMorvane) {
      const legSize = isSkeleton ? 0.15 : 0.2;
      const legGeo = new THREE.BoxGeometry(legSize, 0.7, legSize);

      this.mob.leftLeg = new THREE.Group();
      this.mob.leftLeg.position.set(-0.15, 0.7, 0);
      const leftLegMesh = new THREE.Mesh(legGeo, matPants);
      leftLegMesh.position.y = -0.35;
      if (this.mob.textureAtlas) {
        if (isSkeleton) this.applyTexture(leftLegMesh, 4, 22);
        else this.applyTexture(leftLegMesh, 13, 22); // Zombie Pants
      }
      this.mob.leftLeg.add(leftLegMesh);
      group.add(this.mob.leftLeg);

      this.mob.rightLeg = new THREE.Group();
      this.mob.rightLeg.position.set(0.15, 0.7, 0);
      const rightLegMesh = new THREE.Mesh(legGeo, matPants);
      rightLegMesh.position.y = -0.35;
      if (this.mob.textureAtlas) {
        if (isSkeleton) this.applyTexture(rightLegMesh, 4, 22);
        else this.applyTexture(rightLegMesh, 13, 22); // Zombie Pants
      }
      this.mob.rightLeg.add(rightLegMesh);
      group.add(this.mob.rightLeg);
    }
  }

  createCreeperModel(group: THREE.Group) {
    const isPerformance = settingsManager.getSettings().performanceMode;
    const creeperColor = this.mob.textureAtlas ? 0xffffff : 0x0da82e;
    const creeperMat = isPerformance
      ? new THREE.MeshBasicMaterial({ color: creeperColor })
      : new THREE.MeshStandardMaterial({ color: creeperColor, roughness: 0.9 });
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.8, 0.3),
      creeperMat,
    );
    body.position.y = 0.7;
    if (this.mob.textureAtlas) this.applyTexture(body, 5, 22);
    group.add(body);

    this.mob.head = new THREE.Group();
    this.mob.head.position.y = 1.1;
    const headMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 0.5),
      creeperMat,
    );
    headMesh.position.y = 0.25;
    this.mob.head.add(headMesh);
    group.add(this.mob.head);

    if (this.mob.textureAtlas) {
      this.applyTexture(headMesh, 5, 22); // Use plain creeper skin for sides
      this.applyTexture(headMesh, 2, 22, true); // Face on front
    }

    // Always create eyes and mouth for creepers so they have a face
    const faceMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const eyeGeo = new THREE.BoxGeometry(0.12, 0.12, 0.05);
    const leftEye = new THREE.Mesh(eyeGeo, faceMat);
    leftEye.position.set(-0.12, 0.3, 0.26);
    this.mob.head.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, faceMat);
    rightEye.position.set(0.12, 0.3, 0.26);
    this.mob.head.add(rightEye);
    const mouth = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.2, 0.05),
      faceMat,
    );
    mouth.position.set(0, 0.15, 0.26);
    this.mob.head.add(mouth);
    const mouthDropGeo = new THREE.BoxGeometry(0.05, 0.15, 0.05);
    const leftDrop = new THREE.Mesh(mouthDropGeo, faceMat);
    leftDrop.position.set(-0.1, 0.05, 0.26);
    this.mob.head.add(leftDrop);
    const rightDrop = new THREE.Mesh(mouthDropGeo, faceMat);
    rightDrop.position.set(0.1, 0.05, 0.26);
    this.mob.head.add(rightDrop);

    const legGeo = new THREE.BoxGeometry(0.25, 0.3, 0.25);
    for (let i = 0; i < 4; i++) {
      const legGroup = new THREE.Group();
      const isFront = i < 2;
      const isLeft = i % 2 === 0;
      legGroup.position.set(isLeft ? -0.15 : 0.15, 0.3, isFront ? 0.15 : -0.15);

      const legMesh = new THREE.Mesh(legGeo, creeperMat);
      legMesh.position.y = -0.15;
      if (this.mob.textureAtlas) this.applyTexture(legMesh, 2, 22);

      legGroup.add(legMesh);
      this.mob.legs.push(legGroup);
      group.add(legGroup);
    }
  }

  createPassiveModel(group: THREE.Group) {
    let bodyColor = 0xffffff;
    let headColor = 0xffffff;
    let legColor = 0xffffff;

    // Rows 22 layout:
    // 6: Cow Body, 7: Cow Face, 10: Cow Leg
    // 8: Sheep Body, 9: Sheep Face, 11: Sheep Leg
    let bodyIdx = 6,
      faceIdx = 7,
      legIdx = 10;

    if (this.mob.type === MobType.COW) {
      bodyIdx = 6;
      faceIdx = 7;
      legIdx = 10;
      bodyColor = this.mob.textureAtlas ? 0xffffff : 0x4b3b2a;
      headColor = this.mob.textureAtlas ? 0xffffff : 0x4b3b2a;
      legColor = this.mob.textureAtlas ? 0xffffff : 0x4b3b2a;
    } else if (this.mob.type === MobType.SHEEP) {
      bodyIdx = 8;
      faceIdx = 9;
      legIdx = 11;
      bodyColor = this.mob.textureAtlas ? 0xffffff : 0xffffff;
      headColor = this.mob.textureAtlas ? 0xffffff : 0xe3c5a8;
      legColor = this.mob.textureAtlas ? 0xffffff : 0xe3c5a8;
    }

    const isPerformance = settingsManager.getSettings().performanceMode;
    const bodyMat = isPerformance
      ? new THREE.MeshBasicMaterial({ color: bodyColor })
      : new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 1.0 });
    const headMat = isPerformance
      ? new THREE.MeshBasicMaterial({ color: headColor })
      : new THREE.MeshStandardMaterial({ color: headColor, roughness: 0.8 });
    const legMat = isPerformance
      ? new THREE.MeshBasicMaterial({ color: legColor })
      : new THREE.MeshStandardMaterial({ color: legColor, roughness: 0.9 });

    const bodyWidth = this.mob.type === MobType.SHEEP ? 0.8 : 0.6;
    const bodyHeight = this.mob.type === MobType.SHEEP ? 0.8 : 0.6;
    const bodyDepth = this.mob.type === MobType.SHEEP ? 1.1 : 0.9;

    const bodyGeo = new THREE.BoxGeometry(bodyWidth, bodyHeight, bodyDepth);
    this.mob.body = new THREE.Mesh(bodyGeo, bodyMat);
    this.mob.body.position.y = 0.7;
    if (this.mob.textureAtlas) {
      this.applyTexture(this.mob.body as THREE.Mesh, bodyIdx, 22);
    }
    group.add(this.mob.body);

    // Add Tail
    const tailGeo = new THREE.BoxGeometry(0.1, 0.4, 0.1);
    const tailMat = new THREE.MeshStandardMaterial({
      color: legColor,
      roughness: 0.9,
    });
    this.mob.tail = new THREE.Mesh(tailGeo, tailMat);
    this.mob.tail.position.set(0, 0.2, -bodyDepth / 2);
    this.mob.tail.rotation.x = -0.5;
    this.mob.body.add(this.mob.tail);

    this.mob.head = new THREE.Group();
    this.mob.head.position.set(0, 0.9, 0.45);

    const headMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.4, 0.4),
      headMat,
    );
    headMesh.position.set(0, 0.1, 0.2);
    this.mob.head.add(headMesh);

    if (this.mob.type === MobType.SHEEP) {
      const woolCap = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.2, 0.45),
        bodyMat,
      );
      woolCap.position.set(0, 0.25, 0.15);
      this.mob.head.add(woolCap);
      if (this.mob.textureAtlas) this.applyTexture(woolCap, bodyIdx, 22);
    }

    group.add(this.mob.head);

    if (this.mob.textureAtlas) {
      // Body on all sides of head
      this.applyTexture(headMesh, bodyIdx, 22);
      // Face on front (index 4)
      this.applyTexture(headMesh, faceIdx, 22, true);

      // Add 3D snout for depth even with textures
      if (this.mob.type === MobType.COW) {
        const snoutColor = 0x8b6b4a;
        const snoutMat = new THREE.MeshStandardMaterial({ color: snoutColor });
        const snoutGeo = new THREE.BoxGeometry(0.25, 0.18, 0.12);
        const snout = new THREE.Mesh(snoutGeo, snoutMat);
        snout.position.set(0, 0.0, 0.25);
        this.mob.head.add(snout);
        if (this.mob.textureAtlas) this.applyTexture(snout, faceIdx, 4); // Use face texture for snout too
      }

      if (this.mob.type === MobType.COW) {
        const hornMat = new THREE.MeshStandardMaterial({ color: 0xdddddd });
        const hornGeo = new THREE.BoxGeometry(0.1, 0.2, 0.1);
        const leftHorn = new THREE.Mesh(hornGeo, hornMat);
        leftHorn.position.set(-0.25, 0.3, 0.1);
        this.mob.head.add(leftHorn);
        const rightHorn = new THREE.Mesh(hornGeo, hornMat);
        rightHorn.position.set(0.25, 0.3, 0.1);
        this.mob.head.add(rightHorn);
      }
    } else {
      const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.05);
      const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
      const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
      leftEye.position.set(-0.15, 0.15, 0.41);
      this.mob.head.add(leftEye);
      const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
      rightEye.position.set(0.15, 0.15, 0.41);
      this.mob.head.add(rightEye);

      if (this.mob.type === MobType.COW) {
        const snoutColor = 0x332211;
        const snoutMat = new THREE.MeshStandardMaterial({ color: snoutColor });
        const snoutGeo = new THREE.BoxGeometry(0.2, 0.15, 0.1);
        const snout = new THREE.Mesh(snoutGeo, snoutMat);
        snout.position.set(0, 0.0, 0.45);
        this.mob.head.add(snout);
      }

      if (this.mob.type === MobType.COW) {
        const hornMat = new THREE.MeshStandardMaterial({ color: 0xdddddd });
        const hornGeo = new THREE.BoxGeometry(0.05, 0.15, 0.05);
        const leftHorn = new THREE.Mesh(hornGeo, hornMat);
        leftHorn.position.set(-0.2, 0.35, 0.2);
        this.mob.head.add(leftHorn);
        const rightHorn = new THREE.Mesh(hornGeo, hornMat);
        rightHorn.position.set(0.2, 0.35, 0.2);
        this.mob.head.add(rightHorn);
      }
    }

    const legGeo = new THREE.BoxGeometry(0.15, 0.4, 0.15);
    for (let i = 0; i < 4; i++) {
      const legGroup = new THREE.Group();
      const isFront = i < 2;
      const isLeft = i % 2 === 0;

      legGroup.position.set(isLeft ? -0.2 : 0.2, 0.4, isFront ? 0.3 : -0.3);

      const legMesh = new THREE.Mesh(legGeo, legMat);
      legMesh.position.y = -0.2;
      if (this.mob.textureAtlas) {
        this.applyTexture(legMesh, legIdx, 22);
      }

      legGroup.add(legMesh);
      this.mob.legs.push(legGroup);
      group.add(legGroup);
    }
  }

  createSlimeModel(group: THREE.Group) {
    const isPerformance = settingsManager.getSettings().performanceMode;
    const slimeGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const slimeMat = isPerformance
      ? new THREE.MeshBasicMaterial({
          color: 0x55ff55,
          transparent: true,
          opacity: 0.7,
        })
      : new THREE.MeshPhysicalMaterial({
          color: 0x55ff55,
          transparent: true,
          opacity: 0.7,
          roughness: 0.1,
          transmission: 0.5,
          thickness: 0.5,
        });
    const slime = new THREE.Mesh(slimeGeo, slimeMat);
    slime.position.y = 0.4;
    if (this.mob.textureAtlas) {
      this.applyTexture(slime, 6, 5); // Body on all sides first
      this.applyTexture(slime, 6, 4, true); // Then face on front
    }
    group.add(slime);

    const coreGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const coreMat = isPerformance
      ? new THREE.MeshBasicMaterial({ color: 0x22aa22 })
      : new THREE.MeshStandardMaterial({ color: 0x22aa22, roughness: 0.8 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.y = 0.4;
    if (this.mob.textureAtlas) this.applyTexture(core, 6, 5);
    group.add(core);

    if (!this.mob.textureAtlas) {
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

  animateLimbs(delta: number) {
    if (settingsManager.getSettings().performanceMode) {
      // Minimal animation for performance mode
      const swing = Math.sin(this.mob.walkCycle) * 0.8;
      if (this.mob.leftLeg && this.mob.rightLeg) {
        this.mob.leftLeg.rotation.x = swing;
        this.mob.rightLeg.rotation.x = -swing;
      }
      if (this.mob.legs.length === 4) {
        this.mob.legs[0].rotation.x = swing;
        this.mob.legs[1].rotation.x = -swing;
        this.mob.legs[2].rotation.x = -swing;
        this.mob.legs[3].rotation.x = swing;
      }
      return;
    }

    const swing = Math.sin(this.mob.walkCycle) * 0.8;
    const speed = this.mob.velocity.length();

    // Breathing animation
    this.mob.breathCycle += delta * 2;
    const breathScale = 1 + Math.sin(this.mob.breathCycle) * 0.02;
    if (this.mob.body) {
      this.mob.body.scale.y = breathScale;
      this.mob.body.scale.x = 1 / breathScale; // Compensate to keep volume
    }

    // Tail wagging
    if (this.mob.tail) {
      this.mob.tailWagCycle += delta * (speed > 0.1 ? 15 : 3);
      this.mob.tail.rotation.z = Math.sin(this.mob.tailWagCycle) * 0.3;
      if (this.mob.fleeTimer > 0) {
        this.mob.tail.rotation.z = Math.sin(this.mob.tailWagCycle * 2) * 0.6; // Fast wag when scared
      }
    }

    if (this.mob.leftArm && this.mob.rightArm) {
      if (this.mob.type === MobType.MORVANE) {
        const time = Date.now() * 0.001;
        this.mob.leftArm.rotation.x = Math.sin(time * 2.0) * 0.5 + 0.2;
        this.mob.rightArm.rotation.x = Math.cos(time * 2.0) * 0.5 + 0.2;
        if (this.mob.leftArm2 && this.mob.rightArm2) {
          this.mob.leftArm2.rotation.x = Math.sin(time * 2.0 + Math.PI) * 0.5 - 0.2;
          this.mob.rightArm2.rotation.x =
            Math.cos(time * 2.0 + Math.PI) * 0.5 - 0.2;

          this.mob.leftArm.rotation.z = Math.sin(time * 1.0) * 0.2 - 0.4;
          this.mob.rightArm.rotation.z = -Math.sin(time * 1.0) * 0.2 + 0.4;
          this.mob.leftArm2.rotation.z = Math.sin(time * 1.2) * 0.2 - 0.6;
          this.mob.rightArm2.rotation.z = -Math.sin(time * 1.2) * 0.2 + 0.6;
        }
      } else if (this.mob.type === MobType.ZOMBIE) {
        this.mob.leftArm.rotation.x = -1.5 + swing * 0.2;
        this.mob.rightArm.rotation.x = -1.5 - swing * 0.2;
      } else if (this.mob.type === MobType.SKELETON) {
        this.mob.leftArm.rotation.x = swing;
        this.mob.rightArm.rotation.x = -swing;
      } else {
        this.mob.leftArm.rotation.x = -swing;
        this.mob.rightArm.rotation.x = swing;
      }
    }
    if (this.mob.leftLeg && this.mob.rightLeg) {
      this.mob.leftLeg.rotation.x = swing;
      this.mob.rightLeg.rotation.x = -swing;
    }
    if (this.mob.legs.length === 4) {
      this.mob.legs[0].rotation.x = swing;
      this.mob.legs[1].rotation.x = -swing;
      this.mob.legs[2].rotation.x = -swing;
      this.mob.legs[3].rotation.x = swing;
    }
  }

}
