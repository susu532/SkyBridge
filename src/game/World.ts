import { generateChunkMethod } from "./ChunkGenerator";
import MesherWorker from "./ChunkMesher.worker?worker";
import * as THREE from "three";
import { Chunk, CHUNK_SIZE, CHUNK_HEIGHT, WORLD_Y_OFFSET } from "./Chunk";
import {
  BLOCK,
  createTextureAtlas,
  isSolidBlock,
  isWater,
  isAnyTorch,
} from "./TextureAtlas";
import { getBattleRoyaleBlock } from "./generation/BattleRoyaleGenerator";
import { audioManager } from "./AudioManager";
import { settingsManager } from "./Settings";
import { LightingManager } from "./LightingManager";
import { networkManager } from "./NetworkManager";
import { biomes, getTerrainData, noise2D, noise3D } from "./TerrainGenerator";
import { skycastlesBakedBlocks } from "./SkycastlesBakedBlocks";
import { bakedBlocksMap } from "./BakedBlocks";

import { generateHubTerrain, buildHubCastles } from "./generation/HubGenerator";
import { getCastleBlock } from "./generation/SkyCastlesGenerator";
import { getVillageBlock } from "./generation/SkyBridgeGenerator";
import { getGiantMythicalShipBlock } from "./generation/ShipGenerator";
import { createVoidtrailTextureAtlas } from "./VoidTrailTextureAtlas";

import { WorldPhysics } from "./WorldPhysics";

import { WorldUpdater } from "./WorldUpdater";

import { WorldRaycast } from "./WorldRaycast";

export class World {
  scene: THREE.Scene;
  chunks: Map<string, Chunk> = new Map();
  opaqueMaterial: THREE.MeshStandardMaterial;
  opaqueDepthMaterial: THREE.MeshDepthMaterial;
  transparentMaterial: THREE.MeshStandardMaterial;
  transparentDepthMaterial: THREE.MeshDepthMaterial;
  renderDistance = 7; // chunks

  worldSize = 800; // Radius in blocks
  generatingChunks: Set<string> = new Set();
  meshesToAdd: {
    chunk: Chunk;
    mesh: THREE.Mesh | null;
    transparentMesh: THREE.Mesh | null;
  }[] = [];
  fallingBlocks: Set<string> = new Set();
  waterUpdates: Set<string> = new Set();
  lightingManager: LightingManager;
  physics: WorldPhysics;
  updater: WorldUpdater;
  raycaster: WorldRaycast;
  tickAccumulator: number = 0;
  tickRate: number = 0.1; // Tick every 100ms
  queuedMobs: { type: any; pos: THREE.Vector3; team?: string }[] = [];
  isHub: boolean = false;
  isSkyCastles: boolean = false;
  isVoidtrail: boolean = false;
  isDungeonDelver: boolean = false;
  isBattleRoyale: boolean = false;
  isSkyIsland: boolean = false;

  skycastlesBakedChunkMap: Map<
    string,
    { x: number; y: number; z: number; type: number }[]
  > = new Map();
  bakedBlocksChunkMap: Map<
    string,
    { x: number; y: number; z: number; type: number }[]
  > = new Map();
  bakedBlocksProcessed = false;

  bakedBlocks = bakedBlocksMap;

  biomes = biomes;

  meshWorkers: Worker[] = [];
  nextWorkerIndex = 0;
  pendingTasks: Map<number, { resolve: any; reject: any; chunk: Chunk }> =
    new Map();
  taskIdCounter = 0;
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const urlParams = new URLSearchParams(window.location.search);
    const serverName = urlParams.get("server") || "hub";
    this.isHub = serverName.startsWith("hub");
    this.isSkyCastles = serverName.startsWith("skycastles");
    this.isVoidtrail = serverName.startsWith("voidtrail");
    this.isDungeonDelver = serverName.startsWith("dungeondelver");
    this.isBattleRoyale = serverName.startsWith("battleroyale");
    this.isSkyIsland = serverName.startsWith("skyisland");
    this.lightingManager = new LightingManager(this);
    this.physics = new WorldPhysics(this);
    this.updater = new WorldUpdater(this);
    this.raycaster = new WorldRaycast(this);

    
    let texture: THREE.Texture;
    if (this.isVoidtrail) {
      texture = createVoidtrailTextureAtlas();
    } else {
      texture = createTextureAtlas();
    }

