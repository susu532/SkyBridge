import * as THREE from 'three';
import { Game } from './Game';

export class ChocolateFluidSystem {
  game: Game;
  
  // Projectiles (air particles)
  maxProjectiles = 3000;
  projectileMesh!: THREE.InstancedMesh;
  projectilePositions: THREE.Vector3[] = [];
  projectileVelocities: THREE.Vector3[] = [];
  projectileLifetimes: number[] = [];
  projectileAges: number[] = [];
  projectileInitialScales: number[] = [];
  
  // Splats (painted decays)
  maxSplats = 10000;
  splatCount = 0;
  splatMesh!: THREE.InstancedMesh;
  splatDummy = new THREE.Object3D();
  
  emitOrigin = new THREE.Vector3();
  emitDir = new THREE.Vector3();
  lastEmitOrigin = new THREE.Vector3();
  lastEmitDir = new THREE.Vector3();
  emitActive = 0;
  currentPumpTime = 0;
  didEmitThisFrame = false;
  isSprayThisFrame = false;

  constructor(game: Game) {
    this.game = game;
    this.initProjectiles();
    this.initSplats();
  }

  initProjectiles() {
    // 6-sided cylinder for streaming fluid look instead of bubbles
    const geo = new THREE.CylinderGeometry(0.06, 0.06, 1.0, 6);
    // Orient the cylinder along Y so that lookAt works perfectly when scaled
    geo.translate(0, 0, 0); 
    const mat = new THREE.MeshStandardMaterial({
      color: 0x3d1c04, // Deep chocolate
      roughness: 0.3,
      metalness: 0.05,
    });
    this.projectileMesh = new THREE.InstancedMesh(geo, mat, this.maxProjectiles);
    this.projectileMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.projectileMesh.frustumCulled = false;
    
    // Hide them initially
    const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.maxProjectiles; i++) {
      this.projectileMesh.setMatrixAt(i, hiddenMatrix);
      this.projectilePositions.push(new THREE.Vector3());
      this.projectileVelocities.push(new THREE.Vector3());
      this.projectileLifetimes.push(0);
      this.projectileAges.push(0);
      this.projectileInitialScales.push(1.35);
    }
    this.projectileMesh.instanceMatrix.needsUpdate = true;
    
