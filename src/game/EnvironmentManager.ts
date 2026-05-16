import * as THREE from 'three';
import { Game } from './Game';
import { settingsManager } from './Settings';
import { getTerrainData } from './TerrainGenerator';
import { audioManager } from './AudioManager';

export class EnvironmentManager {
  game: Game;
  
  dayTime: number = 0; // 0 to 1
  dayCycleSpeed: number = 0.0008; // speed of cycle (approx 20 mins for full cycle)
  
  // Sky elements
  sunMesh: THREE.Mesh | null = null;
  sunRaysMesh: THREE.Mesh | null = null;
  moonMesh: THREE.Mesh | null = null;
  clouds: THREE.Group | null = null;

  // Weather elements
  weatherType: 'clear' | 'rain' | 'snow' = 'clear';
  weatherChangeTimer: number = 0;
  globalWeatherIntensity: number = 0;
  rainPoints: THREE.Points | null = null;
  snowPoints: THREE.Points | null = null;
  envTexture: THREE.DataTexture | null = null;
  
  constructor(game: Game) {
    this.game = game;
  }
  
  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    ambientLight.name = 'ambient';
    this.game.scene.add(ambientLight);
    
    const isPerformance = settingsManager.getSettings().performanceMode;
    const dirLight = new THREE.DirectionalLight(0xffffee, 1.5);
    dirLight.name = 'sun';
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = !isPerformance;
    
    // High-Precision Shadow Settings for Ultra-Realistic Soft Shadows
    const shadowSize = 120; // Reduced frustum for higher pixel density
    dirLight.shadow.camera.top = shadowSize / 2;
    dirLight.shadow.camera.bottom = -shadowSize / 2;
    dirLight.shadow.camera.left = -shadowSize / 2;
    dirLight.shadow.camera.right = shadowSize / 2;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 300;
    dirLight.shadow.mapSize.width = 4096;
    dirLight.shadow.mapSize.height = 4096;
    dirLight.shadow.bias = -0.0004; // Increased bias to prevent HD artifacts in FP
    dirLight.shadow.normalBias = 0.05; // Stronger normal bias for voxel edges
    dirLight.shadow.autoUpdate = true;
    dirLight.shadow.radius = this.game.world.isVoidtrail ? 6 : 1; // Super soft shadow for voidtrail
    
    // Add VSM or PCF softness if needed through renderer? Three handles radius based on map type.
    
    this.game.scene.add(dirLight);
    this.game.scene.add(dirLight.target);

