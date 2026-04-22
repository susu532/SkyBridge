import * as THREE from 'three';
import { Chunk, CHUNK_SIZE, CHUNK_HEIGHT, WORLD_Y_OFFSET } from './Chunk';
import { BLOCK, createTextureAtlas, isSolidBlock, isWater, isAnyTorch } from './TextureAtlas';
import { createNoise2D, createNoise3D } from 'simplex-noise';
import { audioManager } from './AudioManager';
import { settingsManager } from './Settings';
import { LightingManager } from './LightingManager';
import { networkManager } from './NetworkManager';

export class World {
  scene: THREE.Scene;
  chunks: Map<string, Chunk> = new Map();
  opaqueMaterial: THREE.MeshStandardMaterial;
  opaqueDepthMaterial: THREE.MeshDepthMaterial;
  transparentMaterial: THREE.MeshStandardMaterial;
  transparentDepthMaterial: THREE.MeshDepthMaterial;
  renderDistance = 7; // chunks
  
  // Seeded random for consistent terrain between client and server
  static createPRNG(seed: string) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
    }
    return function() {
      h = (Math.imul(1597334677, h) + 1) | 0;
      return (h >>> 0) / 0xffffffff;
    };
  }

  prng = World.createPRNG('skyBridge-seed-v1');
  noise2D = createNoise2D(this.prng);
  noise3D = createNoise3D(this.prng);
  worldSize = 800; // Radius in blocks
  generatingChunks: Set<string> = new Set();
  meshesToAdd: { chunk: Chunk, mesh: THREE.Mesh | null, transparentMesh: THREE.Mesh | null }[] = [];
  fallingBlocks: Set<string> = new Set();
  waterUpdates: Set<string> = new Set();
  lightingManager: LightingManager;
  tickAccumulator: number = 0;
  tickRate: number = 0.1; // Tick every 100ms
  queuedMobs: { type: any, pos: THREE.Vector3 }[] = [];
  isHub: boolean = false;

  // BAKED_BLOCKS_START
  bakedBlocks = new Map<string, number>([
    ["0,0,0", 4],
    ["-1,5,-15", 0],
    ["48,8,-316", 2],
    ["0,5,-184", 0],
    ["-4,5,-175", 0],
    ["11,5,-185", 0],
    ["11,5,-112", 3],
    ["-2,40,-103", 0],
    ["-1,40,-103", 0],
    ["-1,40,-104", 0],
    ["-2,40,-104", 0],
    ["-2,40,-102", 0],
    ["-1,40,-102", 0],
    ["-3,40,-102", 0],
    ["-3,40,-104", 0],
    ["-3,40,-103", 0],
    ["-2,41,-102", 0],
    ["-1,40,-105", 0],
    ["-2,40,-105", 0],
    ["-1,41,-102", 0],
    ["-3,40,-105", 0],
    ["-4,40,-105", 0],
    ["-4,40,-104", 0],
    ["-4,40,-103", 0],
    ["-1,40,-106", 0],
    ["-2,40,-106", 0],
    ["-4,40,-102", 0],
    ["-3,40,-106", 0],
    ["-4,40,-106", 0],
    ["0,40,-105", 3],
    ["3,5,-45", 0],
    ["-1,5,-42", 0],
    ["-1,4,-32", 4]
  ]);
  // BAKED_BLOCKS_END

  biomes = {
    SNOWY_TUNDRA: { height: 10, scale: 0.015, topBlock: BLOCK.SNOW, subBlock: BLOCK.DIRT, treeChance: 0.02, plantChance: 0.05, treeType: 'SPRUCE' },
    TAIGA: { height: 20, scale: 0.02, topBlock: BLOCK.GRASS, subBlock: BLOCK.DIRT, treeChance: 0.15, plantChance: 0.05, treeType: 'SPRUCE' },
    SAVANNA: { height: 8, scale: 0.008, topBlock: BLOCK.GRASS, subBlock: BLOCK.DIRT, treeChance: 0.02, plantChance: 0.15, treeType: 'OAK' },
    PLAINS: { height: 5, scale: 0.01, topBlock: BLOCK.GRASS, subBlock: BLOCK.DIRT, treeChance: 0.01, plantChance: 0.2, treeType: 'OAK' },
    FOREST: { height: 15, scale: 0.02, topBlock: BLOCK.GRASS, subBlock: BLOCK.DIRT, treeChance: 0.15, plantChance: 0.1, treeType: 'BIRCH' },
    JUNGLE: { height: 25, scale: 0.025, topBlock: BLOCK.GRASS, subBlock: BLOCK.DIRT, treeChance: 0.3, plantChance: 0.3, treeType: 'JUNGLE' },
    SWAMP: { height: 2, scale: 0.015, topBlock: BLOCK.MUD, subBlock: BLOCK.DIRT, treeChance: 0.08, plantChance: 0.15, treeType: 'OAK' },
    BADLANDS: { height: 25, scale: 0.01, topBlock: BLOCK.RED_SAND, subBlock: BLOCK.TERRACOTTA, treeChance: 0.001, plantChance: 0.02, treeType: 'CACTUS' },
    VOLCANIC: { height: 30, scale: 0.02, topBlock: BLOCK.OBSIDIAN, subBlock: BLOCK.STONE, treeChance: 0, plantChance: 0, treeType: 'NONE' },
    DESERT: { height: 8, scale: 0.01, topBlock: BLOCK.SAND, subBlock: BLOCK.SANDSTONE, treeChance: 0.005, plantChance: 0.05, treeType: 'CACTUS' },
    MOUNTAINS: { height: 60, scale: 0.005, topBlock: BLOCK.STONE, subBlock: BLOCK.STONE, treeChance: 0.005, plantChance: 0.01, treeType: 'SPRUCE' },
    OCEAN: { height: -15, scale: 0.01, topBlock: BLOCK.SAND, subBlock: BLOCK.SAND, treeChance: 0, plantChance: 0, treeType: 'NONE' },
    MUSHROOM_ISLAND: { height: 10, scale: 0.015, topBlock: BLOCK.MYCELIUM, subBlock: BLOCK.DIRT, treeChance: 0.05, plantChance: 0.2, treeType: 'GIANT_MUSHROOM' },
    ICE_SPIKES: { height: 15, scale: 0.02, topBlock: BLOCK.SNOW, subBlock: BLOCK.DIRT, treeChance: 0.05, plantChance: 0, treeType: 'ICE_SPIKE' },
    CHERRY_GROVE: { height: 35, scale: 0.015, topBlock: BLOCK.GRASS, subBlock: BLOCK.DIRT, treeChance: 0.2, plantChance: 0.3, treeType: 'CHERRY' },
    DARK_FOREST: { height: 15, scale: 0.02, topBlock: BLOCK.GRASS, subBlock: BLOCK.DIRT, treeChance: 0.4, plantChance: 0.2, treeType: 'DARK_OAK' }
  };

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const urlParams = new URLSearchParams(window.location.search);
    this.isHub = (urlParams.get('server') || 'hub') === 'hub';
    this.lightingManager = new LightingManager(this);
    const texture = createTextureAtlas();
    
    this.opaqueMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: false,
      vertexColors: true,
      roughness: 0.8,
      metalness: 0.1
    });

    this.opaqueMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uPerformanceMode = { value: settingsManager.getSettings().performanceMode ? 1.0 : 0.0 };
      shader.uniforms.uShaders = { value: settingsManager.getSettings().premiumShaders ? 1.0 : 0.0 };
      (this.opaqueMaterial as any).userData = shader.uniforms;

      shader.vertexShader = `
        uniform float uTime;
        uniform float uPerformanceMode;
        uniform float uShaders;
        attribute float aSway;
        attribute vec2 aTileBase;
        varying vec2 vTileBase;
        ${shader.vertexShader}
      `.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vTileBase = aTileBase;
        // Wind swaying for leaves and plants (aSway == 1 for top vertices)
        if (uPerformanceMode < 0.5 && uShaders > 0.5 && aSway > 0.5 && aSway < 1.5) {
          float sway = sin(uTime * 2.0 + (position.x + modelMatrix[3][0]) * 0.5 + (position.z + modelMatrix[3][2]) * 0.5) * 0.1;
          transformed.x += sway * aSway;
          transformed.z += sway * aSway;
        }
        // Vertical displacement for lava (aSway == 3)
        if (uPerformanceMode < 0.5 && uShaders > 0.5 && aSway > 2.5) {
          transformed.y += sin(uTime * 0.5 + (position.x + modelMatrix[3][0]) * 0.2 + (position.z + modelMatrix[3][2]) * 0.2) * 0.05;
        }
        `
      );

      shader.fragmentShader = `
        varying vec2 vTileBase;
        ${shader.fragmentShader}
      `.replace(
        '#include <map_fragment>',
        `
        #ifdef USE_MAP
          vec2 localUv = fract(vMapUv) / 32.0;
          float margin = 0.0005;
          localUv.x = clamp(localUv.x, margin, 0.03125 - margin);
          localUv.y = clamp(localUv.y, margin, 0.03125 - margin);
          vec2 animatedUv = vTileBase + localUv;
          vec4 texelColor = texture2D( map, animatedUv );
          diffuseColor *= texelColor;
        #endif
        `
      );
    };

    this.opaqueDepthMaterial = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking
    });

    this.opaqueDepthMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uPerformanceMode = { value: settingsManager.getSettings().performanceMode ? 1.0 : 0.0 };
      shader.uniforms.uShaders = { value: settingsManager.getSettings().premiumShaders ? 1.0 : 0.0 };
      (this.opaqueDepthMaterial as any).userData = shader.uniforms;

      shader.vertexShader = `
        uniform float uTime;
        uniform float uPerformanceMode;
        uniform float uShaders;
        attribute float aSway;
        attribute vec2 aTileBase;
        ${shader.vertexShader}
      `.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        // Wind swaying for leaves and plants (aSway == 1 for top vertices)
        if (uPerformanceMode < 0.5 && uShaders > 0.5 && aSway > 0.5 && aSway < 1.5) {
          float sway = sin(uTime * 2.0 + (position.x + modelMatrix[3][0]) * 0.5 + (position.z + modelMatrix[3][2]) * 0.5) * 0.1;
          transformed.x += sway * aSway;
          transformed.z += sway * aSway;
        }
        // Vertical displacement for lava (aSway == 3)
        if (uPerformanceMode < 0.5 && uShaders > 0.5 && aSway > 2.5) {
          transformed.y += sin(uTime * 0.5 + (position.x + modelMatrix[3][0]) * 0.2 + (position.z + modelMatrix[3][2]) * 0.2) * 0.05;
        }
        `
      );
    };

    this.transparentDepthMaterial = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      map: texture,
      alphaTest: 0.5,
      side: THREE.DoubleSide
    });

    this.transparentDepthMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uPerformanceMode = { value: settingsManager.getSettings().performanceMode ? 1.0 : 0.0 };
      shader.uniforms.uShaders = { value: settingsManager.getSettings().premiumShaders ? 1.0 : 0.0 };
      (this.transparentDepthMaterial as any).userData = shader.uniforms;

      shader.vertexShader = `
        uniform float uTime;
        uniform float uPerformanceMode;
        uniform float uShaders;
        attribute float aSway;
        attribute vec2 aTileBase;
        varying vec2 vTileBase;
        ${shader.vertexShader}
      `.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vTileBase = aTileBase;
        // Wind swaying for leaves and plants (aSway == 1 for top vertices)
        if (uPerformanceMode < 0.5 && uShaders > 0.5 && aSway > 0.5 && aSway < 1.5) {
          float sway = sin(uTime * 2.0 + (position.x + modelMatrix[3][0]) * 0.5 + (position.z + modelMatrix[3][2]) * 0.5) * 0.1;
          transformed.x += sway * aSway;
          transformed.z += sway * aSway;
        }
        // Add vertical wave displacement for water (aSway == 2)
        if (uPerformanceMode < 0.5 && uShaders > 0.5 && aSway > 1.5 && aSway < 2.5) {
          transformed.y += sin(uTime * 1.5 + (position.x + modelMatrix[3][0]) * 0.5 + (position.z + modelMatrix[3][2]) * 0.5) * 0.08;
        }
        // Vertical displacement for lava (aSway == 3)
        if (uPerformanceMode < 0.5 && uShaders > 0.5 && aSway > 2.5) {
          transformed.y += sin(uTime * 0.5 + (position.x + modelMatrix[3][0]) * 0.2 + (position.z + modelMatrix[3][2]) * 0.2) * 0.05;
        }
        `
      );

      shader.fragmentShader = `
        varying vec2 vTileBase;
        ${shader.fragmentShader}
      `.replace(
        '#include <map_fragment>',
        `
        #ifdef USE_MAP
          vec2 localUv = fract(vMapUv) / 32.0;
          float margin = 0.0005;
          localUv.x = clamp(localUv.x, margin, 0.03125 - margin);
          localUv.y = clamp(localUv.y, margin, 0.03125 - margin);
          vec2 animatedUv = vTileBase + localUv;
          vec4 texelColor = texture2D( map, animatedUv );
          diffuseColor *= texelColor;
        #endif
        `
      );
    };


    this.transparentMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.5, // Increased to remove square edges on torches
      depthWrite: true, // Enable depth write to prevent "X-ray" glitches between water blocks
      polygonOffset: true, // Use polygon offset to prevent Z-fighting at chunk boundaries
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
      vertexColors: true,
      side: THREE.DoubleSide, // Visible from both sides for underwater view
      roughness: 0.1,
      metalness: 0.1
    });

    this.transparentMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uPerformanceMode = { value: settingsManager.getSettings().performanceMode ? 1.0 : 0.0 };
      shader.uniforms.uShaders = { value: settingsManager.getSettings().premiumShaders ? 1.0 : 0.0 };
      (this.transparentMaterial as any).userData = shader.uniforms;

      shader.vertexShader = `
        uniform float uTime;
        uniform float uPerformanceMode;
        uniform float uShaders;
        attribute float aSway;
        attribute vec2 aTileBase;
        varying vec3 vWorldPos;
        varying vec2 vTileBase;
        ${shader.vertexShader}
      `.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vTileBase = aTileBase;
        // Wind swaying for leaves and plants (aSway == 1 for top vertices)
        if (uPerformanceMode < 0.5 && uShaders > 0.5 && aSway > 0.5 && aSway < 1.5) {
          float sway = sin(uTime * 2.0 + (position.x + modelMatrix[3][0]) * 0.5 + (position.z + modelMatrix[3][2]) * 0.5) * 0.1;
          transformed.x += sway * aSway;
          transformed.z += sway * aSway;
        }
        // Add vertical wave displacement for water (aSway == 2)
        if (uPerformanceMode < 0.5 && uShaders > 0.5 && aSway > 1.5 && aSway < 2.5) {
          transformed.y += sin(uTime * 1.5 + (position.x + modelMatrix[3][0]) * 0.5 + (position.z + modelMatrix[3][2]) * 0.5) * 0.08;
        }
        // Vertical displacement for lava (aSway == 3)
        if (uPerformanceMode < 0.5 && uShaders > 0.5 && aSway > 2.5) {
          transformed.y += sin(uTime * 0.5 + (position.x + modelMatrix[3][0]) * 0.2 + (position.z + modelMatrix[3][2]) * 0.2) * 0.05;
        }
        `
      ).replace(
        '#include <worldpos_vertex>',
        `
        #include <worldpos_vertex>
        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        `
      );

      shader.fragmentShader = `
        uniform float uTime;
        uniform float uPerformanceMode;
        uniform float uShaders;
        varying vec3 vWorldPos;
        varying vec2 vTileBase;
        ${shader.fragmentShader}
      `.replace(
        '#include <map_fragment>',
        `
        #ifdef USE_MAP
          vec2 localUv = fract(vMapUv) / 32.0;
          float margin = 0.0005;
          localUv.x = clamp(localUv.x, margin, 0.03125 - margin);
          localUv.y = clamp(localUv.y, margin, 0.03125 - margin);
          vec2 animatedUv = vTileBase + localUv;
          
          float shimmer = 0.0;
          // Water is at [0, 2] in 32x32 atlas. U: 0, V: 29/32 = 0.90625
          if (uPerformanceMode < 0.5 && uShaders > 0.5 && vTileBase.y > 0.90 && vTileBase.y < 0.91 && vTileBase.x < 0.01) {
            // Use world position for continuous waves across chunks
            vec2 wPos = vWorldPos.xz * 0.2;
            float wave = sin(uTime * 0.5 + wPos.y + wPos.x) * 0.005;
            
            animatedUv.x = vTileBase.x + margin + fract(vWorldPos.x * 0.25 + uTime * 0.01 + wave) * (0.03125 - 2.0 * margin);
            animatedUv.y = vTileBase.y + margin + fract(vWorldPos.z * 0.25 + uTime * 0.015) * (0.03125 - 2.0 * margin);
            
            // Add a "cooling" shimmer/caustic effect
            float shimmer1 = sin(vWorldPos.x * 0.8 + uTime * 1.5) * cos(vWorldPos.z * 0.8 + uTime * 1.2);
            float shimmer2 = sin(vWorldPos.x * 1.5 - uTime * 0.8) * cos(vWorldPos.z * 1.5 - uTime * 1.1);
            shimmer = pow(max(0.0, (shimmer1 + shimmer2) * 0.5), 8.0) * 0.4;
          }
          vec4 texelColor = texture2D( map, animatedUv );
          texelColor.rgb += shimmer; // Apply the cooling shimmer
          diffuseColor *= texelColor;
        #endif
        `
      );
    };
  }

  updateMaterials(delta: number) {
    const settings = settingsManager.getSettings();
    const isPerformanceMode = settings.performanceMode;
    const isPremiumShadersEnabled = settings.premiumShaders;
    
    // Update performance mode uniform
    if ((this.opaqueMaterial as any).userData?.uPerformanceMode) {
      (this.opaqueMaterial as any).userData.uPerformanceMode.value = isPerformanceMode ? 1.0 : 0.0;
    }
    if ((this.transparentMaterial as any).userData?.uPerformanceMode) {
      (this.transparentMaterial as any).userData.uPerformanceMode.value = isPerformanceMode ? 1.0 : 0.0;
    }
    if ((this.opaqueDepthMaterial as any).userData?.uPerformanceMode) {
      (this.opaqueDepthMaterial as any).userData.uPerformanceMode.value = isPerformanceMode ? 1.0 : 0.0;
    }
    if ((this.transparentDepthMaterial as any).userData?.uPerformanceMode) {
      (this.transparentDepthMaterial as any).userData.uPerformanceMode.value = isPerformanceMode ? 1.0 : 0.0;
    }

    // Update premium shaders uniform
    if ((this.opaqueMaterial as any).userData?.uShaders) {
      (this.opaqueMaterial as any).userData.uShaders.value = isPremiumShadersEnabled ? 1.0 : 0.0;
    }
    if ((this.transparentMaterial as any).userData?.uShaders) {
      (this.transparentMaterial as any).userData.uShaders.value = isPremiumShadersEnabled ? 1.0 : 0.0;
    }
    if ((this.opaqueDepthMaterial as any).userData?.uShaders) {
      (this.opaqueDepthMaterial as any).userData.uShaders.value = isPremiumShadersEnabled ? 1.0 : 0.0;
    }
    if ((this.transparentDepthMaterial as any).userData?.uShaders) {
      (this.transparentDepthMaterial as any).userData.uShaders.value = isPremiumShadersEnabled ? 1.0 : 0.0;
    }

    if (isPerformanceMode) return; // Skip animations in performance mode

    if ((this.opaqueMaterial as any).userData?.uTime) {
      (this.opaqueMaterial as any).userData.uTime.value += delta;
    }
    if ((this.transparentMaterial as any).userData?.uTime) {
      (this.transparentMaterial as any).userData.uTime.value += delta;
    }
    if ((this.opaqueDepthMaterial as any).userData?.uTime) {
      (this.opaqueDepthMaterial as any).userData.uTime.value += delta;
    }
    if ((this.transparentDepthMaterial as any).userData?.uTime) {
      (this.transparentDepthMaterial as any).userData.uTime.value += delta;
    }
  }

  getChunkKey(cx: number, cz: number) {
    return `${cx},${cz}`;
  }

  generateHubTerrain(chunk: Chunk, lx: number, lz: number, wx: number, wz: number) {
    const distSq = wx * wx + wz * wz;
    const dist = Math.sqrt(distSq);

    // 1. Floating Island Base
    for (let y = -60; y <= 0; y++) {
      const cy = y + 60;
      const radiusAtY = Math.sqrt(y + 60) * 11;
      const noise = (Math.sin(wx * 0.1) + Math.cos(wz * 0.1)) * 4;
      
      if (dist < radiusAtY + noise) {
        let type = BLOCK.DEEPSLATE;
        if (y === 0) type = BLOCK.POLISHED_ANDESITE;
        else if (y < -45) type = BLOCK.OBSIDIAN;
        else if (y < -25) type = (Math.sin(wx * 0.5 + wz * 0.5) > 0) ? BLOCK.COBBLED_DEEPSLATE : BLOCK.OBSIDIAN;
        else type = (Math.cos(wx * 0.4 - wz * 0.4) > 0) ? BLOCK.DEEPSLATE : BLOCK.COBBLED_DEEPSLATE;
        chunk.setBlockFast(lx, cy, lz, type);
      }
    }

    // 2. Surface Decor (at Y=0, which is cy=60)
    if (dist <= 85) {
      if (dist <= 30) {
         chunk.setBlockFast(lx, 60, lz, BLOCK.CONCRETE_GRAY);
         let petals = 8;
         let angle = Math.atan2(wz, wx);
         let starMod = Math.abs(Math.sin(angle * petals));
         if (dist > 10 && dist < 10 + starMod * 15) {
            chunk.setBlockFast(lx, 60, lz, BLOCK.CONCRETE_BLACK);
         } else if (Math.floor(dist) === 28) {
            chunk.setBlockFast(lx, 60, lz, BLOCK.OBSIDIAN);
         }
      }

      if ((Math.abs(wx) <= 4 && dist <= 85) || (Math.abs(wz) <= 4 && dist <= 85)) {
         chunk.setBlockFast(lx, 60, lz, BLOCK.NETHER_BRICKS);
         if (Math.abs(wx) === 5 || Math.abs(wz) === 5) {
            chunk.setBlockFast(lx, 61, lz, BLOCK.OBSIDIAN);
         }
      }

      if (dist <= 6) {
         chunk.setBlockFast(lx, 61, lz, BLOCK.OBSIDIAN);
         if (dist <= 4) chunk.setBlockFast(lx, 62, lz, BLOCK.RED_NETHER_BRICKS);
         if (dist <= 2) {
             for(let y=61; y<=64; y++) chunk.setBlockFast(lx, y, lz, BLOCK.LAVA);
             chunk.setBlockFast(lx, 65, lz, BLOCK.GLOWSTONE);
         }
      }

      this.buildGothicCastles(chunk, lx, lz, wx, wz);
      
      const ringY = 115;
      const ringNoise = Math.sin(Math.atan2(wz, wx) * 6) * 15;
      if (Math.abs(dist - 85) < 1.1) {
          const cy = Math.floor(ringY + ringNoise);
          if (cy >= 0 && cy < CHUNK_HEIGHT) {
              chunk.setBlockFast(lx, cy, lz, BLOCK.GLOWSTONE);
              if (cy > 0) chunk.setBlockFast(lx, cy - 1, lz, BLOCK.GLASS_PURPLE);
              if (cy > 1) chunk.setBlockFast(lx, cy - 2, lz, BLOCK.GLASS_MAGENTA);
              if (cy > 2) chunk.setBlockFast(lx, cy - 3, lz, BLOCK.OBSIDIAN);
          }
      }

      const corners: [number, number][] = [[45,45], [-45, 45], [45, -45], [-45, -45]];
      for(const [cx, cz] of corners) {
          const dC = Math.sqrt((wx-cx)**2 + (wz-cz)**2);
          if (dC <= 6) {
              const h = 25 + Math.floor((6-dC)*12);
              for(let y=0; y<=h; y++) {
                const cy = y + 60;
                if (cy >= CHUNK_HEIGHT) break;
                let bt = BLOCK.DEEPSLATE;
                if (dC <= 1.5) bt = BLOCK.GLOWSTONE;
                else if (dC <= 2.5 && y > h - 15) bt = BLOCK.GLASS_PURPLE;
                else if (y % 20 === 0 && dC > 5.5) bt = BLOCK.GLOWSTONE;
                chunk.setBlockFast(lx, cy, lz, bt);
              }
          }
      }
    }
  }

  buildGothicCastles(chunk: Chunk, lx: number, lz: number, wx: number, wz: number) {
     const centers: [number, number, number][] = [[0, 35, 0], [35, 0, 1], [0, -35, 2], [-35, 0, 3]];
     for(const [cx, cz, rot] of centers) {
        let lx_c, lz_c;
        if (rot === 0) { lx_c = wx - cx; lz_c = wz - cz; }
        else if (rot === 1) { lx_c = -(wz - cz); lz_c = wx - cx; }
        else if (rot === 2) { lx_c = -(wx - cx); lz_c = -(wz - cz); }
        else { lx_c = wz - cz; lz_c = -(wx - cx); }

        const width = 16;
        const length = 28;

        if (lx_c >= -width && lx_c <= width && lz_c >= 0 && lz_c <= length) {
            const isBorder = (Math.abs(lx_c) === width || lz_c === 0 || lz_c === length);
            if (isBorder && !(lz_c === 0 && Math.abs(lx_c) <= 3)) {
                for(let y=1; y<=25; y++) {
                    let bt = BLOCK.DEEPSLATE;
                    if (y >= 5 && y <= 20 && lz_c > 3 && lz_c < length - 3 && lz_c % 5 === 0) bt = BLOCK.GLASS_PURPLE;
                    chunk.setBlockFast(lx, y + 60, lz, bt);
                }
            } else if (!isBorder) {
                chunk.setBlockFast(lx, 60, lz, BLOCK.CONCRETE_BLACK);
                const archH = 25 + (width - Math.abs(lx_c)) * 0.9;
                chunk.setBlockFast(lx, Math.floor(archH) + 60, lz, BLOCK.COBBLED_DEEPSLATE);
                if (lz_c % 10 === 0 && lz_c > 2 && lz_c < length - 2 && Math.abs(lx_c) === width - 4) {
                    chunk.setBlockFast(lx, 61, lz, BLOCK.NETHER_BRICKS);
                    chunk.setBlockFast(lx, 62, lz, BLOCK.NETHER_BRICKS);
                    chunk.setBlockFast(lx, 63, lz, BLOCK.GLOWSTONE);
                }
            }
        }

        if (lz_c === 0 && Math.abs(lx_c) <= width) {
            for(let y=25; y<=45; y++) {
                if (Math.abs(lx_c) <= (45 - y) * 0.8) {
                    let bt = BLOCK.DEEPSLATE;
                    if (y >= 30 && y <= 38 && Math.abs(lx_c) <= 3) bt = BLOCK.GLASS_RED;
                    else if (y >= 26 && y <= 28 && lx_c === 0) bt = BLOCK.GLOWSTONE;
                    chunk.setBlockFast(lx, y + 60, lz, bt);
                }
            }
        }

        const towers: [number, number, number][] = [[width, 0, 55], [-width, 0, 55], [width, length, 40], [-width, length, 40]];
        for(const [tx, tz, th] of towers) {
            const dt = Math.max(Math.abs(lx_c - tx), Math.abs(lz_c - tz));
            if (dt <= 3) {
                for(let y=1; y<=th; y++) {
                    let bt = (y % 15 === 0) ? BLOCK.OBSIDIAN : BLOCK.NETHER_BRICKS;
                    if (dt < 3) bt = BLOCK.AIR;
                    if (y === 1 && dt < 3) bt = BLOCK.NETHER_BRICKS;
                    if (bt !== BLOCK.AIR) chunk.setBlockFast(lx, y + 60, lz, bt);
                }
                for (let y = 1; y <= 20; y++) {
                    const sr = Math.max(0, 3 - Math.floor(y/6));
                    if (dt <= sr) chunk.setBlockFast(lx, th + y + 60, lz, BLOCK.OBSIDIAN);
                }
            }
        }
     }
  }

  getChunk(cx: number, cz: number) {
    return this.chunks.get(this.getChunkKey(cx, cz));
  }

  getBlock(x: number, y: number, z: number) {
    const cy = y - WORLD_Y_OFFSET;
    if (cy < 0 || cy >= CHUNK_HEIGHT) return BLOCK.AIR;
    const cx = x >> 4;
    const cz = z >> 4;
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return BLOCK.AIR;
    
    return chunk.blocks[(x & 15) | ((z & 15) << 4) | (cy << 8)];
  }

  getLight(x: number, y: number, z: number) {
    const cy = Math.floor(y) - WORLD_Y_OFFSET;
    if (cy < 0 || cy >= CHUNK_HEIGHT) return 15;
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const cx = ix >> 4;
    const cz = iz >> 4;
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return 15;
    
    return chunk.light[(ix & 15) | ((iz & 15) << 4) | (cy << 8)];
  }

  setLight(x: number, y: number, z: number, level: number) {
    const cy = Math.floor(y) - WORLD_Y_OFFSET;
    if (cy < 0 || cy >= CHUNK_HEIGHT) return;
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const cx = ix >> 4;
    const cz = iz >> 4;
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return;
    
    const bx = ix & 15;
    const bz = iz & 15;
    chunk.light[bx | (bz << 4) | (cy << 8)] = level;
    chunk.needsUpdate = true;
    
    // Ensure neighboring chunks update if we modify light at the edge
    if (bx === 0) { 
      const c = this.getChunk(cx - 1, cz); if (c) c.needsUpdate = true; 
      if (bz === 0) { const c2 = this.getChunk(cx - 1, cz - 1); if (c2) c2.needsUpdate = true; }
      if (bz === 15) { const c2 = this.getChunk(cx - 1, cz + 1); if (c2) c2.needsUpdate = true; }
    }
    if (bx === 15) { 
      const c = this.getChunk(cx + 1, cz); if (c) c.needsUpdate = true; 
      if (bz === 0) { const c2 = this.getChunk(cx + 1, cz - 1); if (c2) c2.needsUpdate = true; }
      if (bz === 15) { const c2 = this.getChunk(cx + 1, cz + 1); if (c2) c2.needsUpdate = true; }
    }
    if (bz === 0) { const c = this.getChunk(cx, cz - 1); if (c) c.needsUpdate = true; }
    if (bz === 15) { const c = this.getChunk(cx, cz + 1); if (c) c.needsUpdate = true; }
  }

  isIndestructible(x: number, y: number, z: number) {
    let isHub = false;
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      isHub = (urlParams.get('server') || 'hub') === 'hub';
    }
    
    // The entire hub world is indestructible to prevent players from mining the spawn
    if (isHub) return true;

    const key = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    if (this.bakedBlocks.has(key)) return true;

    // Bedrock is always indestructible
    if (y === -60) return true;

    // Castle footprints (including fences/walls at +-30)
    const isWithinX = x >= -30 && x <= 30;
    const isBlueCastleZ = z >= 70 && z <= 130;
    const isRedCastleZ = z >= -130 && z <= -70;

    // Castles and the grass layer immediately beneath them (y=4)
    if (isWithinX && (isBlueCastleZ || isRedCastleZ) && y >= 4) {
      return true;
    }

    // Village boundaries (protected area)
    const isBlueVillageZ = z >= 131 && z <= 180;
    const isRedVillageZ = z >= -180 && z <= -131;
    const isVillageX = x >= -50 && x <= 50;
    if (isVillageX && (isBlueVillageZ || isRedVillageZ) && y >= 4) {
      return true;
    }

    return false;
  }

  setBlock(x: number, y: number, z: number, type: number, sync: boolean = true, force: boolean = false): boolean {
    const cy = y - WORLD_Y_OFFSET;
    if (cy < 0 || cy >= CHUNK_HEIGHT) return false;
    
    // Prevent any modification to indestructible areas (Castles and Bedrock)
    if (!force && this.isIndestructible(x, y, z)) {
      return false;
    }

    const cx = x >> 4;
    const cz = z >> 4;
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return false;
    
    const bx = x & 15;
    const bz = z & 15;
    const oldType = chunk.getBlock(bx, cy, bz);
    chunk.setBlock(bx, cy, bz, type);

    // Light update
    const isEmissive = type === BLOCK.GLOWSTONE || type === BLOCK.LAVA || isAnyTorch(type);
    const oldIsEmissive = oldType === BLOCK.GLOWSTONE || oldType === BLOCK.LAVA || isAnyTorch(oldType);
    
    if (isEmissive) {
      this.setLight(x, y, z, 14);
      this.lightingManager.addLightUpdate(x, y, z, 14);
    } else if (oldIsEmissive) {
      const oldLight = this.getLight(x, y, z);
      this.lightingManager.addLightRemoval(x, y, z, oldLight);
      this.setLight(x, y, z, 0);
    } else if (isSolidBlock(type) && !isSolidBlock(oldType)) {
      const oldLight = this.getLight(x, y, z);
      if (oldLight > 0) {
        this.lightingManager.addLightRemoval(x, y, z, oldLight);
        this.setLight(x, y, z, 0);
      }
    } else if (!isSolidBlock(type) && isSolidBlock(oldType)) {
      // Check neighbors for light to propagate
      const neighbors = [
        { dx: 1, dy: 0, dz: 0 }, { dx: -1, dy: 0, dz: 0 },
        { dx: 0, dy: 1, dz: 0 }, { dx: 0, dy: -1, dz: 0 },
        { dx: 0, dy: 0, dz: 1 }, { dx: 0, dy: 0, dz: -1 }
      ];
      for (const n of neighbors) {
        const nl = this.getLight(x + n.dx, y + n.dy, z + n.dz);
        if (nl > 1) {
          this.lightingManager.addLightUpdate(x + n.dx, y + n.dy, z + n.dz, nl);
        }
      }
    }

    // Trigger gravity check for the block above and the block itself
    this.addGravityCheck(x, y + 1, z);
    this.addGravityCheck(x, y, z);

    // Trigger water flow check for the block and its neighbors
    this.addWaterCheck(x, y, z);
    this.addWaterCheck(x + 1, y, z);
    this.addWaterCheck(x - 1, y, z);
    this.addWaterCheck(x, y + 1, z);
    this.addWaterCheck(x, y - 1, z);
    this.addWaterCheck(x, y, z + 1);
    this.addWaterCheck(x, y, z - 1);

    // Update neighboring chunks if on the edge
    if (bx === 0) { 
      const c = this.getChunk(cx - 1, cz); if (c) c.needsUpdate = true; 
      if (bz === 0) { const c2 = this.getChunk(cx - 1, cz - 1); if (c2) c2.needsUpdate = true; }
      if (bz === 15) { const c2 = this.getChunk(cx - 1, cz + 1); if (c2) c2.needsUpdate = true; }
    }
    if (bx === 15) { 
      const c = this.getChunk(cx + 1, cz); if (c) c.needsUpdate = true; 
      if (bz === 0) { const c2 = this.getChunk(cx + 1, cz - 1); if (c2) c2.needsUpdate = true; }
      if (bz === 15) { const c2 = this.getChunk(cx + 1, cz + 1); if (c2) c2.needsUpdate = true; }
    }
    if (bz === 0) { const c = this.getChunk(cx, cz - 1); if (c) c.needsUpdate = true; }
    if (bz === 15) { const c = this.getChunk(cx, cz + 1); if (c) c.needsUpdate = true; }

    return true;
  }

  hasWeight(blockType: number) {
    return blockType === BLOCK.SAND || blockType === BLOCK.GRASS || blockType === BLOCK.LEAVES;
  }

  addGravityCheck(x: number, y: number, z: number) {
    this.fallingBlocks.add(`${x},${y},${z}`);
  }

  addWaterCheck(x: number, y: number, z: number) {
    this.waterUpdates.add(`${x},${y},${z}`);
  }

  tick(delta: number) {
    this.tickAccumulator += delta;
    if (this.tickAccumulator < this.tickRate) return;
    this.tickAccumulator = 0;

    this.lightingManager.processLightUpdates();

    if (this.fallingBlocks.size === 0 && this.waterUpdates.size === 0) return;

    if (this.waterUpdates.size > 0) {
      const MAX_WATER_UPDATES_PER_TICK = 500;
      const waterToCheck = Array.from(this.waterUpdates).slice(0, MAX_WATER_UPDATES_PER_TICK);
      
      for (const key of waterToCheck) {
        this.waterUpdates.delete(key);
      }

      for (const key of waterToCheck) {
        const [x, y, z] = key.split(',').map(Number);
        const block = this.getBlock(x, y, z);

        if (isWater(block)) {
          let level = 0;
          if (block === BLOCK.WATER) level = 0;
          else level = block - BLOCK.WATER_1 + 1;

          // Check if it should disappear (if it's flowing water)
          if (level > 0) {
            const above = this.getBlock(x, y + 1, z);
            let hasSource = isWater(above);
            
            if (!hasSource) {
              const checkSource = (nx: number, nz: number) => {
                const n = this.getBlock(nx, y, nz);
                if (isWater(n)) {
                  let nLevel = n === BLOCK.WATER ? 0 : n - BLOCK.WATER_1 + 1;
                  if (nLevel < level) return true;
                }
                return false;
              };
              
              if (checkSource(x + 1, z) || checkSource(x - 1, z) || checkSource(x, z + 1) || checkSource(x, z - 1)) {
                hasSource = true;
              }
            }

            if (!hasSource) {
              this.setBlock(x, y, z, BLOCK.AIR, true);
              continue; // It disappeared, no need to flow
            }
          }

          // Flow logic
          if (level < 7) {
            const below = this.getBlock(x, y - 1, z);
            let nLevelBelow = isWater(below) ? (below === BLOCK.WATER ? 0 : below - BLOCK.WATER_1 + 1) : 999;
            
            if (below === BLOCK.AIR || (isWater(below) && nLevelBelow > 1)) {
              // Flow down
              if (below === BLOCK.AIR) {
                audioManager.play('splash', 0.1, 0.5 + Math.random() * 0.5);
              }
              this.setBlock(x, y - 1, z, BLOCK.WATER_1, true);
            } else if (!isWater(below) && below !== BLOCK.AIR) {
              // Flow horizontally
              const nextLevel = level + 1;
              const nextBlockType = BLOCK.WATER_1 + nextLevel - 1;
              
              const checkAndFlow = (nx: number, nz: number) => {
                const neighbor = this.getBlock(nx, y, nz);
                if (neighbor === BLOCK.AIR) {
                  this.setBlock(nx, y, nz, nextBlockType, true);
                } else if (isWater(neighbor)) {
                  let nLevel = neighbor === BLOCK.WATER ? 0 : neighbor - BLOCK.WATER_1 + 1;
                  if (nLevel > nextLevel) {
                    this.setBlock(nx, y, nz, nextBlockType, true);
                  }
                }
              };

              checkAndFlow(x + 1, z);
              checkAndFlow(x - 1, z);
              checkAndFlow(x, z + 1);
              checkAndFlow(x, z - 1);
            }
          }
        }
      }
    }

    if (this.fallingBlocks.size > 0) {
      const MAX_FALLING_UPDATES_PER_TICK = 100;
      const toCheck = Array.from(this.fallingBlocks).slice(0, MAX_FALLING_UPDATES_PER_TICK);
      
      for (const key of toCheck) {
        this.fallingBlocks.delete(key);
      }

      for (const key of toCheck) {
        const [x, y, z] = key.split(',').map(Number);
        const block = this.getBlock(x, y, z);
        
        const isPlantType = isAnyTorch(block) || block === BLOCK.TALL_GRASS || block === BLOCK.FLOWER_RED || block === BLOCK.FLOWER_YELLOW || block === BLOCK.WHEAT;
        
        if (this.hasWeight(block)) {
          const below = this.getBlock(x, y - 1, z);
          if (below === BLOCK.AIR || isWater(below)) {
            if (this.setBlock(x, y, z, BLOCK.AIR, true)) {
              this.setBlock(x, y - 1, z, block, true);
              
              this.addGravityCheck(x, y - 1, z);
              this.addGravityCheck(x, y + 1, z);
              this.addGravityCheck(x + 1, y, z);
              this.addGravityCheck(x - 1, y, z);
              this.addGravityCheck(x, y, z + 1);
              this.addGravityCheck(x, y, z - 1);
            }
          }
        } else if (isPlantType) {
          let supportBlock = BLOCK.AIR;
          if (block === BLOCK.TORCH_WALL_X_POS) supportBlock = this.getBlock(x + 1, y, z);
          else if (block === BLOCK.TORCH_WALL_X_NEG) supportBlock = this.getBlock(x - 1, y, z);
          else if (block === BLOCK.TORCH_WALL_Z_POS) supportBlock = this.getBlock(x, y, z + 1);
          else if (block === BLOCK.TORCH_WALL_Z_NEG) supportBlock = this.getBlock(x, y, z - 1);
          else supportBlock = this.getBlock(x, y - 1, z);

          if (!isSolidBlock(supportBlock)) {
            this.setBlock(x, y, z, BLOCK.AIR, true);
            this.addGravityCheck(x, y + 1, z);
          }
        }
      }
    }
    
    // Process any light updates that resulted from block changes caused by gravity or water falling
    this.lightingManager.processLightUpdates();
  }

  getCastleBlock(wx: number, wy: number, wz: number, zOffset: number, accentBlock: number): number {
    const localZ = wz - zOffset;

    // 1. Towers at corners (+-30, +-30)
    const isTower = (cx: number, cz: number) => {
      const dx = wx - cx;
      const dz = localZ - cz;
      const distSq = dx * dx + dz * dz;
      
      if (distSq <= 25 && wy <= 30) {
        if (distSq >= 16) {
          // Arrow slits
          if (wy > 10 && wy < 25 && wy % 5 >= 2 && wy % 5 <= 3 && (Math.abs(dx) <= 1 || Math.abs(dz) <= 1)) {
            return BLOCK.AIR;
          }
          // Tower battlements
          if (wy === 30 && ((wx + localZ) % 2 !== 0)) return BLOCK.AIR;
          return wy >= 28 ? accentBlock : BLOCK.STONE;
        }
        if (wy % 10 === 0 && wy > 5) return BLOCK.WOOD;
        return BLOCK.AIR;
      }
      
      // Pointed Roof
      if (wy > 30 && wy <= 45) {
        const roofRadiusSq = 25 - (wy - 30) * 1.8;
        if (distSq <= roofRadiusSq) {
          return accentBlock;
        }
      }
      return -1;
    };

    const t1 = isTower(-30, -30); if (t1 !== -1) return t1;
    const t2 = isTower(-30, 30);  if (t2 !== -1) return t2;
    const t3 = isTower(30, -30);  if (t3 !== -1) return t3;
    const t4 = isTower(30, 30);   if (t4 !== -1) return t4;

    // 2. Outer Walls and Details (x = +-31, z = +-31)
    if (wx >= -31 && wx <= 31 && localZ >= -31 && localZ <= 31) {
      const isWallX = (wx === -30 || wx === 30) && localZ >= -30 && localZ <= 30;
      const isWallZ = (localZ === -30 || localZ === 30) && wx >= -30 && wx <= 30;
      const isOuterEdgeX = (wx === -31 || wx === 31) && localZ > -30 && localZ < 30;
      const isOuterEdgeZ = (localZ === -31 || localZ === 31) && wx > -30 && wx < 30;
      
      if (isWallX || isWallZ) {
        if (wy <= 15) {
          // Gatehouse holes (Front and Back)
          const frontGateZ = zOffset > 0 ? -30 : 30;
          const backGateZ = zOffset > 0 ? 30 : -30;
          if ((localZ === frontGateZ || localZ === backGateZ) && wx >= -4 && wx <= 4 && wy <= 10) {
            // Add iron bars (glass) at the top of the gate
            if (wy >= 8 && wy <= 10 && wx % 2 === 0) return BLOCK.GLASS;
            return BLOCK.AIR;
          }
          
          // Battlements
          if (wy === 15) {
            if (isWallZ && wx % 2 !== 0) return BLOCK.AIR;
            if (isWallX && localZ % 2 !== 0) return BLOCK.AIR;
            return accentBlock;
          }
          
          if ((wx + wy + localZ) % 11 === 0) return BLOCK.BRICK;
          return BLOCK.STONE;
        }
      }
      
      // Buttresses and Banners on the outside
      if (isOuterEdgeX || isOuterEdgeZ) {
        if (wy <= 14) {
          const isFrontOrBack = (localZ === (zOffset > 0 ? -31 : 31));
          if (isFrontOrBack && wx >= -6 && wx <= 6) return -1;
          
          // Buttresses
          if ((isOuterEdgeX && localZ % 6 === 0) || (isOuterEdgeZ && wx % 6 === 0)) {
            return BLOCK.STONE;
          }
          
          // Banners
          if (wy >= 8 && wy <= 13) {
            if ((isOuterEdgeX && localZ % 10 === 5) || (isOuterEdgeZ && wx % 10 === 5)) {
              return accentBlock;
            }
          }
        }
      }
    }

    // 3. The Keep (Center building)
    if (wx >= -14 && wx <= 14 && localZ >= -14 && localZ <= 14) {
      // Keep Corner Turrets
      const isKeepTurret = (cx: number, cz: number) => {
        const dx = wx - cx;
        const dz = localZ - cz;
        const distSq = dx * dx + dz * dz;
        if (distSq <= 9 && wy >= 20 && wy <= 45) {
          if (wy > 40) {
             const roofRadiusSq = 9 - (wy - 40) * 2;
             if (distSq <= roofRadiusSq) return accentBlock;
             return -1;
          }
          if (distSq >= 4) {
             if (wy === 40 && ((wx + localZ) % 2 !== 0)) return BLOCK.AIR;
             return BLOCK.STONE;
          }
          return BLOCK.AIR;
        }
        return -1;
      };
      
      const kt1 = isKeepTurret(-12, -12); if (kt1 !== -1) return kt1;
      const kt2 = isKeepTurret(-12, 12);  if (kt2 !== -1) return kt2;
      const kt3 = isKeepTurret(12, -12);  if (kt3 !== -1) return kt3;
      const kt4 = isKeepTurret(12, 12);   if (kt4 !== -1) return kt4;

      if (wx >= -12 && wx <= 12 && localZ >= -12 && localZ <= 12) {
        const isKeepWall = wx === -12 || wx === 12 || localZ === -12 || localZ === 12;
        const dx = wx;
        const dz = localZ;
        const distSq = dx * dx + dz * dz;

        // Main Keep Body
        if (wy <= 40) {
          if (isKeepWall) {
            // Keep Entrance
            const keepGateZ = zOffset > 0 ? -12 : 12;
            if (localZ === keepGateZ && wx >= -3 && wx <= 3 && wy <= 10) return BLOCK.AIR;
            
            // Grand Windows
            if (wy > 10 && wy % 10 >= 3 && wy % 10 <= 7 && (wx % 4 === 0 || localZ % 4 === 0)) {
              if (wy % 10 === 7) return accentBlock;
              return BLOCK.GLASS;
            }
            
            if ((wx + wy + localZ) % 7 === 0) return BLOCK.BRICK;
            return BLOCK.STONE;
          } else {
            // Inside the keep
            
            // Roof of the keep
            if (wy === 40) {
               const stairAngle = Math.atan2(dz, dx);
               let normalizedStairAngle = stairAngle >= 0 ? stairAngle : stairAngle + Math.PI * 2;
               const stepIndex = Math.floor((normalizedStairAngle / (Math.PI * 2)) * 20);
               if (distSq > 4 && distSq <= 49 && (stepIndex >= 18 || stepIndex <= 0)) {
                 // Let it fall through
               } else {
                 return BLOCK.STONE;
               }
            }

            // Floors
            if (wy > 5 && wy % 10 === 0 && wy < 40) {
              if (distSq > 49) return BLOCK.WOOD; 
            }

            // Central Pillar
            if (distSq <= 4) return BLOCK.STONE;

            // Spiral Stairs (Radius 3 to 7)
            if (distSq > 4 && distSq <= 49) {
              const stairAngle = Math.atan2(dz, dx);
              let normalizedStairAngle = stairAngle >= 0 ? stairAngle : stairAngle + Math.PI * 2;
              // 40 steps per rotation (20 full blocks height)
              const stepIndex = Math.floor((normalizedStairAngle / (Math.PI * 2)) * 40);
              const relativeHeight2 = (wy - 5) * 2; // Start from ground floor (wy=5)
              
              // Use modulo to repeat the spiral all the way up
              if (relativeHeight2 % 40 === stepIndex) {
                return BLOCK.PLANKS;
              }
              if ((relativeHeight2 + 1) % 40 === stepIndex) {
                return BLOCK.SLAB_WOOD;
              }
            }

            return BLOCK.AIR;
          }
        }
        
        // Keep Battlements and Top Room
        if (wy > 40 && wy <= 60) {
          if (isKeepWall && wy === 41) {
            // Keep battlements
            if ((localZ === -12 || localZ === 12) && wx % 2 !== 0) return BLOCK.AIR;
            if ((wx === -12 || wx === 12) && localZ % 2 !== 0) return BLOCK.AIR;
            return accentBlock;
          }

          // Circular tower
          if (distSq <= 100) {
            const isTowerWall = distSq >= 81;
            
            if (wy <= 50) {
              if (isTowerWall) {
                // Door to battlements
                if (wy >= 41 && wy <= 43 && dz >= 8 && Math.abs(dx) <= 1) return BLOCK.AIR;
                
                // Windows
                if (wy >= 44 && wy <= 48 && (Math.abs(dx) <= 1 || Math.abs(dz) <= 1)) return BLOCK.GLASS;
                return BLOCK.STONE;
              } else {
                // Inside Top Room
                // Pedestal
                if (wy === 41 && distSq <= 9) return BLOCK.STONE;
                
                // Dragon Egg
                const dy = wy - 45;
                if (distSq + (dy * 0.8) * (dy * 0.8) <= 12) {
                  return (wy + dx + dz) % 3 === 0 ? BLOCK.GLASS : accentBlock;
                }
                
                return BLOCK.AIR;
              }
            } else {
              // Dome Roof
              const roofRadiusSq = 100 - (wy - 50) * 10;
              if (distSq <= roofRadiusSq) {
                return accentBlock;
              }
            }
          }
        }
      }
    }

    // 4. Fountain in the courtyard
    const fountainZ = zOffset > 0 ? -18 : 18;
    const dxF = wx;
    const dzF = localZ - fountainZ;
    const distSqF = dxF * dxF + dzF * dzF;

    if (distSqF <= 16 && wy >= 5 && wy <= 12) {
      if (wy <= 6) return BLOCK.STONE; // Base
      if (wy === 7) {
        if (distSqF <= 1) return BLOCK.STONE; // Center pillar
        if (distSqF >= 9) return BLOCK.STONE; // Rim
        return BLOCK.WATER;
      }
      if (wy >= 8 && wy <= 10 && distSqF <= 1) return BLOCK.STONE; // Spout
      if (wy === 11 && distSqF <= 4) return BLOCK.STONE; // Top basin
      if (wy === 12 && distSqF <= 1) return BLOCK.WATER; // Water source
    }

    // 5. Courtyard Paths and Details
    if (wy === 5 || wy === 6) {
      // Path from gate to keep
      const gateZ = zOffset > 0 ? -30 : 30;
      const keepGateZ = zOffset > 0 ? -12 : 12;
      const minZ = Math.min(gateZ, keepGateZ);
      const maxZ = Math.max(gateZ, keepGateZ);
      
      if (wx >= -4 && wx <= 4 && localZ >= minZ && localZ <= maxZ) {
        if (wy === 5) return (wx + localZ) % 2 === 0 ? BLOCK.STONE : BLOCK.BRICK;
        return BLOCK.AIR;
      }
      
      // Random decorative bushes
      if (Math.abs(wx) > 5 && Math.abs(localZ) > 15 && Math.abs(wx) < 25 && Math.abs(localZ) < 25) {
         if ((wx * 13 + localZ * 7) % 100 > 95) return BLOCK.LEAVES;
         if (wy === 5 && (wx * 17 + localZ * 11) % 100 > 98) return BLOCK.WOOD; // Small tree trunks
      }
    }

    return BLOCK.AIR;
  }

  getVillageBlock(wx: number, wy: number, wz: number, isBlue: boolean): number {
    const zBase = isBlue ? 131 : -180;
    const localZ = isBlue ? wz - 131 : wz - (-131); // localZ from 0 to 49
    const absLocalZ = Math.abs(localZ);
    
    // 1. Village Fence
    const isFenceX = (wx === -50 || wx === 50) && absLocalZ >= 0 && absLocalZ <= 49;
    const isFenceZ = (localZ === 0 || localZ === (isBlue ? 49 : -49)) && wx >= -50 && wx <= 50;
    
    if (isFenceX || isFenceZ) {
      if (wy <= 8) {
        // Double doors in the fence (front and back)
        const isFrontDoor = localZ === 0;
        const isBackDoor = localZ === (isBlue ? 49 : -49);
        if ((isFrontDoor || isBackDoor) && wx >= -4 && wx <= 4 && wy <= 10) {
          // Open door effect: just air in the middle
          if (Math.abs(wx) < 3) return BLOCK.AIR;
          // Door posts/frames
          return BLOCK.WOOD;
        }
        
        // Fence style: stone base, wood top
        if (wy <= 3) return BLOCK.STONE;
        if (wy === 8 && wx % 2 === 0) return BLOCK.AIR; // Battlements for fence
        return BLOCK.WOOD;
      }
    }

    // 2. Custom Buildings
    const drawTavern = (hx: number, hz: number, width: number, depth: number) => {
      const dx = wx - hx;
      const dz = wz - hz;
      if (dx >= 0 && dx < width && dz >= 0 && dz < depth) {
        const isWall = dx === 0 || dx === width - 1 || dz === 0 || dz === depth - 1;
        const isCorner = (dx === 0 || dx === width - 1) && (dz === 0 || dz === depth - 1);
        
        if (wy >= 5 && wy <= 14) {
          if (isWall) {
            if (wy === 5) return BLOCK.STONE;
            if (isCorner) return BLOCK.WOOD;
            if (wy === 10) return BLOCK.WOOD;
            
            // Door
            if (dz === 0 && dx >= Math.floor(width/2) - 1 && dx <= Math.floor(width/2) + 1 && wy <= 7) return BLOCK.AIR;
            
            // Windows
            if ((wy === 7 || wy === 8 || wy === 12 || wy === 13) && !isCorner && (dx % 4 === 2 || dz % 4 === 2)) return BLOCK.GLASS;
            
            return BLOCK.PLANKS;
          } else {
            if (wy === 5 || wy === 10) return BLOCK.PLANKS; // Floors
            return BLOCK.AIR;
          }
        }
        
        // Pitched Roof
        if (wy >= 15 && wy <= 19) {
          const roofLayer = wy - 15;
          if (dx >= roofLayer - 1 && dx <= width - roofLayer && dz >= -1 && dz <= depth) {
            return BLOCK.WOOD;
          }
        }
      }
      return -1;
    };

    const drawBlacksmith = (hx: number, hz: number, width: number, depth: number) => {
      const dx = wx - hx;
      const dz = wz - hz;
      if (dx >= 0 && dx < width && dz >= 0 && dz < depth) {
        const isRoom = dx < 8;
        
        if (wy >= 5 && wy <= 10) {
          if (isRoom) {
            const isWall = dx === 0 || dx === 7 || dz === 0 || dz === depth - 1;
            if (wy === 10) return BLOCK.STONE; // Flat roof
            if (isWall) {
              // Door
              if (dx === 7 && dz === Math.floor(depth/2) && wy <= 7) return BLOCK.AIR;
              // Window
              if (dx === 0 && dz === Math.floor(depth/2) && wy === 7) return BLOCK.GLASS;
              return BLOCK.STONE;
            } else {
              if (wy === 5) return BLOCK.STONE; // Floor
              return BLOCK.AIR;
            }
          } else {
            // Forge Area
            if (wy === 10) return BLOCK.WOOD; // Awning
            if (wy === 5) return BLOCK.STONE; // Floor
            
            // Pillars
            if ((dx === width - 1 && dz === 0) || (dx === width - 1 && dz === depth - 1)) return BLOCK.WOOD;
            
            // Chimney & Forge
            if (dx >= 9 && dx <= 11 && dz >= 2 && dz <= 4) {
              if (dx === 10 && dz === 3) return BLOCK.BRICK; // Chimney core
              if (wy <= 7) return BLOCK.BRICK; // Forge base
            }
            
            // Water Trough
            if (dx >= 10 && dx <= 11 && dz >= 7 && dz <= 9) {
              if (wy === 6) {
                if (dx === 10 && dz === 8) return BLOCK.WATER;
                return BLOCK.STONE;
              }
            }
            
            return BLOCK.AIR;
          }
        }
        
        // Chimney top
        if (wy > 10 && wy <= 14 && dx === 10 && dz === 3) return BLOCK.BRICK;
      }
      return -1;
    };

    const drawWatchtower = (hx: number, hz: number, width: number, depth: number) => {
      const dx = wx - hx;
      const dz = wz - hz;
      if (dx >= 0 && dx < width && dz >= 0 && dz < depth) {
        // Base tower
        if (wy >= 5 && wy <= 16) {
          if (dx >= 1 && dx <= width - 2 && dz >= 1 && dz <= depth - 2) {
            const isWall = dx === 1 || dx === width - 2 || dz === 1 || dz === depth - 2;
            if (isWall) {
              // Door
              if (dz === 1 && dx === Math.floor(width/2) && wy <= 7) return BLOCK.AIR;
              // Slit windows
              if (wy % 4 === 0 && dx === Math.floor(width/2)) return BLOCK.AIR;
              return BLOCK.STONE;
            } else {
              // Ladder
              if (dx === 2 && dz === 2) return BLOCK.WOOD;
              if (wy === 5 || wy === 16) return BLOCK.PLANKS;
              return BLOCK.AIR;
            }
          }
        }
        
        // Platform
        if (wy === 17) return BLOCK.PLANKS;
        
        // Battlements
        if (wy === 18) {
          const isWall = dx === 0 || dx === width - 1 || dz === 0 || dz === depth - 1;
          if (isWall && (dx % 2 === 0 || dz % 2 === 0)) return BLOCK.WOOD;
          return BLOCK.AIR;
        }
        
        // Roof
        if (wy === 19 && dx >= 1 && dx <= width - 2 && dz >= 1 && dz <= depth - 2) return BLOCK.WOOD;
        if (wy === 20 && dx >= 2 && dx <= width - 3 && dz >= 2 && dz <= depth - 3) return BLOCK.WOOD;
      }
      return -1;
    };

    const drawFarm = (hx: number, hz: number, width: number, depth: number) => {
      const dx = wx - hx;
      const dz = wz - hz;
      if (dx >= 0 && dx < width && dz >= 0 && dz < depth) {
        if (wy === 5 || wy === 6) {
          const isWall = dx === 0 || dx === width - 1 || dz === 0 || dz === depth - 1;
          if (isWall) {
            // Gate
            if (dz === 0 && dx === Math.floor(width/2)) return BLOCK.AIR;
            if (wy === 5) return BLOCK.WOOD;
            if (wy === 6 && (dx % 3 === 0 || dz % 3 === 0)) return BLOCK.WOOD; // Fence posts
            return BLOCK.AIR;
          } else if (wy === 5) {
            // Crops and water
            if (dx % 4 === 2) return BLOCK.WATER;
            return BLOCK.LEAVES; // Represents crops
          }
        }
      }
      return -1;
    };

    const drawLibrary = (hx: number, hz: number, width: number, depth: number, isBlue: boolean) => {
      const dx = wx - hx;
      const dz = wz - hz;
      if (dx >= 0 && dx < width && dz >= 0 && dz < depth) {
        if (wy >= 5 && wy <= 18) {
          const isWall = dx === 0 || dx === width - 1 || dz === 0 || dz === depth - 1;
          if (isWall) {
            if (wy === 5) return BLOCK.STONE;
            // Door facing vertical path
            if (dx === 0 && dz >= Math.floor(depth/2) - 1 && dz <= Math.floor(depth/2) + 1 && wy <= 7) return BLOCK.AIR;
            // Windows
            if (wy >= 8 && wy <= 12 && (dx % 3 === 0 || dz % 3 === 0)) return BLOCK.GLASS;
            return BLOCK.BRICK;
          } else {
            if (wy === 5 || wy === 12) return BLOCK.PLANKS; // Floors
            // Bookshelves
            if (wy >= 6 && wy <= 10 && (dx === 2 || dx === width - 3) && dz >= 2 && dz <= depth - 3) return BLOCK.WOOD;
            return BLOCK.AIR;
          }
        }
        // Roof
        if (wy >= 19 && wy <= 23) {
          const step = wy - 19;
          if (dx >= step && dx < width - step && dz >= step && dz < depth - step) {
            return isBlue ? BLOCK.BLUE_STONE : BLOCK.RED_STONE;
          }
        }
      }
      return -1;
    };

    const drawBakery = (hx: number, hz: number, width: number, depth: number) => {
      const dx = wx - hx;
      const dz = wz - hz;
      if (dx >= 0 && dx < width && dz >= 0 && dz < depth) {
        if (wy >= 5 && wy <= 12) {
          const isWall = dx === 0 || dx === width - 1 || dz === 0 || dz === depth - 1;
          if (isWall) {
            if (wy === 5) return BLOCK.STONE;
            // Door facing vertical path
            if (dx === width - 1 && dz >= Math.floor(depth/2) - 1 && dz <= Math.floor(depth/2) + 1 && wy <= 7) return BLOCK.AIR;
            // Windows
            if (wy === 7 && (dx === 2 || dz === 2 || dz === depth - 3)) return BLOCK.GLASS;
            return BLOCK.PLANKS;
          } else {
            if (wy === 5) return BLOCK.STONE; // Floor
            // Oven
            if (dx >= 2 && dx <= 5 && dz >= 2 && dz <= 4) {
              if (wy <= 8) {
                if (dx === 5 && dz === 3 && wy === 6) return BLOCK.AIR; // Oven opening
                return BLOCK.BRICK;
              }
            }
            // Counter
            if (dx >= 7 && dx <= 10 && dz === 6 && wy <= 6) return BLOCK.WOOD;
            return BLOCK.AIR;
          }
        }
        // Roof
        if (wy >= 13 && wy <= 16) {
          const step = wy - 13;
          if (dx >= step && dx < width - step && dz >= -1 && dz <= depth) {
            return BLOCK.WOOD;
          }
        }
        // Chimney
        if (wy >= 9 && wy <= 18 && dx === 4 && dz === 3) return BLOCK.BRICK;
      }
      return -1;
    };

    const drawTownHall = (hx: number, hz: number, width: number, depth: number, isBlue: boolean) => {
      const dx = wx - hx;
      const dz = wz - hz;
      if (dx >= 0 && dx < width && dz >= 0 && dz < depth) {
        if (wy >= 5 && wy <= 18) {
          const isWall = dx === 0 || dx === width - 1 || dz === 0 || dz === depth - 1;
          if (isWall) {
            if (wy === 5) return BLOCK.STONE;
            // Grand Entrance
            if (dz === 0 && dx >= Math.floor(width/2) - 1 && dx <= Math.floor(width/2) + 1 && wy <= 9) return BLOCK.AIR;
            // Large Windows
            if (wy >= 8 && wy <= 14 && (dx % 4 === 1 || dz % 4 === 1)) return BLOCK.GLASS;
            return BLOCK.STONE;
          } else {
            if (wy === 5 || wy === 12) return BLOCK.PLANKS; // Floors
            // Meeting Table
            if (wy === 6 && dx >= 3 && dx <= width - 4 && dz >= 4 && dz <= depth - 4) return BLOCK.WOOD;
            return BLOCK.AIR;
          }
        }
        // Roof
        if (wy >= 19 && wy <= 23) {
          const step = wy - 19;
          if (dx >= step && dx < width - step && dz >= step && dz < depth - step) {
            return BLOCK.WOOD;
          }
        }
        // Clock Tower
        if (wy > 23 && wy <= 30 && dx >= Math.floor(width/2) - 2 && dx <= Math.floor(width/2) + 2 && dz >= 2 && dz <= 6) {
           if (wy === 27 && dx === Math.floor(width/2) && dz === 2) return BLOCK.GLASS; // Clock face
           return BLOCK.STONE;
        }
      }
      return -1;
    };

    const drawMarket = (hx: number, hz: number, width: number, depth: number) => {
      const dx = wx - hx;
      const dz = wz - hz;
      if (dx >= 0 && dx < width && dz >= 0 && dz < depth) {
        if (wy === 5) return BLOCK.STONE; // Paved floor
        // Stalls
        if (wy >= 6 && wy <= 9) {
          const isStall = (dx >= 2 && dx <= 4 && dz >= 2 && dz <= 4) || 
                          (dx >= width - 5 && dx <= width - 3 && dz >= 2 && dz <= 4) ||
                          (dx >= 2 && dx <= 4 && dz >= depth - 5 && dz <= depth - 3) ||
                          (dx >= width - 5 && dx <= width - 3 && dz >= depth - 5 && dz <= depth - 3);
          if (isStall) {
            if (wy === 6) return BLOCK.WOOD; // Counter
            if (wy === 9) return BLOCK.PLANKS; // Awning
            // Poles
            if (wy > 6 && wy < 9 && ((dx===2||dx===4||dx===width-5||dx===width-3) && (dz===2||dz===4||dz===depth-5||dz===depth-3))) return BLOCK.WOOD;
          }
        }
      }
      return -1;
    };

    const drawMageTower = (hx: number, hz: number, width: number, depth: number, isBlue: boolean) => {
      const dx = wx - hx;
      const dz = wz - hz;
      if (dx >= 0 && dx < width && dz >= 0 && dz < depth) {
        const cx = Math.floor(width/2);
        const cz = Math.floor(depth/2);
        const distSq = (dx - cx) * (dx - cx) + (dz - cz) * (dz - cz);
        const radiusSq = (width/2) * (width/2);
        
        if (distSq <= radiusSq) {
          if (wy >= 5 && wy <= 28) {
            const isWall = distSq >= radiusSq - 3;
            if (isWall) {
              // Door
              if (dz === 0 && dx === cx && wy <= 7) return BLOCK.AIR;
              // Spiral Windows
              if ((wy + dx + dz) % 6 === 0) return BLOCK.GLASS;
              return BLOCK.BRICK;
            } else {
              // Floors every 6 blocks
              if (wy % 6 === 5) return BLOCK.PLANKS;
              // Spiral staircase
              if ((wy + dx) % 4 === 0 && distSq >= radiusSq - 6) return BLOCK.WOOD;
              return BLOCK.AIR;
            }
          }
          // Pointy Roof
          if (wy > 28 && wy <= 35) {
            const roofRadiusSq = Math.max(0, radiusSq - (wy - 28) * 2);
            if (distSq <= roofRadiusSq) return isBlue ? BLOCK.BLUE_STONE : BLOCK.RED_STONE;
          }
        }
      }
      return -1;
    };

    // Place buildings
    const buildings = isBlue ? [
      { type: 'tavern', x: -42, z: 135, w: 16, d: 14 },
      { type: 'blacksmith', x: 22, z: 135, w: 14, d: 12 },
      { type: 'farm', x: -42, z: 160, w: 16, d: 16 },
      { type: 'watchtower', x: 30, z: 165, w: 8, d: 8 },
      { type: 'library', x: 6, z: 135, w: 10, d: 10 },
      { type: 'bakery', x: -20, z: 160, w: 12, d: 12 },
      { type: 'townhall', x: -20, z: 135, w: 14, d: 14 },
      { type: 'market', x: 6, z: 160, w: 14, d: 14 },
      { type: 'magetower', x: 36, z: 145, w: 8, d: 8 },
    ] : [
      { type: 'tavern', x: -42, z: -149, w: 16, d: 14 },
      { type: 'blacksmith', x: 22, z: -147, w: 14, d: 12 },
      { type: 'farm', x: -42, z: -176, w: 16, d: 16 },
      { type: 'watchtower', x: 30, z: -173, w: 8, d: 8 },
      { type: 'library', x: 6, z: -145, w: 10, d: 10 },
      { type: 'bakery', x: -20, z: -172, w: 12, d: 12 },
      { type: 'townhall', x: -20, z: -149, w: 14, d: 14 },
      { type: 'market', x: 6, z: -174, w: 14, d: 14 },
      { type: 'magetower', x: 36, z: -153, w: 8, d: 8 },
    ];

    for (const b of buildings) {
      let res = -1;
      if (b.type === 'tavern') res = drawTavern(b.x, b.z, b.w, b.d);
      else if (b.type === 'blacksmith') res = drawBlacksmith(b.x, b.z, b.w, b.d);
      else if (b.type === 'farm') res = drawFarm(b.x, b.z, b.w, b.d);
      else if (b.type === 'watchtower') res = drawWatchtower(b.x, b.z, b.w, b.d);
      else if (b.type === 'library') res = drawLibrary(b.x, b.z, b.w, b.d, isBlue);
      else if (b.type === 'bakery') res = drawBakery(b.x, b.z, b.w, b.d);
      else if (b.type === 'townhall') res = drawTownHall(b.x, b.z, b.w, b.d, isBlue);
      else if (b.type === 'market') res = drawMarket(b.x, b.z, b.w, b.d);
      else if (b.type === 'magetower') res = drawMageTower(b.x, b.z, b.w, b.d, isBlue);
      
      if (res !== -1) return res;
    }

    // 3. Fountain in the middle
    const fountainZ = isBlue ? 155 : -155;
    const dx = wx - 0;
    const dz = wz - fountainZ;
    const distSq = dx * dx + dz * dz;
    if (distSq <= 16) {
      if (wy <= 4) return BLOCK.STONE;
      if (wy === 5) {
        if (distSq <= 4) return BLOCK.WATER;
        return BLOCK.STONE;
      }
      if (wy === 6) {
        if (distSq <= 1) return BLOCK.STONE; // Center pillar
        if (distSq >= 9) return BLOCK.STONE; // Rim
        return BLOCK.WATER;
      }
      if (wy >= 7 && wy <= 9 && distSq <= 1) return BLOCK.STONE; // Spout
    }

    return BLOCK.AIR;
  }

  getTerrainData(wx: number, wz: number) {
    const urlParams = new URLSearchParams(window.location.search);
    const serverName = urlParams.get('server') || 'hub';
    const isHub = serverName === 'hub';

    if (isHub) {
      const distSq = wx * wx + wz * wz;
      if (distSq <= 900) {
        return { height: 60, biome: this.biomes.PLAINS, isProtected: true };
      }
      return { height: -100, biome: this.biomes.OCEAN, isProtected: false };
    }

    // Blue Castle & Village (Z: 70 to 180, X: -50 to 50)
    const dxBlue = Math.max(0, Math.abs(wx) - 50);
    const dzBlue = Math.max(0, 70 - wz, wz - 180);
    const distBlue = Math.sqrt(dxBlue * dxBlue + dzBlue * dzBlue);

    // Red Castle & Village (Z: -180 to -70, X: -50 to 50)
    const dxRed = Math.max(0, Math.abs(wx) - 50);
    const dzRed = Math.max(0, -180 - wz, wz - -70);
    const distRed = Math.sqrt(dxRed * dxRed + dzRed * dzRed);

    let distToProtected = Math.min(distBlue, distRed);

    const baseHeight = 64;
    
    // Biome selection noise
    const tempNoise = this.noise2D(wx * 0.002, wz * 0.002);
    const moistNoise = this.noise2D(wx * 0.002 + 1000, wz * 0.002 + 1000);
    
    let biome = this.biomes.PLAINS;
    
    if (tempNoise < -0.6) {
      biome = this.biomes.ICE_SPIKES;
    } else if (tempNoise < -0.3) {
      biome = moistNoise < 0 ? this.biomes.SNOWY_TUNDRA : this.biomes.TAIGA;
    } else if (tempNoise < 0.0) {
      if (moistNoise < -0.3) biome = this.biomes.CHERRY_GROVE;
      else if (moistNoise < 0.3) biome = this.biomes.FOREST;
      else biome = this.biomes.DARK_FOREST;
    } else if (tempNoise < 0.3) {
      if (moistNoise < -0.3) biome = this.biomes.SAVANNA;
      else if (moistNoise < 0.3) biome = this.biomes.PLAINS;
      else biome = this.biomes.SWAMP;
    } else if (tempNoise < 0.6) {
      if (moistNoise < -0.4) biome = this.biomes.BADLANDS;
      else if (moistNoise < 0.4) biome = this.biomes.DESERT;
      else biome = this.biomes.JUNGLE;
    } else {
      if (moistNoise < -0.4) biome = this.biomes.VOLCANIC;
      else if (moistNoise < 0.4) biome = this.biomes.MUSHROOM_ISLAND;
      else biome = this.biomes.JUNGLE;
    }
    
    // Add mountains and oceans based on a third noise
    const elevationNoise = this.noise2D(wx * 0.001, wz * 0.001);
    if (elevationNoise < -0.5) biome = this.biomes.OCEAN;
    else if (elevationNoise > 0.6) biome = this.biomes.MOUNTAINS;

    // Terrain height noise based on biome
    const n1 = this.noise2D(wx * biome.scale, wz * biome.scale);
    const n2 = this.noise2D(wx * biome.scale * 4, wz * biome.scale * 4) * 0.5;
    const n3 = this.noise2D(wx * biome.scale * 16, wz * biome.scale * 16) * 0.25;
    
    let mountainHeight = (n1 + n2 + n3) * biome.height;
    
    // World boundary: Fade to ocean at the edge
    const distFromCenter = Math.sqrt(wx * wx + wz * wz);
    if (distFromCenter > this.worldSize - 100) {
      const edgeFactor = Math.min(1, (distFromCenter - (this.worldSize - 100)) / 100);
      mountainHeight = mountainHeight * (1 - edgeFactor) - 30 * edgeFactor;
      if (edgeFactor > 0.5) biome = this.biomes.OCEAN;
    }

    const targetHeight = baseHeight + mountainHeight;

    // Blend with base height near protected areas
    const blendDist = 30;
    let blendFactor = distToProtected / blendDist;
    if (blendFactor > 1) blendFactor = 1;
    if (blendFactor < 0) blendFactor = 0;

    // Smoothstep
    blendFactor = blendFactor * blendFactor * (3 - 2 * blendFactor);

    const finalHeight = Math.floor(baseHeight * (1 - blendFactor) + targetHeight * blendFactor);
    
    return { height: finalHeight, biome, isProtected: distToProtected === 0 };
  }

  async generateChunk(cx: number, cz: number) {
    const key = this.getChunkKey(cx, cz);
    this.generatingChunks.add(key);
    const chunk = new Chunk(cx, cz);
    
    let startTime = performance.now();
    let iterations = 0;
    
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const worldX = cx * CHUNK_SIZE + x;
        const worldZ = cz * CHUNK_SIZE + z;
        
        // Massive but not infinite: Stop generating solid ground far away
        const distFromCenter = Math.sqrt(worldX * worldX + worldZ * worldZ);
        if (distFromCenter > this.worldSize) {
          // Beyond world size, just generate bedrock at y=0 and air/water
          chunk.setBlockFast(x, 0, z, BLOCK.STONE);
          for (let y = 1; y <= 40; y++) {
            chunk.setBlockFast(x, y, z, BLOCK.WATER);
          }
          continue;
        }

        const isBlueSide = worldZ >= 70;
        const isRedSide = worldZ <= -70;
        const isVoid = !isBlueSide && !isRedSide;
        const isBridge = isVoid && worldX >= -8 && worldX <= 8;
        
        const { height: terrainHeight, biome, isProtected: isAreaProtected } = this.getTerrainData(worldX, worldZ);
        const isVillageOrCastle = (worldX >= -50 && worldX <= 50) && ((worldZ >= 70 && worldZ <= 410) || (worldZ <= -70 && worldZ >= -410));
        const isBridgeArea = worldX >= -12 && worldX <= 12 && worldZ > -70 && worldZ < 70;
        const isProtected = isVillageOrCastle || isBridgeArea || isAreaProtected;

        if (this.isHub) {
          this.generateHubTerrain(chunk, x, z, worldX, worldZ);
        } else if (isBlueSide || isRedSide) {
          const hasCaves = !isProtected && biome !== this.biomes.OCEAN && this.noise2D(worldX * 0.01, worldZ * 0.01) > 0.3;
          const isBlueVillage = worldZ >= 131 && worldZ <= 180;
          const isRedVillage = worldZ <= -131 && worldZ >= -180;
          
          for (let y = 0; y <= terrainHeight; y++) {
            if (y === 0) {
              chunk.setBlockFast(x, y, z, BLOCK.STONE); // Bedrock
            } else {
              // Caves
              let isCave = false;
              if (hasCaves && y > 1 && y < terrainHeight - 4) {
                // Noodle caves (tunnels)
                const caveNoise1 = this.noise3D(worldX * 0.015, y * 0.015, worldZ * 0.015);
                const caveNoise2 = this.noise3D(worldX * 0.015 + 1000, y * 0.015 + 1000, worldZ * 0.015 + 1000);
                const tunnelRadius = 0.08 + this.noise3D(worldX * 0.005, y * 0.005, worldZ * 0.005) * 0.05;
                // A tunnel is formed where two noise fields are both close to 0
                if (Math.abs(caveNoise1) < tunnelRadius && Math.abs(caveNoise2) < tunnelRadius) {
                  isCave = true;
                }
                
                // Caverns (large open areas)
                const cavernNoise = this.noise3D(worldX * 0.008, y * 0.01, worldZ * 0.008);
                if (cavernNoise > 0.3) {
                  isCave = true;
                }
              }
              
              if (isCave) {
                if (y < 10) {
                  chunk.setBlockFast(x, y, z, BLOCK.LAVA);
                }
              } else {
                if (y === terrainHeight) {
                  // Path logic inside villages/castles
                  let isPath = false;
                  
                  if ((isBlueVillage || isRedVillage) && worldX >= -50 && worldX <= 50) {
                    const wellZ = isBlueVillage ? 155 : -155;
                    if (worldX >= -3 && worldX <= 3) isPath = true;
                    else if (worldZ >= wellZ - 3 && worldZ <= wellZ + 3 && worldX >= -45 && worldX <= 45) isPath = true;
                    else if (worldX >= -30 && worldX <= -26 && Math.abs(worldZ - wellZ) <= 20) isPath = true;
                    else if (worldX >= 26 && worldX <= 30 && Math.abs(worldZ - wellZ) <= 20) isPath = true;
                    else if (worldX >= -9 && worldX <= -3 && Math.abs(worldZ - (isBlueVillage ? 166 : -166)) <= 2) isPath = true;
                    else if (worldX >= 3 && worldX <= 6 && Math.abs(worldZ - (isBlueVillage ? 140 : -140)) <= 2) isPath = true;
                    else if (worldX >= -15 && worldX <= -11 && Math.abs(worldZ - (isBlueVillage ? 135 : -149)) <= 2) isPath = true;
                    else if (worldX >= 6 && worldX <= 20 && Math.abs(worldZ - (isBlueVillage ? 167 : -167)) <= 2) isPath = true;
                    else if (worldX >= 38 && worldX <= 42 && Math.abs(worldZ - (isBlueVillage ? 145 : -153)) <= 2) isPath = true;
                    
                    if (isPath) {
                      const distSq = (worldX) * (worldX) + (worldZ - wellZ) * (worldZ - wellZ);
                      if (distSq <= 12) isPath = false;
                    }
                  } else if (isProtected) {
                    // Path from gate to keep
                    const zOffset = isBlueSide ? 100 : -100;
                    const localZ = worldZ - zOffset;
                    const gateZ = isBlueSide ? -30 : 30;
                    const keepGateZ = isBlueSide ? -12 : 12;
                    const minZ = Math.min(gateZ, keepGateZ);
                    const maxZ = Math.max(gateZ, keepGateZ);

                    if (worldX >= -4 && worldX <= 4 && localZ >= minZ && localZ <= maxZ) {
                      isPath = true;
                    }
                  }

                  if (isPath) {
                    chunk.setBlockFast(x, y, z, (worldX + worldZ) % 3 === 0 ? BLOCK.STONE : BLOCK.SAND);
                  } else if (!isProtected && terrainHeight <= 61) {
                    chunk.setBlockFast(x, y, z, BLOCK.SAND);
                  } else {
                    // Biome top block
                    let topBlock = biome.topBlock;
                    if (biome === this.biomes.MOUNTAINS && y > 100) topBlock = BLOCK.SNOW;
                    chunk.setBlockFast(x, y, z, topBlock);
                  }
                } else if (y >= terrainHeight - 3) {
                  if (!isProtected && terrainHeight <= 61) {
                    chunk.setBlockFast(x, y, z, BLOCK.SAND);
                  } else {
                    chunk.setBlockFast(x, y, z, biome.subBlock);
                  }
                } else if (biome === this.biomes.BADLANDS && y >= terrainHeight - 15) {
                  // Terracotta layers
                  const layerNoise = Math.floor(y + this.noise2D(worldX * 0.05, worldZ * 0.05) * 3);
                  if (layerNoise % 4 === 0) {
                    chunk.setBlockFast(x, y, z, BLOCK.TERRACOTTA);
                  } else if (layerNoise % 4 === 1) {
                    chunk.setBlockFast(x, y, z, BLOCK.RED_SAND);
                  } else {
                    chunk.setBlockFast(x, y, z, BLOCK.STONE);
                  }
                } else {
                  let blockType = BLOCK.STONE;
                  const isDeepslate = y < 15;
                  if (isDeepslate) blockType = BLOCK.DEEPSLATE;

                  // Ores and Glowstone
                  if (y < 60) {
                    const oreNoise = this.noise3D(worldX * 0.1, y * 0.1, worldZ * 0.1);
                    if (oreNoise > 0.6) {
                      const oreTypeNoise = this.noise3D(worldX * 0.05, y * 0.05, worldZ * 0.05);
                      if (y < 15 && oreTypeNoise > 0.8) blockType = BLOCK.DEEPSLATE_DIAMOND_ORE;
                      else if (y < 30 && oreTypeNoise > 0.6) blockType = isDeepslate ? BLOCK.DEEPSLATE_GOLD_ORE : BLOCK.GOLD_ORE;
                      else if (y < 30 && oreTypeNoise < -0.6) blockType = isDeepslate ? BLOCK.DEEPSLATE_LAPIS_ORE : BLOCK.LAPIS_ORE;
                      else if (y < 20 && oreTypeNoise > 0.4 && oreTypeNoise < 0.6) blockType = isDeepslate ? BLOCK.DEEPSLATE_REDSTONE_ORE : BLOCK.REDSTONE_ORE;
                      else if (y < 25 && oreTypeNoise < -0.8) blockType = isDeepslate ? BLOCK.DEEPSLATE_EMERALD_ORE : BLOCK.EMERALD_ORE;
                      else if (y < 50 && oreTypeNoise > 0.2) blockType = isDeepslate ? BLOCK.DEEPSLATE_IRON_ORE : BLOCK.IRON_ORE;
                      else blockType = isDeepslate ? BLOCK.DEEPSLATE_COAL_ORE : BLOCK.COAL_ORE;
                    }
                  }
                  chunk.setBlockFast(x, y, z, blockType);
                }
              }
            }
          }

          // Water (Lakes/Ocean)
          if (terrainHeight < 62) {
            for (let y = terrainHeight + 1; y <= 62; y++) {
              if (biome === this.biomes.VOLCANIC) {
                chunk.setBlockFast(x, y, z, BLOCK.LAVA);
              } else {
                chunk.setBlockFast(x, y, z, BLOCK.WATER);
              }
            }
          }

          // Trees (only outside protected areas)
          if (!isProtected && terrainHeight >= 63 && biome.treeChance > 0) {
            const treeNoise = this.noise2D(worldX * 13.37, worldZ * 13.37);
            if (treeNoise > 1 - biome.treeChance * 2) { // Tree probability
              // Determine tree type
              let logBlock = BLOCK.WOOD;
              let leavesBlock = BLOCK.LEAVES;
              let treeHeight = 5;
              
              if (biome.treeType === 'BIRCH') {
                const typeNoise = this.noise2D(worldX * 0.1, worldZ * 0.1);
                if (typeNoise > 0.3) {
                  logBlock = BLOCK.BIRCH_LOG;
                  leavesBlock = BLOCK.BIRCH_LEAVES;
                  treeHeight = 6;
                }
              } else if (biome.treeType === 'SPRUCE') {
                logBlock = BLOCK.SPRUCE_LOG;
                leavesBlock = BLOCK.SPRUCE_LEAVES;
                treeHeight = 7;
              } else if (biome.treeType === 'JUNGLE') {
                logBlock = BLOCK.WOOD;
                leavesBlock = BLOCK.LEAVES;
                treeHeight = 10;
              } else if (biome.treeType === 'CACTUS') {
                logBlock = BLOCK.CACTUS;
                leavesBlock = BLOCK.AIR;
                treeHeight = 3 + Math.floor((this.noise2D(worldX * 0.1, worldZ * 0.1) + 1) * 1.5);
              } else if (biome.treeType === 'CHERRY') {
                logBlock = BLOCK.CHERRY_LOG;
                leavesBlock = BLOCK.CHERRY_LEAVES;
                treeHeight = 6;
              } else if (biome.treeType === 'DARK_OAK') {
                logBlock = BLOCK.DARK_OAK_LOG;
                leavesBlock = BLOCK.DARK_OAK_LEAVES;
                treeHeight = 8;
              } else if (biome.treeType === 'GIANT_MUSHROOM') {
                logBlock = BLOCK.MUSHROOM_STEM;
                leavesBlock = this.noise2D(worldX * 0.1, worldZ * 0.1) > 0 ? BLOCK.MUSHROOM_BLOCK_RED : BLOCK.MUSHROOM_BLOCK_BROWN;
                treeHeight = 6;
              } else if (biome.treeType === 'ICE_SPIKE') {
                logBlock = BLOCK.ICE;
                leavesBlock = BLOCK.AIR;
                treeHeight = 10 + Math.floor((this.noise2D(worldX * 0.1, worldZ * 0.1) + 1) * 5);
              }

              for (let ty = 1; ty <= treeHeight; ty++) {
                if (terrainHeight + ty < CHUNK_HEIGHT) {
                  chunk.setBlockFast(x, terrainHeight + ty, z, logBlock);
                }
              }
              // Leaves / Caps
              if (leavesBlock !== BLOCK.AIR) {
                if (biome.treeType === 'GIANT_MUSHROOM') {
                  // Mushroom cap
                  for (let lx = -2; lx <= 2; lx++) {
                    for (let lz = -2; lz <= 2; lz++) {
                      if (Math.abs(lx) === 2 && Math.abs(lz) === 2) continue; // Round corners
                      const bx = x + lx;
                      const bz = z + lz;
                      if (bx >= 0 && bx < CHUNK_SIZE && bz >= 0 && bz < CHUNK_SIZE) {
                        if (terrainHeight + treeHeight < CHUNK_HEIGHT) {
                          chunk.setBlockFast(bx, terrainHeight + treeHeight, bz, leavesBlock);
                        }
                      }
                    }
                  }
                } else {
                  // Normal leaves
                  for (let lx = -2; lx <= 2; lx++) {
                    for (let lz = -2; lz <= 2; lz++) {
                      for (let ly = treeHeight - 2; ly <= treeHeight + 1; ly++) {
                        if (Math.abs(lx) + Math.abs(lz) + Math.abs(ly - treeHeight) <= 3) {
                          const bx = x + lx;
                          const bz = z + lz;
                          if (bx >= 0 && bx < CHUNK_SIZE && bz >= 0 && bz < CHUNK_SIZE) {
                            if (terrainHeight + ly < CHUNK_HEIGHT) {
                              if (chunk.getBlock(bx, terrainHeight + ly, bz) === BLOCK.AIR) {
                                chunk.setBlockFast(bx, Math.floor(terrainHeight + ly), bz, leavesBlock);
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }

          // Plants (Tall grass, flowers, wheat)
          if (!isProtected && terrainHeight >= 63 && biome.plantChance > 0) {
            const plantNoise = this.noise2D(worldX * 42.42, worldZ * 42.42);
            if (plantNoise > 1 - biome.plantChance * 2) {
              const typeNoise = this.noise2D(worldX * 0.5, worldZ * 0.5);
              let plantBlock = BLOCK.TALL_GRASS;
              
              if (biome === this.biomes.DESERT || biome === this.biomes.SAVANNA) {
                if (typeNoise > 0.5) plantBlock = BLOCK.DEAD_BUSH;
              } else if (biome === this.biomes.SWAMP || biome === this.biomes.DARK_FOREST) {
                if (typeNoise > 0.6) plantBlock = BLOCK.MUSHROOM_RED;
                else if (typeNoise > 0.2) plantBlock = BLOCK.MUSHROOM_BROWN;
                else plantBlock = BLOCK.TALL_GRASS;
              } else if (biome === this.biomes.MUSHROOM_ISLAND) {
                if (typeNoise > 0.0) plantBlock = BLOCK.MUSHROOM_RED;
                else plantBlock = BLOCK.MUSHROOM_BROWN;
              } else if (biome === this.biomes.CHERRY_GROVE) {
                if (typeNoise > 0.3) plantBlock = BLOCK.FLOWER_RED;
                else plantBlock = BLOCK.TALL_GRASS;
              } else {
                if (typeNoise > 0.8) plantBlock = BLOCK.FLOWER_RED;
                else if (typeNoise > 0.6) plantBlock = BLOCK.FLOWER_YELLOW;
                else if (typeNoise > 0.4) plantBlock = BLOCK.WHEAT;
              }
              
              if (chunk.getBlock(x, terrainHeight + 1, z) === BLOCK.AIR) {
                chunk.setBlockFast(x, terrainHeight + 1, z, plantBlock);
              }
            }
          }

          // Animals (only outside protected areas)
          if (!isProtected && terrainHeight >= 63) {
            const animalNoise = this.noise2D(worldX * 123.45, worldZ * 123.45);
            if (animalNoise > 0.99) {
              const typeNoise = this.noise2D(worldX * 0.2, worldZ * 0.2);
              let type = 'Cow';
              if (typeNoise > 0.3) type = 'Pig';
              else if (typeNoise < -0.3) type = 'Sheep';
              this.queuedMobs.push({ type, pos: new THREE.Vector3(worldX + 0.5, terrainHeight + 1 + WORLD_Y_OFFSET, worldZ + 0.5) });
            }
          }

          // Castles
          const isBlueCastleArea = isBlueSide && worldX >= -35 && worldX <= 35 && worldZ >= 65 && worldZ <= 135;
          const isRedCastleArea = isRedSide && worldX >= -35 && worldX <= 35 && worldZ >= -135 && worldZ <= -65;
          
          if (isBlueCastleArea || isRedCastleArea) {
            for (let y = 65; y < CHUNK_HEIGHT; y++) {
              let block = BLOCK.AIR;
              if (isBlueCastleArea) {
                block = this.getCastleBlock(worldX, y - 60, worldZ, 100, BLOCK.BLUE_STONE);
              } else if (isRedCastleArea) {
                block = this.getCastleBlock(worldX, y - 60, worldZ, -100, BLOCK.RED_STONE);
              }
              if (block !== BLOCK.AIR) {
                chunk.setBlockFast(x, y, z, block);
              }
            }
          }

          // Villages
          if ((isBlueVillage || isRedVillage) && worldX >= -50 && worldX <= 50) {
            for (let y = 65; y < CHUNK_HEIGHT; y++) {
              const block = this.getVillageBlock(worldX, y - 60, worldZ, isBlueVillage);
              if (block !== BLOCK.AIR) {
                chunk.setBlockFast(x, y, z, block);
              }
            }
          }
        } else if (isBridge) {
          // Enchanted Medieval Bridge structure
          for (let y = 50; y <= 64; y++) {
            const isPillarPos = Math.abs(worldZ) % 15 <= 2;
            const isLampPos = Math.abs(worldZ) % 15 === 0;
            const isSide = worldX === -8 || worldX === 8;
            const isOuterSide = worldX === -9 || worldX === 9; 
            
            // Generate Archway and Pillar Supports
            if (y < 63) {
              const archHeight = 6;
              const zOffset = Math.abs(worldZ) % 15;
              const archY = 56 + Math.floor(Math.sin((zOffset / 15) * Math.PI) * archHeight);
              
              if (isSide || isOuterSide) {
                // Main pillars and arches
                if (y <= archY || isPillarPos) {
                  let brickType = BLOCK.STONE_BRICKS;
                  if ((worldX + worldZ + y) % 15 === 0) brickType = BLOCK.MOSSY_STONE_BRICKS;
                  if ((worldX + worldZ + y) % 20 === 0) brickType = BLOCK.CHISELED_STONE_BRICKS;
                  chunk.setBlockFast(x, y, z, brickType);
                }
                
                // Hanging Enchanted Vines
                if (y < 56 && y > 50 && (isSide || isOuterSide)) {
                  if ((worldZ * 31 + worldX * 17) % 100 > 97) {
                    chunk.setBlockFast(x, y, z, BLOCK.LEAVES); // Hanging greenery
                  }
                }
              }
              
              // Magical "Core" under the arch
              if (Math.abs(worldX) <= 1 && y === 62 && isLampPos) {
                chunk.setBlockFast(x, y, z, BLOCK.SEA_LANTERN);
              }

              if (isPillarPos && Math.abs(worldX) < 8) {
                // Structural cross-beams
                if (y === 62) chunk.setBlockFast(x, y, z, BLOCK.STONE_BRICKS);
              }
            } else if (y === 63) {
              // Bridge foundation layer
              let type = BLOCK.STONE_BRICKS;
              if (isSide) type = BLOCK.CHISELED_STONE_BRICKS;
              else if ((worldX + worldZ) % 10 === 0) type = BLOCK.MOSSY_STONE_BRICKS;
              chunk.setBlockFast(x, y, z, type);
            } else if (y === 64) {
              // Bridge deck
              if (isSide) {
                chunk.setBlockFast(x, y, z, BLOCK.CHISELED_STONE_BRICKS);
              } else {
                // Inlaid wood pattern
                const isCenter = Math.abs(worldX) <= 2;
                chunk.setBlockFast(x, y, z, isCenter ? BLOCK.DARK_OAK_PLANKS : BLOCK.SPRUCE_PLANKS);
              }
            }
          }
          
          // Railings and Magical Spires
          if (worldX === -8 || worldX === 8) {
            const isLampPos = Math.abs(worldZ) % 15 === 0;
            if (isLampPos) {
              // Enchanted Spire
              chunk.setBlockFast(x, 65, z, BLOCK.CHISELED_STONE_BRICKS);
              chunk.setBlockFast(x, 66, z, BLOCK.STONE_BRICKS);
              chunk.setBlockFast(x, 67, z, BLOCK.SEA_LANTERN); // Floating crystal look
              chunk.setBlockFast(x, 68, z, BLOCK.GLASS_LIGHT_BLUE); // Crystal tip
            } else {
              // Ornate railing
              if (Math.abs(worldZ) % 3 === 0) {
                chunk.setBlockFast(x, 65, z, BLOCK.DARK_OAK_LOG);
              } else {
                chunk.setBlockFast(x, 65, z, BLOCK.STONE_BRICKS);
              }
            }
          }
        }

        // Shelters
        if (!this.isHub) {
          if (worldZ >= 300 && worldZ <= 405 && worldX >= -25 && worldX <= 25) {
            this.generateShelter(chunk, x, z, worldX, worldZ, true);
          }
          if (worldZ <= -300 && worldZ >= -405 && worldX >= -25 && worldX <= 25) {
            this.generateShelter(chunk, x, z, worldX, worldZ, false);
          }
        }
        
        iterations++;
        if (iterations % 4 === 0 && performance.now() - startTime > 1) {
          await new Promise(resolve => setTimeout(resolve, 0));
          startTime = performance.now();
        }
      }
    }
    
    // Apply baked blocks
    if (!this.isHub) {
      for (const [key, type] of this.bakedBlocks.entries()) {
        const [bx, by, bz] = key.split(',').map(Number);
        if (Math.floor(bx / 16) === cx && Math.floor(bz / 16) === cz) {
          const cy = by - WORLD_Y_OFFSET;
          if (cy >= 0 && cy < CHUNK_HEIGHT) {
            chunk.setBlockFast(bx & 15, cy, bz & 15, type);
          }
        }
      }
    }

    // Calculate sunlight
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        let lightLevel = 15;
        for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
          const type = chunk.getBlock(x, y, z);
          if (isSolidBlock(type)) {
            lightLevel = 0;
          } else if (type === BLOCK.WATER || type === BLOCK.WATER_1) {
            lightLevel = Math.max(0, lightLevel - 2);
          } else if (type === BLOCK.LEAVES) {
            lightLevel = Math.max(0, lightLevel - 1);
          }
          
          if (type === BLOCK.GLOWSTONE || type === BLOCK.LAVA) {
            lightLevel = 15;
          }
          
          chunk.setLightFast(x, y, z, lightLevel);
          
          if (lightLevel > 0 && lightLevel < 15) {
            this.lightingManager.addLightUpdate(cx * CHUNK_SIZE + x, y + WORLD_Y_OFFSET, cz * CHUNK_SIZE + z, lightLevel);
          } else if (lightLevel === 15 && (type === BLOCK.GLOWSTONE || type === BLOCK.LAVA)) {
            this.lightingManager.addLightUpdate(cx * CHUNK_SIZE + x, y + WORLD_Y_OFFSET, cz * CHUNK_SIZE + z, 15);
          }
        }
      }
    }

    this.applyNetworkBlockChanges(chunk, cx, cz);

    this.chunks.set(key, chunk);
    this.generatingChunks.delete(key);

    // Mark neighbors for update so they can hide faces at the boundary with this new chunk
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dz === 0) continue;
        const neighbor = this.getChunk(cx + dx, cz + dz);
        if (neighbor) neighbor.needsUpdate = true;
      }
    }

    return chunk;
  }

  private generateShelter(chunk: Chunk, lx: number, lz: number, worldX: number, worldZ: number, isBlue: boolean) {
    const startZ = isBlue ? 300 : -300;
    const distToStart = Math.abs(worldZ - startZ);
    const blockType = isBlue ? BLOCK.BLUE_STONE : BLOCK.RED_STONE;

    // Stairs
    if (Math.abs(worldZ) >= 300 && Math.abs(worldZ) < 364) { // Extended range for gentler slope
      if (worldX >= -5 && worldX <= 5) {
        const stairY2 = 124 - distToStart; // Height in half-blocks
        const stairY = Math.floor(stairY2 / 2);
        const hasSlab = stairY2 % 2 === 1;
        const slabType = isBlue ? BLOCK.SLAB_BLUE_STONE : BLOCK.SLAB_RED_STONE;

        for (let y = stairY - 1; y <= stairY + 6; y++) {
          if (y === stairY - 1) {
            chunk.setBlockFast(lx, y, lz, blockType); // Floor
            if (hasSlab) {
              chunk.setBlockFast(lx, y + 1, lz, slabType); // Slab on top of floor
            }
          } else if (worldX === -5 || worldX === 5) {
            chunk.setBlockFast(lx, y, lz, blockType); // Walls
          } else if (y === stairY + 6) {
            if (distToStart > 3) {
              chunk.setBlockFast(lx, y, lz, blockType); // Roof
            } else {
              chunk.setBlockFast(lx, y, lz, BLOCK.AIR); // Open roof at entrance
            }
          } else {
            // Only clear if not a slab we just placed
            if (!hasSlab || y !== stairY) {
              chunk.setBlockFast(lx, y, lz, BLOCK.AIR); // Air inside
            }
          }
        }
        // Clear anything above the entrance
        if (distToStart <= 3) {
          for (let y = stairY + 6; y < CHUNK_HEIGHT; y++) {
            chunk.setBlockFast(lx, y, lz, BLOCK.AIR);
          }
        }
      }
    }

    // Main Room
    if (Math.abs(worldZ) >= 364 && Math.abs(worldZ) <= 404) {
      if (worldX >= -20 && worldX <= 20) {
        for (let y = 30; y <= 45; y++) {
          const isWall = worldX === -20 || worldX === 20 || Math.abs(worldZ) === 364 || Math.abs(worldZ) === 404 || y === 30 || y === 45;
          if (isWall) {
            // Doorway
            if (Math.abs(worldZ) === 364 && worldX > -5 && worldX < 5 && y >= 31 && y <= 36) {
              chunk.setBlockFast(lx, y, lz, BLOCK.AIR);
            } else {
              chunk.setBlockFast(lx, y, lz, blockType);
            }
          } else {
            chunk.setBlockFast(lx, y, lz, BLOCK.AIR);
            // Pillars
            if (worldX % 10 === 0 && worldZ % 10 === 0) {
              chunk.setBlockFast(lx, y, lz, blockType);
            }
            // Lights on pillars
            if (worldX % 10 === 0 && worldZ % 10 === 0 && y === 40) {
              chunk.setBlockFast(lx, y, lz, BLOCK.GLASS);
            }
            // Crates along the walls
            if (y === 31 && Math.abs(worldX) > 15 && worldZ % 3 !== 0) {
              chunk.setBlockFast(lx, y, lz, BLOCK.WOOD);
            }
          }
        }
      }
    }
  }

  applyNetworkBlockChanges(chunk: Chunk, cx: number, cz: number) {
    if (!networkManager || !networkManager.blockChanges) return;
    
    const startX = cx * CHUNK_SIZE;
    const startZ = cz * CHUNK_SIZE;
    const endX = startX + CHUNK_SIZE;
    const endZ = startZ + CHUNK_SIZE;

    // Override generated procedural generation with network synchronized blocks ("The Far Chunk" Desync Fix)
    for (const key in networkManager.blockChanges) {
      const [x, y, z] = key.split(',').map(Number);
      if (x >= startX && x < endX && z >= startZ && z < endZ) {
        const cy = y - WORLD_Y_OFFSET;
        if (cy >= 0 && cy < CHUNK_HEIGHT) {
          chunk.setBlockFast(x - startX, cy, z - startZ, networkManager.blockChanges[key]);
        }
      }
    }
  }

  update(playerPosition: THREE.Vector3, camera?: THREE.Camera) {
    const pcx = Math.floor(playerPosition.x / CHUNK_SIZE);
    const pcz = Math.floor(playerPosition.z / CHUNK_SIZE);

    const startTime = performance.now();
    const maxTimePerFrame = 3; // Reduced for low-end devices

    const frustum = new THREE.Frustum();
    if (camera) {
      const projScreenMatrix = new THREE.Matrix4();
      projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projScreenMatrix);
    }

    // Generate new chunks
    const chunksToGenerate: { cx: number, cz: number, distSq: number, inFrustum: boolean }[] = [];
    for (let x = -this.renderDistance; x <= this.renderDistance; x++) {
      for (let z = -this.renderDistance; z <= this.renderDistance; z++) {
        const cx = pcx + x;
        const cz = pcz + z;
        const key = this.getChunkKey(cx, cz);
        if (!this.getChunk(cx, cz) && !this.generatingChunks.has(key)) {
          let inFrustum = true;
          if (camera) {
            const box = new THREE.Box3(
              new THREE.Vector3(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE),
              new THREE.Vector3((cx + 1) * CHUNK_SIZE, 128, (cz + 1) * CHUNK_SIZE)
            );
            inFrustum = frustum.intersectsBox(box);
          }
          chunksToGenerate.push({ cx, cz, distSq: x * x + z * z, inFrustum });
        }
      }
    }

    // Prioritize chunks in frustum, then by distance
    chunksToGenerate.sort((a, b) => {
      if (a.inFrustum && !b.inFrustum) return -1;
      if (!a.inFrustum && b.inFrustum) return 1;
      return a.distSq - b.distSq;
    });

    let activeGenerations = this.generatingChunks.size;
    for (const { cx, cz } of chunksToGenerate) {
      // Limit concurrent chunk generation to prevent stutter
      if (activeGenerations < 2 && performance.now() - startTime < maxTimePerFrame) {
        this.generateChunk(cx, cz);
        activeGenerations++;
      } else {
        break;
      }
    }

    // Unload far chunks
    for (const [key, chunk] of this.chunks.entries()) {
      const dx = Math.abs(chunk.x - pcx);
      const dz = Math.abs(chunk.z - pcz);
      if (dx > this.renderDistance + 1 || dz > this.renderDistance + 1) {
        if (chunk.mesh) {
          this.scene.remove(chunk.mesh);
          chunk.mesh.geometry.dispose();
        }
        if (chunk.transparentMesh) {
          this.scene.remove(chunk.transparentMesh);
          chunk.transparentMesh.geometry.dispose();
        }
        this.chunks.delete(key);
      }
    }

    // Update meshes
    const chunksToMesh: { chunk: Chunk, distSq: number, inFrustum: boolean }[] = [];
    let activeMeshing = 0;
    for (const chunk of this.chunks.values()) {
      if (chunk.isMeshing) activeMeshing++;
      if (chunk.needsUpdate && !chunk.isMeshing) {
        const dx = chunk.x - pcx;
        const dz = chunk.z - pcz;
        let inFrustum = true;
        if (camera) {
          const box = new THREE.Box3(
            new THREE.Vector3(chunk.x * CHUNK_SIZE, 0, chunk.z * CHUNK_SIZE),
            new THREE.Vector3((chunk.x + 1) * CHUNK_SIZE, 128, (chunk.z + 1) * CHUNK_SIZE)
          );
          inFrustum = frustum.intersectsBox(box);
        }
        chunksToMesh.push({ chunk, distSq: dx * dx + dz * dz, inFrustum });
      }
    }

    // Sort by frustum visibility, then distance so closer visible chunks mesh first
    chunksToMesh.sort((a, b) => {
      if (a.inFrustum && !b.inFrustum) return -1;
      if (!a.inFrustum && b.inFrustum) return 1;
      return a.distSq - b.distSq;
    });

    for (const { chunk } of chunksToMesh) {
      // Limit concurrent meshing to prevent stutter, but allow more if they are in frustum
      const maxConcurrent = chunksToMesh[0]?.inFrustum ? 4 : 2;
      if (activeMeshing < maxConcurrent && performance.now() - startTime < maxTimePerFrame * 2) {
        const cx = chunk.x;
        const cz = chunk.z;
        const chunkCache = new Array(9);
        for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            chunkCache[(dx + 1) + (dz + 1) * 3] = this.getChunk(cx + dx, cz + dz);
          }
        }

        const isPerformanceMode = settingsManager.getSettings().performanceMode;
        chunk.buildMesh(this.opaqueMaterial, this.transparentMaterial, this.opaqueDepthMaterial, this.transparentDepthMaterial, chunkCache, isPerformanceMode).then(() => {
          this.meshesToAdd.push({ chunk, mesh: chunk.mesh, transparentMesh: chunk.transparentMesh });
        });
        activeMeshing++;
      } else {
        break;
      }
    }
  }

  rebuildAllChunks() {
    this.chunks.forEach(chunk => {
      chunk.needsUpdate = true;
    });
  }

  // Raycasting for block placement/breaking
  raycast(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number) {
    let t = 0;
    const step = 0.05;
    const pos = origin.clone();
    let lastPos = origin.clone();

    while (t < maxDistance) {
      pos.add(direction.clone().multiplyScalar(step));
      const x = Math.floor(pos.x);
      const y = Math.floor(pos.y);
      const z = Math.floor(pos.z);

      const block = this.getBlock(x, y, z);
      if (block !== BLOCK.AIR && !isWater(block)) {
        return {
          hit: true,
          blockPos: new THREE.Vector3(x, y, z),
          prevPos: new THREE.Vector3(Math.floor(lastPos.x), Math.floor(lastPos.y), Math.floor(lastPos.z)),
          blockType: block
        };
      }
      lastPos.copy(pos);
      t += step;
    }
    return { hit: false };
  }
}
