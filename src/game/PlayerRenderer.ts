import * as THREE from 'three';
import { Player } from './Player';
import { generateSkin, applySkinUVs } from './SkinManager';
import { createTextureAtlas, createBreakingTexture, getBlockUVs, ATLAS_TILES, isPlant, isFlatItem, isLightEmitting } from './TextureAtlas';
import { ItemType } from './Inventory';
import { createItemModel } from './ItemModels';
import { settingsManager } from './Settings';

export class PlayerRenderer {
  player: Player;
  modelGroup: THREE.Group;
  fpArmGroup: THREE.Group;
  fpOffHandArmGroup: THREE.Group;
  
  armorMeshes: THREE.Mesh[] = [];

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
  gliderGroup: THREE.Group | null = null;
  gliderLeftWing: THREE.Mesh | null = null;
  gliderRightWing: THREE.Mesh | null = null;
  gliderOpenAmount: number = 0;
  
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

  public updateTeam(team?: string) {
    if (this.capeMesh && this.capeMesh.material) {
      const capeColor = team === 'blue' ? 0x3366cc : (team === 'red' ? 0xcc3333 : 0xcc3333);
      const mat = this.capeMesh.material as any;
      if (mat.color) {
        mat.color.setHex(capeColor);
      }
      if (this.capeMesh.userData.originalMaterial) {
        const origMat = this.capeMesh.userData.originalMaterial as any;
        if (origMat.color) origMat.color.setHex(capeColor);
      }
    }
    
    if (team === 'red' || team === 'blue') {
      const teamColor = team === 'blue' ? 0x3366cc : 0xcc3333;
      this.armorMeshes.forEach(mesh => {
        mesh.visible = true;
        (mesh.material as any).color.setHex(teamColor);
      });
    } else {
      this.armorMeshes.forEach(mesh => {
        mesh.visible = false;
      });
    }
    
    // Update glider materials if they exist
    if (this.gliderLeftWing && this.gliderRightWing) {
      const baseColor = 0x1f1f2e;
      let emissiveColor = 0x2a1b4d;
      let accentColor = 0x8a2be2;
      let accentEmissive = 0x9b59b6;
      
      if (team === 'red') {
        emissiveColor = 0x4d1b1b;
        accentColor = 0xe22b2b;
        accentEmissive = 0xb65959;
      } else if (team === 'blue') {
        emissiveColor = 0x1b1b4d;
        accentColor = 0x2b2be2;
        accentEmissive = 0x5959b6;
      }
      
      const updateWingMat = (child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh && child.material) {
          const mat = child.material as any;
          if (child.scale.x === 12) { // It's an accent
             if (mat.color) mat.color.setHex(accentColor);
             if (mat.emissive) mat.emissive.setHex(accentEmissive);
          } else {
             if (mat.color) mat.color.setHex(baseColor);
             if (mat.emissive) mat.emissive.setHex(emissiveColor);
          }
          if (child.userData.originalMaterial) {
            const origMat = child.userData.originalMaterial as any;
            if (child.scale.x === 12) { // It's an accent
               if (origMat.color) origMat.color.setHex(accentColor);
               if (origMat.emissive) origMat.emissive.setHex(accentEmissive);
            } else {
               if (origMat.color) origMat.color.setHex(baseColor);
               if (origMat.emissive) origMat.emissive.setHex(emissiveColor);
            }
          }
        }
      };

      this.gliderLeftWing.children.forEach(updateWingMat);
      this.gliderRightWing.children.forEach(updateWingMat);
    }
  }

  public updateSkin(skinSeed: string) {
    const skinTexture = generateSkin(skinSeed);
    const isPerformance = settingsManager.getSettings().performanceMode;
    const skinMaterial = isPerformance ?
      new THREE.MeshBasicMaterial({ map: skinTexture }) :
      new THREE.MeshStandardMaterial({ 
        map: skinTexture,
        roughness: 0.8,
        metalness: 0.1
      });
    const outerMaterial = isPerformance ?
      new THREE.MeshBasicMaterial({ 
        map: skinTexture, 
        transparent: true, 
        alphaTest: 0.1, 
        side: THREE.DoubleSide 
      }) :
      new THREE.MeshStandardMaterial({ 
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
    const isPerformance = settingsManager.getSettings().performanceMode;
    const skinMaterial = isPerformance ?
      new THREE.MeshBasicMaterial({ map: skinTexture }) :
      new THREE.MeshStandardMaterial({ 
        map: skinTexture,
        roughness: 0.8,
        metalness: 0.1
      });
    const outerMaterial = isPerformance ?
      new THREE.MeshBasicMaterial({ 
        map: skinTexture, 
        transparent: true, 
        alphaTest: 0.1, 
        side: THREE.DoubleSide 
      }) :
      new THREE.MeshStandardMaterial({ 
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

    // Glider
    this.createGlider();
    
    // Armor
    this.createArmor();

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

  private createGlider() {
    this.gliderGroup = new THREE.Group();
    // Positioned at the upper back
    this.gliderGroup.position.set(0, 0.55, 0.25);
    this.bodyMesh?.add(this.gliderGroup);

    // Modern "Cyber Elytra" Shape
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0); // Root
    wingShape.lineTo(0.6, 0.2); // Top edge sweeps out
    wingShape.lineTo(2.0, -0.4); // Outer wingtip
    wingShape.lineTo(1.6, -1.2); // Lower trailing edge
    wingShape.lineTo(0.7, -2.0); // Bottom wingtip
    wingShape.lineTo(0.3, -1.0); // Inner trailing edge
    wingShape.lineTo(0, -0.4); // Back to root
    wingShape.lineTo(0, 0);

    const extrudeSettings = { 
      depth: 0.04, 
      bevelEnabled: true, 
      bevelSegments: 2, 
      steps: 1, 
      bevelSize: 0.015, 
      bevelThickness: 0.015 
    };
    
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
    // Center it on Z
    wingGeo.translate(0, 0, -0.02);

    // Sleek dark grey with a purple sheen
    const wingMat = new THREE.MeshStandardMaterial({ 
      color: 0x1f1f2e, 
      roughness: 0.3,
      metalness: 0.8,
      emissive: 0x2a1b4d, // subtle purple/indigo glow
      emissiveIntensity: 0.6
    });

    // Glowing accent lines
    const accentGeo = new THREE.BoxGeometry(0.04, 0.04, 0.06);
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0x8a2be2, // Blue-violet
      emissive: 0x9b59b6,
      emissiveIntensity: 2.5,
      roughness: 0.2
    });

    const createWing = () => {
      const g = new THREE.Group() as any;
      const canvas = new THREE.Mesh(wingGeo, wingMat);
      g.add(canvas);

      // Add accents
      const a1 = new THREE.Mesh(accentGeo, accentMat);
      a1.position.set(0.5, 0.1, 0);
      a1.rotation.z = Math.PI / 8;
      a1.scale.set(12, 1, 1);
      g.add(a1);

      const a2 = new THREE.Mesh(accentGeo, accentMat);
      a2.position.set(1.2, -0.2, 0);
      a2.rotation.z = -Math.PI / 10;
      a2.scale.set(18, 1, 1);
      g.add(a2);

      const a3 = new THREE.Mesh(accentGeo, accentMat);
      a3.position.set(0.6, -1.0, 0);
      a3.rotation.z = -Math.PI / 3;
      a3.scale.set(22, 1, 1);
      g.add(a3);

      const a4 = new THREE.Mesh(accentGeo, accentMat);
      a4.position.set(1.1, -0.85, 0);
      a4.rotation.z = Math.PI / 3;
      a4.scale.set(10, 1, 1);
      g.add(a4);

      return g;
    };

    this.gliderLeftWing = createWing();
    this.gliderLeftWing!.rotation.y = Math.PI; // Flip horizontally
    this.gliderGroup.add(this.gliderLeftWing!);

    this.gliderRightWing = createWing();
    this.gliderGroup.add(this.gliderRightWing!);

    this.gliderGroup.visible = false;
  }

  private createArmor() {
    // Hidden by default, updated on team change
    const armorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide });

    const createArmorMesh = (w: number, h: number, d: number) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geo, armorMat);
      mesh.visible = false;
      this.armorMeshes.push(mesh);
      return mesh;
    };

    if (this.bodyMesh) {
      // T-shirt body part (slightly shorter than full torso)
      const bodyArmor = createArmorMesh(0.44, 0.54, 0.24);
      bodyArmor.position.y = -0.27;
      this.bodyMesh.add(bodyArmor);
    }
    if (this.headMesh) {
      // Helmet covering the top half of the head
      const headArmor = createArmorMesh(0.44, 0.24, 0.44);
      headArmor.position.y = 0.11;
      this.headMesh.add(headArmor);
    }
    if (this.leftArmMesh) {
      // T-shirt sleeve
      const leftArmArmor = createArmorMesh(0.24, 0.28, 0.24);
      leftArmArmor.position.y = -0.14;
      this.leftArmMesh.add(leftArmArmor);
    }
    if (this.rightArmMesh) {
      // T-shirt sleeve
      const rightArmArmor = createArmorMesh(0.24, 0.28, 0.24);
      rightArmArmor.position.y = -0.14;
      this.rightArmMesh.add(rightArmArmor);
    }
    if (this.leftLegMesh) {
      // Trousers
      const leftLegArmor = createArmorMesh(0.24, 0.44, 0.24);
      leftLegArmor.position.y = -0.22;
      this.leftLegMesh.add(leftLegArmor);
    }
    if (this.rightLegMesh) {
      // Trousers
      const rightLegArmor = createArmorMesh(0.24, 0.44, 0.24);
      rightLegArmor.position.y = -0.22;
      this.rightLegMesh.add(rightLegArmor);
    }
  }

  public update(delta: number, isGliding: boolean) {
    if (!this.gliderGroup || !this.gliderLeftWing || !this.gliderRightWing) return;

    const targetOpen = isGliding ? 1 : 0;
    this.gliderOpenAmount = THREE.MathUtils.lerp(
      this.gliderOpenAmount,
      targetOpen,
      delta * (isGliding ? 8 : 4) // Open faster than close
    );

    if (this.gliderOpenAmount > 0.01) {
      this.gliderGroup.visible = true;
      
      // Aerodynamic pitch
      this.gliderGroup.rotation.x = THREE.MathUtils.lerp(0.5, 0.2, this.gliderOpenAmount);

      const openAngle = 0.15; // Swept back slightly when flying
      const closedAngle = 1.6; // Folded straight back when not flying
      const angle = THREE.MathUtils.lerp(closedAngle, openAngle, this.gliderOpenAmount);

      this.gliderRightWing.rotation.y = angle;
      this.gliderLeftWing.rotation.y = Math.PI - angle;

      // Animation: Gentle flap and tilt
      if (isGliding) {
        const time = performance.now() * 0.005;
        const flap = Math.sin(time) * 0.05;
        this.gliderRightWing.rotation.z = flap;
        this.gliderLeftWing.rotation.z = -flap;
        
        // Slight sway
        this.gliderGroup.rotation.z = Math.sin(time * 0.5) * 0.03;
      } else {
        this.gliderRightWing.rotation.z = 0;
        this.gliderLeftWing.rotation.z = 0;
        this.gliderGroup.rotation.z = 0;
      }
      
      const scale = this.gliderOpenAmount;
      this.gliderGroup.scale.set(scale, scale, scale);
    } else {
      this.gliderGroup.visible = false;
    }

    if (this.player.isSpectator) {
      this.modelGroup.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (!mesh.userData.originalMaterial) {
            mesh.userData.originalMaterial = mesh.material;
            const newMat = Array.isArray(mesh.material) ? mesh.material.map(m => m.clone()) : (mesh.material as THREE.Material).clone();
            if (Array.isArray(newMat)) {
              newMat.forEach(m => { m.transparent = true; m.opacity = 0.3; m.alphaTest = 0.01; });
            } else {
              newMat.transparent = true; newMat.opacity = 0.3; newMat.alphaTest = 0.01;
            }
            mesh.material = newMat;
          }
        }
      });
      // Optionally hide first person arms if spectator
      this.fpArmGroup.visible = false;
      this.fpOffHandArmGroup.visible = false;
    } else {
      this.modelGroup.traverse((child) => {
        if ((child as THREE.Mesh).isMesh && child.userData.originalMaterial) {
          const mesh = child as THREE.Mesh;
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(m => m.dispose());
          } else {
            mesh.material.dispose();
          }
          mesh.material = mesh.userData.originalMaterial;
          delete mesh.userData.originalMaterial;
        }
      });
      this.fpArmGroup.visible = this.isHandVisible && this.player.perspective === 0;
      this.fpOffHandArmGroup.visible = this.isHandVisible && this.player.perspective === 0;
    }
  }

  private createFirstPersonArm() {
    const skinTexture = generateSkin('player_seed_1');
    const isPerformance = settingsManager.getSettings().performanceMode;
    const skinMaterial = isPerformance ?
      new THREE.MeshBasicMaterial({ map: skinTexture }) :
      new THREE.MeshStandardMaterial({ 
        map: skinTexture,
        roughness: 0.8,
        metalness: 0.1
      });
    
    const armGeo = new THREE.BoxGeometry(0.24, 0.24, 0.7); // Robust arm
    applySkinUVs(armGeo, 'armR', false, 'bottom');
    this.fpArmMesh = new THREE.Mesh(armGeo, skinMaterial);
    this.fpArmMesh.castShadow = !isPerformance;
    this.fpArmMesh.receiveShadow = !isPerformance; // Disabled in performance mode
    
    // Position arm in the lower right corner, angled in
    this.fpArmMesh.position.set(0.6, -0.6, -0.5);
    this.fpArmMesh.rotation.set(0.4, -0.2, 0.1);
    
    const blockGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const texture = createTextureAtlas();
    const blockMat = isPerformance ?
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.5 }) :
      new THREE.MeshLambertMaterial({ map: texture, transparent: true, alphaTest: 0.5 });
    this.fpBlockMesh = new THREE.Mesh(blockGeo, blockMat);
    this.fpBlockMesh.castShadow = !isPerformance;
    this.fpBlockMesh.receiveShadow = !isPerformance; // Disabled in performance mode
    this.fpBlockMesh.position.set(0.3, -0.15, -0.8);
    this.fpBlockMesh.rotation.set(0, -Math.PI / 4, 0);
    
    this.fpHeldItemModel = new THREE.Group();
    this.fpArmGroup.add(this.fpHeldItemModel);
    this.fpArmGroup.add(this.fpArmMesh);
    this.fpArmGroup.add(this.fpBlockMesh);
  }

  private createFirstPersonOffHandArm() {
    const skinTexture = generateSkin('player_seed_1');
    const isPerformance = settingsManager.getSettings().performanceMode;
    const skinMaterial = isPerformance ?
      new THREE.MeshBasicMaterial({ map: skinTexture }) :
      new THREE.MeshStandardMaterial({ 
        map: skinTexture,
        roughness: 0.8,
        metalness: 0.1
      });
    
    // Position arm in the lower left corner
    const armGeo = new THREE.BoxGeometry(0.24, 0.24, 0.7);
    applySkinUVs(armGeo, 'armL', false, 'bottom');
    this.fpOffHandArmMesh = new THREE.Mesh(armGeo, skinMaterial);
    this.fpOffHandArmMesh.castShadow = !isPerformance;
    this.fpOffHandArmMesh.receiveShadow = !isPerformance; // Disabled in performance mode
    this.fpOffHandArmMesh.position.set(-0.6, -0.6, -0.5);
    this.fpOffHandArmMesh.rotation.set(0.4, 0.2, -0.1);
    
    const blockGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const texture = createTextureAtlas();
    const blockMat = isPerformance ?
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.5 }) :
      new THREE.MeshLambertMaterial({ map: texture, transparent: true, alphaTest: 0.5 });
    this.fpOffHandBlockMesh = new THREE.Mesh(blockGeo, blockMat);
    this.fpOffHandBlockMesh.castShadow = !isPerformance;
    this.fpOffHandBlockMesh.receiveShadow = !isPerformance; // Disabled in performance mode
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

    const isPerformance = settingsManager.getSettings().performanceMode;
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
      blockMesh.visible = false; 
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
        const isPerformance = settingsManager.getSettings().performanceMode;
        // Enable receiveShadow for all first-person sub-models
        fpHeldModel.traverse(child => {
          if (child instanceof THREE.Mesh) {
             child.castShadow = !isPerformance;
             child.receiveShadow = !isPerformance;
             if (isPerformance) {
                const oldMat = child.material as THREE.MeshStandardMaterial;
                child.material = new THREE.MeshBasicMaterial({
                  color: oldMat.color,
                  map: oldMat.map,
                  transparent: oldMat.transparent,
                  alphaTest: oldMat.alphaTest,
                  side: oldMat.side
                });
             }
          }
        });
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
