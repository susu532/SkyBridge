import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { World } from './World';
import { Chunk } from './Chunk';
import { Player } from './Player';
import { Mob } from './Mob';
import { EntityManager } from './EntityManager';
import { networkManager } from './NetworkManager';
import { settingsManager, GameSettings } from './Settings';
import { skyBridgeManager } from './SkyBridgeManager';
import { audioManager } from './AudioManager';
import { isTransparent, BLOCK, isAnyTorch } from './TextureAtlas';
import { EnvironmentManager } from './EnvironmentManager';

export class Game {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: PointerLockControls;
  world: World;
  player: Player;
  entityManager: EntityManager;
  clock: THREE.Clock;
  selectionBox: THREE.LineSegments | null = null;
  animationFrameId: number | null = null;
  environmentManager: EnvironmentManager;

  particles: { mesh: THREE.InstancedMesh, life: number, velocities: THREE.Vector3[], positions: THREE.Vector3[], active: boolean }[] = [];
  meshesToAdd: { chunk: Chunk, mesh: THREE.Mesh | null, transparentMesh: THREE.Mesh | null }[] = [];

  lastRaycast: any = null;
  lastPerformanceMode: boolean = false;
  lastPremiumShaders: boolean = true;
  private settingsUnsubscribe: (() => void) | null = null;

  private _tempCameraDir = new THREE.Vector3();
  private _tempRaycastDir = new THREE.Vector3();
  private _tagTempVec = new THREE.Vector3();
  private _tagToEntity = new THREE.Vector3();
  
  private _particleTempVec = new THREE.Vector3();
  private _particleMatrix = new THREE.Matrix4();
  private _particleEuler = new THREE.Euler();
  private _particleQuat = new THREE.Quaternion();

  getEntityTags() {
    const tags: any[] = [];
    const widthHalf = window.innerWidth / 2;
    const heightHalf = window.innerHeight / 2;
    this.camera.getWorldDirection(this._tempCameraDir);

    const projectEntity = (id: string, pos: THREE.Vector3, type: string, health: number, maxHealth: number, level: number, name?: string, isPassive: boolean = false) => {
      // Distance check
      const distSq = pos.distanceToSquared(this.camera.position);
      if (isNaN(distSq) || distSq > 2500) return; // 50 blocks for players

      this._tagTempVec.copy(pos);
      this._tagTempVec.y += (type === 'Slime') ? 1.0 : 2.2;
      
      this._tagToEntity.subVectors(this._tagTempVec, this.camera.position).normalize();
      if (this._tempCameraDir.dot(this._tagToEntity) < 0) return;

      this._tagTempVec.project(this.camera);

      let x = (this._tagTempVec.x * widthHalf) + widthHalf;
      let y = -(this._tagTempVec.y * heightHalf) + heightHalf;
      
      // Guard against NaN/Infinity values which can crash CSS styles
      if (!isFinite(x) || !isFinite(y)) return;

      const distance = Math.sqrt(distSq);
      if (distance > 40) return;

      tags.push({ id, x, y, level, type, health, maxHealth, distance, name, isPassive });
    };

    this.entityManager.mobs.forEach((mob) => {
      projectEntity(mob.id, mob.position, mob.type, mob.health, mob.maxHealth, mob.level, undefined, mob.isPassive);
    });

    this.entityManager.remotePlayers.forEach((player) => {
      const combatLevel = player.skills?.Combat?.level || 1;
      projectEntity(player.id, player.group.position, 'Player', 100, 100, combatLevel, player.name, true);
    });

    return tags;
  }
  
  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    const skyColor = 0x99ccff;
    this.scene.background = new THREE.Color(skyColor);
    this.scene.fog = new THREE.FogExp2(skyColor, 0.015);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.scene.add(this.camera);

    const initialSettings = settingsManager.getSettings();