    for (let i = 0; i < 8; i++) {
      const worker = new MesherWorker();
      worker.onmessage = this.onWorkerMessage.bind(this);
      this.meshWorkers.push(worker);
    }
    this.opaqueMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: false,
      vertexColors: true,
      roughness: 0.8,
      metalness: 0.1,
    });

    this.opaqueMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uPerformanceMode = {
        value: settingsManager.getSettings().performanceMode ? 1.0 : 0.0,
      };
      shader.uniforms.uShaders = {
        value: settingsManager.getSettings().premiumShaders ? 1.0 : 0.0,
      };
      shader.uniforms.uIsVoidtrail = {
        value: this.isVoidtrail ? 1.0 : 0.0,
      };
      (this.opaqueMaterial as any).userData = shader.uniforms;

      shader.vertexShader = `
        uniform float uTime;
        uniform float uPerformanceMode;
        uniform float uShaders;
        attribute float aSway;
        attribute vec2 aTileBase;
        varying vec2 vTileBase;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        ${shader.vertexShader}
      `.replace(
        "#include <begin_vertex>",
        `
        #include <begin_vertex>
        vTileBase = aTileBase;
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
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
        `,
      );

      shader.fragmentShader = `
        varying vec2 vTileBase;
        uniform float uTime;
        uniform float uShaders;
        uniform float uPerformanceMode;
        uniform float uIsVoidtrail;
        uniform float uWetness;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        float customRoughness = 0.8;
        float customMetalness = 0.1;
        ${shader.fragmentShader}
      `
        .replace(
          "#include <map_fragment>",
          `
        #ifdef USE_MAP
          vec2 localUv = fract(vMapUv) / 32.0;
          float margin = 0.0005;
          localUv.x = clamp(localUv.x, margin, 0.03125 - margin);
          localUv.y = clamp(localUv.y, margin, 0.03125 - margin);
          vec2 animatedUv = vTileBase + localUv;

          if (uShaders > 0.5 && uPerformanceMode < 0.5) {
             vec3 viewDir = normalize(vViewPosition); 
             float height = dot(texture2D(map, animatedUv).rgb, vec3(0.299, 0.587, 0.114));
             // Deepen the parallax for RTX mode
             vec2 offset = (viewDir.xy) * (height * 0.012 - 0.006);
             animatedUv += offset;
             animatedUv = clamp(animatedUv, vTileBase + margin, vTileBase + 0.03125 - margin);
          }

          // Lava Animation (UV 4, 7 -> u=0.125, v=0.750)
          if (abs(vTileBase.x - 0.125) < 0.01 && abs(vTileBase.y - 0.750) < 0.01) {
             float moveX = -uTime * 0.002;
             float moveY = uTime * 0.004;
             animatedUv.x = vTileBase.x + margin + mod(localUv.x + moveX, 0.03125 - 2.0 * margin);
             animatedUv.y = vTileBase.y + margin + mod(localUv.y + moveY, 0.03125 - 2.0 * margin);
          }

          vec4 texelColor = texture2D( map, animatedUv );

          #ifndef DEPTH_PACKING
          if (uShaders > 0.5 && uPerformanceMode < 0.5) {
             float lum = dot(texelColor.rgb, vec3(0.299, 0.587, 0.114));
             float saturation = length(texelColor.rgb - vec3(lum));
             
             // Base Roughness (RTX style: starker contrast, higher gloss for bright/saturated blocks)
             customRoughness = clamp(0.8 - lum * 0.4 - saturation * 0.4, 0.1, 0.9);
             customMetalness = clamp((1.0 - saturation) * lum * 1.5, 0.0, 0.8);
             
             // Specific block handling (rough approximation based on tile UV)
             // Lava
             if (abs(vTileBase.x - 0.125) < 0.01 && abs(vTileBase.y - 0.750) < 0.01) {
                 customRoughness = 0.0;
                 customMetalness = 0.0;
             }
             // Dirt, Grass, Wood, Leaves, Planks (Earthy/Matte Materials)
             else if (
                 (vTileBase.y > 0.85) || // Rows 0-4: Dirt, Wood, Grass, Stone, Leaves, Sand, Planks
                 (saturation < 0.35 && lum < 0.55 && texelColor.r >= texelColor.b) // Other wood/plank textures
             ) {
                 // Exceptions in Rows 0-4: Stone (saturation < 0.1 usually)
                 if (saturation < 0.05 && lum > 0.3 && vTileBase.y > 0.85) {
                     // Stone: keep slightly reflective
                     customRoughness = clamp(0.7 - lum*0.3, 0.2, 0.8);
                     customMetalness = 0.2;
                 } else {
                     // Dirt, Wood, Planks, Leaves: NO REFLECTION
                     customRoughness = 1.0;
                     customMetalness = 0.0;
                 }
             }
             // Stone/Ores variants outside top rows (usually grey, low sat)
             else if (saturation < 0.1 && lum > 0.3) {
                 // Polished stone look
                 customRoughness = clamp(0.6 - lum*0.4, 0.1, 0.8);
                 customMetalness = 0.3;
             }
             // Metallic / Ores (very high luminance or specific colored specs in grey rock)
             // If local pixel is much brighter/more saturated than the average block luminance
             if (saturation > 0.3 && lum > 0.5) {
                 customRoughness = 0.1;
                 customMetalness = 0.8;
             }
             
             if (uIsVoidtrail > 0.5) {
                 // Reduce excessive light reflection for all blocks in voidtrail
                 customRoughness = 0.6;
                 customMetalness = 0.1;
             }
             
             // Wetness and Puddles Effect
             if (uWetness > 0.01 && vWorldNormal.y > 0.5) {
                // High frequency noise for puddle shapes based on world position
                float puddleNoise = sin(vWorldPos.x * 2.0) * cos(vWorldPos.z * 2.0) + sin(vWorldPos.x * 4.0 + vWorldPos.z * 4.0)*0.5;
                if (puddleNoise > 0.2) {
                   // Inside puddle: Highly reflective, slightly darker
                   customRoughness = mix(customRoughness, 0.05, uWetness);
                   customMetalness = mix(customMetalness, 0.3, uWetness);
                   texelColor.rgb *= (1.0 - uWetness * 0.2); // Darken wet surfaces
                } else {
                   // Damp surface: slightly lower roughness
                   customRoughness = mix(customRoughness, clamp(customRoughness * 0.5, 0.3, 1.0), uWetness);
                   texelColor.rgb *= (1.0 - uWetness * 0.1); 
                }
             }
          }
          #endif

          diffuseColor *= texelColor;
        #endif
        `,
        )
        .replace(
          "#include <roughnessmap_fragment>",
          `
        float roughnessFactor = roughness;
        #ifndef DEPTH_PACKING
        roughnessFactor = customRoughness;
        #endif
        `,
        )
        .replace(
          "#include <metalnessmap_fragment>",
          `
        float metalnessFactor = metalness;
        #ifndef DEPTH_PACKING
        metalnessFactor = customMetalness;
        #endif
        `,
        )
        .replace(
          "#include <dithering_fragment>",
          `
          #include <dithering_fragment>
          #ifdef USE_COLOR
            if (uIsVoidtrail < 0.5) {
              // Voxel baked light (vColor) acts as minimum ambient illumination
              // If the scene lighting (ambient + directional) is darker than our baked light,
              // we boost the final output color to match the baked light!
              // diffuseColor already contains texelColor * vColor.
              gl_FragColor.rgb = max(gl_FragColor.rgb, diffuseColor.rgb);
            } else {
              // Childish happy vibes for voidtrail
              vec3 color = gl_FragColor.rgb;
              float lum = dot(color, vec3(0.299, 0.587, 0.114));
              // Saturate slightly instead of blowing out
              color = mix(vec3(lum), color, 1.3);
              // Quantize / posterize
              color = floor(color * 8.0 + 0.5) / 8.0;
              // Add a soft tint
              vec3 tint = mix(vec3(0.05, 0.0, 0.1), vec3(0.0), lum);
              gl_FragColor.rgb = clamp(color + tint, 0.0, 1.0);
            }
          #endif
          `
        );
    };

    this.opaqueDepthMaterial = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
    });

    this.opaqueDepthMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uPerformanceMode = {
        value: settingsManager.getSettings().performanceMode ? 1.0 : 0.0,
      };
      shader.uniforms.uShaders = {
        value: settingsManager.getSettings().premiumShaders ? 1.0 : 0.0,
      };
      (this.opaqueDepthMaterial as any).userData = shader.uniforms;

      shader.vertexShader = `
        uniform float uTime;
        uniform float uPerformanceMode;
        uniform float uShaders;
        attribute float aSway;
        attribute vec2 aTileBase;
        ${shader.vertexShader}
      `.replace(
        "#include <begin_vertex>",
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
        `,
      );
    };

    this.transparentDepthMaterial = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      map: texture,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });

    this.transparentDepthMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uPerformanceMode = {
        value: settingsManager.getSettings().performanceMode ? 1.0 : 0.0,
      };
      shader.uniforms.uShaders = {
        value: settingsManager.getSettings().premiumShaders ? 1.0 : 0.0,
      };
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
        "#include <begin_vertex>",
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
          // Volumetric 3D Waves: Multiple Gerstner-like sine overlays
          float wX = position.x + modelMatrix[3][0];
          float wZ = position.z + modelMatrix[3][2];
          float wave1 = sin(uTime * 1.5 + wX * 0.5 + wZ * 0.5) * 0.08;
          float wave2 = sin(uTime * 2.0 + wX * 1.2 - wZ * 0.8) * 0.04;
          float wave3 = cos(uTime * 1.0 - wX * 0.3 + wZ * 0.7) * 0.05;
          transformed.y += wave1 + wave2 + wave3;
        }
        // Vertical displacement for lava (aSway == 3)
        if (uPerformanceMode < 0.5 && uShaders > 0.5 && aSway > 2.5) {
          transformed.y += sin(uTime * 0.5 + (position.x + modelMatrix[3][0]) * 0.2 + (position.z + modelMatrix[3][2]) * 0.2) * 0.05;
        }
        `,
      );

      shader.fragmentShader = `
        varying vec2 vTileBase;
        uniform float uShaders;
        uniform float uPerformanceMode;
        ${shader.fragmentShader}
      `.replace(
        "#include <map_fragment>",
        `
        #ifdef USE_MAP
          vec2 localUv = fract(vMapUv) / 32.0;
          float margin = 0.0005;
          localUv.x = clamp(localUv.x, margin, 0.03125 - margin);
          localUv.y = clamp(localUv.y, margin, 0.03125 - margin);
          vec2 animatedUv = vTileBase + localUv;

          if (uShaders > 0.5 && uPerformanceMode < 0.5) {
             #ifndef DEPTH_PACKING
             vec3 viewDir = normalize(vViewPosition); 
             float height = dot(texture2D(map, animatedUv).rgb, vec3(0.299, 0.587, 0.114));
             vec2 offset = (viewDir.xy) * (height * 0.005 - 0.0025);
             animatedUv += offset;
             animatedUv = clamp(animatedUv, vTileBase + margin, vTileBase + 0.03125 - margin);
             #endif
          }

          vec4 texelColor = texture2D( map, animatedUv );
          diffuseColor *= texelColor;
        #endif
        `,
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
      metalness: 0.1,
    });

    this.transparentMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uPerformanceMode = {
        value: settingsManager.getSettings().performanceMode ? 1.0 : 0.0,
      };
      shader.uniforms.uShaders = {
        value: settingsManager.getSettings().premiumShaders ? 1.0 : 0.0,
      };
      shader.uniforms.uIsVoidtrail = {
        value: this.isVoidtrail ? 1.0 : 0.0,
      };
      (this.transparentMaterial as any).userData = shader.uniforms;

      shader.vertexShader = `
        uniform float uTime;
        uniform float uPerformanceMode;
        uniform float uShaders;
        attribute float aSway;
        attribute vec2 aTileBase;
        varying vec3 vWorldPos;
        varying vec2 vTileBase;
        varying vec3 vWorldNormal;
        ${shader.vertexShader}
      `
        .replace(
          "#include <begin_vertex>",
          `
        #include <begin_vertex>
        vTileBase = aTileBase;
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        // Wind swaying for leaves and plants (aSway == 1 for top vertices)
        if (uPerformanceMode < 0.5 && uShaders > 0.5 && aSway > 0.5 && aSway < 1.5) {
          float sway = sin(uTime * 2.0 + (position.x + modelMatrix[3][0]) * 0.5 + (position.z + modelMatrix[3][2]) * 0.5) * 0.1;
          transformed.x += sway * aSway;
          transformed.z += sway * aSway;
        }
        // Add vertical wave displacement for water (aSway == 2)
        if (uPerformanceMode < 0.5 && uShaders > 0.5 && aSway > 1.5 && aSway < 2.5) {
          // Volumetric 3D Waves: Multiple Gerstner-like sine overlays
          float wX = position.x + modelMatrix[3][0];
          float wZ = position.z + modelMatrix[3][2];
          float wave1 = sin(uTime * 1.5 + wX * 0.5 + wZ * 0.5) * 0.08;
          float wave2 = sin(uTime * 2.0 + wX * 1.2 - wZ * 0.8) * 0.04;
          float wave3 = cos(uTime * 1.0 - wX * 0.3 + wZ * 0.7) * 0.05;
          transformed.y += wave1 + wave2 + wave3;
        }
        // Vertical displacement for lava (aSway == 3)
        if (uPerformanceMode < 0.5 && uShaders > 0.5 && aSway > 2.5) {
          transformed.y += sin(uTime * 0.5 + (position.x + modelMatrix[3][0]) * 0.2 + (position.z + modelMatrix[3][2]) * 0.2) * 0.05;
        }
        `,
        )
        .replace(
          "#include <worldpos_vertex>",
          `
        #include <worldpos_vertex>
        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        `,
        );

      shader.fragmentShader = `
        uniform float uTime;
        uniform float uPerformanceMode;
        uniform float uShaders;
        uniform float uIsVoidtrail;
        varying vec3 vWorldPos;
        varying vec2 vTileBase;
        varying vec3 vWorldNormal;
        float customRoughness = 0.1;
        float customMetalness = 0.1;
        ${shader.fragmentShader}
      `
        .replace(
          "#include <map_fragment>",
          `
        #ifdef USE_MAP
          vec2 localUv = fract(vMapUv) / 32.0;
          float margin = 0.0005;
          localUv.x = clamp(localUv.x, margin, 0.03125 - margin);
          localUv.y = clamp(localUv.y, margin, 0.03125 - margin);
          vec2 animatedUv = vTileBase + localUv;
          
          float shimmer = 0.0;
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          float fresnel = 0.0;
          
          // Water is at [0, 2] in 32x32 atlas. U: 0, V: 29/32 = 0.90625
          if (uPerformanceMode < 0.5 && uShaders > 0.5 && vTileBase.y > 0.90 && vTileBase.y < 0.91 && vTileBase.x < 0.01) {
            // Refraction distortion using view direction
            vec2 wPos = vWorldPos.xz * 0.2;
            
            // Limit refraction strength to avoid harsh texture wrapping jumps
            float refracX = viewDir.x * 0.015 * sin(uTime + vWorldPos.z * 0.5);
            float refracY = viewDir.z * 0.015 * cos(uTime + vWorldPos.x * 0.5);
            
            // Smoothly move the UVs rather than jumping them harshly
            float moveX = uTime * 0.005;
            float moveY = uTime * 0.005;
            
            // Note: because we're in an atlas, we have to clamp or use fract, but fract is harsh 
            // if the texture isn't perfectly seamless on all 4 edges. We'll use a very slow gentle move.
            animatedUv.x = vTileBase.x + margin + mod(vWorldPos.x * 0.05 + moveX + refracX, 0.03125 - 2.0 * margin);
            animatedUv.y = vTileBase.y + margin + mod(vWorldPos.z * 0.05 + moveY + refracY, 0.03125 - 2.0 * margin);
            
            // Dynamic Caustics
            float caustic1 = sin(vWorldPos.x * 0.8 + uTime * 1.5) * cos(vWorldPos.z * 0.8 + uTime * 1.2);
            float caustic2 = sin(vWorldPos.x * 1.5 - uTime * 0.8) * cos(vWorldPos.z * 1.5 - uTime * 1.1);
            shimmer = pow(max(0.0, (caustic1 + caustic2) * 0.5), 3.0) * 0.3; // Much softer, broader waves instead of sharp dots
          }
          vec4 texelColor = texture2D( map, animatedUv );
          texelColor.rgb += shimmer; // Apply the cooling shimmer

          // Apply a deeper water color for better aesthetics without the white curtain
          if (uShaders > 0.5 && uPerformanceMode < 0.5 && vTileBase.y > 0.90 && vTileBase.y < 0.91 && vTileBase.x < 0.01) {
            vec3 deepWaterColor = vec3(0.08, 0.3, 0.5);
            texelColor.rgb = mix(texelColor.rgb, deepWaterColor, 0.5);
            texelColor.a = 0.85; // Give it a slight consistent transparency
          }

          #ifndef DEPTH_PACKING
          // Physically Based Rendering (PBR) approximation for transparent items
          if (uShaders > 0.5 && uPerformanceMode < 0.5) {
             float lum = dot(texelColor.rgb, vec3(0.299, 0.587, 0.114));
             float saturation = length(texelColor.rgb - vec3(lum));
             
             customRoughness = clamp(1.0 - lum + saturation * 1.5, 0.1, 1.0);
             // Water and glass are highly specular (low roughness, high metalness or purely reflective)
             if (texelColor.a < 0.9) {
                 customRoughness = 0.05;
                 customMetalness = 0.95;
             }
          }
          #endif

          diffuseColor *= texelColor;
        #endif
        `,
        )
        .replace(
          "#include <roughnessmap_fragment>",
          `
        float roughnessFactor = roughness;
        #ifndef DEPTH_PACKING
        roughnessFactor = customRoughness;
        #endif
        `,
        )
        .replace(
          "#include <metalnessmap_fragment>",
          `
        float metalnessFactor = metalness;
        #ifndef DEPTH_PACKING
        metalnessFactor = customMetalness;
        #endif
        `,
        )
        .replace(
          "#include <dithering_fragment>",
          `
          #include <dithering_fragment>
          #ifdef USE_COLOR
            if (uIsVoidtrail < 0.5) {
              // Voxel baked light (vColor) acts as minimum ambient illumination
              // If the scene lighting (ambient + directional) is darker than our baked light,
              // we boost the final output color to match the baked light!
              // diffuseColor already contains texelColor * vColor.
              gl_FragColor.rgb = max(gl_FragColor.rgb, diffuseColor.rgb);
            } else {
              // Childish happy vibes for voidtrail
              vec3 color = gl_FragColor.rgb;
              float lum = dot(color, vec3(0.299, 0.587, 0.114));
              // Saturate slightly instead of blowing out
              color = mix(vec3(lum), color, 1.3);
              // Quantize / posterize
              color = floor(color * 8.0 + 0.5) / 8.0;
              // Add a soft tint
              vec3 tint = mix(vec3(0.05, 0.0, 0.1), vec3(0.0), lum);
              gl_FragColor.rgb = clamp(color + tint, 0.0, 1.0);
            }
          #endif
          `
        );
    };
  }

  updateMaterials(delta: number, weatherIntensity: number = 0) {
    const settings = settingsManager.getSettings();
    const isPerformanceMode = settings.performanceMode;
    const isPremiumShadersEnabled = settings.premiumShaders;
    const isVoidtrail = this.isVoidtrail;

    // Update performance mode uniform
    if ((this.opaqueMaterial as any).userData?.uPerformanceMode) {
      (this.opaqueMaterial as any).userData.uPerformanceMode.value =
        isPerformanceMode ? 1.0 : 0.0;
    }
    
    // Update uIsVoidtrail
    if ((this.opaqueMaterial as any).userData?.uIsVoidtrail) {
      (this.opaqueMaterial as any).userData.uIsVoidtrail.value = isVoidtrail ? 1.0 : 0.0;
    }
    if ((this.transparentMaterial as any).userData?.uIsVoidtrail) {
      (this.transparentMaterial as any).userData.uIsVoidtrail.value = isVoidtrail ? 1.0 : 0.0;
    }
    if ((this.transparentMaterial as any).userData?.uPerformanceMode) {
      (this.transparentMaterial as any).userData.uPerformanceMode.value =
        isPerformanceMode ? 1.0 : 0.0;
    }
    if ((this.opaqueDepthMaterial as any).userData?.uPerformanceMode) {
      (this.opaqueDepthMaterial as any).userData.uPerformanceMode.value =
        isPerformanceMode ? 1.0 : 0.0;
    }
    if ((this.transparentDepthMaterial as any).userData?.uPerformanceMode) {
      (this.transparentDepthMaterial as any).userData.uPerformanceMode.value =
        isPerformanceMode ? 1.0 : 0.0;
    }

    // Update premium shaders uniform
    if ((this.opaqueMaterial as any).userData?.uShaders) {
      (this.opaqueMaterial as any).userData.uShaders.value =
        isPremiumShadersEnabled ? 1.0 : 0.0;
    }
    if ((this.transparentMaterial as any).userData?.uShaders) {
      (this.transparentMaterial as any).userData.uShaders.value =
        isPremiumShadersEnabled ? 1.0 : 0.0;
    }
    if ((this.opaqueDepthMaterial as any).userData?.uShaders) {
      (this.opaqueDepthMaterial as any).userData.uShaders.value =
        isPremiumShadersEnabled ? 1.0 : 0.0;
    }
    if ((this.transparentDepthMaterial as any).userData?.uShaders) {
      (this.transparentDepthMaterial as any).userData.uShaders.value =
        isPremiumShadersEnabled ? 1.0 : 0.0;
    }

    // Update time and wetness
    if ((this.opaqueMaterial as any).userData?.uTime) {
      if (!(this.opaqueMaterial as any).userData.uWetness) {
        (this.opaqueMaterial as any).userData.uWetness = { value: 0 };
      }
      (this.opaqueMaterial as any).userData.uWetness.value = weatherIntensity;
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
      const c = this.getChunk(cx - 1, cz);
      if (c) c.needsUpdate = true;
      if (bz === 0) {
        const c2 = this.getChunk(cx - 1, cz - 1);
        if (c2) c2.needsUpdate = true;
      }
      if (bz === 15) {
        const c2 = this.getChunk(cx - 1, cz + 1);
        if (c2) c2.needsUpdate = true;
      }
    }
    if (bx === 15) {
      const c = this.getChunk(cx + 1, cz);
      if (c) c.needsUpdate = true;
      if (bz === 0) {
        const c2 = this.getChunk(cx + 1, cz - 1);
        if (c2) c2.needsUpdate = true;
      }
      if (bz === 15) {
        const c2 = this.getChunk(cx + 1, cz + 1);
        if (c2) c2.needsUpdate = true;
      }
    }
    if (bz === 0) {
      const c = this.getChunk(cx, cz - 1);
      if (c) c.needsUpdate = true;
    }
    if (bz === 15) {
      const c = this.getChunk(cx, cz + 1);
      if (c) c.needsUpdate = true;
    }
  }

  isIndestructible(x: number, y: number, z: number) {
    let isHub = false;
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const serverName = urlParams.get("server") || "hub";
      isHub = serverName.startsWith("hub");
    }

    // The entire hub world is indestructible to prevent players from mining the spawn
    if (isHub) return true;

    const absX = Math.abs(Math.floor(x));
    const absZ = Math.abs(Math.floor(z));
    
    // Protect the 4 map corners from block placement/destruction
    if (absX >= 29 && absX <= 34 && absZ >= 76 && absZ <= 81) {
      return true;
    }

    const key = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    const currentBlock = this.getBlock(x, y, z);

    if (this.isSkyCastles) {
      if (skycastlesBakedBlocks.has(key)) {
        const bakedType = skycastlesBakedBlocks.get(key);
        if (bakedType !== 0 && currentBlock !== bakedType) return false;
        if (bakedType !== 0 && currentBlock === bakedType) return true;
      }
      if (this.bakedBlocks.has(key)) {
        const bakedType = this.bakedBlocks.get(key);
        if (bakedType !== 0 && currentBlock !== bakedType) return false;
        if (bakedType !== 0 && currentBlock === bakedType) return true;
      }
      if (x === 5 && y === 65 && Math.abs(z) === 189) return true;
    }

    // Bedrock is always indestructible
    if (y === -60) return true;

    if (this.isSkyCastles) {
      const absX = Math.abs(x);
      const absZ = Math.abs(z);
      const currentBlock = this.getBlock(x, y, z);

      // 3. The stairs of the mountain castle unbreakable
      if (absX <= 6 && absZ >= 65 && absZ <= 175) {
        const groundY = getTerrainData(x, z, true, false, 800).height - 60;
        if (y <= groundY && currentBlock !== BLOCK.AIR) return true;
      }

      // 4. The flanks in the middle void and the tunnels unbreakable
      // Flanks
      if (absZ <= 13 && absX <= 15) {
        const groundY = getTerrainData(x, z, true, false, 800).height - 60;
        if (y <= groundY && currentBlock !== BLOCK.AIR) return true;
      }

      // Tunnels (Main tube and the vertical shafts at absZ=78)
      if (absX >= 22 && absX <= 42 && absZ <= 315) {
        if (y <= 24 || (Math.abs(absZ - 78) <= 5 && Math.abs(absX - 32) <= 5)) {
          // Protect natural terrain blocks so we don't accidentally let them mine the cave walls
          if (
            currentBlock === BLOCK.STONE ||
            currentBlock === BLOCK.DIRT ||
            currentBlock === BLOCK.GRASS ||
            currentBlock === BLOCK.DEEPSLATE ||
            currentBlock === BLOCK.TUFF
          ) {
            return true;
          }
        }
      }
    }

    // Castle footprints (including fences/walls at +-30)
    const isWithinX = x >= -30 && x <= 30;
    const castleCenter = this.isSkyCastles ? 200 : 100;
    const isBlueCastleZ = z >= castleCenter - 30 && z <= castleCenter + 30;
    const isRedCastleZ = z >= -(castleCenter + 30) && z <= -(castleCenter - 30);

    // Castles and the grass layer immediately beneath them (y=4)
    if (isWithinX && (isBlueCastleZ || isRedCastleZ) && y >= 4) {
      return true;
    }

    // Village boundaries (protected area)
    const villageStart = this.isSkyCastles ? 300 : 61;
    const villageEnd = this.isSkyCastles ? 350 : 110;
    const isBlueVillageZ = z >= villageStart && z <= villageEnd;
    const isRedVillageZ = z >= -villageEnd && z <= -villageStart;
    const isVillageX = x >= -50 && x <= 50;
    if (
      isVillageX &&
      (isBlueVillageZ || (isRedVillageZ && this.isSkyCastles)) &&
      y >= 4
    ) {
      return true;
    }

    return false;
  }

  setBlock(
    x: number,
    y: number,
    z: number,
    type: number,
    sync: boolean = true,
    force: boolean = false,
  ): boolean {
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
    const isEmissive =
      type === BLOCK.GLOWSTONE || type === BLOCK.LAVA || isAnyTorch(type);
    const oldIsEmissive =
      oldType === BLOCK.GLOWSTONE ||
      oldType === BLOCK.LAVA ||
      isAnyTorch(oldType);

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
        { dx: 1, dy: 0, dz: 0 },
        { dx: -1, dy: 0, dz: 0 },
        { dx: 0, dy: 1, dz: 0 },
        { dx: 0, dy: -1, dz: 0 },
        { dx: 0, dy: 0, dz: 1 },
        { dx: 0, dy: 0, dz: -1 },
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
      const c = this.getChunk(cx - 1, cz);
      if (c) c.needsUpdate = true;
      if (bz === 0) {
        const c2 = this.getChunk(cx - 1, cz - 1);
        if (c2) c2.needsUpdate = true;
      }
      if (bz === 15) {
        const c2 = this.getChunk(cx - 1, cz + 1);
        if (c2) c2.needsUpdate = true;
      }
    }
    if (bx === 15) {
      const c = this.getChunk(cx + 1, cz);
      if (c) c.needsUpdate = true;
      if (bz === 0) {
        const c2 = this.getChunk(cx + 1, cz - 1);
        if (c2) c2.needsUpdate = true;
      }
      if (bz === 15) {
        const c2 = this.getChunk(cx + 1, cz + 1);
        if (c2) c2.needsUpdate = true;
      }
    }
    if (bz === 0) {
      const c = this.getChunk(cx, cz - 1);
      if (c) c.needsUpdate = true;
    }
    if (bz === 15) {
      const c = this.getChunk(cx, cz + 1);
      if (c) c.needsUpdate = true;
    }

    return true;
  }

  hasWeight(blockType: number) {
    return (
      blockType === BLOCK.SAND ||
      blockType === BLOCK.GRASS ||
      blockType === BLOCK.LEAVES
    );
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

    if (this.fallingBlocks.size > 0 || this.waterUpdates.size > 0) {
      this.physics.tick(delta);
    }

    // Process any light updates that resulted from block changes caused by gravity or water falling
    this.lightingManager.processLightUpdates();
  }

  async generateChunk(cx: number, cz: number) {
    return generateChunkMethod(this, cx, cz);
  }

  async applyNetworkBlockChanges(chunk: Chunk, cx: number, cz: number) {
    if (!networkManager) return;
    try {
      const changes = await networkManager.requestChunkChanges(cx, cz);
      if (changes) {
        // Overlay the typed array block changes over the procedurally generated chunk
        for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
          for (let lz = 0; lz < CHUNK_SIZE; lz++) {
            for (let lx = 0; lx < CHUNK_SIZE; lx++) {
              const type = changes[lx | (lz << 4) | (ly << 8)];
              if (type !== 65535) { // 65535 identifies 'unmodified'
                chunk.setBlockFast(lx, ly, lz, type);
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn("Failed to apply network chunk changes", err);
    }
  }

  onWorkerMessage(e: MessageEvent) {
    const data = e.data;
    const task = this.pendingTasks.get(data.taskId);
    if (!task) return;
    this.pendingTasks.delete(data.taskId);
    try {
      task.chunk.applyMesh(
        data.opaque,
        data.transparent,
        this.opaqueMaterial,
        this.transparentMaterial,
        this.opaqueDepthMaterial,
        this.transparentDepthMaterial,
        settingsManager.getSettings().performanceMode,
      );
      this.meshesToAdd.push({
        chunk: task.chunk,
        mesh: task.chunk.mesh,
        transparentMesh: task.chunk.transparentMesh,
      });
      task.resolve();
    } catch (err) {
      task.chunk.isMeshing = false;
      task.reject(err);
    }
  }
  update(playerPosition: THREE.Vector3, camera?: THREE.Camera) {
    this.updater.update(playerPosition, camera);
  }

  rebuildAllChunks() {
    this.chunks.forEach((chunk) => {
      chunk.needsUpdate = true;
    });
  }

  reset(serverName: string = "hub") {
    if (!serverName) serverName = "hub";
    this.isHub = serverName.startsWith("hub");
    this.isSkyCastles = serverName.startsWith("skycastles");
    this.isVoidtrail = serverName.startsWith("voidtrail");
    this.isDungeonDelver = serverName.startsWith("dungeondelver");
    this.isBattleRoyale = serverName.startsWith("battleroyale");
    this.isSkyIsland = serverName.startsWith("skyisland");

    this.chunks.forEach((chunk) => {
      if (chunk.mesh) {
        this.scene.remove(chunk.mesh);
        chunk.mesh.geometry.dispose();
      }
      if (chunk.transparentMesh) {
        this.scene.remove(chunk.transparentMesh);
        chunk.transparentMesh.geometry.dispose();
      }
    });
    this.chunks.clear();
    this.generatingChunks.clear();
    this.meshesToAdd = [];
    this.fallingBlocks.clear();
    this.waterUpdates.clear();
    this.queuedMobs = [];
  }

  // Raycasting for block placement/breaking
  raycast(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number,
  ) {
    return this.raycaster.raycast(origin, direction, maxDistance);
  }
}
