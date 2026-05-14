import * as THREE from 'three';
import { Game } from './Game';
import { settingsManager } from './Settings';

export class InteractionSystem {
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
      this.game.camera.getWorldDirection(this._tempRaycastDir);
      const ray = this.game.world.raycast(this.game.player.playerHeadPos, this._tempRaycastDir, 5);
      const npcRay = this.game.entityManager.raycastNPC(this.game.player.playerHeadPos, this._tempRaycastDir, 5, this.game.camera);
      
      this.lastRaycast = { block: ray.hit ? ray : null, npc: npcRay };
    }
  }

  update() {
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
  }

  dispose() {
    if (this.selectionBox) {
      this.game.scene.remove(this.selectionBox);
      this.selectionBox.geometry.dispose();
      (this.selectionBox.material as THREE.Material).dispose();
      this.selectionBox = null;
    }
  }
}
