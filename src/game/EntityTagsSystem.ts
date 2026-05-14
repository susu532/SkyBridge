import * as THREE from 'three';
import { Game } from './Game';
import { settingsManager } from './Settings';

export class EntityTagsSystem {
  game: Game;
  private _cachedTags: any[] = [];
  private _lastTagsUpdate: number = 0;
  private _tempCameraDir = new THREE.Vector3();
  private _tagTempVec = new THREE.Vector3();
  private _tagToEntity = new THREE.Vector3();

  constructor(game: Game) {
    this.game = game;
  }

  getEntityTags() {
    const now = performance.now();
    const isPerformanceMode = settingsManager.getSettings().performanceMode;
    
    const throttleTime = isPerformanceMode ? 33 : 16;
    if (now - this._lastTagsUpdate < throttleTime) {
      return this._cachedTags;
    }
    
    this._lastTagsUpdate = now;

    const tags: any[] = [];
    const widthHalf = window.innerWidth / 2;
    const heightHalf = window.innerHeight / 2;
    this.game.camera.getWorldDirection(this._tempCameraDir);

    const projectEntity = (id: string, pos: THREE.Vector3, type: string, health: number, maxHealth: number, level: number, name?: string, isPassive: boolean = false, heightOffset?: number, team?: string) => {
      // Distance check
      const distSq = pos.distanceToSquared(this.game.camera.position);
      if (isNaN(distSq) || distSq > 2500) return; // 50 blocks for players

      this._tagTempVec.copy(pos);
      this._tagTempVec.y += heightOffset !== undefined ? heightOffset : ((type === 'Slime') ? 1.0 : 2.2);
      
      this._tagToEntity.subVectors(this._tagTempVec, this.game.camera.position).normalize();
      if (this._tempCameraDir.dot(this._tagToEntity) < 0) return;

      this._tagTempVec.project(this.game.camera);

      let x = (this._tagTempVec.x * widthHalf) + widthHalf;
      let y = -(this._tagTempVec.y * heightHalf) + heightHalf;
      
      // Guard against NaN/Infinity values which can crash CSS styles
      if (!isFinite(x) || !isFinite(y)) return;

      const distance = Math.sqrt(distSq);
      if (distance > 40) return;

      tags.push({ id, x, y, level, type, health, maxHealth, distance, name, isPassive, team });
    };

    this.game.entityManager.mobs.forEach((mob) => {
      projectEntity(mob.id, mob.position, mob.type, mob.health, mob.maxHealth, mob.level, undefined, mob.isPassive);
    });

    this.game.entityManager.remotePlayers.forEach((player) => {
      const combatLevel = player.skills?.Combat?.level || 1;
      const heightOffset = player.isCrouching ? 1.8 : 2.2;
      projectEntity(player.id, player.group.position, 'Player', player.health || 100, 100, combatLevel, player.name, true, heightOffset, player.team);
    });

    this._cachedTags = tags;
    return tags;
  }
}
