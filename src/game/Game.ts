import { useGameStore } from '../store/gameStore';
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { VerticalTiltShiftShader } from 'three/examples/jsm/shaders/VerticalTiltShiftShader.js';
import { HorizontalTiltShiftShader } from 'three/examples/jsm/shaders/HorizontalTiltShiftShader.js';
import { World } from './World';
import { Chunk, CHUNK_SIZE } from './Chunk';
import { Player } from './Player';
import { Mob } from './Mob';
import { EntityManager } from './EntityManager';
import { networkManager } from './NetworkManager';
import { settingsManager, GameSettings } from './Settings';
import { skyBridgeManager } from './SkyBridgeManager';
import { audioManager } from './AudioManager';
import { isTransparent, BLOCK, isAnyTorch } from './TextureAtlas';
import { EnvironmentManager } from './EnvironmentManager';
import { Inventory, ItemType } from './Inventory';
import { ParticleSystem } from './ParticleSystem';
import { GameController } from './GameController';
import { IMobState, IPlayerUpdate, ISpawnParams, IGameStateData } from '../types/shared';
import { PostProcessingManager } from './PostProcessingManager';
import { InteractionSystem } from './InteractionSystem';
import { EntityTagsSystem } from './EntityTagsSystem';

export class Game {
  static _upVec = new THREE.Vector3(0, 1, 0);
  static _smallScaleVec = new THREE.Vector3();
  static _tempVec = new THREE.Vector3();
  static _tempVec2 = new THREE.Vector3();

  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: PointerLockControls;
  world: World;
  player: Player;
  entityManager: EntityManager;
  clock: THREE.Clock;
  animationFrameId: number | null = null;
  environmentManager: EnvironmentManager;
  particleSystem: ParticleSystem;
  postProcessing: PostProcessingManager | null = null;
  interactionSystem: InteractionSystem | null = null;
  entityTagsSystem: EntityTagsSystem | null = null;
  gameController: GameController;

  meshesToAdd: { chunk: Chunk, mesh: THREE.Mesh | null, transparentMesh: THREE.Mesh | null }[] = [];

  lastRaycast: any = null;
  lastPerformanceMode: boolean = false;
  lastPremiumShaders: boolean = true;
  private settingsUnsubscribe: (() => void) | null = null;

  get currentMode() {
    return useGameStore.getState().currentMode;
  }

  getEntityTags() {
    if (!this.entityTagsSystem) return [];
    return this.entityTagsSystem.getEntityTags();
  }

