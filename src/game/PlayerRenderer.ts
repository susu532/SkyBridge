import * as THREE from 'three';
import { Player } from './Player';
import { generateSkin, applySkinUVs } from './SkinManager';
import { createTextureAtlas, createBreakingTexture, getBlockUVs, ATLAS_TILES, isPlant, isFlatItem, isLightEmitting } from './TextureAtlas';
import { ItemType } from './Inventory';
import { createItemModel } from './ItemModels';

export class PlayerRenderer {
  player: Player;
  modelGroup: THREE.Group;
  fpArmGroup: THREE.Group;
  fpOffHandArmGroup: THREE.Group;
  
  headMesh: THREE.Mesh | null = null;
  bodyMesh: THREE.Mesh | null = null;
  leftLegMesh: THREE.Mesh | null = null;
  rightLegMesh: THREE.Mesh | null = null;
  leftArmMesh: THREE.Mesh | null = null;
  rightArmMesh: THREE.Mesh | null = null;
  capeMesh: THREE.Mesh | null = null;
  
  fpArmMesh: THREE.Mesh | null = null;
  fpOffHandArmMesh: THREE.Mesh | null = null;
  fpBlockMesh: THREE.Mesh | null = null;
  fpOffHandBlockMesh: THREE.Mesh | null = null;
  fpHeldItemModel: THREE.Group | null = null;
  fpOffHandHeldItemModel: THREE.Group | null = null;
  breakingMesh: THREE.Mesh | null = null;
  
  heldItemMesh: THREE.Mesh | null = null;
  heldItemModel: THREE.Group | null = null;
  offHandItemMesh: THREE.Mesh | null = null;
  offHandItemModel: THREE.Group | null = null;
  heldItemType: number = 0;
  offHandItemType: number = 0;
  currentModelType: number | null = null;
  currentOffHandModelType: number | null = null;
  currentFpModelType: number | null = null;
  currentFpOffHandModelType: number | null = null;
  isHandVisible: boolean = true;
  torchLight: THREE.PointLight | null = null;

  constructor(player: Player) {
    this.player = player;
    this.modelGroup = new THREE.Group();
    this.fpArmGroup = new THREE.Group();
    this.fpOffHandArmGroup = new THREE.Group();

    this.createPlayerModel();
    this.createFirstPersonArm();
    this.createFirstPersonOffHandArm();

    this.torchLight = new THREE.PointLight(0xffbd5c, 160.0, 35); 
    this.torchLight.visible = false;
    this.player.camera.add(this.torchLight);
    this.player.camera.add(this.fpOffHandArmGroup);

    // Setup breaking mesh
    const breakGeo = new THREE.BoxGeometry(1.01, 1.01, 1.01);
    const breakTex = createBreakingTexture();
    const breakMat = new THREE.MeshBasicMaterial({ 
      map: breakTex,
      transparent: true, 
      opacity: 0.0, 
      depthWrite: false,
      depthTest: true
    });
    this.breakingMesh = new THREE.Mesh(breakGeo, breakMat);
    this.breakingMesh.visible = false;
  }

  public setHandVisible(visible: boolean) {
    this.isHandVisible = visible;
    if (this.fpArmGroup) {
      this.fpArmGroup.visible = visible;
    }
    if (this.fpOffHandArmGroup) {
      this.fpOffHandArmGroup.visible = visible;
    }
  }

  public updateSkin(skinSeed: string) {
    const skinTexture = generateSkin(skinSeed);
    const skinMaterial = new THREE.MeshStandardMaterial({ 
      map: skinTexture,
      roughness: 0.8,
      metalness: 0.1
    });
    const outerMaterial = new THREE.MeshStandardMaterial({ 
      map: skinTexture, 
      transparent: true, 
      alphaTest: 0.1, 
      side: THREE.DoubleSide,
      roughness: 0.8,
      metalness: 0.1
    });

    if (this.headMesh) {
      this.headMesh.material = skinMaterial;
      (this.headMesh.children[0] as THREE.Mesh).material = outerMaterial;
    }
    if (this.bodyMesh) {
      this.bodyMesh.material = skinMaterial;
      (this.bodyMesh.children[0] as THREE.Mesh).material = outerMaterial;
    }
    if (this.leftLegMesh) {
      this.leftLegMesh.material = skinMaterial;
      (this.leftLegMesh.children[0] as THREE.Mesh).material = outerMaterial;
    }
    if (this.rightLegMesh) {
      this.rightLegMesh.material = skinMaterial;
      (this.rightLegMesh.children[0] as THREE.Mesh).material = outerMaterial;
    }
    if (this.leftArmMesh) {
      this.leftArmMesh.material = skinMaterial;
      (this.leftArmMesh.children[0] as THREE.Mesh).material = outerMaterial;
    }
    if (this.rightArmMesh) {
      this.rightArmMesh.material = skinMaterial;
      (this.rightArmMesh.children[0] as THREE.Mesh).material = outerMaterial;
    }
    if (this.fpArmMesh) {
      this.fpArmMesh.material = skinMaterial;
    }
    if (this.fpOffHandArmMesh) {
      this.fpOffHandArmMesh.material = skinMaterial;
    }
  }