    this.renderer = new THREE.WebGLRenderer({ 
      canvas, 
      antialias: false,
      powerPreference: "high-performance",
      precision: initialSettings.performanceMode ? "mediump" : "highp"
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Use PCFSoftShadowMap for ultra-realistic soft penumbras

    this.controls = new PointerLockControls(this.camera, document.body);
    // Disable internal rotation handling as we handle it in Player.ts to support sensitivity/invert
    this.controls.enabled = false;
    
    this.world = new World(this.scene);
    this.entityManager = new EntityManager(this.scene, this.world);
    this.entityManager.setTextureAtlas(this.world.opaqueMaterial.map!);
    this.player = new Player(this.camera, this.controls, this.world, this.entityManager);
    
    // Setup Environment
    this.environmentManager = new EnvironmentManager(this);
    this.environmentManager.setupLighting();
    this.environmentManager.setupSky();
    this.environmentManager.setupWeather();

    // Initialize audio
    audioManager.init(this.camera);

    // Pre-allocate particle pool to prevent GC spikes
    const particleGeometry = new THREE.BoxGeometry(0.15, 0.15, 0.15);
    for (const count of [4, 12]) {
      for (let i = 0; i < 25; i++) {
        const material = new THREE.MeshLambertMaterial({ color: 0x888888, transparent: true, opacity: 1.0 });
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
    
    // Selection box
    const boxGeo = new THREE.BoxGeometry(1.01, 1.01, 1.01);
    const edges = new THREE.EdgesGeometry(boxGeo);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    this.selectionBox = new THREE.LineSegments(edges, lineMat);
    this.scene.add(this.selectionBox);
    
    // Initial world generation around player
    this.world.update(this.player.position);
    
    this.clock = new THREE.Clock();
    
    window.addEventListener('resize', this.onWindowResize);
    window.addEventListener('spawnParticles', this.onSpawnParticles as EventListener);

    // Network setup
    networkManager.onInit = (data) => {
      // The world generation routine now automatically checks networkManager.blockChanges 
      // preventing far-chunks from dismissing updates before they generate.
      // Any chunks already in frustum will be flagged to rebuild.
      this.world.rebuildAllChunks();
      
      if (!this.world.isHub) {
        // Load local skills if they exist, otherwise use server skills
        const savedSkills = localStorage.getItem('skyBridge_skills');
        if (savedSkills) {
          skyBridgeManager.setSkills(JSON.parse(savedSkills));
        } else if (data.players[networkManager.socket.id]?.skills) {
          skyBridgeManager.setSkills(data.players[networkManager.socket.id].skills);
        }
      } else {
        // Ensure SkyBridge state is blank in the hub
        skyBridgeManager.reset();
      }

      // Add existing players
      for (const id in data.players) {
        if (id !== networkManager.socket.id) {
          this.entityManager.addRemotePlayer(id, data.players[id].skinSeed, data.players[id].name);
          this.entityManager.updateRemotePlayer(id, data.players[id]);
        }
      }
      // Add existing mobs
      if (data.mobs) {
        for (const id in data.mobs) {
          const mobData = data.mobs[id];
          if (mobData.type === 'Pig') continue; // Filter out pigs from server
          const pos = new THREE.Vector3(mobData.position.x, mobData.position.y, mobData.position.z);
          this.entityManager.addMob(new Mob(mobData.id, pos, 1, mobData.type, this.entityManager.textureAtlas));
        }
      }
      // Add existing minions
      if (data.minions) {
        for (const id in data.minions) {
          const minionData = data.minions[id];
          const pos = new THREE.Vector3(minionData.position.x, minionData.position.y, minionData.position.z);
          this.entityManager.addMinionLocally(minionData.id, minionData.type, pos);
        }
      }
      // Add existing dropped items
      if (data.droppedItems) {
        for (const id in data.droppedItems) {
          const itemData = data.droppedItems[id];
          const pos = new THREE.Vector3(itemData.position.x, itemData.position.y, itemData.position.z);
          const vel = itemData.velocity ? new THREE.Vector3(itemData.velocity.x, itemData.velocity.y, itemData.velocity.z) : undefined;
          this.entityManager.addDroppedItem(itemData.id, itemData.type, pos, vel);
        }
      }

      // Add existing NPCs
      if (data.npcs) {
        for (const npcData of data.npcs) {
          this.entityManager.addNPCFromData(npcData);
        }
      }

      // Sync time
      if (data.dayTime !== undefined) {
        this.environmentManager.dayTime = data.dayTime;
      }
    };

    networkManager.onPlayerJoined = (player) => {
      if (player.id !== networkManager.socket.id) {
        this.entityManager.addRemotePlayer(player.id, player.skinSeed, player.name);
      }
    };

    networkManager.onPlayerMoved = (player) => {
      if (player.id !== networkManager.socket.id) {
        this.entityManager.updateRemotePlayer(player.id, player);
      }
    };

    networkManager.onPlayerLeft = (id) => {
      this.entityManager.removeRemotePlayer(id);
    };

    networkManager.onBlockChanged = (data) => {
      this.world.setBlock(data.x, data.y, data.z, data.type, false);
      const pos = new THREE.Vector3(data.x + 0.5, data.y + 0.5, data.z + 0.5);
      if (data.type === 0) {
        audioManager.playPositional('break', pos, 0.4, 0.8 + Math.random() * 0.4, 20);
        window.dispatchEvent(new CustomEvent('spawnParticles', { 
          detail: { pos: pos, type: 1 } // Use a generic block type for remote break particles right now
        }));
      } else {
        audioManager.playPositional('place', pos, 0.6, 0.9 + Math.random() * 0.2, 20);
      }
    };

    networkManager.onItemSpawned = (data) => {
      const pos = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
      const vel = data.velocity ? new THREE.Vector3(data.velocity.x, data.velocity.y, data.velocity.z) : undefined;
      this.entityManager.addDroppedItem(data.id, data.type, pos, vel);
    };

    networkManager.onItemDespawned = (id) => {
      this.entityManager.removeDroppedItem(id);
    };

    networkManager.onRequestSpawnCheck = (data) => {
      const isNight = Math.sin(this.environmentManager.dayTime * Math.PI * 2) <= 0;
      
      // 1. Check for player placed/natural light sources nearby (sphere radius 7)
      let nearLightSource = false;
      const radius = 7;
      
      const px = Math.floor(data.x);
      const py = Math.floor(data.y);
      const pz = Math.floor(data.z);

      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dz = -radius; dz <= radius; dz++) {
            if (dx * dx + dy * dy + dz * dz <= radius * radius) {
              const block = this.world.getBlock(px + dx, py + dy, pz + dz);
              if (block === BLOCK.GLOWSTONE || block === BLOCK.LAVA || isAnyTorch(block)) {
                nearLightSource = true;
                break;
              }
            }
          }
          if (nearLightSource) break;
        }
        if (nearLightSource) break;
      }

      if (nearLightSource) return; // Too bright from nearby light-emitting blocks

      // 2. Check sunlight exposure (raycast straight up)
      let isExposed = true;
      const maxHeight = 68; // CHUNK_HEIGHT (128) + WORLD_Y_OFFSET (-60)
      for (let y = py + 1; y < maxHeight; y++) {
        const block = this.world.getBlock(px, y, pz);
        if (block !== 0 && !isTransparent(block)) { // Consider non-transparent blocks as occluding
          isExposed = false;
          break;
        }
      }

      // If it's daytime and exposed to the sky, don't spawn hostile mobs!
      if (!isNight && isExposed) return;

      // Spawn allowed!
      networkManager.spawnMob(data.type, { x: data.x, y: data.y, z: data.z }, data.level);
    };

    networkManager.onMinionCollected = (data) => {
      this.player.inventory.addItem(data.type, data.amount);
      window.dispatchEvent(new CustomEvent('showNotification', { 
        detail: { text: `Collected ${data.amount}x items from minion!`, color: "#55FF55" } 
      }));
    };

    networkManager.onTimeUpdate = (data) => {
      // Smoothly interpolate or just set
      // For now, just set to ensure perfect sync
      this.environmentManager.dayTime = data.dayTime;
    };

    // Join the game
    const cameraEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    cameraEuler.setFromQuaternion(this.camera.quaternion);
    
    // Persist skin and name
    let mySkinSeed = localStorage.getItem('skyBridge_skin_seed');
    if (!mySkinSeed) {
      mySkinSeed = 'player_' + Math.random().toString(36).substring(7);
      localStorage.setItem('skyBridge_skin_seed', mySkinSeed);
    }
    
    let myName = localStorage.getItem('skyBridge_player_name');
    if (!myName) {
      myName = 'Player ' + Math.floor(Math.random() * 1000);
      localStorage.setItem('skyBridge_player_name', myName);
    }

    const joinPos = new THREE.Vector3(this.player.position.x, this.player.position.y - 1.6, this.player.position.z);
    networkManager.join(joinPos, cameraEuler, mySkinSeed, myName, skyBridgeManager.skills, this.player.inventory.slots[this.player.hotbarIndex]?.type || 0);
    
    // Update local player skin
    this.player.updateSkin(mySkinSeed);

    // Sync skills when they change
    skyBridgeManager.onSkillChange = (skill, progress) => {
      if (!this.world.isHub) {
        networkManager.updateSkills(skill, progress);
        localStorage.setItem('skyBridge_skills', JSON.stringify(skyBridgeManager.skills));
      }
    };

    // Subscribe to settings
    this.settingsUnsubscribe = settingsManager.subscribe(this.applySettings.bind(this));
  }

