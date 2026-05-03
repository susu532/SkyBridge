import * as THREE from 'three';
import { ItemType } from './Inventory';
import { generateSkin, applySkinUVs } from './SkinManager';
import { settingsManager } from './Settings';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const gltfLoader = new GLTFLoader();

export interface ShopItem {
  type: ItemType;
  price: number;
  currency: ItemType;
  outputAmount?: number;
  metadata?: any;
  action?: 'buy' | 'sell';
}

export class NPC {
  id: string;
  position: THREE.Vector3;
  name: string;
  shopItems: ShopItem[];
  group: THREE.Group;
  modelPath?: string;

  rotation: number;
  autoRotate: boolean = false;
  scale: number = 1.0;
  isHubNPC: boolean = false; // Flag to identify hub NPCs

  constructor(id: string, name: string, position: THREE.Vector3, shopItems: ShopItem[], modelPath?: string, rotation: number = 0, scale: number = 1.0, autoRotate: boolean = false) {
    this.id = id;
    this.name = name;
    this.position = position;
    this.rotation = rotation;
    this.scale = scale;
    this.autoRotate = autoRotate;
    this.isHubNPC = id === 'hub_npc_q' || id === 'hub_npc_r' || id === 'hub_npc_v' || id === 'hub_npc_dungeon'; // Automatically detect hub NPCs
    this.shopItems = shopItems;
    this.modelPath = modelPath;
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.group.rotation.y = rotation;
    this.group.scale.set(scale, scale, scale);
    this.group.userData = { npcId: id, isNPC: true };
    
    if (modelPath) {
      this.loadModel(modelPath);
    } else {
      this.createModel();
    }

    this.createNameTag();
  }

