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
import { updateAnimatedItems } from './ItemModels';
import { isTransparent, BLOCK, isAnyTorch } from './TextureAtlas';
import { EnvironmentManager } from './EnvironmentManager';
import { Inventory, ItemType } from './Inventory';
import { ParticleSystem } from './ParticleSystem';
import { GameController } from './GameController';
import { useUIStore } from '../store/uiStore';
import { IMobState, IPlayerUpdate, ISpawnParams, IGameStateData } from '../types/shared';
import { PostProcessingManager } from './PostProcessingManager';
import { InteractionSystem } from './InteractionSystem';
import { EntityTagsSystem } from './EntityTagsSystem';
import { ChocolateFluidSystem } from './ChocolateFluidSystem';

import { ClientNetworkSync } from './ClientNetworkSync';
import { ISystem } from './ISystem';

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
  chocolateFluidSystem: ChocolateFluidSystem | null = null;
  gameController: GameController;
  tickWorker: Worker | null = null;
  clientNetworkSync: ClientNetworkSync;
  systems: ISystem[] = [];
  lastFrameTime: number = performance.now();
  lastTickTime: number = performance.now();

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
      // Extremely aggressive scaling on mobile to save fill rate
      return isMobile ? Math.min(0.5, window.devicePixelRatio) : Math.min(0.8, window.devicePixelRatio);
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
      precision: "highp" // Force highp to fix point lights on mobile devices
    });
    
    this.renderer.setPixelRatio(this.getResolvedDpr(initialSettings.performanceMode));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    const effectivePremiumShaders = initialSettings.premiumShaders && !initialSettings.performanceMode;
    this.renderer.shadowMap.enabled = effectivePremiumShaders;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // Use PCFShadowMap

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
    this.chocolateFluidSystem = new ChocolateFluidSystem(this);
    
    this.systems.push(this.environmentManager);
    this.systems.push(this.particleSystem);
    this.systems.push(this.interactionSystem);
    this.systems.push(this.chocolateFluidSystem as unknown as ISystem);
    
    // Initial world generation around player
    this.world.update(this.player.position);
    
    this.gameController = new GameController(this);
    
    this.clock = new THREE.Clock();
    
    // Setup network sync
    this.clientNetworkSync = new ClientNetworkSync(this);

    // Subscribe to settings
    this.settingsUnsubscribe = settingsManager.subscribe(this.applySettings.bind(this));
  }

  applySettings(settings: GameSettings) {
    const isMobile = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    this.world.renderDistance = settings.performanceMode ? (isMobile ? Math.min(settings.renderDistance, 2) : Math.min(settings.renderDistance, 3)) : settings.renderDistance;
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

      // Refresh post-processing for Ray Tracing effects
      if (this.postProcessing) {
        this.postProcessing.dispose();
      }
      this.postProcessing = new PostProcessingManager(this);
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

  onWindowResize = (width?: number, height?: number) => {
    let w = width;
    let h = height;

    if (w === undefined || h === undefined) {
      const parent = this.renderer.domElement.parentElement;
      if (parent) {
        w = parent.clientWidth;
        h = parent.clientHeight;
      } else {
        w = window.innerWidth;
        h = window.innerHeight;
      }
    }

    if (h === 0 || w === 0) return;
    
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.postProcessing) {
      this.postProcessing.setSize(w, h);
    }
  };

  start() {
    this.loop();
    
    // Background worker to keep the game ticking when the browser tab is hidden
    const workerCode = `
      let interval;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          interval = setInterval(() => self.postMessage('tick'), 1000 / 20); // 20 TPS fallback
        } else if (e.data === 'stop') {
          clearInterval(interval);
        }
      };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    this.tickWorker = new Worker(URL.createObjectURL(blob));
    this.tickWorker.onmessage = () => {
      // Only process background worker ticks if the tab is actually hidden and requestAnimationFrame has stalled
      if (document.hidden && performance.now() - this.lastFrameTime > 100) {
        this.loop(true);
      }
    };
    this.tickWorker.postMessage('start');
  }

  stop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.tickWorker) {
      this.tickWorker.postMessage('stop');
      this.tickWorker.terminate();
      this.tickWorker = null;
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
    
    for (const system of this.systems) {
      system.destroy();
    }
    
    if (this.chocolateFluidSystem) {
      this.chocolateFluidSystem.destroy();
    }
    
    // Cleanup player
    if (this.player) {
      this.player.destroy();
    }

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

    if (this.postProcessing) {
      this.postProcessing.dispose();
    }

    this.renderer.dispose();
    const gl = this.renderer.getContext();
    const ext = gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
  }

  loop = (isBackgroundTick?: boolean | number | Event) => {
    if (this.animationFrameId === null && this.clock.getElapsedTime() > 0) {
      return; // Already stopped
    }
    
    // Only schedule next animation frame if this isn't a worker tick
    if (isBackgroundTick !== true) {
      this.lastFrameTime = performance.now();
      if (this.animationFrameId !== null) {
        cancelAnimationFrame(this.animationFrameId);
      }
      this.animationFrameId = requestAnimationFrame(this.loop);
    }
    
    if (!this.renderer || !this.scene || !this.camera) return;
    
    const now = performance.now();
    const delta = Math.min((now - this.lastTickTime) / 1000, 0.1);
    this.lastTickTime = now;
    if (delta <= 0) return;

    if (!this.world.isHub) {
      skyBridgeManager.tick(delta, this.player.inventory, this.player.hotbarIndex);
    }

    this.player.update(delta);
    this.world.tick(delta);
    this.world.updateMaterials(delta);
    this.world.update(this.player.position, this.camera);
    this.environmentManager.update(delta);
    
    updateAnimatedItems(this.clock.getElapsedTime());

    const serverName = new URLSearchParams(window.location.search).get('server') || 'dungeondelver';
    this.gameController.tick(delta, serverName);
    
    // Check loading state
    if (useGameStore.getState().isMapLoading && this.player.hasReceivedInitialRespawn) {
       const pcx = Math.floor(this.player.worldPosition.x / CHUNK_SIZE);
       const pcz = Math.floor(this.player.worldPosition.z / CHUNK_SIZE);
       
       let loadedCount = 0;
       let meshedCount = 0;
       const radius = Math.min(2, this.world.renderDistance);
       const TOTAL_CHUNKS = Math.pow(radius * 2 + 1, 2);
       
       for (let x = -radius; x <= radius; x++) {
          for (let z = -radius; z <= radius; z++) {
             const chunk = this.world.getChunk(pcx + x, pcz + z);
             if (chunk) {
                loadedCount++;
                if (chunk.mesh || (!chunk.needsUpdate && !chunk.isMeshing)) meshedCount++;
             }
          }
       }
       
       const progress = (loadedCount + meshedCount) / (TOTAL_CHUNKS * 2);
       let msg = "Awaiting Server Data";
       if (loadedCount < TOTAL_CHUNKS) msg = `Generating Terrain (${loadedCount}/${TOTAL_CHUNKS})`;
       else if (meshedCount < TOTAL_CHUNKS) msg = `Building Geometry (${meshedCount}/${TOTAL_CHUNKS})`;
       else msg = "Spawning Entities";

       const now = performance.now();
       if (!(this as any)._lastLoadUpdate || now - (this as any)._lastLoadUpdate > 100 || progress >= 1) {
           useGameStore.getState().setLoadingProgress(progress, msg);
           (this as any)._lastLoadUpdate = now;
       }
    }

    // Process queued mobs from world generation
    if (this.world.queuedMobs.length > 0) {
      const mob = this.world.queuedMobs.shift()!;
      networkManager.spawnMob(mob.type as any, { x: mob.pos.x, y: mob.pos.y, z: mob.pos.z }, undefined, mob.team);
    }
    
    // Process chunk meshes within a tight time budget (< 3ms) to prevent GPU upload stutter
    const startMeshTime = performance.now();
    
    // Process disposals first
    while (this.world.meshesToRemove.length > 0) {
      if (performance.now() - startMeshTime > 1.5) break;
      const disposing = this.world.meshesToRemove.shift()!;
      if (disposing.mesh) disposing.mesh.geometry.dispose();
      if (disposing.transparentMesh) disposing.transparentMesh.geometry.dispose();
    }

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

    for (const system of this.systems) {
      system.update(delta);
    }
    
    // Save state needed for other parts from systems
    this.lastRaycast = this.interactionSystem.lastRaycast;

    // Update water animation time
    if ((this.world.transparentMaterial as any).userData?.uTime) {
      (this.world.transparentMaterial as any).userData.uTime.value = this.clock.getElapsedTime();
    }

    if (document.hidden) {
      return; // Skip rendering
    }

    if (this.postProcessing) {
      this.postProcessing.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
