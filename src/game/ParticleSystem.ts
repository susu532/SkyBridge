import * as THREE from 'three';
import { settingsManager } from './Settings';

export class ParticleSystem {
  particles: { mesh: THREE.InstancedMesh, life: number, velocities: THREE.Vector3[], positions: THREE.Vector3[], active: boolean }[] = [];
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private isVoidtrail: boolean;

  private _upVec = new THREE.Vector3(0, 1, 0);
  private _smallScaleVec = new THREE.Vector3();
  private _particleTempVec = new THREE.Vector3();
  private _particleMatrix = new THREE.Matrix4();
  private _particleEuler = new THREE.Euler();
  private _particleQuat = new THREE.Quaternion();
  private _particleColorTemp = new THREE.Color();

  constructor(scene: THREE.Scene, camera: THREE.Camera, isVoidtrail: boolean) {
    this.scene = scene;
    this.camera = camera;
    this.isVoidtrail = isVoidtrail;

    const particleGeometry = isVoidtrail 
        ? new THREE.CircleGeometry(0.2, 8) 
        : new THREE.BoxGeometry(0.15, 0.15, 0.15);
        
    for (const count of [4, 12]) {
      for (let i = 0; i < 25; i++) {
        const material = isVoidtrail 
            ? new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1.0, depthWrite: false, side: THREE.DoubleSide }) 
            : new THREE.MeshLambertMaterial({ color: 0x888888, transparent: true, opacity: 1.0 });
        const mesh = new THREE.InstancedMesh(particleGeometry, material, count);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.visible = false;
        const velocities: THREE.Vector3[] = [];
        const positions: THREE.Vector3[] = [];
        for (let j = 0; j < count; j++) {
          velocities.push(new THREE.Vector3());
          positions.push(new THREE.Vector3());
          mesh.setMatrixAt(j, new THREE.Matrix4());
        }
        this.scene.add(mesh);
        this.particles.push({ mesh, life: 0, velocities, positions, active: false });
      }
    }

    window.addEventListener('spawnParticles', this.onSpawnParticles as EventListener);
  }

  onSpawnParticles = (e: CustomEvent) => {
    const { pos, type } = e.detail;
    const isPerformanceMode = settingsManager.getSettings().performanceMode;
    const particleCount = isPerformanceMode ? 4 : 12;
    
    const color = this._particleColorTemp.setHex(0x888888);
    const blockColors: Record<number, number> = {
      1: 0x5C4033, // DIRT
      2: 0x41980a, // GRASS
      3: 0x888888, // STONE
      4: 0x6b4d29, // WOOD
      5: 0x2d6a14, // LEAVES
      6: 0xd2b48c, // SAND
      8: 0xffffff, // GLASS
      9: 0x2a52be, // BLUE_STONE
      10: 0xbe2a2a, // RED_STONE
      11: 0xa67b5b, // PLANKS
      12: 0xb22222, // BRICK
      14: 0xffffff, // SNOW
      15: 0x888888, // SLAB_STONE
      16: 0x2a52be, // SLAB_BLUE
      17: 0xbe2a2a, // SLAB_RED
      18: 0x6b4d29, // SLAB_WOOD
    };
    if (blockColors[type]) color.setHex(blockColors[type]);

    let p = this.particles.find(p => !p.active && p.mesh.count === particleCount);
    
    if (!p) {
      // Fallback: forcefully reuse the oldest active particle of correct count
      p = this.particles.find(p => p.mesh.count === particleCount);
      if (!p) return; // Should not happen
    }
    
    p.active = true;
    p.life = 1.0;
    p.mesh.visible = true;
    if (this.isVoidtrail) {
      (p.mesh.material as any).color.setHex(0xffffff);
    } else {
      (p.mesh.material as any).color.copy(color);
    }
    (p.mesh.material as any).opacity = 1.0;
    
    const matrix = this._particleMatrix;
    for (let i = 0; i < particleCount; i++) {
      const pPos = p.positions[i];
      pPos.set(
        pos.x + (Math.random() - 0.5) * 0.4,
        pos.y + (Math.random() - 0.5) * 0.4,
        pos.z + (Math.random() - 0.5) * 0.4
      );
      
      const speedParam = this.isVoidtrail ? 2.5 : 4.0;
      p.velocities[i].set(
        (Math.random() - 0.5) * speedParam,
        Math.random() * speedParam + 2,
        (Math.random() - 0.5) * speedParam
      );
      
      matrix.makeTranslation(pPos.x, pPos.y, pPos.z);
      if (this.isVoidtrail) {
        matrix.lookAt(pPos, this.camera.position, this._upVec);
        this._smallScaleVec.set(0.1, 0.1, 0.1);
        matrix.scale(this._smallScaleVec); // Start small
      }
      p.mesh.setMatrixAt(i, matrix);
    }
    p.mesh.instanceMatrix.needsUpdate = true;
  };

  update(delta: number) {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      p.life -= delta * 1.5;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      
      for (let j = 0; j < p.velocities.length; j++) {
        const v = p.velocities[j];
        const pos = p.positions[j];
        
        if (this.isVoidtrail) {
          v.y -= 2 * delta; // Light gravity
          v.multiplyScalar(0.95); // Drag
          this._particleTempVec.copy(v).multiplyScalar(delta);
          pos.add(this._particleTempVec);
          
          this._particleMatrix.makeTranslation(pos.x, pos.y, pos.z);
          this._particleMatrix.lookAt(pos, this.camera.position, this._upVec);
          // Scale grows then shrinks
          const scale = Math.sin(p.life * Math.PI) * 1.5;
          this._smallScaleVec.set(scale, scale, scale);
          this._particleMatrix.scale(this._smallScaleVec);
        } else {
          v.y -= 20 * delta; // Gravity
          this._particleTempVec.copy(v).multiplyScalar(delta);
          pos.add(this._particleTempVec);
          
          // Add some rotation
          this._particleEuler.set(p.life * 5, p.life * 3, 0);
          this._particleQuat.setFromEuler(this._particleEuler);
          this._particleMatrix.makeRotationFromQuaternion(this._particleQuat);
          this._particleMatrix.setPosition(pos);
        }
        
        p.mesh.setMatrixAt(j, this._particleMatrix);
      }
      p.mesh.instanceMatrix.needsUpdate = true;
      if (this.isVoidtrail) {
        (p.mesh.material as any).opacity = Math.pow(p.life, 2.0); // smooth fade
      } else {
        (p.mesh.material as any).opacity = p.life;
      }
    }
  }

  destroy() {
    window.removeEventListener('spawnParticles', this.onSpawnParticles as EventListener);
    // Game.ts will dispose the geometry and materials when traversing the scene
  }
}