  private createNameTag() {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;

    // Much higher resolution for very large, crisp tags
    canvas.width = 1024;
    canvas.height = 256;

    // Background with rounded corners
    context.fillStyle = 'rgba(0, 0, 0, 0.7)';
    // Draw rounded rect
    const r = 40;
    context.beginPath();
    context.moveTo(r, 0);
    context.lineTo(canvas.width - r, 0);
    context.quadraticCurveTo(canvas.width, 0, canvas.width, r);
    context.lineTo(canvas.width, canvas.height - r);
    context.quadraticCurveTo(canvas.width, canvas.height, canvas.width - r, canvas.height);
    context.lineTo(r, canvas.height);
    context.quadraticCurveTo(0, canvas.height, 0, canvas.height - r);
    context.lineTo(0, r);
    context.quadraticCurveTo(0, 0, r, 0);
    context.closePath();
    context.fill();

    // Text style - Very large and bold
    context.font = 'bold 120px "Inter", Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Strong shadow for high contrast
    context.shadowColor = 'rgba(0, 0, 0, 0.8)';
    context.shadowBlur = 8;
    context.shadowOffsetX = 4;
    context.shadowOffsetY = 4;

    context.fillStyle = '#ffffff';
    context.fillText(this.name.toUpperCase(), canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    // Massive PlaneGeometry instead of a sprite
    // This makes it "non-rotational" (it stays fixed in world space)
    const geometry = new THREE.PlaneGeometry(5, 1.25);
    const material = new THREE.MeshBasicMaterial({ 
      map: texture, 
      transparent: true,
      side: THREE.DoubleSide,
      depthTest: true // Ensure it respects occlusion
    });
    
    const nameTag = new THREE.Mesh(geometry, material);
    
    // Rotate name tag for specific NPCs if requested (e.g., Jerry)
    if (this.id.includes('jerry')) {
      nameTag.rotation.y = Math.PI;
    }
    
    // Elevate it significantly above the NPC (approx 4 blocks high)
    nameTag.position.y = 3.8;
    
    // Add it to the NPC group (it will inherit the NPC's rotation)
    this.group.add(nameTag);
    this.group.userData.nameTag = nameTag; // Store for billboard rotation
  }

  private loadModel(path: string) {
    gltfLoader.load(path, (gltf) => {
      const model = gltf.scene;
      // Scale if needed, typical NPCs are ~2 blocks tall
      model.scale.set(1, 1, 1);
      this.group.add(model);
      
      if (gltf.animations && gltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(model);
        // Play the first animation by default (usually idle if it's a character)
        const action = mixer.clipAction(gltf.animations[0]);
        action.play();
        this.group.userData.mixer = mixer;
      }
      
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
    }, undefined, (error) => {
      console.error(`Error loading model ${path}:`, error);
      this.createModel(); // Fallback to classic NPC model
    });
  }

  getHitbox(): THREE.Box3 {
    const width = 0.6;
    const height = 1.95;
    const pos = this.group.position;
    
    const min = new THREE.Vector3(
      pos.x - width / 2,
      pos.y,
      pos.z - width / 2
    );
    const max = new THREE.Vector3(
      pos.x + width / 2,
      pos.y + height,
      pos.z + width / 2
    );
    
    return new THREE.Box3(min, max);
  }

  private createModel() {
    const hash = this.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const skinTexture = generateSkin(this.id);
    const skinMaterial = new THREE.MeshLambertMaterial({ map: skinTexture });
    const outerMaterial = new THREE.MeshLambertMaterial({ map: skinTexture, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide });

    // Head
    const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    applySkinUVs(headGeo, 'head');
    const head = new THREE.Mesh(headGeo, skinMaterial);

    const headOuterGeo = new THREE.BoxGeometry(0.42, 0.42, 0.42);
    applySkinUVs(headOuterGeo, 'head', true);
    const headOuter = new THREE.Mesh(headOuterGeo, outerMaterial);
    head.add(headOuter);

    head.position.y = 1.4;
    head.castShadow = true;
    head.receiveShadow = true;
    this.group.add(head);

    // Optional Hat (based on hash)
    if (hash % 3 === 0) {
      const hatGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 8);
      const hatMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
      const hat = new THREE.Mesh(hatGeo, hatMat);
      hat.position.y = 0.25;
      hat.castShadow = true;
      head.add(hat);
    }

    // Body
    const bodyGeo = new THREE.BoxGeometry(0.4, 0.6, 0.2); // Adjusted to match 8x12x4 ratio
    applySkinUVs(bodyGeo, 'body');
    const body = new THREE.Mesh(bodyGeo, skinMaterial);

    const bodyOuterGeo = new THREE.BoxGeometry(0.42, 0.62, 0.22);
    applySkinUVs(bodyOuterGeo, 'body', true);
    const bodyOuter = new THREE.Mesh(bodyOuterGeo, outerMaterial);
    body.add(bodyOuter);

    body.position.y = 0.9;
    body.castShadow = true;
    body.receiveShadow = true;
    this.group.add(body);
    
    // Optional Backpack (based on hash)
    if (hash % 2 === 0) {
      const packGeo = new THREE.BoxGeometry(0.3, 0.4, 0.15);
      const packMat = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
      const backpack = new THREE.Mesh(packGeo, packMat);
      backpack.position.set(0, 0, 0.18);
      backpack.castShadow = true;
      body.add(backpack);
    }

    // Legs
    const legGeoL = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    applySkinUVs(legGeoL, 'legL');
    const leftLeg = new THREE.Mesh(legGeoL, skinMaterial);

    const legOuterGeoL = new THREE.BoxGeometry(0.22, 0.62, 0.22);
    applySkinUVs(legOuterGeoL, 'legL', true);
    const legOuterL = new THREE.Mesh(legOuterGeoL, outerMaterial);
    legOuterL.position.y = -0.3;
    leftLeg.add(legOuterL);

    leftLeg.position.set(-0.1, 0.6, 0);
    leftLeg.geometry.translate(0, -0.3, 0);
    leftLeg.castShadow = true;
    leftLeg.receiveShadow = true;
    this.group.add(leftLeg);

    const legGeoR = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    applySkinUVs(legGeoR, 'legR');
    const rightLeg = new THREE.Mesh(legGeoR, skinMaterial);

    const legOuterGeoR = new THREE.BoxGeometry(0.22, 0.62, 0.22);
    applySkinUVs(legOuterGeoR, 'legR', true);
    const legOuterR = new THREE.Mesh(legOuterGeoR, outerMaterial);
    legOuterR.position.y = -0.3;
    rightLeg.add(legOuterR);

    rightLeg.position.set(0.1, 0.6, 0);
    rightLeg.geometry.translate(0, -0.3, 0);
    rightLeg.castShadow = true;
    rightLeg.receiveShadow = true;
    this.group.add(rightLeg);

    // Arms
    const armGeoL = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    applySkinUVs(armGeoL, 'armL');
    const leftArm = new THREE.Mesh(armGeoL, skinMaterial);

    const armOuterGeoL = new THREE.BoxGeometry(0.22, 0.62, 0.22);
    applySkinUVs(armOuterGeoL, 'armL', true);
    const armOuterL = new THREE.Mesh(armOuterGeoL, outerMaterial);
    armOuterL.position.y = -0.3;
    leftArm.add(armOuterL);

    leftArm.position.set(-0.3, 1.2, 0);
    leftArm.geometry.translate(0, -0.3, 0);
    leftArm.castShadow = true;
    leftArm.receiveShadow = true;
    this.group.add(leftArm);

    const armGeoR = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    applySkinUVs(armGeoR, 'armR');
    const rightArm = new THREE.Mesh(armGeoR, skinMaterial);

    const armOuterGeoR = new THREE.BoxGeometry(0.22, 0.62, 0.22);
    applySkinUVs(armOuterGeoR, 'armR', true);
    const armOuterR = new THREE.Mesh(armOuterGeoR, outerMaterial);
    armOuterR.position.y = -0.3;
    rightArm.add(armOuterR);

    rightArm.position.set(0.3, 1.2, 0);
    rightArm.geometry.translate(0, -0.3, 0);
    rightArm.castShadow = true;
    rightArm.receiveShadow = true;
    this.group.add(rightArm);
    
    // Store parts for animation
    this.group.userData.head = head;
    this.group.userData.body = body;
    this.group.userData.leftArm = leftArm;
    this.group.userData.rightArm = rightArm;
  }

