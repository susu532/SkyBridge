import { useGameStore } from '../store/gameStore';
import * as THREE from 'three';
import { Player } from './Player';
import { BLOCK, isPlant, ATLAS_TILES, isFlatItem, isSolidBlock } from './TextureAtlas';
import { ItemType } from './Inventory';
import { audioManager } from './AudioManager';
import { networkManager } from './NetworkManager';
import { skyBridgeManager, SkillType } from './SkyBridgeManager';
import { settingsManager } from './Settings';
import { ITEM_NAMES } from './Constants';

export class PlayerInputController {
  player: Player;
  
  moveForward = false;
  moveBackward = false;
  moveLeft = false;
  moveRight = false;
  moveUp = false;
  moveDown = false;
  isCrouching = false;
  isSprinting = false;
  isBlocking = false;
  
  constructor(player: Player) {
    this.player = player;
  }

  bindEvents() {
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mousedown', this.onMouseDown);
    document.addEventListener('mouseup', this.onMouseUp);
    document.addEventListener('mousemove', this.onMouseMove);
    
    // Add listeners to reset input when focus is lost or cursor is unlocked
    window.addEventListener('blur', this.resetInput);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);

    window.addEventListener('playerTakeDamage', this.onPlayerTakeDamage as EventListener);
  }

  onPointerLockChange = () => {
    if (document.pointerLockElement !== this.player.controls.domElement) {
      this.resetInput();
    }
  };

  onPlayerTakeDamage = (e: CustomEvent) => {
    this.player.takeDamage(e.detail.damage, e.detail.knockbackDir);
  };

  resetInput = () => {
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.moveUp = false;
    this.moveDown = false;
    this.isCrouching = false;
    this.isSprinting = false;
    this.player.isLeftMouseDown = false;
    this.player.isMining = false;
    this.player.velocity.set(0, this.player.velocity.y, 0); // Stop horizontal movement but keep falling
  };

  onKeyDown = (event: KeyboardEvent) => {
    if (!this.player.controls.isLocked) return;
    const { keybinds } = settingsManager.getSettings();
    
    switch (event.code) {
      case keybinds.forward: this.moveForward = true; break;
      case keybinds.left: this.moveLeft = true; break;
      case keybinds.backward: this.moveBackward = true; break;
      case keybinds.right: this.moveRight = true; break;
      case keybinds.sprint: this.isSprinting = true; break;
      case keybinds.drop: if (!this.player.world.isHub) this.dropItem(event.ctrlKey); break;
      case keybinds.zoom: this.player.isZooming = true; break;
      case keybinds.perspective: 
        this.player.perspective = (this.player.perspective + 1) % 3;
        break;
      case keybinds.slot1: if (!this.player.world.isHub) this.player.hotbarIndex = 0; break;
      case keybinds.slot2: if (!this.player.world.isHub) this.player.hotbarIndex = 1; break;
      case keybinds.slot3: if (!this.player.world.isHub) this.player.hotbarIndex = 2; break;
      case keybinds.slot4: if (!this.player.world.isHub) this.player.hotbarIndex = 3; break;
      case keybinds.slot5: if (!this.player.world.isHub) this.player.hotbarIndex = 4; break;
      case keybinds.slot6: if (!this.player.world.isHub) this.player.hotbarIndex = 5; break;
      case keybinds.slot7: if (!this.player.world.isHub) this.player.hotbarIndex = 6; break;
      case keybinds.slot8: if (!this.player.world.isHub) this.player.hotbarIndex = 7; break;
      case keybinds.slot9: if (!this.player.world.isHub) this.player.hotbarIndex = 8; break;
      case keybinds.fly: 
        this.player.isFlying = !this.player.isFlying;
        this.player.velocity.set(0, 0, 0);
        break;
      case keybinds.jump: 
        this.moveUp = true;
        if (!this.player.isFlying && !this.player.isSwimming && this.player.canJump) {
          this.player.velocity.y += this.player.jumpForce;
          
          if (this.isSprinting && (this.moveForward || this.moveBackward || this.moveLeft || this.moveRight)) {
            const sprintBoost = new THREE.Vector3(0, 0, -2.5);
            sprintBoost.applyEuler(new THREE.Euler(0, this.player.cameraYaw, 0, 'YXZ'));
            this.player.velocity.x += sprintBoost.x;
            this.player.velocity.z += sprintBoost.z;
          }
          
          this.player.canJump = false;
          const blockBelow = this.player.world.getBlock(Math.floor(this.player.worldPosition.x), Math.floor(this.player.worldPosition.y - this.player.playerHeight - 0.1), Math.floor(this.player.worldPosition.z));
          let surface = 'grass';
          if (blockBelow === BLOCK.STONE || blockBelow === BLOCK.BLUE_STONE || blockBelow === BLOCK.RED_STONE || blockBelow === BLOCK.BRICK) surface = 'stone';
          else if (blockBelow === BLOCK.SAND) surface = 'sand';
          else if (blockBelow === BLOCK.WOOD || blockBelow === BLOCK.PLANKS) surface = 'wood';
          audioManager.playStep(surface);
        }
        break;
      case keybinds.crouch:
        this.isCrouching = true;
        this.moveDown = true;
        break;
    }
  }

  onKeyUp = (event: KeyboardEvent) => {
    if (!this.player.controls.isLocked) return;
    const { keybinds } = settingsManager.getSettings();
    
    switch (event.code) {
      case keybinds.forward: this.moveForward = false; break;
      case keybinds.left: this.moveLeft = false; break;
      case keybinds.backward: this.moveBackward = false; break;
      case keybinds.right: this.moveRight = false; break;
      case keybinds.sprint: this.isSprinting = false; break;
      case keybinds.zoom: this.player.isZooming = false; break;
      case keybinds.jump: this.moveUp = false; break;
      case keybinds.crouch:
        this.isCrouching = false; 
        this.moveDown = false;
        break;
    }
  }

  onMouseMove = (event: MouseEvent) => {
    if (this.player.controls.isLocked) {
      this.player.mouseDeltaX = event.movementX;
      this.player.mouseDeltaY = event.movementY;
    }
  };

  dropItem(dropStack: boolean = false) {
    const stack = this.player.inventory.slots[this.player.hotbarIndex];
    if (stack && stack.count > 0) {
      const amount = dropStack ? stack.count : 1;
      const itemType = stack.type;
      this.player.inventory.removeItemFromSlot(this.player.hotbarIndex, amount);
      
      const direction = new THREE.Vector3();
      this.player.camera.getWorldDirection(direction);
      
      const forwardScale = Math.abs(direction.y) > 0.8 ? 0.8 : 0.5;
      const dropPos = this.player.playerHeadPos.clone().add(direction.clone().multiplyScalar(forwardScale));
      dropPos.y -= 0.3;
      
      const tossVelocity = direction.clone().multiplyScalar(5);
      tossVelocity.y += 2;
      
      for (let i = 0; i < amount; i++) {
        const finalVel = tossVelocity.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 1.5,
          (Math.random() - 0.5) * 1.5,
          (Math.random() - 0.5) * 1.5
        ));

        networkManager.dropItem(itemType, {
          x: dropPos.x + (Math.random() - 0.5) * 0.1,
          y: dropPos.y + (Math.random() - 0.5) * 0.1,
          z: dropPos.z + (Math.random() - 0.5) * 0.1
        }, {
          x: finalVel.x,
          y: finalVel.y,
          z: finalVel.z
        });
      }
    }
  }

  private calculateDamage() {
    const stats = skyBridgeManager.getEffectiveStats(this.player.inventory, this.player.hotbarIndex);
    
    const weaponDamage = stats.damage || 0;
    const baseDamage = 5 + weaponDamage;
    const strengthMultiplier = 1 + (stats.strength / 100);
    
    const isCrit = Math.random() < stats.critChance / 100;
    const critMultiplier = isCrit ? (1 + stats.critDamage / 100) : 1;
    
    const combatLevel = skyBridgeManager.skills[SkillType.COMBAT].level;
    const additiveMultiplier = 1 + (combatLevel * 0.04);
    
    const damage = Math.floor(baseDamage * strengthMultiplier * critMultiplier * additiveMultiplier);
    
    return { damage, isCrit };
  }

  onMouseDown = (event: MouseEvent) => {
    if (!this.player.controls.isLocked) return;

    this.player.isSwinging = true;
    this.player.swingTimer = 0;

    const direction = new THREE.Vector3();
    this.player.camera.getWorldDirection(direction);

    const rayOrigin = this.player.playerHeadPos.clone();

    if (event.button === 2) { // Right click
      const npc = this.player.entityManager.raycastNPC(rayOrigin, direction, 4, this.player.camera);
      if (npc) {
        if (npc.id === 'hub_npc_q') {
          if (networkManager.serverName.startsWith('hub')) {
            window.dispatchEvent(new CustomEvent('openServerJoin', { detail: { server: 'skybridge' } }));
          }
        } else if (npc.id === 'hub_npc_r') {
          if (networkManager.serverName.startsWith('hub')) {
            window.dispatchEvent(new CustomEvent('openServerJoin', { detail: { server: 'skycastles' } }));
          }
        } else if (npc.id === 'hub_npc_v') {
          if (networkManager.serverName.startsWith('hub')) {
            window.dispatchEvent(new CustomEvent('openServerJoin', { detail: { server: 'voidtrail' } }));
          }
        } else if (npc.id.startsWith('bren')) {
          window.dispatchEvent(new CustomEvent('openLaunchMenu'));
        } else {
          window.dispatchEvent(new CustomEvent('openShop', { detail: { npc } }));
        }
        return;
      }

      const minion = this.player.entityManager.raycastMinion(rayOrigin, direction, 4, this.player.camera);
      if (minion) {
        networkManager.collectMinion(minion.id);
        return;
      }

      const selectedStack = this.player.inventory.getStackInSlot(this.player.hotbarIndex);
      
      const isSword = selectedStack && selectedStack.type >= ItemType.WOODEN_SWORD && selectedStack.type <= ItemType.DIAMOND_SWORD;
      const isAOTE = selectedStack && selectedStack.type === ItemType.ASPECT_OF_THE_END;
      
      if (isSword && (!selectedStack.metadata?.ability) && !isAOTE) {
        this.player.isBlocking = true;
        return;
      }
      
      if (selectedStack?.metadata?.ability) {
        const ability = selectedStack.metadata.ability;
        const manaCost = ability.manaCost || 0;
        
        if (skyBridgeManager.useMana(manaCost)) {
          console.log(`Used ability: ${ability.name}`);
          window.dispatchEvent(new CustomEvent('spawnParticles', { 
            detail: { pos: this.player.playerHeadPos.clone().add(direction.multiplyScalar(2)), type: BLOCK.BLUE_STONE } 
          }));
          
          if (ability.name === "Instant Transmission") {
            const teleportDist = 8;
            const targetPos = this.player.worldPosition.clone().add(direction.multiplyScalar(teleportDist));
            
            if (this.player.world.getBlock(Math.floor(targetPos.x), Math.floor(targetPos.y), Math.floor(targetPos.z)) === 0) {
              this.player.worldPosition.copy(targetPos);
              audioManager.play('pop', 1.0, 0.5);
              this.player.velocity.add(direction.multiplyScalar(10));
            } else {
              useGameStore.getState().addMessage("There are blocks in the way!", "#FF5555");
            }
          } else if (ability.name === "Deep Strike") {
            this.player.velocity.add(direction.multiplyScalar(30));
            audioManager.play('explosion', 0.5, 1.5);
          } else if (ability.name === "Dragon's Breath") {
            audioManager.play('explosion', 0.8, 0.8);
            for(let i=0; i<5; i++) {
               window.dispatchEvent(new CustomEvent('spawnParticles', { 
                detail: { pos: this.player.playerHeadPos.clone().add(direction.multiplyScalar(3 + i)), type: BLOCK.RED_STONE } 
              }));
            }
          }
        } else {
          useGameStore.getState().addMessage("Not enough mana!", "#55FFFF");
        }
      }
    } else if (event.button === 0) { // Left click
      this.player.isLeftMouseDown = true;

      const player = this.player.entityManager.raycastPlayer(rayOrigin, direction, 4, this.player.camera);
      if (player) {
        const { damage, isCrit } = this.calculateDamage();
        
        const isCombative = event.button === 0 && !this.player.isMining;
        const kbForce = isCombative ? (this.isSprinting ? 12 : 8) : 0;
        const kbDir = direction.clone().setY(0).normalize().multiplyScalar(kbForce);
        
        networkManager.attack(player.id, false, kbDir, this.isSprinting);
        
        audioManager.play('hit', 0.5, 0.9 + Math.random() * 0.2);
        
        // Client-side prediction for instant hit feel
        player.takeDamage(kbDir);
        if (isCrit) {
          for(let i=0; i<3; i++) {
            window.dispatchEvent(new CustomEvent('spawnParticles', { 
              detail: { pos: player.group.position.clone().add(new THREE.Vector3(0, 0.5, 0)), type: 73 } 
            }));
          }
        }
        
        const pPos = player.group.position.clone().add(new THREE.Vector3(0, 1.5, 0));
        pPos.project(this.player.camera);
        const screenX = (pPos.x * 0.5 + 0.5) * window.innerWidth;
        const screenY = -(pPos.y * 0.5 - 0.5) * window.innerHeight;
        
        window.dispatchEvent(new CustomEvent('mobDamage', { detail: { amount: Math.floor(damage), isCrit, screenX, screenY } }));
        this.damageWeapon();
        return;
      }

      const mob = this.player.entityManager.raycastMob(rayOrigin, direction, 4, this.player.camera);
      if (mob) {
        const { damage, isCrit } = this.calculateDamage();
        
        const isCombative = true;
        const kbForce = this.isSprinting ? 12 : 8;
        const kbDir = direction.clone().setY(0).normalize().multiplyScalar(kbForce);
        networkManager.attack(mob.id, true, kbDir, this.isSprinting);
        // We now rely on the network to dictate our damage loop output (or we can predict it locally)
        // Predicting locally for immediate feedback, but the server has the real state:
        const lootType = mob.takeDamage(damage, kbDir); 
        audioManager.play('hit', 0.5, 0.9 + Math.random() * 0.2);
        this.damageWeapon();
        
        if (isCrit) {
          for(let i=0; i<3; i++) {
            window.dispatchEvent(new CustomEvent('spawnParticles', { 
              detail: { pos: mob.position.clone().add(new THREE.Vector3(0, 0.5, 0)), type: BLOCK.RED_STONE } 
            }));
          }
        }
        
        mob.knockback(direction.clone().setY(0).normalize(), kbForce);

        // Also note: we are just predicting the visual hit here.
        // Mobs update their actual death logic from the server loop via 'mobDespawned' and 'mobsUpdate' events.

        const pPos = mob.position.clone().add(new THREE.Vector3(0, 1.5, 0));
        pPos.project(this.player.camera);
        const screenX = (pPos.x * 0.5 + 0.5) * window.innerWidth;
        const screenY = -(pPos.y * 0.5 - 0.5) * window.innerHeight;

        window.dispatchEvent(new CustomEvent('mobDamage', { 
          detail: { amount: Math.floor(damage), isCrit, screenX, screenY } 
        }));

        if (lootType !== null) {
          const remaining = this.player.inventory.addItem(lootType, 1);
          
          if (remaining > 0) {
            networkManager.dropItem(lootType, {
              x: mob.position.x,
              y: mob.position.y + 0.5,
              z: mob.position.z
            });
            useGameStore.getState().addMessage("Inventory full! Mob loot was dropped.", "#FF5555");
          } else {
            useGameStore.getState().addMessage(`+1 ${ITEM_NAMES[lootType]} (Auto-pickup)`, "#55FF55");
          }

          this.player.entityManager.removeMob(mob.id);
        }
        return;
      }
    }
    
    const hitResult = this.player.world.raycast(rayOrigin, direction, 5);
    
    if (hitResult.hit && hitResult.blockPos && hitResult.prevPos) {
      if (event.button === 0) { // Left click: start mining
        const blockType = this.player.world.getBlock(hitResult.blockPos.x, hitResult.blockPos.y, hitResult.blockPos.z);
        if (blockType !== BLOCK.AIR && blockType !== BLOCK.WATER) {
          if (this.player.isFlying) {
            // Instant break for creative mode (flying)
            this.player.performBlockBreak(hitResult.blockPos, blockType);
            this.player.lastCreativeBreakTime = Date.now();
            return;
          }
          this.player.isMining = true;
          this.player.miningTarget = hitResult.blockPos.clone();
          this.player.miningProgress = 0;
          
          const activeTool = this.player.inventory.slots[this.player.hotbarIndex];
          const stats = this.player.getMiningStats(blockType, activeTool);
          this.player.miningTimeRequired = stats.time;
          this.player.canHarvestTarget = stats.drops;
          
          if (this.player.breakingMesh) {
            this.player.breakingMesh.visible = true;
            this.player.breakingMesh.position.set(
              this.player.miningTarget.x + 0.5,
              this.player.miningTarget.y + 0.5,
              this.player.miningTarget.z + 0.5
            );
            (this.player.breakingMesh.material as THREE.MeshBasicMaterial).opacity = 0;
          }
        }
      } else if (event.button === 2) { // Right click: place block
        const blockType = this.player.world.getBlock(hitResult.blockPos.x, hitResult.blockPos.y, hitResult.blockPos.z);
        
        const selectedStack = this.player.inventory.getStackInSlot(this.player.hotbarIndex);
        if (!selectedStack || selectedStack.count <= 0) return;

        let placeType = selectedStack.type as unknown as number;

        // Restriction for Torches and Plants: only place on top of solid blocks
        const isTorch = selectedStack.type === ItemType.TORCH;
        if (isTorch) {
          const dx = hitResult.prevPos.x - hitResult.blockPos.x;
          const dz = hitResult.prevPos.z - hitResult.blockPos.z;
          const dy = hitResult.prevPos.y - hitResult.blockPos.y;

          if (dy === 1) {
            // Placed on top
            placeType = ItemType.TORCH;
          } else if (dx === 1) {
            placeType = ItemType.TORCH_WALL_X_NEG; // Attached to +X block face, so torch is at +X relative to block, leaning -X
          } else if (dx === -1) {
            placeType = ItemType.TORCH_WALL_X_POS;
          } else if (dz === 1) {
            placeType = ItemType.TORCH_WALL_Z_NEG; // Attached to +Z block face
          } else if (dz === -1) {
            placeType = ItemType.TORCH_WALL_Z_POS;
          } else {
            return; // Can't place torch from bottom!
          }

          let supportBlock = BLOCK.AIR;
          if (placeType === ItemType.TORCH) supportBlock = this.player.world.getBlock(hitResult.prevPos.x, hitResult.prevPos.y - 1, hitResult.prevPos.z);
          else if (placeType === ItemType.TORCH_WALL_X_NEG) supportBlock = this.player.world.getBlock(hitResult.prevPos.x - 1, hitResult.prevPos.y, hitResult.prevPos.z);
          else if (placeType === ItemType.TORCH_WALL_X_POS) supportBlock = this.player.world.getBlock(hitResult.prevPos.x + 1, hitResult.prevPos.y, hitResult.prevPos.z);
          else if (placeType === ItemType.TORCH_WALL_Z_NEG) supportBlock = this.player.world.getBlock(hitResult.prevPos.x, hitResult.prevPos.y, hitResult.prevPos.z - 1);
          else if (placeType === ItemType.TORCH_WALL_Z_POS) supportBlock = this.player.world.getBlock(hitResult.prevPos.x, hitResult.prevPos.y, hitResult.prevPos.z + 1);

          if (!isSolidBlock(supportBlock)) {
            return;
          }
        }

        const px = Math.floor(this.player.worldPosition.x);
        const pyFeet = Math.floor(this.player.worldPosition.y - this.player.playerHeight + 0.1);
        const pz = Math.floor(this.player.worldPosition.z);
        const pyHead = Math.floor(this.player.worldPosition.y);
        
        if ((hitResult.prevPos.x === px && hitResult.prevPos.z === pz) && 
            (hitResult.prevPos.y === pyFeet || hitResult.prevPos.y === pyHead)) {
          return;
        }

        if (selectedStack.type === ItemType.MINION) {
          const minionId = 'minion_' + Math.random().toString(36).substring(7);
          const pos = new THREE.Vector3(hitResult.prevPos.x + 0.5, hitResult.prevPos.y, hitResult.prevPos.z + 0.5);
          this.player.entityManager.addMinion(minionId, ItemType.STONE, pos);
          this.player.inventory.removeItem(ItemType.MINION, 1);
          return;
        }

        const success = this.player.world.setBlock(hitResult.prevPos.x, hitResult.prevPos.y, hitResult.prevPos.z, placeType, true, this.player.isFlying);
        if (success) {
           this.player.inventory.removeItem(selectedStack.type, 1);
           audioManager.playPositional('place', new THREE.Vector3(hitResult.prevPos.x, hitResult.prevPos.y, hitResult.prevPos.z), 1.0, 0.9 + Math.random() * 0.2, 20);
           networkManager.setBlock(hitResult.prevPos.x, hitResult.prevPos.y, hitResult.prevPos.z, placeType, this.player.isFlying);
        }
      }
    }
  }

  damageWeapon() {
    const stack = this.player.inventory.slots[this.player.hotbarIndex];
    if (!stack || stack.count <= 0) return;
    const itemType = stack.type as unknown as number;
    const isTool = (itemType >= 436 && itemType <= 455) || (itemType >= 460 && itemType <= 472) || itemType === 54;
    
    if (isTool) {
      if (this.player.inventory.damageItem(this.player.hotbarIndex, 1)) {
        audioManager.play('pop', 0.5, 0.5);
      }
    }
  }

  onMouseUp = (event: MouseEvent) => {
    if (event.button === 0) {
      this.player.isLeftMouseDown = false;
      this.player.isMining = false;
      this.player.miningTarget = null;
      this.player.miningProgress = 0;
      if (this.player.breakingMesh) {
        this.player.breakingMesh.visible = false;
      }
    } else if (event.button === 2) {
      this.player.isBlocking = false;
    }
  }

  destroy() {
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('mousedown', this.onMouseDown);
    document.removeEventListener('mouseup', this.onMouseUp);
    document.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('blur', this.resetInput);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    window.removeEventListener('playerTakeDamage', this.onPlayerTakeDamage as EventListener);
  }
}

