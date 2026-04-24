import { useGameStore } from '../store/gameStore';
import * as THREE from 'three';
import { Player } from './Player';
import { BLOCK, isSolidBlock, isSlab } from './TextureAtlas';
import { audioManager } from './AudioManager';

const _moveEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const _moveVec = new THREE.Vector3();
const _currentPos = new THREE.Vector3();
const _nextPosX = new THREE.Vector3();
const _nextPosZ = new THREE.Vector3();
const _stepUpPos = new THREE.Vector3();
const _checkPos = new THREE.Vector3();

export class PlayerPhysics {
  player: Player;
  private lastLavaDamageTime: number = 0;
  
  constructor(player: Player) {
    this.player = player;
  }

  checkCollision(pos: THREE.Vector3): boolean {
    const minX = Math.floor(pos.x - this.player.playerRadius);
    const maxX = Math.floor(pos.x + this.player.playerRadius);
    const minY = Math.floor(pos.y - this.player.playerHeight);
    const maxY = Math.floor(pos.y);
    const minZ = Math.floor(pos.z - this.player.playerRadius);
    const maxZ = Math.floor(pos.z + this.player.playerRadius);

    // Block collision
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const block = this.player.world.getBlock(x, y, z);
          if (isSolidBlock(block)) {
            if (isSlab(block)) {
              const playerBottom = pos.y - this.player.playerHeight;
              const slabTop = y + 0.5;
              if (playerBottom < slabTop && pos.y > y) {
                return true;
              }
            } else {
              return true;
            }
          }
        }
      }
    }

    // Remote player collision
    const radiusSum = this.player.playerRadius * 2;
    const radiusSumSq = radiusSum * radiusSum;
    
    for (const remotePlayer of this.player.entityManager.remotePlayers.values()) {
      const rpPos = remotePlayer.group.position;
      const dx = pos.x - rpPos.x;
      if (Math.abs(dx) > radiusSum) continue;

      const dz = pos.z - rpPos.z;
      if (Math.abs(dz) > radiusSum) continue;

      const dy = pos.y - rpPos.y;
      if (dy <= -1.8 || dy >= this.player.playerHeight) continue;

      if (dx * dx + dz * dz < radiusSumSq) {
        return true;
      }
    }

    // NPC collision
    for (const npc of this.player.entityManager.npcs.values()) {
      const npcPos = npc.group.position;
      const dx = pos.x - npcPos.x;
      if (Math.abs(dx) > radiusSum) continue;

      const dz = pos.z - npcPos.z;
      if (Math.abs(dz) > radiusSum) continue;

      const dy = pos.y - npcPos.y;
      if (dy <= -1.8 || dy >= this.player.playerHeight) continue;

      if (dx * dx + dz * dz < radiusSumSq) {
        return true;
      }
    }

    return false;
  }

  isSupported(pos: THREE.Vector3): boolean {
    const minX = Math.floor(pos.x - this.player.playerRadius);
    const maxX = Math.floor(pos.x + this.player.playerRadius);
    const minZ = Math.floor(pos.z - this.player.playerRadius);
    const maxZ = Math.floor(pos.z + this.player.playerRadius);
    const yBelow = Math.floor(pos.y - this.player.playerHeight - 0.1);

    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        const block = this.player.world.getBlock(x, yBelow, z);
        if (block !== BLOCK.AIR && block !== BLOCK.WATER) {
          return true;
        }
      }
    }
    return false;
  }

  applyGravityAndCollision(delta: number) {
    const p = this.player;

    // Check for water
    const headBlock = p.world.getBlock(Math.floor(p.worldPosition.x), Math.floor(p.worldPosition.y), Math.floor(p.worldPosition.z));
    const feetBlock = p.world.getBlock(Math.floor(p.worldPosition.x), Math.floor(p.worldPosition.y - p.playerHeight + 0.1), Math.floor(p.worldPosition.z));

    const wasSwimming = p.isSwimming;
    
    // Check Water & Lava
    const headWater = headBlock === BLOCK.WATER;
    const feetWater = feetBlock === BLOCK.WATER;
    const headLava = headBlock === BLOCK.LAVA;
    const feetLava = feetBlock === BLOCK.LAVA;

    const inLava = headLava || feetLava;
    p.isUnderLava = headLava;
    p.isUnderwater = headWater || headLava;
    p.isSwimming = p.isUnderwater || feetWater || feetLava;

    if (inLava) {
      const now = performance.now();
      if (now - this.lastLavaDamageTime > 500) {
        p.takeDamage(4, undefined, false, "burnt to crisp");
        this.lastLavaDamageTime = now;
        
        // Spawn fire/smoke particles if available
        window.dispatchEvent(new CustomEvent('spawnParticles', { 
          detail: { pos: p.worldPosition.clone().addScalar(0.5), type: BLOCK.LAVA } 
        }));
      }
    }

    if (p.isSwimming && !wasSwimming) {
      audioManager.play('splash', 0.4, 0.8 + Math.random() * 0.4);
    }
    
    // Track highest Y for fall damage
    if (p.canJump || p.isFlying || p.isSwimming) {
      p.highestY = p.worldPosition.y;
    } else {
      p.highestY = Math.max(p.highestY, p.worldPosition.y);
    }

    p.velocity.x -= p.velocity.x * 10.0 * delta;
    p.velocity.z -= p.velocity.z * 10.0 * delta;
    
    const horizontalVelocity = Math.sqrt(p.velocity.x * p.velocity.x + p.velocity.z * p.velocity.z);
    const isMoving = horizontalVelocity > 0.1;

    const input = p.inputController; // Get input states
    
    if (p.isSwimming) {
      const drag = inLava ? 8.0 : 5.0; // Lava is thicker than water
      p.velocity.y -= p.velocity.y * drag * delta; 
      p.velocity.y -= p.gravity * 0.1 * delta; // Reduced gravity
      
      const vertDir = Number(input.moveUp) - Number(input.moveDown);
      if (input.moveUp || input.moveDown) {
        p.velocity.y += vertDir * p.speed * (inLava ? 0.3 : 0.5) * delta * 10.0;
      }
      
      // Play swim sound or sizzle
      if (isMoving && Math.sin(performance.now() * 0.01) > 0.9) {
        if (inLava) {
           audioManager.play('splash', 0.1, 0.5); // "sizzle" equivalent
        } else {
           audioManager.play('swim', 0.2, 0.8 + Math.random() * 0.4);
        }
      }
    } else if (!p.isFlying) {
      p.velocity.y -= p.gravity * delta;
    } else {
      p.velocity.y -= p.velocity.y * 10.0 * delta;
      const vertDir = Number(input.moveUp) - Number(input.moveDown);
      const currentSpeed = p.flySpeed;
      if (input.moveUp || input.moveDown) p.velocity.y += vertDir * currentSpeed * delta * 10.0;
    }

    p.direction.z = Number(input.moveForward) - Number(input.moveBackward);
    p.direction.x = Number(input.moveRight) - Number(input.moveLeft);
    p.direction.normalize();

    const currentSpeed = p.isFlying ? p.flySpeed : 
      (p.isSwimming ? (input.isSprinting ? p.sprintSpeed * (inLava ? 0.25 : 0.5) : p.speed * (inLava ? 0.25 : 0.5)) : 
      (input.isSprinting ? p.sprintSpeed : 
      ((input.isCrouching || input.isBlocking) ? p.crouchSpeed : p.speed)));

    if (input.moveForward || input.moveBackward) p.velocity.z -= p.direction.z * currentSpeed * delta * 10.0;
    if (input.moveLeft || input.moveRight) p.velocity.x += p.direction.x * currentSpeed * delta * 10.0;
    
    // Apply movement
    const currentPos = _currentPos.copy(p.worldPosition);
    
    // Extract pure yaw from camera rotation for movement
    const moveEuler = _moveEuler.set(0, p.cameraYaw, 0, 'YXZ');
    const moveVec = _moveVec.set(p.velocity.x * delta, 0, p.velocity.z * delta);
    moveVec.applyEuler(moveEuler);

    // Apply world-space knockback with smooth decay
    const kbDecay = 1.0 - Math.pow(0.01, delta); // Strong friction but smooth
    p.knockbackVelocity.x = THREE.MathUtils.lerp(p.knockbackVelocity.x, 0, kbDecay);
    p.knockbackVelocity.z = THREE.MathUtils.lerp(p.knockbackVelocity.z, 0, kbDecay);
    
    moveVec.x += p.knockbackVelocity.x * delta;
    moveVec.z += p.knockbackVelocity.z * delta;

    // X collision and shifting
    const nextPosX = _nextPosX.copy(currentPos);
    nextPosX.x += moveVec.x;
    
    // World boundary check (Invisible walls)
    const distSqX = nextPosX.x * nextPosX.x + nextPosX.z * nextPosX.z;
    const isInsideBoundaryX = distSqX < p.world.worldSize * p.world.worldSize;

    if (isInsideBoundaryX) {
      if (p.isFlying) {
        currentPos.x = nextPosX.x;
      } else {
        if (!this.checkCollision(nextPosX)) {
          // Shifting check: if crouching and on ground, don't fall off edges
          if (input.isCrouching && p.canJump) {
            if (this.isSupported(nextPosX)) {
              currentPos.x = nextPosX.x;
            } else {
              p.knockbackVelocity.x = 0;
            }
          } else {
            currentPos.x = nextPosX.x;
          }
        } else if (p.velocity.y <= 0) {
          // Auto-step up (for slabs/stairs)
          const stepUpPos = _stepUpPos.copy(nextPosX);
          stepUpPos.y += 0.6;
          if (!this.checkCollision(stepUpPos)) {
            currentPos.x = nextPosX.x;
            const oldY = currentPos.y;
            currentPos.y += 0.51;
            p.cameraYOffset -= (currentPos.y - oldY);
            p.velocity.y = 0;
          } else {
            // Try full block step
            stepUpPos.y += 0.5; // Up to 1.1 total checking
            if (!this.checkCollision(stepUpPos)) {
              currentPos.x = nextPosX.x;
              const oldY = currentPos.y;
              currentPos.y += 1.05;
              p.cameraYOffset -= (currentPos.y - oldY);
              p.velocity.y = 0;
            } else {
              p.knockbackVelocity.x = 0;
            }
          }
        } else {
          p.knockbackVelocity.x = 0;
        }
      }
    } else {
      p.knockbackVelocity.x = 0;
    }
    
    // Z collision and shifting
    const nextPosZ = _nextPosZ.copy(currentPos);
    nextPosZ.z += moveVec.z;
    
    const distSqZ = currentPos.x * currentPos.x + nextPosZ.z * nextPosZ.z;
    const isInsideBoundaryZ = distSqZ < p.world.worldSize * p.world.worldSize;

    if (isInsideBoundaryZ) {
      if (p.isFlying) {
        currentPos.z = nextPosZ.z;
      } else {
        if (!this.checkCollision(nextPosZ)) {
          if (input.isCrouching && p.canJump) {
            if (this.isSupported(nextPosZ)) {
              currentPos.z = nextPosZ.z;
            } else {
              p.knockbackVelocity.z = 0;
            }
          } else {
            currentPos.z = nextPosZ.z;
          }
        } else if (p.velocity.y <= 0) {
          // Auto-step up
          const stepUpPos = _stepUpPos.copy(nextPosZ);
          stepUpPos.y += 0.6;
          if (!this.checkCollision(stepUpPos)) {
            currentPos.z = nextPosZ.z;
            const oldY = currentPos.y;
            currentPos.y += 0.51;
            p.cameraYOffset -= (currentPos.y - oldY);
            p.velocity.y = 0;
          } else {
            // Try full block step
            stepUpPos.y += 0.5; // Up to 1.1 total checking
            if (!this.checkCollision(stepUpPos)) {
              currentPos.z = nextPosZ.z;
              const oldY = currentPos.y;
              currentPos.y += 1.05;
              p.cameraYOffset -= (currentPos.y - oldY);
              p.velocity.y = 0;
            } else {
              p.knockbackVelocity.z = 0;
            }
          }
        } else {
          p.knockbackVelocity.z = 0;
        }
      }
    } else {
      p.knockbackVelocity.z = 0;
    }

    // Y collision
    currentPos.y += p.velocity.y * delta;
    if (!p.isFlying && this.checkCollision(currentPos)) {
      if (p.velocity.y <= 0) { // Include 0 to prevent sinking while standing
        // Landing detection
        if (p.wasInAir && Math.abs(p.velocity.y) > 5) {
          p.landingTimer = 1.0;
          const blockBelow = p.world.getBlock(Math.floor(currentPos.x), Math.floor(currentPos.y - p.playerHeight - 0.1), Math.floor(currentPos.z));
          let surface = 'stone';
          if (blockBelow === BLOCK.GRASS || blockBelow === BLOCK.DIRT) surface = 'grass';
          else if (blockBelow === BLOCK.SAND) surface = 'sand';
          else if (blockBelow === BLOCK.WOOD || blockBelow === BLOCK.PLANKS) surface = 'wood';
          audioManager.playStep(surface);
        }
        
        // Fall damage calculation
        const fallDistance = p.highestY - currentPos.y;
        if (fallDistance > 3.5 && !p.isFlying && !p.isSwimming && !p.world.isHub) {
          const damage = Math.floor(fallDistance - 3);
          if (damage > 0) {
            p.takeDamage(damage * 5, undefined, false, "died of fall damage"); // 5 damage per block fallen (20 health max usually)
            useGameStore.getState().addMessage(`You took ${damage * 5} fall damage!`, "#FF5555");
          }
        }
        
        p.canJump = true;
        p.wasInAir = false;
        p.highestY = currentPos.y;
        // Snap to top of block: ensure we are ABOVE the block
        // Find exact top of the highest block we are standing on to prevent jitter
        // Check blocks beneath the player's bounding box
        let hitTop = Math.floor(currentPos.y - p.playerHeight) + 1;
        const minX = Math.floor(currentPos.x - p.playerRadius);
        const maxX = Math.floor(currentPos.x + p.playerRadius);
        const minZ = Math.floor(currentPos.z - p.playerRadius);
        const maxZ = Math.floor(currentPos.z + p.playerRadius);
        const yCheck = Math.floor(currentPos.y - p.playerHeight);
        
        let highestBlockTop = -Infinity;
        for (let x = minX; x <= maxX; x++) {
          for (let ySearch = yCheck - 1; ySearch <= yCheck + 1; ySearch++) {
            for (let z = minZ; z <= maxZ; z++) {
              const block = p.world.getBlock(x, ySearch, z);
              if (isSolidBlock(block)) {
                const blockTop = isSlab(block) ? ySearch + 0.5 : ySearch + 1.0;
                // Only consider blocks that our bottom intersected or hit
                if (blockTop > highestBlockTop && blockTop <= currentPos.y - p.playerHeight - (p.velocity.y * delta) + 0.1) {
                  highestBlockTop = blockTop;
                }
              }
            }
          }
        }
        
        if (highestBlockTop !== -Infinity) {
          hitTop = highestBlockTop;
        }

        currentPos.y = hitTop + p.playerHeight + 0.001;
      } else if (p.velocity.y > 0) {
        // Hit head: snap to bottom of the block
        currentPos.y = Math.floor(currentPos.y) - 0.001;
      }
      p.velocity.y = 0;
    } else if (!p.isFlying && !p.isSwimming) {
      // Check if we just barely stepped off before declaring false
      const checkPos = _checkPos.copy(currentPos);
      checkPos.y -= 0.1;
      if (!this.checkCollision(checkPos)) {
        p.canJump = false;
      }
      if (Math.abs(p.velocity.y) > 2) {
        p.wasInAir = true;
      }
    }

    // Prevent falling through world
    if (currentPos.y < -100) {
      if (p.world.isHub) {
        // Instant silent respawn for hub
        currentPos.set(0, 10, 0); 
        p.velocity.set(0, 0, 0);
        p.highestY = 10;
        p.wasInAir = false;
        p.health = 100;
        p.isDead = false;
        p.isDeadThisFrame = false;
      } else {
        p.takeDamage(99999, undefined, false, "fell into the void"); // Void damage
      }
    }

    if (p.isDeadThisFrame) {
      p.isDeadThisFrame = false;
      currentPos.copy(p.worldPosition); // (0, 10, 0)
      p.velocity.set(0, 0, 0);
      p.highestY = 10;
      p.wasInAir = false;
    }

    p.worldPosition.copy(currentPos);
    p.playerHeadPos.copy(currentPos);
  }
}