    // GI Bounced Light (Simulated Path Tracing Global Illumination)
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    hemiLight.name = 'hemi';
    this.game.scene.add(hemiLight);
  }

  setupSky() {
    // Sun
    const sunGeo = new THREE.PlaneGeometry(200, 200);
    const sunMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0xffffee) }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float time;
        uniform vec3 color;

        // Random function
        float random(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
        }

        // Noise function
        float noise(vec2 st) {
            vec2 i = floor(st);
            vec2 f = fract(st);

            float a = random(i);
            float b = random(i + vec2(1.0, 0.0));
            float c = random(i + vec2(0.0, 1.0));
            float d = random(i + vec2(1.0, 1.0));

            vec2 u = f * f * (3.0 - 2.0 * f);

            return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }

        // FBM 
        float fbm(vec2 st) {
            float value = 0.0;
            float amplitude = 0.5;
            float frequency = 0.0;
            for (int i = 0; i < 5; i++) {
                value += amplitude * noise(st);
                st *= 2.0;
                amplitude *= 0.5;
            }
            return value;
        }
        
        void main() {
          vec2 p = vUv - 0.5;
          float dist = length(p);
          
          // Corona distortion using FBM
          float angle = atan(p.y, p.x);
          float n1 = fbm(vec2(angle * 3.0 + time * 0.1, dist * 8.0 - time * 0.5));
          float n2 = fbm(vec2(angle * 5.0 - time * 0.2, dist * 10.0 + time * 0.3));
          float distortion = (n1 + n2) * 0.05;

          dist += distortion;

          // Realistic bright core with steep falloff
          float core = 1.0 - smoothstep(0.08, 0.1, dist);
          
          // Inner glow
          float innerGlow = 1.0 - smoothstep(0.08, 0.2, dist);
          innerGlow = pow(innerGlow, 2.0);

          // Outer halo/corona with noise
          float haloDist = length(vUv - 0.5); // base distance for smooth falloff
          float outerGlow = 1.0 - smoothstep(0.1, 0.5, haloDist);
          outerGlow = pow(outerGlow, 3.0);
          
          // Star surface texture
          float surfaceNoise = fbm(p * 20.0 + time * 0.2);
          vec3 surfaceColor = mix(vec3(1.0, 0.9, 0.6), vec3(1.0, 1.0, 0.9), surfaceNoise);
          
          float alpha = clamp(core + innerGlow + outerGlow, 0.0, 1.0);
          if (alpha < 0.01) discard;
          
          // Animate the global brightness slightly
          float pulse = sin(time * 1.5) * 0.05 + 0.95;
          
          // Colors
          vec3 tintColor = color * vec3(1.0, 0.9, 0.5) * pulse; // Warmer glow
          vec3 finalColor = mix(tintColor * (innerGlow + outerGlow), surfaceColor, core);
          
          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.game.scene.add(this.sunMesh);

    // Sun Rays (Sky Castles)
    if (this.game.world.isSkyCastles) {
      const rayGeo = new THREE.PlaneGeometry(500, 500);
      const rayMat = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            color: { value: new THREE.Color(0xffffaa) },
            sunIntensity: { value: 1.0 }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float time;
            uniform vec3 color;
            uniform float sunIntensity;
            varying vec2 vUv;
            
            // Random function
            float random(vec2 st) {
                return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
            }

            // Noise function
            float noise(vec2 st) {
                vec2 i = floor(st);
                vec2 f = fract(st);

                // Four corners in 2D of a tile
                float a = random(i);
                float b = random(i + vec2(1.0, 0.0));
                float c = random(i + vec2(0.0, 1.0));
                float d = random(i + vec2(1.0, 1.0));

                vec2 u = f * f * (3.0 - 2.0 * f);

                return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
            }
            
            void main() {
                vec2 centeredUv = vUv - 0.5;
                float dist = length(centeredUv);
                
                // Shorter sun rays limit
                if (dist > 0.2) {
                    discard;
                }
                
                float angle = atan(centeredUv.y, centeredUv.x);
                
                // Construct animated rays using angle and time
                float ray1 = noise(vec2(angle * 7.0 + time * 0.4, dist * 3.0 - time * 0.7));
                float ray2 = noise(vec2(angle * 14.0 - time * 0.5, dist * 6.0 - time * 1.0));
                
                // Combine overlapping rays
                float rays = max(ray1, ray2);
                
                // Soft gradient from center
                float alpha = smoothstep(0.2, 0.05, dist) * smoothstep(0.0, 0.05, dist);
                
                // Sparkle effect
                float sparkle = pow(rays, 3.0) * alpha * sunIntensity * 0.5;
                
                gl_FragColor = vec4(color, sparkle);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      this.sunRaysMesh = new THREE.Mesh(rayGeo, rayMat);
      this.game.scene.add(this.sunRaysMesh);
    }

    // Moon
    const moonGeo = new THREE.BoxGeometry(30, 30, 30);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
    this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
    this.game.scene.add(this.moonMesh);

    // Clouds
    this.clouds = new THREE.Group();
    const cloudColor = this.game.world.isVoidtrail ? 0xffeef5 : 0xffffff;
    const cloudOpacity = this.game.world.isVoidtrail ? 0.95 : 0.8;
    const cloudMat = new THREE.MeshLambertMaterial({ color: cloudColor, transparent: true, opacity: cloudOpacity });
    for (let i = 0; i < 40; i++) {
      const cloud = new THREE.Group();
      const blocks = 3 + Math.floor(Math.random() * 5);
      for (let j = 0; j < blocks; j++) {
        // If voidtrail, we could use rounded corners... but BoxGeometry is fine if we stick to voxels.
        // We'll make them taller and chunkier.
        const width = 10 + Math.random() * 10;
        const height = this.game.world.isVoidtrail ? 8 + Math.random() * 8 : 4 + Math.random() * 4;
        const depth = 10 + Math.random() * 10;
        const blockGeo = new THREE.BoxGeometry(width, height, depth);
        const block = new THREE.Mesh(blockGeo, cloudMat);
        block.castShadow = false;
        block.receiveShadow = false;
        block.position.set(
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 5,
          (Math.random() - 0.5) * 20
        );
        cloud.add(block);
      }
      cloud.position.set(
        (Math.random() - 0.5) * 1000,
        100 + Math.random() * 20,
        (Math.random() - 0.5) * 1000
      );
      this.clouds.add(cloud);
    }
    this.game.scene.add(this.clouds);
  }

  setupWeather() {
    // Rain
    const rainGeo = new THREE.BufferGeometry();
    const rainCount = 10000;
    const rainPositions = new Float32Array(rainCount * 3);
    const rainVelocities = new Float32Array(rainCount);
    for (let i = 0; i < rainCount; i++) {
        rainPositions[i * 3] = (Math.random() - 0.5) * 100;
        rainPositions[i * 3 + 1] = Math.random() * 100;
        rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 100;
        rainVelocities[i] = 15 + Math.random() * 10;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    rainGeo.setAttribute('velocity', new THREE.BufferAttribute(rainVelocities, 1));

    const rainMat = new THREE.PointsMaterial({
        color: 0xaaaaaa,
        size: 0.1,
        transparent: true,
        opacity: 0.6,
    });
    this.rainPoints = new THREE.Points(rainGeo, rainMat);
    this.rainPoints.visible = false;
    this.rainPoints.frustumCulled = false;
    this.game.scene.add(this.rainPoints);

    // Snow
    const snowGeo = new THREE.BufferGeometry();
    const snowCount = 10000;
    const snowPositions = new Float32Array(snowCount * 3);
    const snowVelocities = new Float32Array(snowCount);
    for (let i = 0; i < snowCount; i++) {
        snowPositions[i*3] = (Math.random() - 0.5) * 100;
        snowPositions[i*3+1] = Math.random() * 100;
        snowPositions[i*3+2] = (Math.random() - 0.5) * 100;
        snowVelocities[i] = 2 + Math.random() * 3;
    }
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
    snowGeo.setAttribute('velocity', new THREE.BufferAttribute(snowVelocities, 1));
    
    const snowMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.2,
        transparent: true,
        opacity: 0.8
    });
    this.snowPoints = new THREE.Points(snowGeo, snowMat);
    this.snowPoints.visible = false;
    this.snowPoints.frustumCulled = false;
    this.game.scene.add(this.snowPoints);
  }

  update(delta: number) {
    this.updateWeather(delta);
    this.updateSky(delta);
  }

  updateWeather(delta: number) {
    const settings = settingsManager.getSettings();
    if (settings.performanceMode) {
        if (this.rainPoints) this.rainPoints.visible = false;
        if (this.snowPoints) this.snowPoints.visible = false;
        
        // Stop rain sound if performance mode is enabled
        if (audioManager.isAmbientPlaying('rain')) {
            audioManager.stopAmbient('rain');
        }
        return;
    }

    const cycleDuration = 15 * 60 * 1000;
    const rainDuration = cycleDuration / 3;
    const timeInCycle = Date.now() % cycleDuration;
    
    let targetIntensity = 0;
    if (timeInCycle < rainDuration) {
        targetIntensity = 1.0;
    }
    
    if (this.globalWeatherIntensity < targetIntensity) {
        this.globalWeatherIntensity = Math.min(targetIntensity, this.globalWeatherIntensity + delta / 10);
    } else if (this.globalWeatherIntensity > targetIntensity) {
        this.globalWeatherIntensity = Math.max(targetIntensity, this.globalWeatherIntensity - delta / 10);
    }

    const isInclement = this.globalWeatherIntensity > 0.05;

    const px = Math.floor(this.game.player.position.x);
    const pz = Math.floor(this.game.player.position.z);
    let isSnowBiome = false;
    let isDesertBiome = false;
    
    if (this.game.world && this.game.world.biomes) {
        const tData = getTerrainData(px, pz, this.game.world.isSkyCastles, this.game.world.isHub, this.game.world.worldSize);
        const b = tData.biome;
        isSnowBiome = b === this.game.world.biomes.SNOWY_TUNDRA || b === this.game.world.biomes.ICE_SPIKES || b === this.game.world.biomes.TAIGA || b === this.game.world.biomes.MOUNTAINS;
        isDesertBiome = b === this.game.world.biomes.DESERT || b === this.game.world.biomes.BADLANDS || b === this.game.world.biomes.SAVANNA || b === this.game.world.biomes.VOLCANIC;
    }

    let showRain = false;
    let showSnow = false;

    if (isInclement) {
        if (isSnowBiome) showSnow = true;
        else if (!isDesertBiome) showRain = true;
    }
    
    if (showRain) this.weatherType = 'rain';
    else if (showSnow) this.weatherType = 'snow';
    else this.weatherType = 'clear';

    // Handle rain sound
    if (showRain) {
        if (!audioManager.isAmbientPlaying('rain')) {
            audioManager.startAmbient('rain');
        }
        // Increased volume from 0.3 to 0.7 for rain
        audioManager.setAmbientVolume('rain', this.globalWeatherIntensity * 0.7);
    } else {
        if (audioManager.isAmbientPlaying('rain')) {
            audioManager.stopAmbient('rain');
        }
    }

    if (this.rainPoints) {
        this.rainPoints.visible = showRain;
        if (showRain) {
            if (this.rainPoints.material instanceof THREE.PointsMaterial) {
                this.rainPoints.material.opacity = this.globalWeatherIntensity * 0.6;
            }
            const posAttribute = this.rainPoints.geometry.getAttribute('position');
            const velAttribute = this.rainPoints.geometry.getAttribute('velocity');
            const posArray = posAttribute.array as Float32Array;
            const velArray = velAttribute.array as Float32Array;

            for (let i=0; i<posArray.length/3; i++) {
                posArray[i*3+1] -= velArray[i] * delta;
                
                let dx = posArray[i*3] - this.game.player.position.x;
                if (dx > 50) posArray[i*3] -= 100;
                else if (dx < -50) posArray[i*3] += 100;

                let dz = posArray[i*3+2] - this.game.player.position.z;
                if (dz > 50) posArray[i*3+2] -= 100;
                else if (dz < -50) posArray[i*3+2] += 100;

                const px = Math.floor(posArray[i*3]);
                const py = Math.floor(posArray[i*3+1]);
                const pz = Math.floor(posArray[i*3+2]);
                
                // Hide or reset rain if it hits a block
                if (posArray[i*3+1] < this.game.player.position.y - 20 || (py >= 0 && this.game.world.getBlock(px, py, pz) !== 0)) {
                    posArray[i*3+1] = this.game.player.position.y + 40 + Math.random() * 40;
                }
            }
            posAttribute.needsUpdate = true;
        }
    }

    if (this.snowPoints) {
        this.snowPoints.visible = showSnow;
        if (showSnow) {
            if (this.snowPoints.material instanceof THREE.PointsMaterial) {
                this.snowPoints.material.opacity = this.globalWeatherIntensity * 0.8;
            }
            const posAttribute = this.snowPoints.geometry.getAttribute('position');
            const velAttribute = this.snowPoints.geometry.getAttribute('velocity');
            const posArray = posAttribute.array as Float32Array;
            const velArray = velAttribute.array as Float32Array;

            const t = this.game.clock.getElapsedTime();

            for (let i=0; i<posArray.length/3; i++) {
                posArray[i*3+1] -= velArray[i] * delta;
                const driftX = (i % 7 - 3) * 0.1;
                const driftZ = (i % 11 - 5) * 0.1;

                posArray[i*3] += (Math.sin(t * 0.5 + driftX) * 0.5 + driftX) * delta;
                posArray[i*3+2] += (Math.cos(t * 0.5 + driftZ) * 0.5 + driftZ) * delta;

                let dx = posArray[i*3] - this.game.player.position.x;
                if (dx > 50) posArray[i*3] -= 100;
                else if (dx < -50) posArray[i*3] += 100;

                let dz = posArray[i*3+2] - this.game.player.position.z;
                if (dz > 50) posArray[i*3+2] -= 100;
                else if (dz < -50) posArray[i*3+2] += 100;
                
                const px = Math.floor(posArray[i*3]);
                const py = Math.floor(posArray[i*3+1]);
                const pz = Math.floor(posArray[i*3+2]);

                // Hide or reset snow if it hits a block
                if (posArray[i*3+1] < this.game.player.position.y - 20 || (py >= 0 && this.game.world.getBlock(px, py, pz) !== 0)) {
                    posArray[i*3+1] = this.game.player.position.y + 40 + Math.random() * 40;
                }
            }
            posAttribute.needsUpdate = true;
        }
    }
  }

  updateSky(delta: number) {
    const settings = settingsManager.getSettings();
    const isPerformance = settings.performanceMode;
    this.dayTime = (this.dayTime + delta * this.dayCycleSpeed) % 1;
    
    const sunAngle = this.dayTime * Math.PI * 2;
    const sunY = Math.sin(sunAngle);
    const sunX = Math.cos(sunAngle);
    const isDay = sunY > 0;
    const isPremium = settingsManager.getSettings().premiumShaders;
    
    // Update Sun and Moon positions
    if (this.sunMesh) {
      this.sunMesh.position.set(
          this.game.player.position.x + sunX * 250, 
          this.game.player.position.y + sunY * 250, 
          this.game.player.position.z
      );
      this.sunMesh.lookAt(this.game.player.position);
      this.sunMesh.visible = !isPerformance && !this.game.world.isDungeonDelver;
      
      if (this.sunMesh.material instanceof THREE.ShaderMaterial) {
          this.sunMesh.material.uniforms.time.value = this.game.clock.getElapsedTime();
      }
      
      if (this.sunRaysMesh) {
          const sunIntensityRays = Math.max(0, sunY) * 2.5; // Scale with sun position
          // Add player world pos offset to sunRaysMesh to keep it relative
          this.sunRaysMesh.position.set(
              this.game.player.position.x + sunX * 240, 
              this.game.player.position.y + sunY * 240, 
              this.game.player.position.z
          );
          
          this.sunRaysMesh.lookAt(this.game.player.position);
          this.sunRaysMesh.visible = this.sunMesh.visible && sunIntensityRays > 0;
          
          if (this.sunRaysMesh.material instanceof THREE.ShaderMaterial) {
              this.sunRaysMesh.material.uniforms.time.value = this.game.clock.getElapsedTime();
              this.sunRaysMesh.material.uniforms.sunIntensity.value = sunIntensityRays;
          }
      }
    }
    if (this.moonMesh) {
      this.moonMesh.position.set(
          this.game.player.position.x - sunX * 250, 
          this.game.player.position.y - sunY * 250, 
          this.game.player.position.z
      );
      this.moonMesh.lookAt(this.game.player.position);
      this.moonMesh.visible = !isPerformance && !this.game.world.isDungeonDelver;
    }

    // Update Clouds
    if (this.clouds) {
      if (!isPerformance) {
        this.clouds.children.forEach(cloud => {
          cloud.position.x += delta * 2;
          if (cloud.position.x > 500) cloud.position.x = -500;
        });
        this.clouds.position.x = this.game.player.position.x;
        this.clouds.position.z = this.game.player.position.z;
        this.clouds.visible = true;
      } else {
        this.clouds.visible = false;
      }
    }
    
    // Sky and Fog
    const daySky = this.game.world.isVoidtrail ? new THREE.Color(0x7ec8e3) : new THREE.Color(0x4facfe);
    const nightSky = this.game.world.isVoidtrail ? new THREE.Color(0x191970) : new THREE.Color(0x0f0c29);
    const sunsetSky = this.game.world.isVoidtrail ? new THREE.Color(0xffa07a) : new THREE.Color(0xff8c00);
    const waterSky = new THREE.Color(0x103060);
    const lavaSky = new THREE.Color(0x601010);
    const rainSky = this.game.world.isVoidtrail ? new THREE.Color(0x90b0c0) : new THREE.Color(0x5a6a7a);
    
    let skyColor;
    if (this.game.world.isDungeonDelver) {
      skyColor = new THREE.Color(0x050505);
      if (this.clouds) this.clouds.visible = false;
      if (this.sunMesh) this.sunMesh.visible = false;
      if (this.moonMesh) this.moonMesh.visible = false;
    } else if (this.game.player.isUnderLava) {
      skyColor = lavaSky;
    } else if (this.game.player.isUnderwater) {
      skyColor = waterSky;
    } else {
      if (sunY > 0.1) {
        skyColor = daySky.clone();
      } else if (sunY > -0.1) {
        skyColor = daySky.clone().lerp(sunsetSky, 1.0 - Math.abs(sunY * 10));
      } else {
        skyColor = sunsetSky.clone().lerp(nightSky, Math.min(1.0, Math.abs(sunY * 5)));
      }

      if (this.globalWeatherIntensity > 0) {
        const currentRainSky = rainSky.clone().lerp(nightSky, Math.max(0, -sunY));
        skyColor.lerp(currentRainSky, this.globalWeatherIntensity * 0.8);
      }
    }
    
    this.game.scene.background = skyColor;
    
    // Create an environment map for PBR reflections (for RTX mode)
    if (!this.envTexture) {
      this.envTexture = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat);
      this.envTexture.needsUpdate = true;
      this.game.scene.environment = this.envTexture;
    }
    const envData = this.envTexture.image.data;
    const r = Math.floor(skyColor.r * 255);
    const g = Math.floor(skyColor.g * 255);
    const b = Math.floor(skyColor.b * 255);
    if (envData[0] !== r || envData[1] !== g || envData[2] !== b) {
      envData[0] = r;
      envData[1] = g;
      envData[2] = b;
      envData[3] = 255;
      this.envTexture.needsUpdate = true;
    }

    if (this.game.scene.fog instanceof THREE.FogExp2) {
      this.game.scene.fog.color.copy(skyColor);
      if (this.game.player.isUnderLava) {
        this.game.scene.fog.density = 0.45;
      } else if (this.game.player.isUnderwater) {
        this.game.scene.fog.density = 0.15;
      } else if (this.game.world.isDungeonDelver) {
        this.game.scene.fog.density = 0.08;
      } else {
        const fogFactor = Math.max(0, -sunY * 2 + 0.5);
        // Volumetric fog effect: enhance fog density in the morning/evening for god ray simulation
        const volumetricBoost = (isPremium && sunY > 0.0 && sunY < 0.3) ? 0.003 : 0.0;
        let baseDensity = isDay ? (0.004 + volumetricBoost) : 0.002 + fogFactor * 0.005;
        if (this.game.world.isVoidtrail) {
            baseDensity *= 1.5; // Thicker pastel fog
            // Tint fog pastel:
            this.game.scene.fog.color.lerp(new THREE.Color(0xffe4e1), 0.3 * (sunY > 0.1 ? 1 : 0));
        }
        const weatherFogDensity = 0.025;
        this.game.scene.fog.density = THREE.MathUtils.lerp(baseDensity, weatherFogDensity, this.globalWeatherIntensity);
      }
    }

    // Lights
    const dirLight = this.game.scene.getObjectByName('sun') as THREE.DirectionalLight;
    if (dirLight) {
      const sunDist = 150;
      const lightOffset = new THREE.Vector3(sunX * sunDist, Math.max(Math.abs(sunY), 0.1) * sunDist * (isDay ? 1 : -1), 0);
      
      const shadowFrustumSize = 120;
      const texelSize = shadowFrustumSize / 4096;
      
      const snappedPos = this.game.player.worldPosition.clone();
      snappedPos.x = Math.round(snappedPos.x / texelSize) * texelSize;
      snappedPos.y = Math.round(snappedPos.y / texelSize) * texelSize;
      snappedPos.z = Math.round(snappedPos.z / texelSize) * texelSize;

      dirLight.position.copy(snappedPos).add(lightOffset);
      dirLight.target.position.copy(snappedPos);
      dirLight.target.updateMatrixWorld();
      
      const sunColorDay = this.game.world.isVoidtrail ? new THREE.Color(0xfffbcc) : new THREE.Color(0xffffee);
      const sunColorSunset = this.game.world.isVoidtrail ? new THREE.Color(0xffbbaa) : new THREE.Color(0xffaa55);
      const sunColorNight = this.game.world.isVoidtrail ? new THREE.Color(0xccddff) : new THREE.Color(0xabcdef);
      
      let sunCol;
      if (sunY > 0.2) {
        sunCol = sunColorDay;
      } else if (sunY > 0.0) {
        sunCol = sunColorDay.clone().lerp(sunColorSunset, 1.0 - (sunY * 5));
      } else {
        sunCol = sunColorSunset.clone().lerp(sunColorNight, Math.min(1.0, Math.abs(sunY * 5)));
      }
      
      if (this.globalWeatherIntensity > 0) {
        sunCol.lerp(new THREE.Color(0xaaaaaa), this.globalWeatherIntensity * 0.5);
      }

      dirLight.color.copy(sunCol);
      
      let targetIntensity = isDay ? Math.max(0, sunY) * 2.5 + 0.5 : Math.max(0, Math.abs(sunY)) * 0.8;
      if (this.game.world.isVoidtrail) {
       targetIntensity = isDay ? targetIntensity * 0.1 : targetIntensity * 0.2;
      } else if (isPremium) {
       // RTX Style: much brighter direct sunlight
       targetIntensity = isDay ? targetIntensity * 1.5 : targetIntensity * 1.2;
      }
      
      if (this.globalWeatherIntensity > 0) {
        targetIntensity = THREE.MathUtils.lerp(targetIntensity, targetIntensity * 0.4, this.globalWeatherIntensity);
      }
      
      dirLight.intensity = this.game.world.isDungeonDelver ? 0 : targetIntensity;
      
      // Update Hemisphere Light for GI Ray Tracing Feel
      const hemiLight = this.game.scene.getObjectByName('hemi') as THREE.HemisphereLight;
      if (hemiLight) {
          if (this.game.world.isDungeonDelver) {
            hemiLight.color.copy(skyColor).lerp(new THREE.Color(0x333333), 0.5);
            hemiLight.groundColor.copy(new THREE.Color(0x111111));
            hemiLight.intensity = 0.6;
          } else {
            const upBlend = this.game.world.isVoidtrail ? new THREE.Color(0xffffee) : new THREE.Color(0xffffff);
            const downBlend = this.game.world.isVoidtrail ? new THREE.Color(0xddeeff) : new THREE.Color(0x556633);
            hemiLight.color.copy(skyColor).lerp(upBlend, 0.5);
            hemiLight.groundColor.copy(downBlend).lerp(new THREE.Color(0x111111), isDay ? 0.0 : 0.8);
            hemiLight.intensity = isDay ? (this.game.world.isVoidtrail ? 1.0 : 0.8) : (this.game.world.isVoidtrail ? 0.5 : 0.3);
            if (isPremium && !this.game.world.isVoidtrail) {
                // Stronger GI bounce feel
                hemiLight.intensity *= 1.4;
            }
          }
      }
    }
    const ambientLight = this.game.scene.getObjectByName('ambient') as THREE.AmbientLight;
    if (ambientLight) {
      let ambientIntensity = isDay ? (Math.max(0, sunY) * 0.4 + 0.4) : (Math.abs(sunY) * 0.2 + 0.2);
      if (this.game.world.isVoidtrail) ambientIntensity *= 1.3;
      if (this.globalWeatherIntensity > 0) {
        ambientIntensity = THREE.MathUtils.lerp(ambientIntensity, ambientIntensity * 0.6, this.globalWeatherIntensity);
      }
      if (isPremium) {
         // RTX style: lower flat ambient, rely on directional + hemi + reflections
         ambientIntensity *= 0.3;
      }
      ambientLight.intensity = ambientIntensity;
      if (this.game.world.isVoidtrail) {
        ambientLight.color.copy(skyColor).lerp(new THREE.Color(0xffffff), 0.3);
      } else {
        ambientLight.color.copy(skyColor);
      }
    }
  }
}