  private createPlayerModel() {
    const skinTexture = generateSkin('player_seed_1');
    const skinMaterial = new THREE.MeshStandardMaterial({ 
      map: skinTexture,
      roughness: 0.8,
      metalness: 0.1
    });
    const outerMaterial = new THREE.MeshStandardMaterial({ 
      map: skinTexture, 
      transparent: true, 
      alphaTest: 0.1, 
      side: THREE.DoubleSide,
      roughness: 0.8,
      metalness: 0.1
    });

    // Body
    const bodyGeo = new THREE.BoxGeometry(0.4, 0.6, 0.2); 
    applySkinUVs(bodyGeo, 'body');
    this.bodyMesh = new THREE.Mesh(bodyGeo, skinMaterial);
    this.bodyMesh.position.y = 0.9;
    this.bodyMesh.castShadow = true;
    this.bodyMesh.receiveShadow = true;
    this.modelGroup.add(this.bodyMesh);

    const bodyOuterGeo = new THREE.BoxGeometry(0.42, 0.62, 0.22);
    applySkinUVs(bodyOuterGeo, 'body', true);
    const bodyOuter = new THREE.Mesh(bodyOuterGeo, outerMaterial);
    this.bodyMesh.add(bodyOuter);
    
    // Backpack
    const packGeo = new THREE.BoxGeometry(0.3, 0.4, 0.15);
    const packMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 }); 
    const backpack = new THREE.Mesh(packGeo, packMat);
    backpack.position.set(0, 0, 0.18);
    backpack.castShadow = true;
    this.bodyMesh.add(backpack);

    // Head
    const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    applySkinUVs(headGeo, 'head');
    this.headMesh = new THREE.Mesh(headGeo, skinMaterial);
    this.headMesh.position.y = 0.5;
    this.headMesh.castShadow = true;
    this.headMesh.receiveShadow = true;
    this.bodyMesh.add(this.headMesh);
    
    const headOuterGeo = new THREE.BoxGeometry(0.42, 0.42, 0.42);
    applySkinUVs(headOuterGeo, 'head', true);
    const headOuter = new THREE.Mesh(headOuterGeo, outerMaterial);
    this.headMesh.add(headOuter);

    // Arms
    const armGeoL = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    applySkinUVs(armGeoL, 'armL');
    this.leftArmMesh = new THREE.Mesh(armGeoL, skinMaterial);
    this.leftArmMesh.position.set(-0.3, 0.3, 0);
    this.leftArmMesh.geometry.translate(0, -0.3, 0);
    this.leftArmMesh.castShadow = true;
    this.leftArmMesh.receiveShadow = true;
    this.bodyMesh.add(this.leftArmMesh);

    const armOuterGeoL = new THREE.BoxGeometry(0.22, 0.62, 0.22);
    applySkinUVs(armOuterGeoL, 'armL', true);
    const armOuterL = new THREE.Mesh(armOuterGeoL, outerMaterial);
    armOuterL.position.y = -0.3;
    this.leftArmMesh.add(armOuterL);

    const armGeoR = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    applySkinUVs(armGeoR, 'armR');
    this.rightArmMesh = new THREE.Mesh(armGeoR, skinMaterial);
    this.rightArmMesh.position.set(0.3, 0.3, 0);
    this.rightArmMesh.geometry.translate(0, -0.3, 0);
    this.rightArmMesh.castShadow = true;
    this.rightArmMesh.receiveShadow = true;
    this.bodyMesh.add(this.rightArmMesh);

    const armOuterGeoR = new THREE.BoxGeometry(0.22, 0.62, 0.22);
    applySkinUVs(armOuterGeoR, 'armR', true);
    const armOuterR = new THREE.Mesh(armOuterGeoR, outerMaterial);
    armOuterR.position.y = -0.3;
    this.rightArmMesh.add(armOuterR);

    // Legs
    const legGeoL = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    applySkinUVs(legGeoL, 'legL');
    this.leftLegMesh = new THREE.Mesh(legGeoL, skinMaterial);
    this.leftLegMesh.position.set(-0.1, 0.6, 0);
    this.leftLegMesh.geometry.translate(0, -0.3, 0);
    this.leftLegMesh.castShadow = true;
    this.leftLegMesh.receiveShadow = true;
    this.modelGroup.add(this.leftLegMesh);
    
    const legOuterGeoL = new THREE.BoxGeometry(0.22, 0.62, 0.22);
    applySkinUVs(legOuterGeoL, 'legL', true);
    const legOuterL = new THREE.Mesh(legOuterGeoL, outerMaterial);
    legOuterL.position.y = -0.3;
    this.leftLegMesh.add(legOuterL);

    const legGeoR = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    applySkinUVs(legGeoR, 'legR');
    this.rightLegMesh = new THREE.Mesh(legGeoR, skinMaterial);
    this.rightLegMesh.position.set(0.1, 0.6, 0);
    this.rightLegMesh.geometry.translate(0, -0.3, 0);
    this.rightLegMesh.castShadow = true;
    this.rightLegMesh.receiveShadow = true;
    this.modelGroup.add(this.rightLegMesh);

    const legOuterGeoR = new THREE.BoxGeometry(0.22, 0.62, 0.22);
    applySkinUVs(legOuterGeoR, 'legR', true);
    const legOuterR = new THREE.Mesh(legOuterGeoR, outerMaterial);
    legOuterR.position.y = -0.3;
    this.rightLegMesh.add(legOuterR);

    // Cape
    const capeGeo = new THREE.BoxGeometry(0.4, 1.0, 0.05);
    const capeMat = new THREE.MeshStandardMaterial({ color: 0xcc3333, roughness: 0.7 });
    this.capeMesh = new THREE.Mesh(capeGeo, capeMat);
    this.capeMesh.position.set(0, 0.3, 0.1); 
    this.capeMesh.geometry.translate(0, -0.5, 0);
    this.capeMesh.castShadow = true;
    this.capeMesh.receiveShadow = true;
    this.bodyMesh.add(this.capeMesh);

    // Held Item (3rd Person)
    const itemGeo = new THREE.BoxGeometry(0.25, 0.25, 0.25);
    const itemMat = new THREE.MeshStandardMaterial({ 
      transparent: true, 
      alphaTest: 0.5,
      roughness: 0.8
    });
    this.heldItemMesh = new THREE.Mesh(itemGeo, itemMat);
    this.heldItemMesh.position.set(0, -0.45, -0.15);
    this.heldItemMesh.visible = false;
    this.heldItemModel = new THREE.Group();
    if (this.rightArmMesh) {
      this.rightArmMesh.add(this.heldItemModel);
      this.rightArmMesh.add(this.heldItemMesh);
    }

    // Off-hand Item (3rd Person)
    this.offHandItemMesh = new THREE.Mesh(itemGeo.clone(), itemMat.clone());
    this.offHandItemMesh.position.set(0, -0.45, -0.15);
    this.offHandItemMesh.visible = false;
    this.offHandItemModel = new THREE.Group();
    if (this.leftArmMesh) {
      this.leftArmMesh.add(this.offHandItemModel);
      this.leftArmMesh.add(this.offHandItemMesh);
    }
  }

  private createFirstPersonArm() {
    const skinTexture = generateSkin('player_seed_1');
    const skinMaterial = new THREE.MeshStandardMaterial({ 
      map: skinTexture,
      roughness: 0.8,
      metalness: 0.1
    });
    
 const armGeo = new THREE.BoxGeometry(0.24, 0.24, 0.7); // Robust arm
    applySkinUVs(armGeo, 'armR', false, 'bottom');
    this.fpArmMesh = new THREE.Mesh(armGeo, skinMaterial);
    
    // Position arm in the lower right corner, angled in
    this.fpArmMesh.position.set(0.6, -0.6, -0.5);
    this.fpArmMesh.rotation.set(0.4, -0.2, 0.1);
    
    const blockGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const texture = createTextureAtlas();
    const blockMat = new THREE.MeshLambertMaterial({ map: texture, transparent: true, alphaTest: 0.5 });
    this.fpBlockMesh = new THREE.Mesh(blockGeo, blockMat);
    this.fpBlockMesh.position.set(0.3, -0.15, -0.8);
    this.fpBlockMesh.rotation.set(0, -Math.PI / 4, 0);
    
    this.fpHeldItemModel = new THREE.Group();
    this.fpArmGroup.add(this.fpHeldItemModel);
    this.fpArmGroup.add(this.fpArmMesh);
    this.fpArmGroup.add(this.fpBlockMesh);
  }

  private createFirstPersonOffHandArm() {
    const skinTexture = generateSkin('player_seed_1');
    const skinMaterial = new THREE.MeshStandardMaterial({ 
      map: skinTexture,
      roughness: 0.8,
      metalness: 0.1
    });
    
    // Position arm in the lower left corner
    const armGeo = new THREE.BoxGeometry(0.24, 0.24, 0.7);
    applySkinUVs(armGeo, 'armL', false, 'bottom');
    this.fpOffHandArmMesh = new THREE.Mesh(armGeo, skinMaterial);
    this.fpOffHandArmMesh.position.set(-0.6, -0.6, -0.5);
    this.fpOffHandArmMesh.rotation.set(0.4, 0.2, -0.1);
    
    const blockGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const texture = createTextureAtlas();
    const blockMat = new THREE.MeshLambertMaterial({ map: texture, transparent: true, alphaTest: 0.5 });
    this.fpOffHandBlockMesh = new THREE.Mesh(blockGeo, blockMat);
    this.fpOffHandBlockMesh.position.set(-0.3, -0.15, -0.8);
    this.fpOffHandBlockMesh.rotation.set(0, Math.PI / 4, 0);
    this.fpOffHandBlockMesh.visible = false;
    
    this.fpOffHandHeldItemModel = new THREE.Group();
    this.fpOffHandArmGroup.add(this.fpOffHandHeldItemModel);
    this.fpOffHandArmGroup.add(this.fpOffHandArmMesh);
    this.fpOffHandArmGroup.add(this.fpOffHandBlockMesh);
  }

  setHeldItem(type: number, offHandType: number = 0) {
    this.updateItemHand(type, false);
    this.updateItemHand(offHandType, true);

    const isTorch = type === ItemType.TORCH || offHandType === ItemType.TORCH;
    if (this.torchLight) {
      this.torchLight.visible = isTorch;
      if (isTorch) {
        if (offHandType === ItemType.TORCH) {
          this.torchLight.position.set(-0.3, 1.2, 0); 
        } else {
          this.torchLight.position.set(0.3, 1.2, 0);
        }
      }
    }
  }

  private updateItemHand(type: number, isOffHand: boolean) {
    if (isOffHand && this.offHandItemType === type) return;
    if (!isOffHand && this.heldItemType === type) return;
    
    if (isOffHand) this.offHandItemType = type;
    else this.heldItemType = type;
    
    const mesh = isOffHand ? this.offHandItemMesh : this.heldItemMesh;
    const model = isOffHand ? this.offHandItemModel : this.heldItemModel;
    const blockMesh = isOffHand ? this.fpOffHandBlockMesh : this.fpBlockMesh;
    const fpModelGrp = isOffHand ? this.fpOffHandHeldItemModel : this.fpHeldItemModel;
    const currentModelType = isOffHand ? this.currentOffHandModelType : this.currentModelType;
    const currentFpModelType = isOffHand ? this.currentFpOffHandModelType : this.currentFpModelType;
    
    if (!mesh || !model || !blockMesh || !fpModelGrp) return;

    if (type === 0) {
      mesh.visible = false;
      model.visible = false;
      fpModelGrp.visible = false;
      blockMesh.visible = !isOffHand; 
      return;
    }

    const isPickaxe = type >= ItemType.WOODEN_PICKAXE && type <= ItemType.DIAMOND_PICKAXE;
    const isSword = type >= ItemType.WOODEN_SWORD && type <= ItemType.DIAMOND_SWORD;
    const isShovel = type >= ItemType.WOODEN_SHOVEL && type <= ItemType.DIAMOND_SHOVEL;
    const isAxe = type >= ItemType.WOODEN_AXE && type <= ItemType.DIAMOND_AXE;
    const isTorch = type === ItemType.TORCH;
    const isTool = isPickaxe || isSword || isShovel || isAxe || (type >= 460 && type <= 472) || type === 54;
    const isFood = (type >= 456 && type <= 459);
    const isMaterial = type === 13 || (type >= 500 && type <= 509) || type === 29 || type === 303 || type === 300 || type === 319 || type === 321 || type === 43 || type === 44 || isTorch;
    const use3DModel = isTool || isFood || isMaterial;

    if (use3DModel) {
      mesh.visible = false;
      model.visible = true;
      blockMesh.visible = false;
      fpModelGrp.visible = true;

      if (currentModelType !== type) {
        model.clear();
        const itemModel = createItemModel(type as ItemType);
        model.add(itemModel);
        if (isOffHand) this.currentOffHandModelType = type;
        else this.currentModelType = type;
      }

      if (currentFpModelType !== type) {
        fpModelGrp.clear();
        const fpHeldModel = createItemModel(type as ItemType);
        fpModelGrp.add(fpHeldModel);
        if (isOffHand) this.currentFpOffHandModelType = type;
        else this.currentFpModelType = type;
      }

      const side = isOffHand ? -1 : 1;

      if (isFood) {
        model.position.set(0, -0.42, 0);
        model.scale.set(0.8, 0.8, 0.8);
        model.rotation.set(0, 0, 0);

        fpModelGrp.position.set(0.3 * side, -0.2, -0.5);
        fpModelGrp.scale.set(0.8, 0.8, 0.8);
        fpModelGrp.rotation.set(0.3, -Math.PI / 4 * side, 0);
      } else if (isTorch) {
        model.position.set(0, -0.3, -0.1);
        model.scale.set(1.2, 1.2, 1.2);
        model.rotation.set(0, 0, 0);

        fpModelGrp.position.set(0.55 * side, -0.5, -0.7);
        fpModelGrp.scale.set(1.2, 1.2, 1.2);
        fpModelGrp.rotation.set(0, -Math.PI / 8 * side, 0);
      } else if (isMaterial && !isTool) {
        model.position.set(0, -0.45, -0.05);
        model.scale.set(0.9, 0.9, 0.9);
        model.rotation.set(Math.PI / 8, 0, Math.PI / 16 * side);

        fpModelGrp.position.set(0.35 * side, -0.25, -0.6);
        fpModelGrp.scale.set(0.9, 0.9, 0.9);
        fpModelGrp.rotation.set(0.2, -Math.PI / 4 * side, 0);
      } else {
        model.position.set(0, -0.4, -0.1);
        model.scale.set(1.1, 1.1, 1.1);
        model.rotation.set(-Math.PI / 4, Math.PI / 8 * side, Math.PI / 16 * side);

        fpModelGrp.position.set(0.45 * side, -0.35, -0.7);
        fpModelGrp.scale.set(1.3, 1.3, 1.3);
        fpModelGrp.rotation.set(0.8, -Math.PI / 4 * side, -0.2 * side);
      }
    } else {
      model.visible = false;
      mesh.visible = true;
      fpModelGrp.visible = false;
      blockMesh.visible = !isOffHand;
      
      const side = isOffHand ? -1 : 1;
      const uvs = getBlockUVs(type);
      if (uvs) {
        const isFlat = isFlatItem(type);
        const plant = isPlant(type);

        if (isFlat) {
          mesh.scale.set(1.4, 1.4, 0.05);
          mesh.position.set(0, -0.4, -0.1);
          mesh.rotation.set(Math.PI / 8, Math.PI / 4 * side, 0); 
          (mesh.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
        } else if (plant) {
          mesh.scale.set(1, 1, 0.05);
          mesh.position.set(0, -0.45, -0.15);
          mesh.rotation.set(0, 0, 0);
          (mesh.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
        } else {
          mesh.scale.set(1, 1, 1);
          mesh.position.set(0, -0.45, -0.15);
          mesh.rotation.set(0, 0, 0);
          (mesh.material as THREE.MeshStandardMaterial).side = THREE.FrontSide;
        }

        const uvAttribute = mesh.geometry.getAttribute('uv') as THREE.BufferAttribute;
        const atlasSize = ATLAS_TILES;
        const step = 1 / atlasSize;
        
        for (let i = 0; i < 6; i++) {
          const faceUVs = uvs[i];
          const u = faceUVs[0] * step;
          const v = 1.0 - (faceUVs[1] + 1) * step;
          
          const startIdx = i * 4;
          uvAttribute.setXY(startIdx, u, v + step);
          uvAttribute.setXY(startIdx + 1, u + step, v + step);
          uvAttribute.setXY(startIdx + 2, u, v);
          uvAttribute.setXY(startIdx + 3, u + step, v);
        }
        uvAttribute.needsUpdate = true;
        
        if (!(mesh.material as THREE.MeshStandardMaterial).map) {
          (mesh.material as THREE.MeshStandardMaterial).map = createTextureAtlas();
        }
      } else {
        mesh.visible = false;
      }
    }
  }
}
