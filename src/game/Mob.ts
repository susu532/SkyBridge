import * as THREE from "three";
import { World } from "./World";
import { MobRenderer } from "./MobRenderer";

const _tempEuler = new THREE.Euler();
const _tempQuat = new THREE.Quaternion();
const _zAxis = new THREE.Vector3(0, 0, 1);
const _forward = new THREE.Vector3();
const _startPos = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _nextPos = new THREE.Vector3();
const _zeroVec = new THREE.Vector3();
const _upOffset = new THREE.Vector3(0, 1.5, 0);
const _upOffsetPlayer = new THREE.Vector3(0, 1.0, 0);
const _kbDir = new THREE.Vector3();
const _hitMin = new THREE.Vector3();
const _hitMax = new THREE.Vector3();
const _tempVec1 = new THREE.Vector3();
const _tempVec2 = new THREE.Vector3();
const _tempVec3 = new THREE.Vector3();
const _chaseForce = new THREE.Vector3();

import { BLOCK, isSolidBlock, isSlab, ATLAS_TILES } from "./TextureAtlas";
import { skyBridgeManager, SkillType } from "./SkyBridgeManager";
import { networkManager } from "./NetworkManager";
import { ItemType } from "./Inventory";
import { audioManager } from "./AudioManager";
import { settingsManager } from "./Settings";

export enum MobType {
  ZOMBIE = "Zombie",
  SLIME = "Slime",
  SKELETON = "Skeleton",
  CREEPER = "Creeper",
  COW = "Cow",
  SHEEP = "Sheep",
  MORVANE = "Morvane",
}

export class Mob {
  renderer: MobRenderer;
  id: string;
  type: MobType;
  group: THREE.Group;
  position: THREE.Vector3;
  health: number = 100;
  maxHealth: number = 100;
  level: number = 1;
  name: string = "Zombie";
  isPassive: boolean = false;
  lastDamagePredictedTime: number = 0;
  hasInitialPosition: boolean = false;
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
  lastKnockbackTime: number = 0;
  predictionOffset = new THREE.Vector3();
  knockbackVelocity = new THREE.Vector3();

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
  team?: string;

  constructor(
    id: string,
    position: THREE.Vector3,
    level: number = 1,
    type: MobType = MobType.ZOMBIE,
    textureAtlas: THREE.Texture | null = null,
    team?: string,
  ) {
    this.id = id;
    this.type = type;
    this.position = position.clone();
    this.targetPosition = position.clone();
    this.level = level;
    this.team = team;
    this.isPassive = [MobType.COW, MobType.SHEEP].includes(type);
    this.textureAtlas = textureAtlas;
    this.wanderAngle = Math.random() * Math.PI * 2;

    this.maxHealth = 100 + (level - 1) * 50;
    if (type === MobType.MORVANE) {
      this.maxHealth = 5000;
      this.name = "Morvane, Guardian of Skycastle";
    }
    if (type === MobType.SLIME) this.maxHealth *= 0.5;
    if (this.isPassive) this.maxHealth = 20;

    this.health = this.maxHealth;
    this.renderer = new MobRenderer(this);
    this.group = this.renderer.createModel();
    this.renderer.enableShadows(this.group);

    this.group.position.copy(this.position);
    this.group.userData = { isMob: true, mobId: id };
  }

