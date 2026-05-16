import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SSRPass } from 'three/examples/jsm/postprocessing/SSRPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { Game } from './Game';
import { settingsManager } from './Settings';

export class PostProcessingManager {
  composer: EffectComposer | null = null;
  game: Game;

  constructor(game: Game) {
    this.game = game;

    const usePremiumShaders = settingsManager.getSettings().premiumShaders;
    
    if (this.game.world.isVoidtrail || usePremiumShaders) {
      if (usePremiumShaders) {
        this.game.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.game.renderer.toneMappingExposure = 1.0;
        this.game.renderer.shadowMap.enabled = true;
        this.game.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      } else {
        this.game.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.game.renderer.toneMappingExposure = 1.1; // Bright punchy lighting
      }
      
      this.composer = new EffectComposer(this.game.renderer);
      const renderPass = new RenderPass(this.game.scene, this.game.camera);
      this.composer.addPass(renderPass);
      
      // Ray Tracing setup via Screen Space Reflections and SSAO
      if (usePremiumShaders) {
        // Soft ambient occlusion
        const ssaoPass = new SSAOPass(this.game.scene, this.game.camera, window.innerWidth, window.innerHeight);
        ssaoPass.kernelRadius = 16;
        ssaoPass.minDistance = 0.005;
        ssaoPass.maxDistance = 0.1;
        this.composer.addPass(ssaoPass);

        // Screen space reflections
        const ssrPass = new SSRPass({
          renderer: this.game.renderer,
          scene: this.game.scene,
          camera: this.game.camera,
          width: window.innerWidth,
          height: window.innerHeight,
          groundReflector: null,
          selects: null // Reflect all compatible meshes by default
        });

        ssrPass.maxDistance = 10;
        ssrPass.opacity = 0.8;
        ssrPass.thickness = 0.05;
        this.composer.addPass(ssrPass);
      }
      
      // Subtle bloom
      if (this.game.world.isVoidtrail) {
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.35, 0.4, 0.85);
        this.composer.addPass(bloomPass);
      } else if (usePremiumShaders) {
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.25, 0.2, 0.95);
        this.composer.addPass(bloomPass);
      }
    } else {
      this.game.renderer.toneMapping = THREE.NoToneMapping;
    }
  }

  setSize(width: number, height: number) {
    if (this.composer) {
      this.composer.setSize(width, height);
    }
  }

  render() {
    if (this.composer) {
      this.composer.render();
    } else {
      this.game.renderer.render(this.game.scene, this.game.camera);
    }
  }

  dispose() {
    if (this.composer) {
      this.composer.renderer.dispose();
      if ((this.composer as any).renderTarget1) (this.composer as any).renderTarget1.dispose();
      if ((this.composer as any).renderTarget2) (this.composer as any).renderTarget2.dispose();
    }
  }
}