  update(playerPos: THREE.Vector3, delta: number) {
    // Continuous rotation for special NPCs
    if (this.autoRotate) {
      this.group.rotation.y += delta * 1.5;
    }
    
    // Hub NPCs name tags follow the player
    if (this.isHubNPC && this.group.userData.nameTag) {
      const tag = this.group.userData.nameTag as THREE.Mesh;
      // Billboard effect: lookAt the player
      tag.lookAt(playerPos.x, tag.position.y + this.group.position.y, playerPos.z);
    }
    
    const isPerformanceMode = settingsManager.getSettings().performanceMode;
    
    // Update animation mixer if it exists
    if (this.group.userData.mixer) {
      this.group.userData.mixer.update(delta);
      return; // Skip manual animations if using GLB animations
    }

    if (isPerformanceMode) return;

    // Simple idle animation (breathing/bobbing)
    const time = Date.now() * 0.002;
    const hash = this.id.charCodeAt(0); // Offset animation per NPC
    const breath = Math.sin(time + hash) * 0.02;
    
    const { head, body, leftArm, rightArm } = this.group.userData;
    
    if (body) {
      body.scale.y = 1.0 + breath;
    }
    if (head) {
      head.position.y = 1.4 + breath * 0.8;
      // Slight random head looking
      head.rotation.y = Math.sin(time * 0.5 + hash) * 0.2;
      head.rotation.x = Math.sin(time * 0.3 + hash) * 0.1;
    }
    if (leftArm) {
      leftArm.position.y = 1.2 + breath * 0.8;
      leftArm.rotation.z = 0.1 + Math.sin(time * 0.8 + hash) * 0.05;
      leftArm.rotation.x = Math.sin(time * 0.5 + hash) * 0.05;
    }
    if (rightArm) {
      rightArm.position.y = 1.2 + breath * 0.8;
      rightArm.rotation.z = -0.1 - Math.sin(time * 0.8 + hash) * 0.05;
      rightArm.rotation.x = Math.cos(time * 0.5 + hash) * 0.05;
    }
  }
}
