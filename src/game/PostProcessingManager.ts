import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { Game } from './Game';

export class PostProcessingManager {
  composer: EffectComposer | null = null;
  game: Game;

  constructor(game: Game) {
    this.game = game;

    if (this.game.world.isVoidtrail) {
      this.game.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.game.renderer.toneMappingExposure = 1.1; // Bright punchy lighting
      
      this.composer = new EffectComposer(this.game.renderer);
      const renderPass = new RenderPass(this.game.scene, this.game.camera);
      this.composer.addPass(renderPass);
      
      // Subtle bloom
      const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.35, 0.4, 0.85);
      this.composer.addPass(bloomPass);
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
