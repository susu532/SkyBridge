import * as THREE from 'three';
import { Game } from './Game';
import { settingsManager } from './Settings';
import { ItemType } from './Inventory';
import { Perspective } from './Player';

import { ISystem } from './ISystem';

export class InteractionSystem implements ISystem {
  game: Game;
  selectionBox: THREE.LineSegments | null = null;
  lastRaycast: any = null;
  private _lastRaycastTime: number = 0;
  private _tempRaycastDir = new THREE.Vector3();

  constructor(game: Game) {
    this.game = game;

    // Selection box
    const boxGeo = new THREE.BoxGeometry(1.01, 1.01, 1.01);
    const edges = new THREE.EdgesGeometry(boxGeo);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    this.selectionBox = new THREE.LineSegments(edges, lineMat);
    this.game.scene.add(this.selectionBox);
  }

  updateRaycast(force = false) {
    const now = performance.now();
    if (force || now - this._lastRaycastTime > 66) { // roughly 15fps
      this._lastRaycastTime = now;
      this._tempRaycastDir.set(
        -Math.sin(this.game.player.cameraYaw) * Math.cos(this.game.player.cameraPitch),
        Math.sin(this.game.player.cameraPitch),
        -Math.cos(this.game.player.cameraYaw) * Math.cos(this.game.player.cameraPitch)
      ).normalize();
      const ray = this.game.world.raycast(this.game.player.playerHeadPos, this._tempRaycastDir, 5);
      const npcRay = this.game.entityManager.raycastNPC(this.game.player.playerHeadPos, this._tempRaycastDir, 5, this.game.camera);
      
      this.lastRaycast = { block: ray.hit ? ray : null, npc: npcRay };
    }
  }

  update(delta: number) {
    this.updateRaycast();

    const ray = this.lastRaycast?.block || { hit: false };

    if (ray.hit && this.selectionBox) {
      this.selectionBox.visible = true;
      this.selectionBox.position.set(
        ray.blockPos!.x + 0.5,
        ray.blockPos!.y + 0.5,
        ray.blockPos!.z + 0.5
      );
      // Subtle pulse effect
      const isPerformanceMode = settingsManager.getSettings().performanceMode;
      const pulse = isPerformanceMode ? 1.0 : 1.0 + Math.sin(this.game.clock.getElapsedTime() * 10) * 0.01;
      this.selectionBox.scale.set(pulse, pulse, pulse);
    } else if (this.selectionBox) {
      this.selectionBox.visible = false;
    }

    // Check for fluid chocolate hose emission
    const equippedItem = this.game.player.inventory.slots[this.game.player.hotbarIndex];
    if (equippedItem?.type === ItemType.FLUID_CHOCOLATE_HOSE) {
      if (this.game.player.inputController.isRightMouseDown || this.game.player.isLeftMouseDown) {
        if (this.game.chocolateFluidSystem) {
          const isSpray = this.game.player.inputController.isRightMouseDown;
          let origin: THREE.Vector3;
          let camDir = new THREE.Vector3(0, 0, -1).transformDirection(this.game.camera.matrixWorld);
          let emitDir = camDir.clone();
          
          if (this.game.player.perspective === Perspective.FIRST_PERSON) {
            origin = new THREE.Vector3();
            if (this.game.player.renderer.fpHeldItemModel && this.game.player.renderer.fpHeldItemModel.visible) {
              const nozzle = this.game.player.renderer.fpHeldItemModel.getObjectByName('hose_nozzle');
              this.game.player.renderer.fpHeldItemModel.updateMatrixWorld(true);
              if (nozzle) {
                origin.set(0, 0.1, 0); // Tip of the nozzle (height/2)
                nozzle.localToWorld(origin);
              } else {
                const localOffset = new THREE.Vector3(0, 0.7, 0); 
                origin.copy(localOffset);
                this.game.player.renderer.fpHeldItemModel.localToWorld(origin);
              }
              
              const targetPoint = this.game.camera.position.clone().add(camDir.clone().multiplyScalar(20));
              emitDir.copy(targetPoint).sub(origin).normalize();
            } else {
              origin = new THREE.Vector3(0.55, -0.35, -1.0);
              origin.applyMatrix4(this.game.camera.matrixWorld);
            }
            
            // Move origin forward significantly in first person to avoid clipping or being too close to eyes
            origin.add(camDir.clone().multiplyScalar(0.7));
          } else {
            origin = new THREE.Vector3();
            if (this.game.player.renderer.heldItemModel && this.game.player.renderer.heldItemModel.visible) {
              const nozzle = this.game.player.renderer.heldItemModel.getObjectByName('hose_nozzle');
              this.game.player.renderer.heldItemModel.updateMatrixWorld(true);
              if (nozzle) {
                origin.set(0, 0.1, 0); // Tip of the nozzle
                nozzle.localToWorld(origin);
              } else {
                const localOffset = new THREE.Vector3(0, 0.7, 0); // Nozzle tip
                origin.copy(localOffset);
                this.game.player.renderer.heldItemModel.localToWorld(origin);
              }
              
              const targetPoint = this.game.camera.position.clone().add(camDir.clone().multiplyScalar(20));
              emitDir.copy(targetPoint).sub(origin).normalize();
            } else {
              origin = this.game.player.worldPosition.clone().add(new THREE.Vector3(0, 1.1, 0));
              origin.add(camDir.clone().multiplyScalar(0.7));
              const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.game.player.modelGroup.quaternion);
              origin.add(right.multiplyScalar(0.4));
            }
          }
          
          this.game.chocolateFluidSystem.emit(origin, emitDir, isSpray);
        }
      }
    }
  }

  destroy() {
    if (this.selectionBox) {
      this.game.scene.remove(this.selectionBox);
      this.selectionBox.geometry.dispose();
      (this.selectionBox.material as THREE.Material).dispose();
      this.selectionBox = null;
    }
  }
}