  applySettings(settings: GameSettings) {
    this.world.renderDistance = settings.performanceMode ? Math.min(settings.renderDistance, 4) : settings.renderDistance;
    this.player.sensitivity = settings.sensitivity;
    this.player.baseFOV = settings.fov;

    // Premium Shaders (Shadows, Block Animations, Sky Texture)
    const effectivePremiumShaders = settings.premiumShaders && !settings.performanceMode;
    if (this.lastPremiumShaders !== effectivePremiumShaders) {
      this.lastPremiumShaders = effectivePremiumShaders;
      
      const enabled = effectivePremiumShaders;
      
      // Toggle shadows
      this.renderer.shadowMap.enabled = enabled;
      const dirLight = this.scene.getObjectByName('sun') as THREE.DirectionalLight;
      if (dirLight) {
        dirLight.castShadow = enabled;
      }

      // Toggle entity shadows
      this.entityManager.setShadows(enabled);

      // Rebuild chunks to apply AO/shadow changes
      this.world.rebuildAllChunks();
    }

    // Performance Mode optimizations (Extra cuts for speed)
    if (this.lastPerformanceMode !== settings.performanceMode) {
      this.lastPerformanceMode = settings.performanceMode;
      
      // Toggle clouds (Hide clouds in performance mode regardless of shaders)
      if (this.environmentManager.clouds) {
        this.environmentManager.clouds.visible = !settings.performanceMode;
      }

      // Reduce pixel ratio for better performance
      this.renderer.setPixelRatio(settings.performanceMode ? Math.min(0.75, window.devicePixelRatio) : window.devicePixelRatio);
    }
  }