  private getResolvedDpr(perfMode: boolean) {
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (perfMode) {
      return isMobile ? Math.min(0.7, window.devicePixelRatio) : Math.min(0.9, window.devicePixelRatio);
    } else {
      return isMobile ? Math.min(1.0, window.devicePixelRatio) : Math.min(1.0, window.devicePixelRatio); // Let desktop use standard, mobile 1.0
    }
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
    
    this.renderer.setPixelRatio(this.getResolvedDpr(initialSettings.performanceMode));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    const effectivePremiumShaders = initialSettings.premiumShaders && !initialSettings.performanceMode;
    this.renderer.shadowMap.enabled = effectivePremiumShaders;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Use PCFSoftShadowMap for ultra-realistic soft penumbras

    this.controls = new PointerLockControls(this.camera, document.body);
    // Disable internal rotation handling as we handle it in Player.ts to support sensitivity/invert
    this.controls.enabled = false;
    
    this.world = new World(this.scene);
    
    this.postProcessing = new PostProcessingManager(this);

    this.entityManager = new EntityManager(this.scene, this.world, this.camera);
    this.entityManager.setTextureAtlas(this.world.opaqueMaterial.map!);
    this.player = new Player(this.camera, this.controls, this.world, this.entityManager);
    
    // Setup Environment
    this.environmentManager = new EnvironmentManager(this);
    this.environmentManager.setupLighting();
    this.environmentManager.setupSky();
    this.environmentManager.setupWeather();

    // Initialize audio
    audioManager.init(this.camera);

    this.particleSystem = new ParticleSystem(this.scene, this.camera, this.world.isVoidtrail);
    
    this.interactionSystem = new InteractionSystem(this);
    this.entityTagsSystem = new EntityTagsSystem(this);
    
    // Initial world generation around player
    this.world.update(this.player.position);
    
    this.gameController = new GameController(this);
    
    this.clock = new THREE.Clock();
    
    window.addEventListener('resize', this.onWindowResize);

    // Network setup
    networkManager.onInit = (data: IGameStateData) => {
      const urlParams = new URLSearchParams(window.location.search);
      const serverName = urlParams.get('server') || 'hub';

      this.player.hasReceivedInitialRespawn = false;
      useGameStore.getState().setIsMapLoading(true);

      // Clear the world chunks to prevent terrain bleeding between domains
      this.world.reset(serverName);

      // The world generation routine now automatically checks networkManager.blockChanges 
      // preventing far-chunks from dismissing updates before they generate.
      // Any chunks already in frustum will be flagged to rebuild.
      this.world.rebuildAllChunks();
      
      // Clear out all previous entities before processing the newly arrived ones
      this.entityManager.clearEntities();
      
      const modeWithoutNum = serverName.split('_')[0];
      if (modeWithoutNum === 'skycastles') {
        this.player.setupSkyCastlesInventory();
        useGameStore.getState().setSkycoins(500);
      } else if (modeWithoutNum === 'dungeondelver') {
        this.player.setupDungeonDelverInventory();
      } else if (modeWithoutNum === 'skybridge') {
        // If skybridge has a setup, do it, but for now just leave it or clear it.
        // Skybridge usually gives you starting items? We can just clear it.
        this.player.inventory.clear();
      } else {
        this.player.inventory.clear();
      }
      
      // Clear team immediately to prevent bleeding armor state until explicit assignment
      this.player.team = undefined;
      this.player.renderer.updateTeam(undefined);
      
      if (!this.world.isHub) {
        // Load local skills if they exist, otherwise use server skills
        let savedSkills = null;
        try {
          savedSkills = localStorage.getItem('skyBridge_skills');
        } catch (e) {
          console.warn('Failed to access localStorage for skills', e);
        }
        
        if (savedSkills) {
          skyBridgeManager.setSkills(JSON.parse(savedSkills));
        } else if (networkManager.id && data.players?.[networkManager.id]?.skills) {
          skyBridgeManager.setSkills(data.players[networkManager.id].skills);
        }
      } else {
        // Ensure SkyBridge state is blank in the hub
        skyBridgeManager.reset();
      }

      // Add existing players
      const playersMap = data?.players || {};
      for (const id in playersMap) {
        if (id === networkManager.id) {
            const myData = playersMap[id];
            this.player.team = myData.team || null;
            this.player.renderer.updateTeam(this.player.team);
            
            this.player.isSpectator = myData.isSpectator || false;
            this.player.isDead = myData.isDead || false;
            if (this.player.isSpectator) {
               this.player.isFlying = true;
            } else if (!this.world.isHub) {
               this.player.isFlying = false;
            }
        } else {
          this.entityManager.addRemotePlayer(id, playersMap[id].skinSeed || '', playersMap[id].name || 'Player', playersMap[id].team);
          this.entityManager.updateRemotePlayer(id, playersMap[id] as any);
          const rp = this.entityManager.remotePlayers.get(id);
          if (rp) {
             rp.isDead = playersMap[id].isDead || false;
             rp.isSpectator = playersMap[id].isSpectator || false;
          }
        }
      }
      // Add existing mobs
      if (data.mobs) {
        for (const id in data.mobs) {
          const mobData = data.mobs[id];
          if (mobData.type === 'Sheep' && false) continue; // Sample placeholder or just remove if cleanup
          const pos = Game._tempVec.set(mobData.position.x, mobData.position.y, mobData.position.z);
          const mob = new Mob(mobData.id, pos, mobData.level || 1, mobData.type as any, this.entityManager.textureAtlas, mobData.team);
          if (mobData.health !== undefined) mob.health = mobData.health;
          if (mobData.maxHealth !== undefined) mob.maxHealth = mobData.maxHealth;
          if (mobData.scale) {
             mob.group.scale.set(mobData.scale, mobData.scale, mobData.scale);
          }
          this.entityManager.addMob(mob);
        }
      }
      // Add existing minions
      if (data.minions) {
        for (const id in data.minions) {
          const minionData = data.minions[id];
          const pos = Game._tempVec.set(minionData.position.x, minionData.position.y, minionData.position.z);
          this.entityManager.addMinionLocally(minionData.id, minionData.type, pos);
        }
      }
      // Add existing dropped items
      if (data.droppedItems) {
        for (const id in data.droppedItems) {
          const itemData = data.droppedItems[id];
          const pos = Game._tempVec.set(itemData.position.x, itemData.position.y, itemData.position.z);
          const vel = itemData.velocity ? Game._tempVec2.set(itemData.velocity.x, itemData.velocity.y, itemData.velocity.z) : undefined;
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

      // Join the game
      const cameraEuler = new THREE.Euler(0, 0, 0, 'YXZ');
      cameraEuler.setFromQuaternion(this.camera.quaternion);
      
      // Persist skin
      let mySkinSeed = null;
      try {
        mySkinSeed = localStorage.getItem('skyBridge_skin_seed');
        if (!mySkinSeed) {
          mySkinSeed = 'player_' + Math.random().toString(36).substring(7);
          localStorage.setItem('skyBridge_skin_seed', mySkinSeed);
        }
      } catch (e) {
        console.warn('Failed to access localStorage for player info', e);
        if (!mySkinSeed) mySkinSeed = 'player_' + Math.random().toString(36).substring(7);
      }
  
      const joinPos = Game._tempVec.set(this.player.position.x, this.player.position.y - 1.6, this.player.position.z);
      
      const myName = settingsManager.getSettings().username || ('Player_' + Math.floor(Math.random() * 1000));
      
      networkManager.join(joinPos, cameraEuler, mySkinSeed, myName, skyBridgeManager.skills, this.player.inventory.slots[this.player.hotbarIndex]?.type || 0);
      
      // Update local player skin
      this.player.updateSkin(mySkinSeed);
    };

    networkManager.onPlayerJoined = (player: IPlayerUpdate) => {
      if (player.id !== networkManager.id) {
        this.entityManager.addRemotePlayer(player.id, player.skinSeed || '', player.name || 'Player', player.team);
        const rp = this.entityManager.remotePlayers.get(player.id);
        if (rp) {
           rp.isDead = player.isDead || false;
           rp.isSpectator = player.isSpectator || false;
           rp.health = player.health || 100;
        }
      }
    };

    networkManager.onPlayerMoved = (player: IPlayerUpdate) => {
      if (player.id !== networkManager.id) {
        this.entityManager.updateRemotePlayer(player.id, player);
      }
    };

    networkManager.onPlayerLeft = (id: string) => {
      this.entityManager.removeRemotePlayer(id);
    };

    networkManager.onBlockChanged = (data) => {
      this.world.setBlock(data.x, data.y, data.z, data.type, false);
      const pos = Game._tempVec.set(data.x + 0.5, data.y + 0.5, data.z + 0.5);
      if (data.type === 0) {
        audioManager.playPositional('break', pos, 0.4, 0.8 + Math.random() * 0.4, 20);
        window.dispatchEvent(new CustomEvent('spawnParticles', { 
          detail: { pos: pos.clone(), type: 1 } // Use a generic block type for remote break particles right now
        }));
      } else {
        audioManager.playPositional('place', pos, 0.6, 0.9 + Math.random() * 0.2, 20);
      }
    };

    networkManager.onItemSpawned = (data) => {
      const pos = Game._tempVec.set(data.position.x, data.position.y, data.position.z);
      const vel = data.velocity ? Game._tempVec2.set(data.velocity.x, data.velocity.y, data.velocity.z) : undefined;
      this.entityManager.addDroppedItem(data.id, data.type, pos, vel);
    };

    networkManager.onItemDespawned = (id) => {
      this.entityManager.removeDroppedItem(id);
    };

    networkManager.onRequestSpawnCheck = (data: ISpawnParams) => {
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
      const maxHeight = 196; // CHUNK_HEIGHT (256) + WORLD_Y_OFFSET (-60)
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
      useGameStore.getState().addMessage(`Collected ${data.amount}x items from minion!`, "#55FF55");
    };

    networkManager.onTimeUpdate = (data) => {
      // Smoothly interpolate or just set
      // For now, just set to ensure perfect sync
      this.environmentManager.dayTime = data.dayTime;
    };

    networkManager.onEntitiesReset = (data: { mobs: Record<string, any>; droppedItems: Record<string, any>; gameStartTime?: number }) => {
      window.dispatchEvent(new CustomEvent('forceCloseMenus'));
      this.entityManager.clearEntities();
      this.world.reset(this.currentMode);
      useGameStore.getState().clearChatMessages();
      const modeWithoutNum = this.currentMode.split('_')[0];
      if (modeWithoutNum === 'skycastles') {
        this.player.setupSkyCastlesInventory();
        useGameStore.getState().setSkycoins(500);
        skyBridgeManager.reset();
      } else if (modeWithoutNum === 'dungeondelver') {
        this.player.setupDungeonDelverInventory();
      } else {
        this.player.inventory.clear();
      }
      if (data.mobs) {
        for (const id in data.mobs) {
          const mobData = data.mobs[id];
          // mobData.type check removed
          const pos = Game._tempVec.set(mobData.position.x, mobData.position.y, mobData.position.z);
          const mob = new Mob(mobData.id, pos, mobData.level || 1, mobData.type as any, this.entityManager.textureAtlas, mobData.team);
          if (mobData.health !== undefined) mob.health = mobData.health;
          if (mobData.maxHealth !== undefined) mob.maxHealth = mobData.maxHealth;
          if (mobData.scale) mob.group.scale.set(mobData.scale, mobData.scale, mobData.scale);
          this.entityManager.addMob(mob);
        }
      }
    };

    // Sync skills when they change
    skyBridgeManager.onSkillChange = (skill, progress) => {
      if (!this.world.isHub) {
        networkManager.updateSkills(skill, progress);
        try {
          localStorage.setItem('skyBridge_skills', JSON.stringify(skyBridgeManager.skills));
        } catch (e) {
          // ignore
        }
      }
    };

    // Subscribe to settings
    this.settingsUnsubscribe = settingsManager.subscribe(this.applySettings.bind(this));
  }

  applySettings(settings: GameSettings) {
    this.world.renderDistance = settings.performanceMode ? Math.min(settings.renderDistance, 3) : settings.renderDistance;
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
      this.renderer.setPixelRatio(this.getResolvedDpr(settings.performanceMode));
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
  }

  onWindowResize = () => {
    let width = window.innerWidth;
    let height = window.innerHeight;
    
    // Leverage the canvas's container if available for Resizer compatibility
    const parent = this.renderer.domElement.parentElement;
    if (parent) {
      width = parent.clientWidth;
      height = parent.clientHeight;
    }

    if (height === 0 || width === 0) return;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    if (this.postProcessing) {
      this.postProcessing.setSize(width, height);
    }
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
    
    if (this.particleSystem) {
      this.particleSystem.destroy();
    }

    // Remove window listeners
    window.removeEventListener('resize', this.onWindowResize);

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

    this.world.meshesToAdd = [];
    
    if (this.interactionSystem) {
      this.interactionSystem.dispose();
    }

    if (this.postProcessing) {
      this.postProcessing.dispose();
    }

    this.renderer.dispose();
    const gl = this.renderer.getContext();
    const ext = gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
  }

  loop = () => {
    if (this.animationFrameId === null && this.clock.getElapsedTime() > 0) {
      return; // Already stopped
    }
    this.animationFrameId = requestAnimationFrame(this.loop);
    
    if (!this.renderer || !this.scene || !this.camera) return;
    
    const delta = Math.min(this.clock.getDelta(), 0.1); 

    if (!this.world.isHub) {
      skyBridgeManager.tick(delta, this.player.inventory, this.player.hotbarIndex);
    }

    this.player.update(delta);
    this.world.tick(delta);
    this.world.updateMaterials(delta);
    this.world.update(this.player.position, this.camera);
    this.environmentManager.update(delta);

    const serverName = new URLSearchParams(window.location.search).get('server') || 'hub';
    this.gameController.tick(delta, serverName);
    
    // Check loading state
    if (useGameStore.getState().isMapLoading && this.player.hasReceivedInitialRespawn) {
       const pcx = Math.floor(this.player.worldPosition.x / CHUNK_SIZE);
       const pcz = Math.floor(this.player.worldPosition.z / CHUNK_SIZE);
       
       let loadedCount = 0;
       let meshedCount = 0;
       const radius = 2; // 5x5 chunks
       const TOTAL_CHUNKS = Math.pow(radius * 2 + 1, 2);
       
       for (let x = -radius; x <= radius; x++) {
          for (let z = -radius; z <= radius; z++) {
             const chunk = this.world.getChunk(pcx + x, pcz + z);
             if (chunk) {
                loadedCount++;
                if (chunk.mesh) meshedCount++;
             }
          }
       }
       
       const progress = (loadedCount + meshedCount) / (TOTAL_CHUNKS * 2);
       let msg = "Awaiting Server Data";
       if (loadedCount < TOTAL_CHUNKS) msg = `Generating Terrain (${loadedCount}/${TOTAL_CHUNKS})`;
       else if (meshedCount < TOTAL_CHUNKS) msg = `Building Geometry (${meshedCount}/${TOTAL_CHUNKS})`;
       else msg = "Spawning Entities";

       useGameStore.getState().setLoadingProgress(progress, msg);
       
       if (meshedCount >= TOTAL_CHUNKS && this.world.meshesToAdd.length === 0) {
          useGameStore.getState().setIsMapLoading(false);
       }
    }

    // Process queued mobs from world generation
    if (this.world.queuedMobs.length > 0) {
      const mob = this.world.queuedMobs.shift()!;
      networkManager.spawnMob(mob.type as any, { x: mob.pos.x, y: mob.pos.y, z: mob.pos.z }, undefined, mob.team);
    }
    
    // Process chunk meshes within a tight time budget (< 3ms) to prevent GPU upload stutter
    const startMeshTime = performance.now();
    while (this.world.meshesToAdd.length > 0) {
      if (performance.now() - startMeshTime > 3) {
        break; // Exceeded budget, finish the rest in subsequent frames
      }
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
    this.particleSystem.update(delta);

    // Update water animation time
    if ((this.world.transparentMaterial as any).userData?.uTime) {
      (this.world.transparentMaterial as any).userData.uTime.value = this.clock.getElapsedTime();
    }

    if (this.interactionSystem) {
      this.interactionSystem.update();
      this.lastRaycast = this.interactionSystem.lastRaycast;
    }

    if (this.postProcessing) {
      this.postProcessing.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
