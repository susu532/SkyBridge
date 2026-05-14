import * as THREE from "three";
import { Player } from "./Player";
import { BLOCK, isPlant, isFlatItem, isSolidBlock, isWater, getBlockUVs, ATLAS_TILES } from "./TextureAtlas";
import { ItemType, Inventory } from "./Inventory";
import { networkManager } from "./NetworkManager";
import { audioManager } from "./AudioManager";
import { getMiningStats } from "./MiningStats";
import { skyBridgeManager } from "./SkyBridgeManager";
import { settingsManager } from "./Settings";
import { Perspective } from "./Player";
import { useGameStore } from "../store/gameStore";
import { createItemModel } from "./ItemModels";

const _rayDir = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _offset = new THREE.Vector3();
const _smoothedPos = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _eyePos = new THREE.Vector3();
const _direction = new THREE.Vector3();
const _testPos = new THREE.Vector3();
const _tempEuler = new THREE.Euler();
const _tempVec2 = new THREE.Vector2();

export function updatePlayer(player: Player, delta: number) {
    player.inputController.update();

    if (player.rightClickTimer > 0) {
      player.rightClickTimer -= delta;
    }
    if (player.inputController.isRightMouseDown && player.rightClickTimer <= 0) {
      player.inputController.onMouseDown({ button: 2 } as MouseEvent);
      // Fast placement while held, typical MC speed 4-5 blocks/sec
      player.rightClickTimer = 0.2; 
    }

    const isLocked = player.controls.isLocked;

    if (player.isDead) {
      player.inputController.moveForward = false;
      player.inputController.moveBackward = false;
      player.inputController.moveLeft = false;
      player.inputController.moveRight = false;
      player.inputController.moveUp = false;
      player.inputController.moveDown = false;
      player.inputController.isSprinting = false;
    }

    // Apply rotation manually to support sensitivity and invert mouse
    // PointerLockControls is used for the lock state, but we handle rotation
    const isMobile = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (isLocked || isMobile) {
      const settings = settingsManager.getSettings();
      const factor = settings.sensitivity / 0.002; // Scale relative to default

      player.cameraYaw -= player.mouseDeltaX * 0.002 * factor;
      const invertFactor = settings.invertMouse ? -1 : 1;
      player.cameraPitch -= player.mouseDeltaY * 0.002 * factor * invertFactor;

      // Clamp pitch - look up/down limits
      const limitUp = Math.PI * 0.4; // ~72 degrees
      const limitDown = Math.PI * 0.48; // ~86 degrees
      player.cameraPitch = Math.max(
        -limitDown,
        Math.min(limitUp, player.cameraPitch),
      );
    }

    player.camera.quaternion.setFromEuler(
      _tempEuler.set(player.cameraPitch, player.cameraYaw, 0, "YXZ"),
    );

    // Check for picking up items
    const currentTime = Date.now();
    for (const item of player.entityManager.droppedItems.values()) {
      // Don't pick up items that were just dropped
      if (currentTime - item.createdAt < item.pickupDelay) continue;

      const dist = player.worldPosition.distanceTo(item.position);
      if (dist < 2.2) {
        // Optimistically remove visually
        networkManager.pickupItem(item.id);
        audioManager.play("pop", 0.4, 0.8 + Math.random() * 0.4);
        player.entityManager.removeDroppedItem(item.id);
      }
    }

    // Handle crouching height
    const targetHeight = player.inputController.isCrouching
      ? player.crouchHeight
      : player.standingHeight;
    player.playerHeight = targetHeight;

    // Handle Zoom
    const targetFov = player.isZooming ? 30 : player.baseFOV;
    if (player.camera.fov !== targetFov) {
      player.camera.fov = THREE.MathUtils.lerp(player.camera.fov, targetFov, 0.2);
      player.camera.updateProjectionMatrix();
    }

    // Handle Mining
    if (player.isLeftMouseDown && !player.isDead && !player.isSpectator) {
      if (!player.isMining && !player.isFlying) {
        // It should have been started by onMouseDown, if not, wait for another click.
        // In survival we don't auto-start mining immediately on drag unless we are still holding left click after a block breaks.
      }

      const direction = _rayDir;
      player.camera.getWorldDirection(direction);
      const rayOrigin = _rayOrigin.copy(player.playerHeadPos);
      const hitResult = player.world.raycast(rayOrigin, direction, 5);

      if (hitResult.hit && hitResult.blockPos) {
        const blockType = player.world.getBlock(
          hitResult.blockPos.x,
          hitResult.blockPos.y,
          hitResult.blockPos.z,
        );

        if (
          player.isFlying &&
          blockType !== BLOCK.AIR &&
          blockType !== BLOCK.WATER
        ) {
          // Instant creative break continuously on look
          const now = Date.now();
          if (now - player.lastCreativeBreakTime > 150) {
            // 150ms delay
            player.performBlockBreak(hitResult.blockPos, blockType);
            player.lastCreativeBreakTime = now;
            player.miningTarget = null;

            // Play arm swing animation for visual feedback on continuous breaks
            if (!player.isSwinging) {
              player.isSwinging = true;
              player.swingTimer = 0;
            }
          } else {
            // Still on cooldown, wait.
            player.miningTarget = hitResult.blockPos.clone();
          }
        } else if (!player.isFlying) {
          // Auto-start mining a new block if the target changed while we are holding the mouse down
          if (
            !player.miningTarget ||
            !hitResult.blockPos.equals(player.miningTarget)
          ) {
            if (blockType !== BLOCK.AIR && blockType !== BLOCK.WATER) {
              player.isMining = true;
              player.miningTarget = hitResult.blockPos.clone();
              player.miningProgress = 0;
              const activeTool = player.inventory.slots[player.hotbarIndex];
              const stats = getMiningStats(blockType, activeTool);
              player.miningTimeRequired = stats.time;
              player.canHarvestTarget = stats.drops;
              if (player.breakingMesh) {
                player.breakingMesh.visible = true;
                player.breakingMesh.position.set(
                  player.miningTarget.x + 0.5,
                  player.miningTarget.y + 0.5,
                  player.miningTarget.z + 0.5,
                );
                (
                  player.breakingMesh.material as THREE.MeshBasicMaterial
                ).opacity = 0;
              }
            } else {
              player.isMining = false;
              player.miningTarget = null;
              if (player.breakingMesh) player.breakingMesh.visible = false;
            }
          }
        }
      } else {
        player.isMining = false;
        player.miningTarget = null;
        if (player.breakingMesh) player.breakingMesh.visible = false;
      }
    }

    // Progress mining if it's active
    if (player.isMining && player.miningTarget) {
      if (
        !player.isFlying &&
        player.world.isIndestructible(
          player.miningTarget.x,
          player.miningTarget.y,
          player.miningTarget.z,
        )
      ) {
        player.isMining = false;
        player.miningTarget = null;
        if (player.breakingMesh) player.breakingMesh.visible = false;
      } else {
        const direction = _rayDir;
        player.camera.getWorldDirection(direction);
        const rayOrigin = _rayOrigin.copy(player.playerHeadPos);
        const hitResult = player.world.raycast(rayOrigin, direction, 5);

        if (
          hitResult.hit &&
          hitResult.blockPos &&
          hitResult.blockPos.equals(player.miningTarget)
        ) {
          let speedMultiplier = 1.0;

          // Apply SkyBridge Mining Speed
          const effectiveStats = skyBridgeManager.getEffectiveStats(
            player.inventory,
            player.hotbarIndex,
          );
          if (effectiveStats.miningSpeed > 0) {
            // Mining speed formula: base + speed/50
            speedMultiplier += effectiveStats.miningSpeed / 50;
          }

          // Air penalty
          if (!player.canJump && !player.isFlying) {
            speedMultiplier *= 0.2; // 5x slower in air
          }

          // Water penalty
          const headBlock = player.world.getBlock(
            Math.floor(player.worldPosition.x),
            Math.floor(player.worldPosition.y),
            Math.floor(player.worldPosition.z),
          );
          if (headBlock === BLOCK.WATER) {
            speedMultiplier *= 0.2; // 5x slower in water
          }

          if (player.isFlying) {
            player.miningProgress = 1.0;
          } else {
            player.miningProgress +=
              (delta * speedMultiplier) / player.miningTimeRequired;
          }

          // Play mining sound periodically
          if (
            !player.isFlying &&
            Math.floor(player.miningProgress * 5) >
              Math.floor(
                (player.miningProgress -
                  (delta * speedMultiplier) / player.miningTimeRequired) *
                  5,
              )
          ) {
            const blockType = player.world.getBlock(
              player.miningTarget.x,
              player.miningTarget.y,
              player.miningTarget.z,
            );
            let surface = "stone";
            if (blockType === BLOCK.GRASS || blockType === BLOCK.DIRT)
              surface = "grass";
            else if (blockType === BLOCK.SAND) surface = "sand";
            else if (blockType === BLOCK.WOOD || blockType === BLOCK.PLANKS)
              surface = "wood";

            audioManager.playPositional(
              "break",
              player.miningTarget.clone().addScalar(0.5),
              0.6,
              0.8 + Math.random() * 0.4,
              20,
            );
          }

          // Keep swinging while mining
          if (!player.isSwinging) {
            player.isSwinging = true;
            player.swingTimer = 0;
          }

          if (player.breakingMesh) {
            player.breakingMesh.visible = true;
            player.breakingMesh.position.set(
              player.miningTarget.x + 0.5,
              player.miningTarget.y + 0.5,
              player.miningTarget.z + 0.5,
            );
            // Increase opacity based on progress
            (player.breakingMesh.material as THREE.MeshBasicMaterial).opacity =
              player.miningProgress * 0.9;
          }

          if (player.miningProgress >= 1.0) {
            // Break block
            const blockType = player.world.getBlock(
              player.miningTarget.x,
              player.miningTarget.y,
              player.miningTarget.z,
            );
            if (blockType !== BLOCK.AIR) {
              player.performBlockBreak(player.miningTarget, blockType);
            }
            player.isMining = false;
            player.miningTarget = null;
            player.miningProgress = 0;
            if (player.breakingMesh) player.breakingMesh.visible = false;
          }
        } else {
          // Looked away
          player.isMining = false;
          player.miningTarget = null;
          player.miningProgress = 0;
          if (player.breakingMesh) player.breakingMesh.visible = false;
        }
      }
    }

    player.physics.applyGravityAndCollision(delta);

    const input = player.inputController;
    _tempVec2.set(player.velocity.x, player.velocity.z);
    const horizontalVelocity = _tempVec2.length();
    const isMoving = horizontalVelocity > 0.1;

    // Smooth camera height for crouching
    player.targetCameraHeight = input.isCrouching
      ? player.crouchHeight
      : player.standingHeight;
    player.currentCameraHeight = THREE.MathUtils.lerp(
      player.currentCameraHeight,
      player.targetCameraHeight,
      0.15,
    );

    // Smooth FOV for sprinting/zooming
    let desiredFOV = player.baseFOV;
    if (player.isZooming) desiredFOV = 30;
    else if (input.isSprinting && isMoving) desiredFOV = player.baseFOV + 10;

    // Dynamic FOV when falling at high speeds
    if (!player.canJump && player.velocity.y < -15) {
      const fallSpeed = Math.abs(player.velocity.y);
      const fovIncrease = Math.min((fallSpeed - 15) * 0.5, 30); // Max +30 FOV
      desiredFOV += fovIncrease;
    }

    player.targetFOV = THREE.MathUtils.lerp(player.targetFOV, desiredFOV, 0.1);
    if (Math.abs(player.camera.fov - player.targetFOV) > 0.1) {
      player.camera.fov = player.targetFOV;
      player.camera.updateProjectionMatrix();
    }

    // Update first person held item
    if (player.fpBlockMesh && player.fpArmMesh && player.fpHeldItemModel) {
      const selectedStack = player.inventory.getStackInSlot(player.hotbarIndex);
      if (
        selectedStack &&
        selectedStack.count > 0 &&
        selectedStack.type !== ItemType.AIR
      ) {
        const itemTypeNum = selectedStack.type as unknown as number;

        // Update 3rd person and 1st person renderer
        const offHandItem =
          player.inventory.slots[Inventory.OFF_HAND_SLOT]?.type || 0;
        player.renderer.setHeldItem(itemTypeNum, offHandItem);

        const isMinion = selectedStack.type === ItemType.MINION;
        const isTorch = itemTypeNum === ItemType.TORCH;
        const isSelectedPlant = isPlant(itemTypeNum);
        const isFlat = isFlatItem(itemTypeNum);
        const isTool =
          (itemTypeNum >= 436 && itemTypeNum <= 455) ||
          (itemTypeNum >= 460 && itemTypeNum <= 472) ||
          itemTypeNum === 54;
        const isFood = itemTypeNum >= 456 && itemTypeNum <= 459;
        const isMaterial =
          itemTypeNum === 13 ||
          (itemTypeNum >= 500 && itemTypeNum <= 509) ||
          itemTypeNum === 29 ||
          itemTypeNum === 303 ||
          itemTypeNum === 300 ||
          itemTypeNum === 319 ||
          itemTypeNum === 321 ||
          itemTypeNum === 43 ||
          itemTypeNum === 44 ||
          isTorch;
        const use3DModel = isTool || isFood || isMaterial;

        if (use3DModel) {
          player.fpBlockMesh.visible = false;
          player.fpHeldItemModel.visible = true;
          player.fpArmMesh.visible = false; // Hide hand when holding item

          if (player.currentModelType !== selectedStack.type) {
            player.fpHeldItemModel.clear();
            const model = createItemModel(selectedStack.type);
            player.fpHeldItemModel.add(model);
            player.currentModelType = selectedStack.type;

            // Positioning override based on type
            if (isFood) {
              player.fpHeldItemModel.position.set(0.4, -0.4, -0.7);
              player.fpHeldItemModel.rotation.set(-0.2, -Math.PI / 4, 0.4);
              player.fpHeldItemModel.scale.set(0.8, 0.8, 0.8);
            } else if (isTorch) {
              player.fpHeldItemModel.position.set(0.55, -0.5, -0.7);
              player.fpHeldItemModel.rotation.set(0, -Math.PI / 8, 0);
              player.fpHeldItemModel.scale.set(1.2, 1.2, 1.2);
            } else if (isMaterial && !isTool) {
              // Ingots, gems, sticks
              player.fpHeldItemModel.position.set(0.5, -0.45, -0.7);
              player.fpHeldItemModel.rotation.set(-0.3, -Math.PI / 4, 0.6);
              player.fpHeldItemModel.scale.set(0.9, 0.9, 0.9);
            } else {
              // Standard tool position
              player.fpHeldItemModel.position.set(0.55, -0.4, -0.75);
              player.fpHeldItemModel.rotation.set(-0.35, -Math.PI / 3.5, 0.5);
              player.fpHeldItemModel.scale.set(1.1, 1.1, 1.1);
            }
          }
        } else {
          player.fpBlockMesh.visible = true;
          player.fpHeldItemModel.visible = false;
          player.currentModelType = null;
          player.fpArmMesh.visible = false; // Hide hand when holding block/sprite

          // Position block at the end of the hand
          player.fpBlockMesh.position.set(0.6, -0.5, -0.7);

          if (isMinion) {
            // Special look for minion in hand
            player.fpBlockMesh.scale.set(0.5, 0.8, 0.3);
            player.fpBlockMesh.rotation.set(0, 0, 0);
            const mat = player.fpBlockMesh.material as any;
            if (mat && mat.color) {
              mat.color.setHex(0xffff55);
            }
            if (mat) mat.map = null;
          } else if (isSelectedPlant || isFlat) {
            if (isFlat) {
              player.fpBlockMesh.scale.set(1.3, 1.3, 0.02);
              player.fpBlockMesh.position.set(0.5, -0.3, -0.6);
              // Tilt for a tool-holding perspective (Diagonal hold)
              player.fpBlockMesh.rotation.set(-0.5, 0.5, 0.5);
            } else {
              player.fpBlockMesh.scale.set(1, 1, 0.01);
              player.fpBlockMesh.position.set(0.6, -0.5, -0.7);
              player.fpBlockMesh.rotation.set(0, 0, 0);
            }
            const mat = player.fpBlockMesh.material as any;
            if (mat && mat.color) {
              mat.color.setHex(0xffffff);
            }
            if (mat) {
              mat.map = player.world.opaqueMaterial.map;
              mat.side = THREE.DoubleSide;
            }

            // Update UVs for the front face only (all faces same for simplicity)
            const uvs = player.fpBlockMesh.geometry.attributes.uv;
            const blockUVs = getBlockUVs(itemTypeNum);
            if (blockUVs) {
              const [x, y] = blockUVs[4]; // Front face
              const u1 = x / ATLAS_TILES;
              const v1 = 1.0 - (y + 1) / ATLAS_TILES;
              const u2 = (x + 1) / ATLAS_TILES;
              const v2 = 1.0 - y / ATLAS_TILES;

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
            player.fpBlockMesh.scale.set(1, 1, 1);
            player.fpBlockMesh.position.set(0.6, -0.5, -0.7);
            player.fpBlockMesh.rotation.set(0, 0, 0);
            const mat = player.fpBlockMesh.material as any;
            if (mat && mat.color) {
              mat.color.setHex(0xffffff);
            }
            if (mat) {
              mat.map = player.world.opaqueMaterial.map;
              mat.side = THREE.FrontSide;
            }

            // Update UVs for the block
            const uvs = player.fpBlockMesh.geometry.attributes.uv;
            const blockUVs = getBlockUVs(
              selectedStack.type as unknown as number,
            );
            if (blockUVs) {
              for (let i = 0; i < 6; i++) {
                const [x, y] = blockUVs[i];
                const u1 = x / ATLAS_TILES;
                const v1 = 1.0 - (y + 1) / ATLAS_TILES;
                const u2 = (x + 1) / ATLAS_TILES;
                const v2 = 1.0 - y / ATLAS_TILES;

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
        player.fpBlockMesh.visible = false;
        player.fpHeldItemModel.visible = false;
        player.fpArmMesh.visible = true;
        player.currentModelType = null;

        // Update 3rd person and 1st person renderer
        const offHandItem =
          player.inventory.slots[Inventory.OFF_HAND_SLOT]?.type || 0;
        player.renderer.setHeldItem(0, offHandItem);
      }
    }

    // Animate character model
    player.renderer.animate(delta);
    player.renderer.update(delta, player.isGliding);

    // Smooth camera step offsets
    if (player.cameraYOffset < 0) {
      player.cameraYOffset = THREE.MathUtils.lerp(
        player.cameraYOffset,
        0,
        delta * 15,
      );
      if (Math.abs(player.cameraYOffset) < 0.01) player.cameraYOffset = 0;
    }

    // Update camera and model based on perspective
    player.modelGroup.rotation.y = player.cameraYaw;

    // Smooth model position using cameraYOffset to prevent snapping on steps
    const smoothedModelY =
      player.worldPosition.y - player.playerHeight + player.cameraYOffset;
    player.modelGroup.position.set(
      player.worldPosition.x,
      smoothedModelY,
      player.worldPosition.z,
    );

    if (player.perspective !== Perspective.FIRST_PERSON) {
      player.modelGroup.visible = true;
      player.fpArmGroup.visible = false;
      player.fpOffHandArmGroup.visible = false;

      // Position camera based on perspective
      const offset = _offset.set(0, 0, 0);
      if (player.perspective === Perspective.THIRD_PERSON_BACK) {
        offset.set(0, 0.5, 4);
      } else {
        // Front view
        offset.set(0, 0.5, -4);
      }

      offset.applyQuaternion(player.camera.quaternion);
      _smoothedPos.copy(player.worldPosition);
      _smoothedPos.y += player.cameraYOffset;

      _targetPos.copy(_smoothedPos).add(offset);

      // Calculate raycast to prevent clipping through blocks
      _eyePos.copy(_smoothedPos);
      _eyePos.y += player.standingHeight - 0.2; // roughly eye level

      _direction.copy(_targetPos).sub(_eyePos);
      const dist = _direction.length();

      if (dist > 0.001) {
        _direction.normalize();

        let currentDist = 0;
        const step = 0.2;
        let hitDist = dist;

        while (currentDist < dist) {
          _testPos.copy(_eyePos).addScaledVector(_direction, currentDist);
          const b = player.world.getBlock(
            Math.floor(_testPos.x),
            Math.floor(_testPos.y),
            Math.floor(_testPos.z),
          );
          if (b !== 0 && isSolidBlock(b) && !isWater(b)) {
            hitDist = Math.max(0, currentDist - 0.3); // stay slightly away from the wall
            break;
          }
          currentDist += step;
        }

        player.camera.position
          .copy(_eyePos)
          .add(_direction.multiplyScalar(hitDist));
      } else {
        player.camera.position.copy(_eyePos);
      }

      if (player.perspective === Perspective.THIRD_PERSON_FRONT) {
        // Look back at the player
        // We need to calculate the lookAt point based on player position
        _testPos.copy(_smoothedPos);
        _testPos.y -= 0.5; // Look at chest level
        player.camera.lookAt(_testPos);
      }
    } else {
      player.modelGroup.visible = false;
      player.fpArmGroup.visible = player.renderer.isHandVisible;
      player.fpOffHandArmGroup.visible = player.renderer.isHandVisible;

      // Apply smooth camera height (halved bobbing for less motion sickness)
      const bobY =
        isMoving && player.canJump ? Math.sin(player.walkCycle * 2) * 0.001 : 0;
      const bobX =
        isMoving && player.canJump ? Math.cos(player.walkCycle) * 0.001 : 0;

      player.camera.position.set(
        player.worldPosition.x + bobX,
        player.worldPosition.y -
          (player.standingHeight - player.currentCameraHeight) +
          bobY +
          player.cameraYOffset,
        player.worldPosition.z,
      );

      // Hand Inertia / Sway (More pronounced for "refined" feel)
      player.lookSwayX = THREE.MathUtils.lerp(
        player.lookSwayX,
        player.mouseDeltaX * 0.0015,
        0.15,
      );
      player.lookSwayY = THREE.MathUtils.lerp(
        player.lookSwayY,
        player.mouseDeltaY * 0.0015,
        0.15,
      );

      // Calculate target swing values
      let swingRotX = 0,
        swingRotY = 0,
        swingRotZ = 0;
      let swingPosX = 0,
        swingPosY = 0,
        swingPosZ = 0;

      if (player.isSwinging) {
        // Minecraft-like snappy swing
        const t = player.swingTimer / Math.PI;
        // Faster "flick"
        const swingProgress = Math.sin(Math.sqrt(t) * Math.PI);

        swingRotX = -swingProgress * 0.5;
        swingRotY = swingProgress * 0.3;
        swingRotZ = swingProgress * 0.3;
        swingPosX = -swingProgress * 0.2;
        swingPosY = -swingProgress * 0.1;
        swingPosZ = swingProgress * 0.1;
      }

      if (player.inputController.isBlocking && player.renderer.fpHeldItemModel) {
        // Overlay block animation
        swingRotY -= 0.6;
        swingRotZ -= 0.3;
        swingPosX -= 0.15;
      }

      // Idle breathing and walk bobbing (more natural movement)
      const idleBobY = Math.sin(performance.now() * 0.002) * 0.01;
      const walkBobX = isMoving ? Math.cos(player.walkCycle) * 0.04 : 0;
      const walkBobY = isMoving ? Math.sin(player.walkCycle * 2) * 0.04 : 0;

      // Apply rotations
      player.fpArmGroup.rotation.x = THREE.MathUtils.lerp(
        player.fpArmGroup.rotation.x,
        swingRotX,
        0.25,
      );
      player.fpArmGroup.rotation.y = THREE.MathUtils.lerp(
        player.fpArmGroup.rotation.y,
        swingRotY + player.lookSwayX * 0.8,
        0.25,
      );
      player.fpArmGroup.rotation.z = THREE.MathUtils.lerp(
        player.fpArmGroup.rotation.z,
        swingRotZ + player.lookSwayX * 0.3,
        0.25,
      );

      // Apply positions (including sway and bob)
      player.fpArmGroup.position.x = THREE.MathUtils.lerp(
        player.fpArmGroup.position.x,
        swingPosX - player.lookSwayX * 2.0 + walkBobX,
        0.2,
      );
      player.fpArmGroup.position.y = THREE.MathUtils.lerp(
        player.fpArmGroup.position.y,
        swingPosY + player.lookSwayY * 1.5 + walkBobY + idleBobY,
        0.2,
      );
      player.fpArmGroup.position.z = THREE.MathUtils.lerp(
        player.fpArmGroup.position.z,
        swingPosZ,
        0.2,
      );

      if (player.renderer.fpOffHandArmGroup) {
        const offHand = player.renderer.fpOffHandArmGroup;
        offHand.rotation.x = THREE.MathUtils.lerp(
          offHand.rotation.x,
          -0.1,
          0.25,
        );
        offHand.rotation.y = THREE.MathUtils.lerp(
          offHand.rotation.y,
          player.lookSwayX * 0.8,
          0.25,
        );
        offHand.rotation.z = THREE.MathUtils.lerp(
          offHand.rotation.z,
          player.lookSwayX * 0.3,
          0.25,
        );

        offHand.position.x = THREE.MathUtils.lerp(
          offHand.position.x,
          -0.6 - player.lookSwayX * 2.0 - walkBobX,
          0.2,
        );
        offHand.position.y = THREE.MathUtils.lerp(
          offHand.position.y,
          -0.6 + player.lookSwayY * 1.5 + walkBobY + idleBobY,
          0.2,
        );
        offHand.position.z = THREE.MathUtils.lerp(
          offHand.position.z,
          -0.5,
          0.2,
        );
      }
    }

    // Reset mouse delta
    player.mouseDeltaX = 0;
    player.mouseDeltaY = 0;

    // Sync to network (Adaptive frequency)
    const now = performance.now();
    const syncInterval = 50; // Always sync at 20Hz for server scalability

    const currentState = {
      isFlying: player.isFlying,
      isSwimming: player.isSwimming,
      isCrouching: player.inputController.isCrouching,
      isSprinting: player.inputController.isSprinting,
      isSwinging: player.isSwinging,
      isGliding: player.isGliding,
      isBlocking: player.inputController.isBlocking,
      swingSpeed: player.swingSpeed,
      isGrounded: player.canJump,
      heldItem: player.inventory.slots[player.hotbarIndex]?.type || 0,
      offHandItem: player.inventory.slots[Inventory.OFF_HAND_SLOT]?.type || 0,
      defense: skyBridgeManager.effectiveStats.defense || 0,
      maxHealth: skyBridgeManager.effectiveStats.maxHealth || 100,
    };

    const stateHash = JSON.stringify(currentState);
    if (player.lastStateHash !== stateHash) {
      networkManager.updateState(currentState);
      player.lastStateHash = stateHash;
    }

    if (now - player.lastNetworkSyncTime > syncInterval) {
      player.syncEuler.set(player.cameraPitch, player.cameraYaw, 0, "YXZ");
      player.syncPos.set(
        player.worldPosition.x,
        player.worldPosition.y - player.playerHeight,
        player.worldPosition.z,
      );

      const dx = player.syncPos.x - (player.lastSyncPos?.x || 0);
      const dy = player.syncPos.y - (player.lastSyncPos?.y || 0);
      const dz = player.syncPos.z - (player.lastSyncPos?.z || 0);
      const distSq = dx * dx + dy * dy + dz * dz;
      const rotDiff =
        Math.abs(player.syncEuler.x - (player.lastSyncEuler?.x || 0)) +
        Math.abs(player.syncEuler.y - (player.lastSyncEuler?.y || 0));

      if (distSq > 0.0001 || rotDiff > 0.01) {
        networkManager.move(player.syncPos, player.syncEuler);
        player.lastNetworkSyncTime = now;

        if (!player.lastSyncPos) player.lastSyncPos = new THREE.Vector3();
        if (!player.lastSyncEuler) player.lastSyncEuler = new THREE.Euler();
        player.lastSyncPos.copy(player.syncPos);
        player.lastSyncEuler.copy(player.syncEuler);
      }
    }
}