  onSpawnParticles = (e: CustomEvent) => {
    const { pos, type } = e.detail;
    const isPerformanceMode = settingsManager.getSettings().performanceMode;
    const particleCount = isPerformanceMode ? 4 : 12;
    
    const color = new THREE.Color(0x888888);
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
    (p.mesh.material as THREE.MeshLambertMaterial).color.copy(color);
    (p.mesh.material as THREE.MeshLambertMaterial).opacity = 1.0;
    
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < particleCount; i++) {
      const pPos = p.positions[i];
      pPos.set(
        pos.x + (Math.random() - 0.5) * 0.4,
        pos.y + (Math.random() - 0.5) * 0.4,
        pos.z + (Math.random() - 0.5) * 0.4
      );
      
      p.velocities[i].set(
        (Math.random() - 0.5) * 4,
        Math.random() * 4 + 2,
        (Math.random() - 0.5) * 4
      );
      
      matrix.setPosition(pPos);
      p.mesh.setMatrixAt(i, matrix);
    }
    p.mesh.instanceMatrix.needsUpdate = true;
  };

  onWindowResize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (height === 0 || width === 0) return;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  start() {
    this.loop();
  }

  stop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Clear singleton listeners
    networkManager.resetHandlers();
    skyBridgeManager.resetHandlers();
    if (this.settingsUnsubscribe) {
      this.settingsUnsubscribe();
      this.settingsUnsubscribe = null;
    }

    // Cleanup entity manager
    this.entityManager.destroy();
    
    // Cleanup player
    if (this.player) {
      this.player.destroy();
    }

    // Remove window listeners
    window.removeEventListener('resize', this.onWindowResize);
    window.removeEventListener('spawnParticles', this.onSpawnParticles as EventListener);

    // Dispose Three.js resources
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.InstancedMesh) {
        if (object.geometry) {
          object.geometry.dispose();
        }
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(mat => mat.dispose());
          } else {
            object.material.dispose();
          }
        }
      }
    });

    // Dispose materials explicitly held by World
    if (this.world.opaqueMaterial) this.world.opaqueMaterial.dispose();
    if (this.world.transparentMaterial) this.world.transparentMaterial.dispose();
    
    // Dispose textures in World
    this.world.chunks.forEach(chunk => {
      if (chunk.mesh) {
        chunk.mesh.geometry.dispose();
      }
      if (chunk.transparentMesh) {
        chunk.transparentMesh.geometry.dispose();
      }
    });

    this.renderer.dispose();
  }

  loop = () => {
    if (this.animationFrameId === null && this.clock.getElapsedTime() > 0) {
      return; // Already stopped
    }
    this.animationFrameId = requestAnimationFrame(this.loop);
    
    if (!this.renderer || !this.scene || !this.camera) return;
    
    const delta = Math.min(this.clock.getDelta(), 0.1); // Cap delta to prevent huge jumps and clipping through floors during lag
    
    // Adaptive render distance is now handled by settings, but we can keep a soft version
    // if settings allow it. For now, let's just use the setting directly.
    // this.world.renderDistance = settingsManager.getSettings().renderDistance;

    if (!this.world.isHub) {
      skyBridgeManager.tick(delta, this.player.inventory, this.player.hotbarIndex);
    }

    this.player.update(delta);
    this.world.tick(delta);
    this.world.updateMaterials(delta);
    this.world.update(this.player.position, this.camera);
    this.environmentManager.update(delta);
    
    // Process queued mobs from world generation
    if (this.world.queuedMobs.length > 0) {
      const mob = this.world.queuedMobs.shift()!;
      networkManager.spawnMob(mob.type, { x: mob.pos.x, y: mob.pos.y, z: mob.pos.z });
    }
    
    // Process one mesh addition per frame to prevent GPU upload stutter
    if (this.world.meshesToAdd.length > 0) {
      const { chunk, mesh, transparentMesh } = this.world.meshesToAdd.shift()!;
      if (mesh && !this.scene.children.includes(mesh)) {
        this.scene.add(mesh);
      }
      if (transparentMesh && !this.scene.children.includes(transparentMesh)) {
        this.scene.add(transparentMesh);
      }
    }

    this.entityManager.update(this.player.position, delta);

    // Update particles
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
        
        v.y -= 20 * delta; // Gravity
        this._particleTempVec.copy(v).multiplyScalar(delta);
        pos.add(this._particleTempVec);
        
        // Add some rotation
        this._particleEuler.set(p.life * 5, p.life * 3, 0);
        this._particleQuat.setFromEuler(this._particleEuler);
        this._particleMatrix.makeRotationFromQuaternion(this._particleQuat);
        this._particleMatrix.setPosition(pos);
        
        p.mesh.setMatrixAt(j, this._particleMatrix);
      }
      p.mesh.instanceMatrix.needsUpdate = true;
      (p.mesh.material as THREE.MeshLambertMaterial).opacity = p.life;
    }

    // Update water animation time
    if ((this.world.transparentMaterial as any).userData?.uTime) {
      (this.world.transparentMaterial as any).userData.uTime.value = this.clock.getElapsedTime();
    }

    // Update selection box
    this.camera.getWorldDirection(this._tempRaycastDir);
    const ray = this.world.raycast(this.player.playerHeadPos, this._tempRaycastDir, 5);
    const npcRay = this.entityManager.raycastNPC(this.player.playerHeadPos, this._tempRaycastDir, 5, this.camera);
    
    this.lastRaycast = { block: ray.hit ? ray : null, npc: npcRay };

    if (ray.hit && this.selectionBox) {
      this.selectionBox.visible = true;
      this.selectionBox.position.set(
        ray.blockPos!.x + 0.5,
        ray.blockPos!.y + 0.5,
        ray.blockPos!.z + 0.5
      );
      // Subtle pulse effect
      const isPerformanceMode = settingsManager.getSettings().performanceMode;
      const pulse = isPerformanceMode ? 1.0 : 1.0 + Math.sin(this.clock.getElapsedTime() * 10) * 0.01;
      this.selectionBox.scale.set(pulse, pulse, pulse);
    } else if (this.selectionBox) {
      this.selectionBox.visible = false;
    }

    this.renderer.render(this.scene, this.camera);
  }
}
