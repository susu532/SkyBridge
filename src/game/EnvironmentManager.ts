import * as THREE from 'three';
import { Game } from './Game';
import { settingsManager } from './Settings';

export class EnvironmentManager {
  game: Game;
  
  dayTime: number = 0; // 0 to 1
  dayCycleSpeed: number = 0.0008; // speed of cycle (approx 20 mins for full cycle)
  
  // Sky elements
  sunMesh: THREE.Mesh | null = null;
  moonMesh: THREE.Mesh | null = null;
  clouds: THREE.Group | null = null;

  // Weather elements
  weatherType: 'clear' | 'rain' | 'snow' = 'clear';
  weatherChangeTimer: number = 0;
  globalWeatherIntensity: number = 0;
  rainPoints: THREE.Points | null = null;
  snowPoints: THREE.Points | null = null;
  
  constructor(game: Game) {
    this.game = game;
  }
  
  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    ambientLight.name = 'ambient';
    this.game.scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffee, 1.0);
    dirLight.name = 'sun';
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = true;
    
    // High-Precision Shadow Settings
    const shadowSize = 128; // Smaller frustum = higher shadow density
    dirLight.shadow.camera.top = shadowSize / 2;
    dirLight.shadow.camera.bottom = -shadowSize / 2;
    dirLight.shadow.camera.left = -shadowSize / 2;
    dirLight.shadow.camera.right = shadowSize / 2;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 400;
    dirLight.shadow.mapSize.width = 4096;
    dirLight.shadow.mapSize.height = 4096;
    dirLight.shadow.bias = -0.0003;
    dirLight.shadow.normalBias = 0.08;
    dirLight.shadow.autoUpdate = true;
    dirLight.shadow.radius = 1.0;
    
    this.game.scene.add(dirLight);
    this.game.scene.add(dirLight.target);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    this.game.scene.add(hemiLight);
  }

  setupSky() {
    // Sun
    const sunGeo = new THREE.BoxGeometry(40, 40, 40);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffaa });
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.game.scene.add(this.sunMesh);

    // Moon
    const moonGeo = new THREE.BoxGeometry(30, 30, 30);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
    this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
    this.game.scene.add(this.moonMesh);

    // Clouds
    this.clouds = new THREE.Group();
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
    for (let i = 0; i < 40; i++) {
      const cloud = new THREE.Group();
      const blocks = 3 + Math.floor(Math.random() * 5);
      for (let j = 0; j < blocks; j++) {
        const blockGeo = new THREE.BoxGeometry(
          10 + Math.random() * 10,
          4 + Math.random() * 4,
          10 + Math.random() * 10
        );
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
        const tData = this.game.world.getTerrainData(px, pz);
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

                if (posArray[i*3+1] < this.game.player.position.y - 20) {
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

                if (posArray[i*3+1] < this.game.player.position.y - 20) {
                    posArray[i*3+1] = this.game.player.position.y + 40 + Math.random() * 40;
                }
            }
            posAttribute.needsUpdate = true;
        }
    }
  }

  updateSky(delta: number) {
    this.dayTime = (this.dayTime + delta * this.dayCycleSpeed) % 1;
    
    const sunAngle = this.dayTime * Math.PI * 2;
    const sunY = Math.sin(sunAngle);
    const sunX = Math.cos(sunAngle);
    const isDay = sunY > 0;
    
    // Update Sun and Moon positions
    if (this.sunMesh) {
      this.sunMesh.position.set(sunX * 250, sunY * 250, 0);
      this.sunMesh.lookAt(0, 0, 0);
      this.sunMesh.visible = true;
    }
    if (this.moonMesh) {
      this.moonMesh.position.set(-sunX * 250, -sunY * 250, 0);
      this.moonMesh.lookAt(0, 0, 0);
      this.moonMesh.visible = true;
    }

    // Update Clouds
    if (this.clouds) {
      this.clouds.children.forEach(cloud => {
        cloud.position.x += delta * 2;
        if (cloud.position.x > 500) cloud.position.x = -500;
      });
      this.clouds.position.x = this.game.player.position.x;
      this.clouds.position.z = this.game.player.position.z;
      this.clouds.visible = true;
    }
    
    // Sky and Fog
    const daySky = new THREE.Color(0x4facfe);
    const nightSky = new THREE.Color(0x0f0c29);
    const sunsetSky = new THREE.Color(0xff8c00);
    const waterSky = new THREE.Color(0x103060);
    const lavaSky = new THREE.Color(0x601010);
    const rainSky = new THREE.Color(0x5a6a7a);
    
    let skyColor;
    if (this.game.player.isUnderLava) {
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

    if (this.game.scene.fog instanceof THREE.FogExp2) {
      this.game.scene.fog.color.copy(skyColor);
      if (this.game.player.isUnderLava) {
        this.game.scene.fog.density = 0.45;
      } else if (this.game.player.isUnderwater) {
        this.game.scene.fog.density = 0.15;
      } else {
        const fogFactor = Math.max(0, -sunY * 2 + 0.5);
        const baseDensity = isDay ? 0.008 : 0.002 + fogFactor * 0.005;
        const weatherFogDensity = 0.025;
        this.game.scene.fog.density = THREE.MathUtils.lerp(baseDensity, weatherFogDensity, this.globalWeatherIntensity);
      }
    }

    // Lights
    const dirLight = this.game.scene.getObjectByName('sun') as THREE.DirectionalLight;
    if (dirLight) {
      const sunDist = 200;
      const lightOffset = new THREE.Vector3(sunX * sunDist, Math.max(Math.abs(sunY), 0.1) * sunDist * (isDay ? 1 : -1), 0);
      
      const shadowFrustumSize = 128;
      const texelSize = shadowFrustumSize / 4096;
      
      const snappedPos = this.game.player.worldPosition.clone();
      snappedPos.x = Math.round(snappedPos.x / texelSize) * texelSize;
      snappedPos.y = Math.round(snappedPos.y / texelSize) * texelSize;
      snappedPos.z = Math.round(snappedPos.z / texelSize) * texelSize;

      dirLight.position.copy(snappedPos).add(lightOffset);
      dirLight.target.position.copy(snappedPos);
      dirLight.target.updateMatrixWorld();
      
      const sunColorDay = new THREE.Color(0xffffee);
      const sunColorSunset = new THREE.Color(0xffaa55);
      const sunColorNight = new THREE.Color(0xabcdef);
      
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
      
      let targetIntensity = isDay ? Math.max(0, sunY) * 4.5 + 0.5 : Math.max(0, Math.abs(sunY)) * 1.5;
      
      if (this.globalWeatherIntensity > 0) {
        targetIntensity = THREE.MathUtils.lerp(targetIntensity, targetIntensity * 0.4, this.globalWeatherIntensity);
      }
      
      dirLight.intensity = targetIntensity;
    }
    const ambientLight = this.game.scene.getObjectByName('ambient') as THREE.AmbientLight;
    if (ambientLight) {
      let ambientIntensity = isDay ? (Math.max(0, sunY) * 0.4 + 0.4) : (Math.abs(sunY) * 0.2 + 0.2);
      if (this.globalWeatherIntensity > 0) {
        ambientIntensity = THREE.MathUtils.lerp(ambientIntensity, ambientIntensity * 0.6, this.globalWeatherIntensity);
      }
      ambientLight.intensity = ambientIntensity;
      ambientLight.color.copy(skyColor);
    }
  }
}