    this.game.world.scene.add(this.projectileMesh);
  }

  initSplats() {
    // Generate a splat texture procedurally via Canvas
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    
    const cx = 64, cy = 64;
    ctx.fillStyle = "white";
    ctx.beginPath();
    // Central blob
    ctx.arc(cx, cy, 32, 0, Math.PI * 2);
    // Outer random drips
    for (let i=0; i<8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 20 + Math.random() * 25;
      const sr = 10 + Math.random() * 15;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      ctx.arc(x, y, sr, 0, Math.PI * 2);
    }
    ctx.fill();
    // Blur to soften
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'blur(4px)';
    ctx.drawImage(canvas, 0, 0);
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = this.game.renderer.capabilities.getMaxAnisotropy();
    
    const geo = new THREE.PlaneGeometry(1.0, 1.0);
    // Move slightly forward so it sits on top of the block
    geo.translate(0, 0, 0.05); // more offset to avoid z-fighting

    const mat = new THREE.MeshStandardMaterial({
      color: 0x3d1c04, // Deep chocolate
      roughness: 0.2,
      metalness: 0.1,
      map: tex,
      transparent: true,
      alphaTest: 0.1,    // Good for cheap shadows / overdraw filtering
      depthWrite: false, // Don't write to depth buffer to prevent z-fighting among overlapping splats
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -1.0,
    });
    
    this.splatMesh = new THREE.InstancedMesh(geo, mat, this.maxSplats);
    this.splatMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.splatMesh.frustumCulled = false;
    
    const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.maxSplats; i++) {
        this.splatMesh.setMatrixAt(i, hiddenMatrix);
    }
    this.splatMesh.instanceMatrix.needsUpdate = true;
    
    this.game.world.scene.add(this.splatMesh);
  }

  update(delta: number) {
    if (delta > 0.1) delta = 0.1; // clamp delta to prevent huge jumps

    // Manage pump duration timing
    if (this.didEmitThisFrame) {
      this.currentPumpTime += delta;
    } else {
      // Cool down faster than it pumps up
      this.currentPumpTime = Math.max(0, this.currentPumpTime - delta * 2.0);
    }
    this.didEmitThisFrame = false;

    // 1. Emit new projectiles
    if (this.emitActive > 0) {
      const spawnRate = 4000; // doubled for ultra-smooth continuous stream
      const toSpawn = Math.floor(spawnRate * delta) + (Math.random() < ((spawnRate * delta) % 1) ? 1 : 0);
      
      // Calculate current thickness based on how long we've been pumping
      // Starts thin (0.4) and reaches full thickness (1.45) over ~1.2 seconds if not spraying
      const pumpAlpha = Math.min(1.0, this.currentPumpTime / 1.2);
      const spawnThickness = this.isSprayThisFrame ? (0.4 + Math.random() * 0.4) : THREE.MathUtils.lerp(0.4, 1.45, pumpAlpha);

      for (let i = 0; i < toSpawn; i++) {
        // Interpolate to create a continuous unbroken line across frames
        const t = toSpawn > 1 ? i / (toSpawn - 1) : 1; 
        const interpOrigin = new THREE.Vector3().lerpVectors(this.lastEmitOrigin, this.emitOrigin, t);
        const interpDir = new THREE.Vector3().lerpVectors(this.lastEmitDir, this.emitDir, t).normalize();

        const idx = this.projectileLifetimes.findIndex((l) => l <= 0);
        if (idx !== -1) {
          this.projectileLifetimes[idx] = 1.2 + Math.random() * 0.4; // slightly longer lifespan
          this.projectileAges[idx] = 0; // reset age
          this.projectileInitialScales[idx] = spawnThickness; // Store thickness at spawn time
          
          // Tight origin spread for cohesive stream, wider for spray
          const originSpreadAmount = this.isSprayThisFrame ? 0.08 : 0.012;
          this.projectilePositions[idx].copy(interpOrigin).add(
            new THREE.Vector3((Math.random()-0.5)*originSpreadAmount, (Math.random()-0.5)*originSpreadAmount, (Math.random()-0.5)*originSpreadAmount)
          );
          
          // Velocity spread
          const spreadAmount = this.isSprayThisFrame ? 4.0 : 0.1;
          const spread = new THREE.Vector3((Math.random()-0.5)*spreadAmount, (Math.random()-0.5)*spreadAmount, (Math.random()-0.5)*spreadAmount);
          this.projectileVelocities[idx].copy(interpDir).multiplyScalar(this.isSprayThisFrame ? (20.0 + Math.random() * 8.0) : 26.0).add(spread).add(this.game.player.velocity);
          
          // Precise backdating for sub-frame continuity
          this.projectilePositions[idx].addScaledVector(this.projectileVelocities[idx], -t * delta);
          this.projectileAges[idx] = (1.0 - t) * delta;
        }
      }
      
      this.emitActive -= delta * 12;
    }
    
    // 2. Update existing projectiles
    let projectileUpdated = false;
    let minUpdateIdx = this.maxProjectiles;
    let maxUpdateIdx = -1;
    
    for (let i = 0; i < this.maxProjectiles; i++) {
      if (this.projectileLifetimes[i] > 0) {
        this.projectileLifetimes[i] -= delta;
        this.projectileAges[i] += delta;
        
        let hideNow = false;
        if (this.projectileLifetimes[i] <= 0) {
            hideNow = true;
        }

        const pos = this.projectilePositions[i];
        const vel = this.projectileVelocities[i];
        
        if (!hideNow) {
            // Next position
            const nextPos = pos.clone().add(vel.clone().multiplyScalar(delta));
            
            // Raycast voxel world (DDA)
            const rayDir = nextPos.clone().sub(pos);
            const dist = rayDir.length();
            
            if (dist > 0.0001) {
                rayDir.normalize();
                
                const hitInfo = this.game.world.raycast(pos, rayDir, dist);
                if (hitInfo.hit && hitInfo.hitPoint) {
                    // It hit a block!
                    this.projectileLifetimes[i] = 0;
                    
                    // Spawn a Splat!
                    const hitNorm = hitInfo.prevPos.clone().sub(hitInfo.blockPos).normalize();
                    // Prevent zero normal
                    if (hitNorm.lengthSq() < 0.1) hitNorm.set(0, 1, 0);

                    this.spawnSplat(hitInfo.hitPoint, hitNorm);
                    
                    hideNow = true;
                } else if (nextPos.y <= 0.05) { // Floor collision backup
                    this.projectileLifetimes[i] = 0;
                    this.spawnSplat(new THREE.Vector3(nextPos.x, 0.05, nextPos.z), new THREE.Vector3(0, 1, 0));
                    hideNow = true;
                }
            }
            
            if (!hideNow) {
                // Gravity & Drag
                vel.y -= 16.0 * delta; // slightly more gravity for arc
                vel.multiplyScalar(Math.max(0, 1.0 - 0.45 * delta)); // slightly less drag

                // Apply new pos
                pos.copy(nextPos);
                
                // Update mesh
                this.splatDummy.position.copy(pos);
                // Stretchy projectiles using lookAt to velocity
                const speed = vel.length();
                if (speed > 0.1) {
                    this.splatDummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), vel.clone().normalize());
                }
                
                // Rope-like thickness: starts at individual initial scale, gets slightly thicker with age
                const age = this.projectileAges[i];
                const baseThickness = Math.min(3.0, (this.projectileInitialScales[i] || 1.35) + age * 2.0);
                // Ensure length is enough to cover the distance traveled plus overlap
                const stretch = Math.max(1.5, speed * delta * 1.5);
                this.splatDummy.scale.set(baseThickness, stretch, baseThickness); 
                this.splatDummy.updateMatrix();
                this.projectileMesh.setMatrixAt(i, this.splatDummy.matrix);
                projectileUpdated = true;
                if (i < minUpdateIdx) minUpdateIdx = i;
                if (i > maxUpdateIdx) maxUpdateIdx = i;
            }
        }
        
        if (hideNow) {
             // Hide dead projectile immediately
             this.splatDummy.scale.set(0,0,0);
             this.splatDummy.updateMatrix();
             this.projectileMesh.setMatrixAt(i, this.splatDummy.matrix);
             projectileUpdated = true;
             if (i < minUpdateIdx) minUpdateIdx = i;
             if (i > maxUpdateIdx) maxUpdateIdx = i;
        }
      }
    }
    
    if (projectileUpdated) {
      if (typeof this.projectileMesh.instanceMatrix.clearUpdateRanges === 'function') {
        this.projectileMesh.instanceMatrix.clearUpdateRanges();
        if (minUpdateIdx <= maxUpdateIdx) {
            this.projectileMesh.instanceMatrix.addUpdateRange(minUpdateIdx * 16, (maxUpdateIdx - minUpdateIdx + 1) * 16);
        }
      }
      this.projectileMesh.instanceMatrix.needsUpdate = true;
    }
  }

  spawnSplat(position: THREE.Vector3, normal: THREE.Vector3) {
    this.splatDummy.position.copy(position);
    
    // Align to normal
    if (normal.lengthSq() > 0.1) {
        this.splatDummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), normal);
    } else {
        this.splatDummy.quaternion.identity();
    }
    
    // Add random spin around normal
    this.splatDummy.rotateZ(Math.random() * Math.PI * 2);
    
    // Scale randomly for organic look
    const s = 0.5 + Math.random() * 0.5;
    this.splatDummy.scale.set(s, s, 1);
    
    this.splatDummy.updateMatrix();
    
    // Cycle splat buffer
    const splatIdx = this.splatCount % this.maxSplats;
    this.splatMesh.setMatrixAt(splatIdx, this.splatDummy.matrix);
    this.splatCount++;
    
    if (typeof this.splatMesh.instanceMatrix.clearUpdateRanges === 'function') {
        this.splatMesh.instanceMatrix.clearUpdateRanges();
        this.splatMesh.instanceMatrix.addUpdateRange(splatIdx * 16, 16);
    }
    this.splatMesh.instanceMatrix.needsUpdate = true;
  }

  emit(origin: THREE.Vector3, direction: THREE.Vector3, isSpray: boolean = false) {
    this.didEmitThisFrame = true;
    this.isSprayThisFrame = isSpray;
    if (this.emitActive <= 0) {
      this.lastEmitOrigin.copy(origin);
      this.lastEmitDir.copy(direction);
    } else {
      this.lastEmitOrigin.copy(this.emitOrigin);
      this.lastEmitDir.copy(this.emitDir);
    }
    this.emitOrigin.copy(origin);
    this.emitDir.copy(direction);
    this.emitActive = 1.0;
  }

  destroy() {
    if (this.projectileMesh) {
      this.game.world.scene.remove(this.projectileMesh);
      this.projectileMesh.geometry.dispose();
      (this.projectileMesh.material as THREE.Material).dispose();
    }
    if (this.splatMesh) {
      this.game.world.scene.remove(this.splatMesh);
      this.splatMesh.geometry.dispose();
      const splatMat = this.splatMesh.material as THREE.MeshPhongMaterial;
      splatMat.dispose();
      if (splatMat.map) splatMat.map.dispose();
    }
  }
}