  private createNameTag() {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return;
    canvas.width = 512;
    canvas.height = 128;
    context.fillStyle = "rgba(0, 0, 0, 0.6)";
    context.fillRect(0, 0, 512, 128);
    context.font = 'bold 80px "Inter", Arial';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#ff3333";
    context.fillText(this.name, 256, 64);
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
    });
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
        width = 0.6;
        height = 1.95;
        break;
      case MobType.CREEPER:
        width = 0.6;
        height = 1.7;
        break;
      case MobType.MORVANE:
        width = 3.0;
        height = 9.0;
        break;
      case MobType.COW:
        width = 0.9;
        height = 1.4;
        break;
      case MobType.SHEEP:
        width = 0.9;
        height = 1.3;
        break;
      case MobType.SLIME:
        width = 0.8;
        height = 0.8;
        break;
    }

    _hitMin.set(
      this.position.x - width / 2,
      this.position.y,
      this.position.z - width / 2,
    );
    _hitMax.set(
      this.position.x + width / 2,
      this.position.y + height,
      this.position.z + width / 2,
    );

    return new THREE.Box3(_hitMin, _hitMax);
  }

  checkCollision(pos: THREE.Vector3, world: World): boolean {
    const radius = 0.3;
    const height =
      this.type === MobType.SLIME ? 0.8 : this.isPassive ? 1.2 : 1.8;

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

      // Apply knockback to prediction offset instead of modifying real state
      if (this.knockbackVelocity.lengthSq() > 0.01) {
        const step = this.knockbackVelocity.clone().multiplyScalar(delta);
        this.predictionOffset.add(step);
        this.knockbackVelocity.multiplyScalar(1.0 - 8.0 * delta); // friction
      }

      // Decay the prediction offset as server syncs up
      const predDecay = 1.0 - Math.exp(-2.5 * delta); // Slower natural decay
      this.predictionOffset.lerp(_zeroVec, predDecay);
      if (this.predictionOffset.lengthSq() < 0.01) this.predictionOffset.set(0, 0, 0);

      const decay = 1.0 - Math.exp(-10 * delta); // Slower snap-back so knockback prediction feels good
      this.visualOffset.lerp(_zeroVec, decay);
      this.damageRotate = THREE.MathUtils.lerp(this.damageRotate, 0, decay);

      this.group.position.copy(this.position).add(this.visualOffset).add(this.predictionOffset);

      // Face movement direction
      const moveDir = _tempVec1.subVectors(this.targetPosition, this.lastNetPos);
      if (moveDir.length() > 0.001) {
        const targetRotation = Math.atan2(moveDir.x, moveDir.z);

        let diff = targetRotation - this.group.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;

        this.group.rotation.set(
          0,
          this.group.rotation.y + diff * delta * 15,
          0,
        );
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
            _tempVec1.copy(playerPos);
            const localPlayerPos = this.group.worldToLocal(_tempVec1);
            const targetHeadRot = new THREE.Euler().setFromQuaternion(
              _tempQuat.setFromUnitVectors(
                _zAxis,
                localPlayerPos.normalize(),
              ),
            );

            this.head.rotation.x = THREE.MathUtils.lerp(
              this.head.rotation.x,
              THREE.MathUtils.clamp(targetHeadRot.x, -0.5, 0.5),
              0.05,
            );
            this.head.rotation.y = THREE.MathUtils.lerp(
              this.head.rotation.y,
              THREE.MathUtils.clamp(targetHeadRot.y, -0.8, 0.8),
              0.05,
            );
          } else if (distToPlayer < 10 && Math.random() < 0.005) {
            this.idleTimer = 2 + Math.random() * 3;
          } else {
            // Reset head slowly
            this.head.rotation.x = THREE.MathUtils.lerp(
              this.head.rotation.x,
              0,
              0.02,
            );
            this.head.rotation.y = THREE.MathUtils.lerp(
              this.head.rotation.y,
              0,
              0.02,
            );
          }
        } else {
          this.head.rotation.set(0, 0, 0);
        }
      }

      this.renderer.animateLimbs(delta);

      // Ambient sounds
      if (Math.random() < 0.001) {
        const distToPlayer = this.position.distanceTo(playerPos);
        if (distToPlayer < 20) {
          if (this.type === MobType.ZOMBIE)
            audioManager.play("zombie_idle", 0.2);
          else if (this.type === MobType.SKELETON)
            audioManager.play("skeleton_idle", 0.2);
          else if (this.type === MobType.COW)
            audioManager.play("cow_idle", 0.2);
          else if (this.type === MobType.SHEEP)
            audioManager.play("sheep_idle", 0.2);
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

      if (
        !this.isPassive &&
        horizontalDistSq < 1.69 &&
        dy < 1.3 &&
        Date.now() - this.lastAttackTime > 1000
      ) {
        // Line of sight check
        const start = _tempVec1.copy(this.position).add(_upOffset);
        const target = _tempVec2.copy(playerPos).add(_upOffsetPlayer);
        const dir = _tempVec3.subVectors(target, start).normalize();
        const distToPlayer = start.distanceTo(target);
        const hit = world.raycast(start, dir, distToPlayer);

        if (false && !hit) {
          // Disabled in favor of server-authoritative combat
          this.lastAttackTime = Date.now();

          // Calculate knockback direction from mob to player
          const kbDir = _kbDir.subVectors(playerPos, this.position).normalize();

          window.dispatchEvent(
            new CustomEvent("playerTakeDamage", {
              detail: {
                damage: 10,
                knockbackDir: { x: kbDir.x, y: 0, z: kbDir.z },
              },
            }),
          );
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

    _chaseForce.set(0, 0, 0);
    if (!this.isPassive && dist < 15) {
      // Alert state when first seeing player
      if (this.alertTimer <= 0 && dist > 10) {
        this.alertTimer = 1.0;
        if (this.type === MobType.ZOMBIE) audioManager.play("zombie_idle", 0.5);
        else if (this.type === MobType.SKELETON)
          audioManager.play("skeleton_idle", 0.5);
      }

      // Chase player
      const dir = _tempVec1.subVectors(playerPos, this.position).normalize();
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
        _chaseForce.copy(dir).multiplyScalar(3);
      }

      const targetRotation = Math.atan2(dir.x, dir.z);
      this.group.rotation.y = THREE.MathUtils.lerp(
        this.group.rotation.y,
        targetRotation,
        0.1,
      );
    } else if (this.isPassive) {
      if (this.fleeTimer > 0) {
        // Flee from player (slower, as requested)
        const dir = _tempVec2.subVectors(this.position, playerPos).normalize();
        dir.y = 0;
        _chaseForce.copy(dir).multiplyScalar(3.5);
        const targetRotation = Math.atan2(dir.x, dir.z);
        this.group.rotation.y = THREE.MathUtils.lerp(
          this.group.rotation.y,
          targetRotation,
          0.15,
        );

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
          const dir = _tempVec3.subVectors(playerPos, this.position).normalize();
          const targetRotation = Math.atan2(dir.x, dir.z);
          this.group.rotation.y = THREE.MathUtils.lerp(
            this.group.rotation.y,
            targetRotation,
            0.05,
          );
        } else if (this.wanderAngle !== -1 && this.sniffTimer <= 0) {
          _chaseForce
            .set(Math.cos(this.wanderAngle), 0, Math.sin(this.wanderAngle))
            .multiplyScalar(1.0);
          const targetRotation = -this.wanderAngle + Math.PI / 2;
          this.group.rotation.y = THREE.MathUtils.lerp(
            this.group.rotation.y,
            targetRotation,
            0.03,
          );
        }
      }
    }

    // Head tracking logic (only for passive mobs)
    if (this.head) {
      if (this.isPassive && this.sniffTimer > 0) {
        // Sniffing ground animation
        this.head.rotation.x = THREE.MathUtils.lerp(
          this.head.rotation.x,
          0.8,
          0.1,
        );
        this.head.rotation.y = THREE.MathUtils.lerp(
          this.head.rotation.y,
          Math.sin(Date.now() * 0.01) * 0.2,
          0.1,
        );
      } else if (
        (this.isPassive || this.type === MobType.MORVANE) &&
        (dist < 20 || this.wanderAngle === -2 || this.type === MobType.MORVANE)
      ) {
        // Look at player
        _tempVec1.copy(playerPos);
        const localPlayerPos = this.group.worldToLocal(_tempVec1);
        _tempQuat.setFromUnitVectors(_zAxis, localPlayerPos.normalize());
        _tempEuler.setFromQuaternion(_tempQuat);

        this.head.rotation.x = THREE.MathUtils.lerp(
          this.head.rotation.x,
          THREE.MathUtils.clamp(_tempEuler.x, -0.5, 0.5),
          0.05,
        );
        this.head.rotation.y = THREE.MathUtils.lerp(
          this.head.rotation.y,
          THREE.MathUtils.clamp(_tempEuler.y, -0.8, 0.8),
          0.05,
        );
      } else {
        // Reset head slowly
        this.head.rotation.x = THREE.MathUtils.lerp(
          this.head.rotation.x,
          0,
          0.02,
        );
        this.head.rotation.y = THREE.MathUtils.lerp(
          this.head.rotation.y,
          0,
          0.02,
        );
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
        this.velocity.x = THREE.MathUtils.lerp(
          this.velocity.x,
          _chaseForce.x,
          chaseLerp,
        );
        this.velocity.z = THREE.MathUtils.lerp(
          this.velocity.z,
          _chaseForce.z,
          chaseLerp,
        );
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

    this.renderer.animateLimbs(delta);

    if (this.targetPosition) {
      const lerpFactor = 1.0 - Math.pow(0.001, delta);

      // Calculate velocity for animation
      _tempVec1.copy(this.position);
      this.position.lerp(this.targetPosition, lerpFactor);

      this.velocity.x = (this.position.x - _tempVec1.x) / delta;
      this.velocity.y = (this.position.y - _tempVec1.y) / delta;
      this.velocity.z = (this.position.z - _tempVec1.z) / delta;
    }

    if (this.knockbackTimer > 0) {
      const tilt = (this.knockbackTimer / 0.5) * 0.4;
      this.group.rotation.z = Math.sin(this.knockbackTimer * 20) * tilt;
    } else if (this.health > 0) {
      this.group.rotation.z = THREE.MathUtils.lerp(
        this.group.rotation.z,
        0,
        delta * 10,
      );
    }

    if (this.health <= 0) {
      // Death effect interpolation
      this.group.rotation.x = THREE.MathUtils.lerp(
        this.group.rotation.x,
        Math.PI / 2,
        delta * 10,
      );
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

    if (
      !this.isPassive &&
      horizontalDistSq < attackDistSq &&
      dy < (isSkeleton ? 15 : 1.3) &&
      Date.now() - this.lastAttackTime > (isSkeleton ? 2000 : 1000)
    ) {
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

          audioManager.playPositional(
            "bow_shoot",
            _startPos,
            0.6,
            0.9 + Math.random() * 0.2,
            30,
          );

          const disposeArrow = () => {
            if (arrowGroup.parent) arrowGroup.parent.remove(arrowGroup);
            shaftGeo.dispose();
            shaftMat.dispose();
            headGeo.dispose();
            headMat.dispose();
          };

          const velocity = _forward.clone().multiplyScalar(15);
          const localAdd = new THREE.Vector3();
          let animationFrameId: number;
          let lastTime = performance.now();

          const tickArrow = () => {
            const currentTime = performance.now();
            const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
            lastTime = currentTime;

            // The original code ran at 20Hz (50ms). We multiply by dt / 0.05 to scale the movement.
            const scale = dt / 0.05;

            localAdd.copy(velocity).multiplyScalar(0.05 * scale);
            arrowGroup.position.add(localAdd);
            // Gravity
            velocity.y -= 0.5 * scale;
            localAdd.copy(arrowGroup.position).add(velocity);
            arrowGroup.lookAt(localAdd);

            // Check hit player
            if (arrowGroup.position.distanceTo(playerPos) < 1.0) {
              cancelAnimationFrame(animationFrameId);
              disposeArrow();

              const damage = 12 * (1 + (this.level - 1) * 0.1);
              window.dispatchEvent(
                new CustomEvent("playerTakeDamage", {
                  detail: {
                    damage: damage,
                    knockbackDir: new THREE.Vector3(
                      _forward.x,
                      0,
                      _forward.z,
                    ).normalize(),
                  },
                }),
              );
              return;
            }

            // Check hit block
            const b = world.getBlock(
              Math.floor(arrowGroup.position.x),
              Math.floor(arrowGroup.position.y),
              Math.floor(arrowGroup.position.z),
            );
            if (b !== 0 && isSolidBlock(b)) {
              cancelAnimationFrame(animationFrameId);
              setTimeout(() => {
                disposeArrow();
              }, 5000);
              return;
            }

            animationFrameId = requestAnimationFrame(tickArrow);
          };

          animationFrameId = requestAnimationFrame(tickArrow);

          // Cleanup max lifetime
          setTimeout(() => {
            cancelAnimationFrame(animationFrameId);
            disposeArrow();
          }, 4000);
        } else {
          // Base damage for melee mobs
          let baseDamage = 10;
          if (this.type === MobType.ZOMBIE) baseDamage = 15;
          else if (this.type === MobType.CREEPER) baseDamage = 30;

          const damage = baseDamage * (1 + (this.level - 1) * 0.1);

          window.dispatchEvent(
            new CustomEvent("playerTakeDamage", {
              detail: {
                damage: damage,
                knockbackDir: new THREE.Vector3()
                  .subVectors(playerPos, this.position)
                  .normalize(),
              },
            }),
          );
        }
      }
    }
  }

  updatePositionFromServer(x: number, y: number, z: number) {
    if (this.targetPosition) {
      if (this.predictionOffset.lengthSq() > 0.001) {
        const deltaPos = new THREE.Vector3(x - this.targetPosition.x, y - this.targetPosition.y, z - this.targetPosition.z);
        const dot = deltaPos.dot(this.predictionOffset);
        if (dot > 0) {
          const matchLen = deltaPos.length() * (dot / (deltaPos.length() * this.predictionOffset.length()));
          if (!isNaN(matchLen)) {
            const matchedVec = this.predictionOffset.clone().normalize().multiplyScalar(matchLen);
            this.predictionOffset.sub(matchedVec);
            if (this.predictionOffset.dot(matchedVec) < 0) {
              this.predictionOffset.set(0, 0, 0);
            }
          }
        }
      }
      this.targetPosition.set(x, y, z);
    }
  }

  knockback(dir: THREE.Vector3, force: number) {
    this.velocity.x = dir.x * force;
    this.velocity.z = dir.z * force;
    this.velocity.y = 6; // Upward pop (lift)
    this.knockbackTimer = 0.5; // 500ms of knockback where AI movement is disabled
    this.lastKnockbackTime = Date.now();
    
    // Client-side visual knockback prediction
    this.knockbackVelocity.copy(dir).multiplyScalar(force * 1.5);
    this.knockbackVelocity.y = Math.min(force, 12);
  }

  takeDamage(
    amount: number,
    knockbackDir?: THREE.Vector3,
    isLocalPrediction: boolean = true,
  ) {
    if (isLocalPrediction) {
      this.health -= amount;
      this.lastDamagePredictedTime = Date.now();
    }

    if (this.isPassive) this.fleeTimer = 5.0;

    if (knockbackDir && knockbackDir.lengthSq() > 0) {
      const kDir = knockbackDir.clone().normalize();
      this.visualOffset.addScaledVector(kDir, 0.4);
      this.damageRotateAxis.set(-kDir.z, 0, kDir.x).normalize();
      this.damageRotate = 0.4;
      
      this.knockback(kDir, knockbackDir.length());
    } else {
      this._recoilDir
        .set(0, 0, 1)
        .applyQuaternion(this.group.quaternion)
        .negate();
      this.visualOffset.addScaledVector(this._recoilDir, 0.4);
      this.damageRotateAxis
        .set(-this._recoilDir.z, 0, this._recoilDir.x)
        .normalize();
      this.damageRotate = 0.4;
    }
    this.visualOffset.y += 0.2;

    // Play hurt sound
    const soundPrefix = this.type.toLowerCase();
    if (this.type === MobType.ZOMBIE) audioManager.play("zombie_hurt", 0.3);
    else if (this.type === MobType.SKELETON)
      audioManager.play("skeleton_hurt", 0.3);
    else audioManager.play("hit", 0.3);

    // Emit hit to network
    networkManager.mobHit(
      this.id,
      amount,
      knockbackDir
        ? { x: knockbackDir.x, y: knockbackDir.y, z: knockbackDir.z }
        : { x: 0, y: 0, z: 0 },
    );

    // Red flash effect
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mat = child.material as any;

        // Don't clone current state as it might already be red from a previous hit
        if (mat.emissive) {
          mat.emissive.setHex(0xff0000);
          mat.emissiveIntensity = 1.0;
        } else if (mat.color) {
          // If no emissive (BasicMaterial), we can faking it by changing color,
          // but we won't have a reference to the old color easily here.
          // Let's just skip if no emissive for now or just check if it exists.
        }

        setTimeout(() => {
          if (child.material) {
            const m = child.material as any;
            if (m.emissive) {
              m.emissive.setHex(0x000000);
              m.emissiveIntensity = 0;
            }
          }
        }, 150);
      }
    });

    if (this.health <= 0) {
      if (this.type === MobType.MORVANE) {
        return null; // Bosses are orchestrated by the server, don't drop loot locally and don't despawn locally
      }
      skyBridgeManager.addXp(SkillType.COMBAT, 25);

      // Play death sound
      if (this.type === MobType.ZOMBIE) audioManager.play("zombie_death", 0.3);
      else if (this.type === MobType.SKELETON)
        audioManager.play("skeleton_death", 0.3);
      else audioManager.play("pop", 0.3);

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
