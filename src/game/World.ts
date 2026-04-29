import * as THREE from 'three';
import { Chunk, CHUNK_SIZE, CHUNK_HEIGHT, WORLD_Y_OFFSET } from './Chunk';
import { BLOCK, createTextureAtlas, isSolidBlock, isWater, isAnyTorch } from './TextureAtlas';
import { audioManager } from './AudioManager';
import { settingsManager } from './Settings';
import { LightingManager } from './LightingManager';
import { networkManager } from './NetworkManager';
import { biomes, getTerrainData, noise2D, noise3D } from './TerrainGenerator';

import { generateHubTerrain, buildHubCastles } from './generation/HubGenerator';
import { getCastleBlock } from './generation/SkyCastlesGenerator';
import { getVillageBlock } from './generation/SkyBridgeGenerator';
import { getGiantMythicalShipBlock } from './generation/ShipGenerator';

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
  meshesToAdd: { chunk: Chunk, mesh: THREE.Mesh | null, transparentMesh: THREE.Mesh | null }[] = [];
  fallingBlocks: Set<string> = new Set();
  waterUpdates: Set<string> = new Set();
  lightingManager: LightingManager;
  tickAccumulator: number = 0;
  tickRate: number = 0.1; // Tick every 100ms
  queuedMobs: { type: any, pos: THREE.Vector3 }[] = [];
  isHub: boolean = false;
  isSkyCastles: boolean = false;

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

  biomes = biomes;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const urlParams = new URLSearchParams(window.location.search);
    const serverName = urlParams.get('server') || 'hub';
    this.isHub = serverName === 'hub';
    this.isSkyCastles = serverName === 'skycastles' || serverName === 'voidtrail';
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
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        ${shader.vertexShader}
      `.replace(
        '#include <begin_vertex>',
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
        `
      );

      shader.fragmentShader = `
        varying vec2 vTileBase;
        uniform float uShaders;
        uniform float uPerformanceMode;
        uniform float uWetness;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        float customRoughness = 0.8;
        float customMetalness = 0.1;
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

          if (uShaders > 0.5 && uPerformanceMode < 0.5) {
             vec3 viewDir = normalize(vViewPosition); 
             float height = dot(texture2D(map, animatedUv).rgb, vec3(0.299, 0.587, 0.114));
             vec2 offset = (viewDir.xy) * (height * 0.005 - 0.0025);
             animatedUv += offset;
             animatedUv = clamp(animatedUv, vTileBase + margin, vTileBase + 0.03125 - margin);
          }

          vec4 texelColor = texture2D( map, animatedUv );

          #ifndef DEPTH_PACKING
          if (uShaders > 0.5 && uPerformanceMode < 0.5) {
             float lum = dot(texelColor.rgb, vec3(0.299, 0.587, 0.114));
             float saturation = length(texelColor.rgb - vec3(lum));
             
             // Base Roughness
             customRoughness = clamp(1.0 - lum + saturation * 1.5, 0.3, 1.0); // Kept quite rough so things don't look artificial
             customMetalness = clamp((1.0 - saturation * 2.5) * lum, 0.0, 0.2); // Usually very slightly metallic 
             
             // Specific block handling (rough approximation based on tile UV)
             // Leaves (y == 2 or 3 in atlas approx)
             if (vTileBase.y > 0.06 && vTileBase.y < 0.1) {
                 customRoughness = 0.9; 
                 customMetalness = 0.0;
             }
             // Stone variants (usually grey, low sat)
             else if (saturation < 0.1) {
                 customRoughness = clamp(0.7 - lum*0.3, 0.4, 0.9);
                 customMetalness = 0.15;
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
        `
      ).replace(
        '#include <roughnessmap_fragment>',
        `
        float roughnessFactor = roughness;
        #ifndef DEPTH_PACKING
        roughnessFactor = customRoughness;
        #endif
        `
      ).replace(
        '#include <metalnessmap_fragment>',
        `
        float metalnessFactor = metalness;
        #ifndef DEPTH_PACKING
        metalnessFactor = customMetalness;
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
        `
      );

      shader.fragmentShader = `
        varying vec2 vTileBase;
        uniform float uShaders;
        uniform float uPerformanceMode;
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
        varying vec3 vWorldNormal;
        ${shader.vertexShader}
      `.replace(
        '#include <begin_vertex>',
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
        varying vec3 vWorldNormal;
        float customRoughness = 0.1;
        float customMetalness = 0.1;
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
            shimmer = pow(max(0.0, (caustic1 + caustic2) * 0.5), 10.0) * 0.8; // Sharpen and strengthen caustics
            
            // Fresnel equation for Reflection/Refraction blend
            fresnel = max(0.0, 1.0 - dot(viewDir, normalize(vWorldNormal)));
            fresnel = pow(fresnel, 3.0); // Less aggressive grazing angle requirements
          }
          vec4 texelColor = texture2D( map, animatedUv );
          texelColor.rgb += shimmer; // Apply the cooling shimmer

          // Screen-space reflection approximation (blend sky blue into water at grazing angles)
          if (uShaders > 0.5 && uPerformanceMode < 0.5 && vTileBase.y > 0.90 && vTileBase.y < 0.91 && vTileBase.x < 0.01) {
            // Better water color and sky reflection blend
            vec3 deepWaterColor = vec3(0.05, 0.2, 0.4);
            vec3 skyReflectColor = vec3(0.6, 0.8, 0.95);
            
            // Blend base texture with deep water color
            texelColor.rgb = mix(texelColor.rgb, deepWaterColor, 0.5);
            
            // Apply sky reflection based on fresnel
            texelColor.rgb = mix(texelColor.rgb, skyReflectColor, fresnel * 0.8);
            
            // Increase opacity for reflections, keep it transparent otherwise
            texelColor.a = mix(0.6, 0.98, fresnel);
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
        `
      ).replace(
        '#include <roughnessmap_fragment>',
        `
        float roughnessFactor = roughness;
        #ifndef DEPTH_PACKING
        roughnessFactor = customRoughness;
        #endif
        `
      ).replace(
        '#include <metalnessmap_fragment>',
        `
        float metalnessFactor = metalness;
        #ifndef DEPTH_PACKING
        metalnessFactor = customMetalness;
        #endif
        `
      );
    };
  }

  updateMaterials(delta: number, weatherIntensity: number = 0) {
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
    const castleCenter = this.isSkyCastles ? 200 : 100;
    const isBlueCastleZ = z >= (castleCenter - 30) && z <= (castleCenter + 30);
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
          // Beyond world size, just generate air
          continue;
        }

        const isBlueSide = this.isSkyCastles ? worldZ >= 70 : worldZ >= 0;
        const isRedSide = this.isSkyCastles ? worldZ <= -70 : worldZ < 0;
        const isVoid = !isBlueSide && !isRedSide;
        const isBridge = this.isSkyCastles ? isVoid && worldX >= -8 && worldX <= 8 : false;

        const t_bridge = Math.max(-1, Math.min(1, worldZ / 70));
        const curveOffset = 45 * (1 - t_bridge * t_bridge);
        const rightCenterX = 30 + curveOffset;
        const leftCenterX = -30 - curveOffset;
        const isRightCurve = Math.abs(worldX - rightCenterX) <= 2;
        const isLeftCurve = Math.abs(worldX - leftCenterX) <= 2;
        const isRightIsland = Math.pow(worldX - 75, 2) + Math.pow(worldZ, 2) <= 100;
        const isLeftIsland = Math.pow(worldX + 75, 2) + Math.pow(worldZ, 2) <= 100;
        const isSideBridge = isVoid && (isRightCurve || isLeftCurve);
        const isSideIsland = isVoid && (isRightIsland || isLeftIsland);
        
        if (this.isSkyCastles) {
          if (Math.abs(worldZ) >= 320 || Math.abs(worldX) > 95) {
            for (let y = 0; y < CHUNK_HEIGHT; y++) chunk.setBlockFast(x, y, z, BLOCK.AIR);
            // DO NOT continue here, so that Pirate Ship structures can be drawn later!
          }
        }

        const { height: terrainHeight, biome, isProtected: isAreaProtected, minHeight: terrainMinHeight } = getTerrainData(worldX, worldZ, this.isSkyCastles, this.isHub, this.worldSize);
        const maxProtectedZ = this.isSkyCastles ? 500 : 410;
        const villageStart = this.isSkyCastles ? 70 : 61;
        const protectionWidth = this.isSkyCastles ? 100 : 50;
        const isVillageOrCastle = (worldX >= -protectionWidth && worldX <= protectionWidth) && ((worldZ >= villageStart && maxProtectedZ >= worldZ) || (worldZ <= -villageStart && worldZ >= -maxProtectedZ));
        const isBridgeArea = this.isSkyCastles ? worldX >= -12 && worldX <= 12 && worldZ > -70 && worldZ < 70 : false;
        const isProtected = isVillageOrCastle || isBridgeArea || isAreaProtected;
        if (this.isHub) {
          generateHubTerrain(chunk, x, z, worldX, worldZ);
        } else if (isBlueSide || isRedSide) {
          const hasCaves = !this.isSkyCastles && !isProtected && biome !== this.biomes.OCEAN && noise2D(worldX * 0.01, worldZ * 0.01) > 0.3;
          const blueVillageStart = this.isSkyCastles ? 300 : 61;
          const blueVillageEnd = this.isSkyCastles ? 350 : 110;
          const isBlueVillage = worldZ >= blueVillageStart && worldZ <= blueVillageEnd;
          const isRedVillage = worldZ <= -blueVillageStart && worldZ >= -blueVillageEnd;
          
          let minIslandY = terrainMinHeight;
          if (!this.isSkyCastles) minIslandY = 0;
          
          for (let y = Math.max(0, Math.floor(minIslandY)); y <= terrainHeight; y++) {
            if (y === minIslandY) {
              chunk.setBlockFast(x, y, z, BLOCK.STONE); // Bedrock/Bottom layer
            } else {
              // Caves
              let isCave = false;
              if (hasCaves && y > 1 && y < terrainHeight - 4) {
                // Noodle caves (tunnels)
                const caveNoise1 = noise3D(worldX * 0.015, y * 0.015, worldZ * 0.015);
                const caveNoise2 = noise3D(worldX * 0.015 + 1000, y * 0.015 + 1000, worldZ * 0.015 + 1000);
                const tunnelRadius = 0.08 + noise3D(worldX * 0.005, y * 0.005, worldZ * 0.005) * 0.05;
                // A tunnel is formed where two noise fields are both close to 0
                if (Math.abs(caveNoise1) < tunnelRadius && Math.abs(caveNoise2) < tunnelRadius) {
                  isCave = true;
                }
                
                // Caverns (large open areas)
                const cavernNoise = noise3D(worldX * 0.008, y * 0.01, worldZ * 0.008);
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
                  
                  if (!this.isSkyCastles && (isBlueVillage || isRedVillage) && worldX >= -50 && worldX <= 50) {
                    const villageOffset = this.isSkyCastles ? 169 : -70;
                    const wellZ = isBlueVillage ? (85 + villageOffset) : -(85 + villageOffset);
                    if (worldX >= -3 && worldX <= 3) isPath = true;
                    else if (worldZ >= wellZ - 3 && worldZ <= wellZ + 3 && worldX >= -45 && worldX <= 45) isPath = true;
                    else if (worldX >= -30 && worldX <= -26 && Math.abs(worldZ - wellZ) <= 20) isPath = true;
                    else if (worldX >= 26 && worldX <= 30 && Math.abs(worldZ - wellZ) <= 20) isPath = true;
                    else if (worldX >= -9 && worldX <= -3 && Math.abs(worldZ - (isBlueVillage ? (96 + villageOffset) : -(96 + villageOffset))) <= 2) isPath = true;
                    else if (worldX >= 3 && worldX <= 6 && Math.abs(worldZ - (isBlueVillage ? (70 + villageOffset) : -(70 + villageOffset))) <= 2) isPath = true;
                    else if (worldX >= -15 && worldX <= -11 && Math.abs(worldZ - (isBlueVillage ? (65 + villageOffset) : -(79 + villageOffset))) <= 2) isPath = true;
                    else if (worldX >= 6 && worldX <= 20 && Math.abs(worldZ - (isBlueVillage ? (97 + villageOffset) : -(97 + villageOffset))) <= 2) isPath = true;
                    else if (worldX >= 38 && worldX <= 42 && Math.abs(worldZ - (isBlueVillage ? (75 + villageOffset) : -(83 + villageOffset))) <= 2) isPath = true;
                    
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
                  } else if (this.isSkyCastles && Math.abs(worldX) <= 5 && ((Math.abs(worldZ) >= 70 && Math.abs(worldZ) <= 170) || (Math.abs(worldZ) >= 230 && Math.abs(worldZ) <= 300))) {
                    // Majestic Stairs refinement
                    chunk.setBlockFast(x, y, z, BLOCK.SLAB_WOOD);
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
                  const layerNoise = Math.floor(y + noise2D(worldX * 0.05, worldZ * 0.05) * 3);
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
                  if (!this.isSkyCastles && y < 60) {
                    const oreNoise = noise3D(worldX * 0.1, y * 0.1, worldZ * 0.1);
                    if (oreNoise > 0.6) {
                      const oreTypeNoise = noise3D(worldX * 0.05, y * 0.05, worldZ * 0.05);
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
          if (terrainHeight < 62 && (!this.isSkyCastles || terrainHeight > 0)) {
            for (let y = terrainHeight + 1; y <= 62; y++) {
              if (biome === this.biomes.VOLCANIC) {
                chunk.setBlockFast(x, y, z, BLOCK.LAVA);
              } else {
                chunk.setBlockFast(x, y, z, BLOCK.WATER);
              }
            }
          }

          // Trees (only outside protected areas)
          if (!isProtected && !this.isSkyCastles && terrainHeight >= 63 && biome.treeChance > 0) {
            const treeNoise = noise2D(worldX * 13.37, worldZ * 13.37);
            if (treeNoise > 1 - biome.treeChance * 2) { // Tree probability
              // Determine tree type
              let logBlock = BLOCK.WOOD;
              let leavesBlock = BLOCK.LEAVES;
              let treeHeight = 5;
              
              if (biome.treeType === 'BIRCH') {
                const typeNoise = noise2D(worldX * 0.1, worldZ * 0.1);
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
                treeHeight = 3 + Math.floor((noise2D(worldX * 0.1, worldZ * 0.1) + 1) * 1.5);
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
                leavesBlock = noise2D(worldX * 0.1, worldZ * 0.1) > 0 ? BLOCK.MUSHROOM_BLOCK_RED : BLOCK.MUSHROOM_BLOCK_BROWN;
                treeHeight = 6;
              } else if (biome.treeType === 'ICE_SPIKE') {
                logBlock = BLOCK.ICE;
                leavesBlock = BLOCK.AIR;
                treeHeight = 10 + Math.floor((noise2D(worldX * 0.1, worldZ * 0.1) + 1) * 5);
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
          if (!isProtected && !this.isSkyCastles && terrainHeight >= 63 && biome.plantChance > 0) {
            const plantNoise = noise2D(worldX * 42.42, worldZ * 42.42);
            if (plantNoise > 1 - biome.plantChance * 2) {
              const typeNoise = noise2D(worldX * 0.5, worldZ * 0.5);
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
          if (!this.isSkyCastles && !isProtected && terrainHeight >= 63) {
            const animalNoise = noise2D(worldX * 123.45, worldZ * 123.45);
            if (animalNoise > 0.99) {
              const typeNoise = noise2D(worldX * 0.2, worldZ * 0.2);
              let type = 'Cow';
              if (typeNoise > 0.3) type = 'Pig';
              else if (typeNoise < -0.3) type = 'Sheep';
              this.queuedMobs.push({ type, pos: new THREE.Vector3(worldX + 0.5, terrainHeight + 1 + WORLD_Y_OFFSET, worldZ + 0.5) });
            }
          }

          // Castles
          const castleZCenter = this.isSkyCastles ? 200 : 100;
          const isBlueCastleArea = isBlueSide && worldX >= -35 && worldX <= 35 && worldZ >= (castleZCenter - 35) && worldZ <= (castleZCenter + 35);
          const isRedCastleArea = isRedSide && worldX >= -35 && worldX <= 35 && worldZ >= -(castleZCenter + 35) && worldZ <= -(castleZCenter - 35);
          
          if (this.isSkyCastles && (isBlueCastleArea || isRedCastleArea)) {
            const castleYOffset = this.isSkyCastles ? 60 : 0;
            for (let y = 65; y < CHUNK_HEIGHT; y++) {
              let block = BLOCK.AIR;
              if (y >= 65 + castleYOffset) {
                if (isBlueCastleArea) {
                  block = getCastleBlock(worldX, y - 60 - castleYOffset, worldZ, castleZCenter, BLOCK.BLUE_STONE, this.isSkyCastles, this.queuedMobs);
                } else if (isRedCastleArea) {
                  block = getCastleBlock(worldX, y - 60 - castleYOffset, worldZ, -castleZCenter, BLOCK.RED_STONE, this.isSkyCastles, this.queuedMobs);
                }
              }
              if (block !== BLOCK.AIR && block !== -1) {
                chunk.setBlockFast(x, y, z, block);
              } else if (block === BLOCK.AIR && y >= 65 + castleYOffset) {
                chunk.setBlockFast(x, y, z, BLOCK.AIR);
              }
            }
          }

          // Villages
          if (!this.isSkyCastles && (isBlueVillage || isRedVillage) && worldX >= -50 && worldX <= 50) {
            for (let y = 65; y < CHUNK_HEIGHT; y++) {
              const block = getVillageBlock(worldX, y - 60, worldZ, isBlueVillage, this.isSkyCastles);
              if (block !== BLOCK.AIR) {
                chunk.setBlockFast(x, y, z, block);
              }
            }
          }
        } else if (isBridge) {
          if (this.isSkyCastles) {
            // "Wide flank floating" - Generate large floating platforms instead of a bridge
            // Use absolute Z for perfect symmetry between teams
            const islandNoise = noise2D(worldX * 0.04, Math.abs(worldZ) * 0.03);
            const detailNoise = noise2D(worldX * 0.2, Math.abs(worldZ) * 0.2);
            
            // Special logic for an elevated flat flank just in the middle
            const isMiddle = Math.abs(worldZ) < 12;
            const middleWidth = Math.abs(worldX) < 14; 
            
            if (isMiddle && middleWidth) {
              const centerHeight = 75;
              const centerThickness = 5;
              
              const distFromCenter = Math.sqrt((worldX * worldX) / 200 + (worldZ * worldZ) / 144);
              if (distFromCenter < 1.0) {
                for (let y = centerHeight - centerThickness; y <= centerHeight; y++) {
                  let block = BLOCK.STONE;
                  if (y === centerHeight) {
                    block = (Math.abs(worldX) < 12 && Math.abs(worldZ) < 10) ? BLOCK.GRASS : BLOCK.STONE_BRICKS;
                  } else if (y > centerHeight - 2) {
                    block = BLOCK.DIRT;
                  }
                  chunk.setBlockFast(x, y, z, block);
                }
                
                if (Math.abs(worldX) % 8 === 0 && Math.abs(worldZ) % 8 === 0) {
                    chunk.setBlockFast(x, centerHeight + 1, z, BLOCK.SEA_LANTERN);
                }
                
                continue;
              }
            }

            if (islandNoise > 0.1) {
              const baseHeight = 60 + Math.floor(noise2D(Math.abs(worldZ) * 0.01, 0) * 10);
              const thickness = 4 + Math.floor((islandNoise - 0.1) * 10) + Math.floor(detailNoise * 2);
              
              for (let y = baseHeight - thickness; y <= baseHeight; y++) {
                let block = BLOCK.STONE;
                if (y === baseHeight) {
                  block = (detailNoise > 0.5) ? BLOCK.GRASS : BLOCK.STONE_BRICKS;
                } else if (y > baseHeight - 2) {
                  block = BLOCK.DIRT;
                }
                if (y < baseHeight - thickness + 1 && detailNoise < -0.5) continue;
                chunk.setBlockFast(x, y, z, block);
              }
              if (islandNoise > 0.4 && detailNoise > 0.8) {
                chunk.setBlockFast(x, baseHeight + 1, z, BLOCK.SEA_LANTERN);
              }
            }
            continue; 
          }

          // Enchanted Medieval Bridge structure (Original logic for non-Skycastles)
          for (let y = 50; y <= 64; y++) {
            const isPillarPos = Math.abs(worldZ) % 15 <= 2;
            const isLampPos = Math.abs(worldZ) % 15 === 0;
            const isSide = worldX === -8 || worldX === 8;
            const isOuterSide = worldX === -9 || worldX === 9;

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
        } else if (isSideIsland) {
            const distRightSq = Math.pow(worldX - 75, 2) + Math.pow(worldZ, 2);
            const distLeftSq = Math.pow(worldX + 75, 2) + Math.pow(worldZ, 2);
            const distSq = worldX > 0 ? distRightSq : distLeftSq;
            const dist = Math.sqrt(distSq);

            const islandDepth = Math.max(1, 10 - dist);
            const islandBase = 64 - Math.floor(islandDepth);

            for (let y = islandBase; y <= 64; y++) {
               if (y === 64) {
                 chunk.setBlockFast(x, y, z, BLOCK.GRASS);
               } else if (y >= 64 - 2) {
                 chunk.setBlockFast(x, y, z, BLOCK.DIRT);
               } else {
                 chunk.setBlockFast(x, y, z, BLOCK.STONE);
               }
            }

            if (dist < 1.0) {
               for (let ty = 65; ty <= 68; ty++) chunk.setBlockFast(x, ty, z, BLOCK.DARK_OAK_LOG);
               for (let ly=67; ly<=69; ly++) {
                 for (let lx=-2; lx<=2; lx++) {
                   for (let lz=-2; lz<=2; lz++) {
                     if (Math.abs(lx)+Math.abs(lz) < 3 || ly===68) {
                        const targetX = x+lx;
                        const targetZ = z+lz;
                        if (targetX >= 0 && targetX < CHUNK_SIZE && targetZ >= 0 && targetZ < CHUNK_SIZE) {
                           if (chunk.getBlock(targetX, ly, targetZ) === BLOCK.AIR) {
                             chunk.setBlockFast(targetX, ly, targetZ, BLOCK.DARK_OAK_LEAVES);
                           }
                        }
                     }
                   }
                 }
               }
            } else if (dist > 3 && dist < 4 && Math.abs(worldX + worldZ) % 3 === 0) {
               chunk.setBlockFast(x, 65, z, BLOCK.TALL_GRASS);
            }
        } else if (isSideBridge) {
            const isRightSideEdge = worldX > 0 && Math.abs(worldX - rightCenterX) >= 1.5;
            const isLeftSideEdge = worldX < 0 && Math.abs(worldX - leftCenterX) >= 1.5;
            const isEdge = isRightSideEdge || isLeftSideEdge;
            const sketchyHole = noise2D(worldX * 0.4, worldZ * 0.4) > 0.6;

            if (!sketchyHole || isEdge) {
               chunk.setBlockFast(x, 64, z, isEdge ? BLOCK.SPRUCE_LOG : BLOCK.SPRUCE_PLANKS);
            }

            if (!isEdge && !sketchyHole) {
               chunk.setBlockFast(x, 63, z, BLOCK.SPRUCE_PLANKS);
            }

            if (isEdge && Math.abs(worldZ) % 15 === 0) {
               chunk.setBlockFast(x, 65, z, BLOCK.SPRUCE_LOG);
            }
        }

        // Giant Mythical Pirate Ships replacing Shelters
        if (!this.isHub) {
          const pShipStart = 200;
          const pShipEnd = 430;
          const poolCenterZ = 310;
          const distToBlueShipSq = worldX * worldX + (worldZ - poolCenterZ) * (worldZ - poolCenterZ);
          const distToRedShipSq = worldX * worldX + (worldZ + poolCenterZ) * (worldZ + poolCenterZ);
          
          if (worldZ >= pShipStart && worldZ <= pShipEnd && worldX >= -45 && worldX <= 45) {
             for (let y = 130; y <= 255; y++) {
                const shipBlock = getGiantMythicalShipBlock(worldX, y, worldZ, true);
                if (shipBlock !== BLOCK.AIR) chunk.setBlockFast(x, y, z, shipBlock);
             }
             if (distToBlueShipSq <= 400) {
                 const dist = Math.sqrt(distToBlueShipSq);
                 const depth = Math.floor(20 - dist);
                 if (depth > 0) {
                     const poolSurfaceY = 64;
                     for (let y = poolSurfaceY - depth; y <= poolSurfaceY; y++) {
                         const isEdge = y === poolSurfaceY - depth || dist >= 19;
                         chunk.setBlockFast(x, y, z, isEdge ? BLOCK.MOSSY_COBBLESTONE : BLOCK.WATER); 
                     }
                     for (let y = poolSurfaceY + 1; y <= Math.min(poolSurfaceY + 15, CHUNK_HEIGHT - 1); y++) {
                         chunk.setBlockFast(x, y, z, BLOCK.AIR);
                     }
                 }
             }
          }
          if (worldZ <= -pShipStart && worldZ >= -pShipEnd && worldX >= -45 && worldX <= 45) {
             for (let y = 130; y <= 255; y++) {
                const shipBlock = getGiantMythicalShipBlock(worldX, y, worldZ, false);
                if (shipBlock !== BLOCK.AIR) chunk.setBlockFast(x, y, z, shipBlock);
             }
             if (distToRedShipSq <= 400) {
                 const dist = Math.sqrt(distToRedShipSq);
                 const depth = Math.floor(20 - dist);
                 if (depth > 0) {
                     const poolSurfaceY = 64;
                     for (let y = poolSurfaceY - depth; y <= poolSurfaceY; y++) {
                         const isEdge = y === poolSurfaceY - depth || dist >= 19;
                         chunk.setBlockFast(x, y, z, isEdge ? BLOCK.MOSSY_COBBLESTONE : BLOCK.WATER); 
                     }
                     for (let y = poolSurfaceY + 1; y <= Math.min(poolSurfaceY + 15, CHUNK_HEIGHT - 1); y++) {
                         chunk.setBlockFast(x, y, z, BLOCK.AIR);
                     }
                 }
             }
          }
          
          // Note: Old Pirate Ships removed in favor of Giant Mythical Pirate Ships
          
          // Side Mines (Underground Tunnels connecting bases)
          const isLeftMineArea = worldX >= -40 && worldX <= -24;
          const isRightMineArea = worldX >= 24 && worldX <= 40;
          const mineZLimit = this.isSkyCastles ? 310 : 140; 
          
          if ((isLeftMineArea || isRightMineArea) && worldZ >= -mineZLimit && worldZ <= mineZLimit) {
            const centerX = worldX < 0 ? -32 : 32;
            const tunnelY = 6; // Floor at Y=6, walk at Y=7
            
            // Check if we are at the entry shafts (Z = ±78)
            const isEntryZ = Math.abs(worldZ - 78) <= 2 || Math.abs(worldZ + 78) <= 2;
            const isEntryX = Math.abs(worldX - centerX) <= 2;
            const isEntryShaft = isEntryZ && isEntryX;
            
            // Tunnel dimensions
            const dyCenter = tunnelY + 3;
            const sqDistToCenter = (worldX - centerX) * (worldX - centerX);
            
            for (let y = 0; y <= CHUNK_HEIGHT - 1; y++) {
               const dyTop = (y - dyCenter);
               const distSq = sqDistToCenter + dyTop * dyTop;
               const innerRadiusSq = 3 * 3;
               const outerRadiusSq = 5 * 5;
               
               const isInsideTunnel = distSq <= innerRadiusSq;
               const isTunnelShell = distSq <= outerRadiusSq + noise3D(worldX * 0.1, y * 0.1, worldZ * 0.1) * 5;
               
               let blockToPlace: number | null = null;
               
               // Generate Shaft
               if (isEntryShaft) {
                   if (y >= tunnelY && y <= terrainHeight) {
                       // Hollow out the core of the shaft, place ladders/vines? or stairs
                       const shaftDistSq = (worldX - centerX) * (worldX - centerX) + Math.min(Math.abs(worldZ - 78), Math.abs(worldZ + 78)) ** 2;
                       if (shaftDistSq <= 2) {
                           // Water elevator or just air? Let's use scaffolding or air
                           // Actually we'll just put air for the shaft and water at the bottom
                           if (y === tunnelY && shaftDistSq === 0) blockToPlace = BLOCK.WATER;
                           else blockToPlace = BLOCK.AIR;
                       } else if (shaftDistSq <= 6) {
                           // Walls of the shaft
                           if (y > tunnelY) blockToPlace = BLOCK.STONE_BRICKS;
                       }
                   }
               }
               
               // Generate Tunnel
               if (blockToPlace === null && isInsideTunnel) {
                   if (y >= tunnelY && y <= tunnelY + 4) {
                       blockToPlace = BLOCK.AIR;
                       // Decorations
                       const localX = worldX - centerX;
                       if (Math.abs(worldZ) % 8 <= 1) {
                           if (Math.abs(localX) === 2 || y === tunnelY + 4 || y === tunnelY) {
                               blockToPlace = BLOCK.STRIPPED_OAK_LOG;
                           }
                       }
                       if (Math.abs(worldZ) % 8 === 0 && y === tunnelY + 2 && Math.abs(localX) === 1) {
                           blockToPlace = BLOCK.TORCH;
                       }
                   } else if (y === tunnelY - 1) {
                       blockToPlace = BLOCK.STONE;
                   }
               } else if (blockToPlace === null && isTunnelShell) {
                   if (y < Math.max(terrainHeight - 3, tunnelY + 5) || terrainHeight === 0) {
                       if (Math.random() < 0.2) blockToPlace = BLOCK.DEEPSLATE;
                       else if (Math.random() < 0.3) blockToPlace = BLOCK.MOSSY_COBBLESTONE;
                       else blockToPlace = BLOCK.COBBLESTONE;
                   }
               }
               
               if (blockToPlace !== null) {
                   const curr = chunk.getBlock(x, y, z);
                   // Ensure we don't overwrite bedrock or very top blocks unless it is our shaft
                   if (y > 0 && curr !== BLOCK.CHEST) {
                        chunk.setBlockFast(x, y, z, blockToPlace);
                   }
               }
            }
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
              new THREE.Vector3(cx * CHUNK_SIZE, WORLD_Y_OFFSET, cz * CHUNK_SIZE),
              new THREE.Vector3((cx + 1) * CHUNK_SIZE, WORLD_Y_OFFSET + CHUNK_HEIGHT, (cz + 1) * CHUNK_SIZE)
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
          // We don't dispose the material because it's shared across all chunks
          // chunk.mesh.material.dispose(); // Removing this explicitly to prevent WebGL leaks from destroying shared material
        }
        if (chunk.transparentMesh) {
          this.scene.remove(chunk.transparentMesh);
          chunk.transparentMesh.geometry.dispose();
          // chunk.transparentMesh.material.dispose();
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
            new THREE.Vector3(chunk.x * CHUNK_SIZE, WORLD_Y_OFFSET, chunk.z * CHUNK_SIZE),
            new THREE.Vector3((chunk.x + 1) * CHUNK_SIZE, WORLD_Y_OFFSET + CHUNK_HEIGHT, (chunk.z + 1) * CHUNK_SIZE)
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
