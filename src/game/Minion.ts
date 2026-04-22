
import * as THREE from 'three';
import { ItemType } from './Inventory';
import { networkManager } from './NetworkManager';
import { settingsManager } from './Settings';

export class Minion {
  id: string;
  type: ItemType;
  position: THREE.Vector3;
  mesh: THREE.Group;
  lastActionTime: number = 0;
  actionInterval: number = 10000; // 10 seconds
  storage: number = 0;
  maxStorage: number = 64;

  constructor(id: string, type: ItemType, position: THREE.Vector3) {
    this.id = id;
    this.type = type;
    this.position = position.clone();
    this.mesh = this.createMesh();
    this.mesh.position.copy(this.position);
    this.mesh.userData = { isMinion: true, minionId: id };
  }

  getHitbox(): THREE.Box3 {
    const width = 0.8;
    const pos = this.mesh.position;
    
    const min = new THREE.Vector3(
      pos.x - width / 2,
      pos.y - 0.5,
      pos.z - width / 2
    );
    const max = new THREE.Vector3(
      pos.x + width / 2,
      pos.y + 0.5,
      pos.z + width / 2
    );
    
    return new THREE.Box3(min, max);
  }

  private createMesh(): THREE.Group {
    const group = new THREE.Group();
    
    // Base/Platform
    const baseGeo = new THREE.BoxGeometry(0.8, 0.1, 0.8);
    const baseMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = -0.45;
    group.add(base);

    // Body (Small armor stand like)
    const bodyGeo = new THREE.BoxGeometry(0.3, 0.5, 0.15);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = -0.15;
    group.add(body);

    // Head
    const headGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const headMat = new THREE.MeshLambertMaterial({ color: 0xAAAAAA });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.25;
    group.add(head);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.1, 0.3, 0.1);
    const armMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
    
    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-0.2, -0.15, 0);
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(0.2, -0.15, 0.1);
    rightArm.rotation.x = -Math.PI / 4;
    group.add(rightArm);

    // Item they are "holding"
    const itemGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const itemMat = new THREE.MeshLambertMaterial({ color: 0x888888 }); // Stone
    const item = new THREE.Mesh(itemGeo, itemMat);
    item.position.set(0.2, -0.25, 0.25);
    group.add(item);

    // Name tag placeholder
    const tagGeo = new THREE.BoxGeometry(0.6, 0.15, 0.01);
    const tagMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });
    const tag = new THREE.Mesh(tagGeo, tagMat);
    tag.position.y = 0.6;
    group.add(tag);

    // Storage Bar Background
    const barBgGeo = new THREE.BoxGeometry(0.5, 0.05, 0.01);
    const barBgMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const barBg = new THREE.Mesh(barBgGeo, barBgMat);
    barBg.position.y = 0.8;
    group.add(barBg);

    // Storage Bar Foreground
    const barGeo = new THREE.BoxGeometry(0.5, 0.05, 0.02);
    const barMat = new THREE.MeshBasicMaterial({ color: 0x55FF55 });
    const bar = new THREE.Mesh(barGeo, barMat);
    bar.position.y = 0.8;
    bar.name = 'storageBar';
    group.add(bar);

    // Full Tag
    const fullTagGeo = new THREE.BoxGeometry(0.4, 0.15, 0.01);
    const fullTagMat = new THREE.MeshBasicMaterial({ color: 0xFF5555 });
    const fullTag = new THREE.Mesh(fullTagGeo, fullTagMat);
    fullTag.position.y = 1.0;
    fullTag.name = 'fullTag';
    fullTag.visible = false;
    group.add(fullTag);

    return group;
  }

  update(time: number) {
    const isPerformanceMode = settingsManager.getSettings().performanceMode;
    
    // Update storage bar
    const bar = this.mesh.getObjectByName('storageBar');
    if (bar) {
      const scale = this.storage / this.maxStorage;
      bar.scale.x = Math.max(0.001, scale);
      bar.position.x = -0.25 * (1 - scale);
    }

    // Update full tag
    const fullTag = this.mesh.getObjectByName('fullTag');
    if (fullTag) {
      fullTag.visible = this.storage >= this.maxStorage;
      if (fullTag.visible && !isPerformanceMode) {
        fullTag.scale.setScalar(1 + Math.sin(time * 0.01) * 0.1);
      }
    }

    if (isPerformanceMode) return;

    // Subtle hover animation
    this.mesh.position.y = this.position.y + Math.sin(time * 0.002) * 0.05;
    this.mesh.rotation.y += 0.01;
  }

  // Visual feedback for production (called by EntityManager when storage increases)
  onProduce() {
    const originalScale = this.mesh.scale.clone();
    this.mesh.scale.multiplyScalar(1.2);
    setTimeout(() => {
      if (this.mesh) this.mesh.scale.copy(originalScale);
    }, 200);
  }

  collect(): number {
    const amount = this.storage;
    this.storage = 0;
    return amount;
  }
}
