import * as THREE from 'three';
import { ItemType } from './Inventory';
import { ITEM_COLORS } from './Constants';

export function createItemModel(type: ItemType): THREE.Group {
  const group = new THREE.Group();
  
  // Base colors
  let primaryColor = ITEM_COLORS[type] || '#FFFFFF';
  let handleColor = '#8B5A2B'; // Default wood handle
  
  // Specific material tones for depth
  const material = new THREE.MeshStandardMaterial({
    color: primaryColor,
    roughness: 0.7,
    metalness: 0.3
  });
  
  const handleMaterial = new THREE.MeshStandardMaterial({
    color: handleColor,
    roughness: 0.9,
    metalness: 0.0
  });

  const isPickaxe = type >= ItemType.WOODEN_PICKAXE && type <= ItemType.DIAMOND_PICKAXE;
  const isSword = type >= ItemType.WOODEN_SWORD && type <= ItemType.DIAMOND_SWORD;
  const isShovel = type >= ItemType.WOODEN_SHOVEL && type <= ItemType.DIAMOND_SHOVEL;
  const isAxe = type >= ItemType.WOODEN_AXE && type <= ItemType.DIAMOND_AXE;
  const isIngot = type === ItemType.IRON_INGOT || type === ItemType.GOLD_INGOT || type === ItemType.COPPER_INGOT;
  const isGem = type === ItemType.DIAMOND || type === ItemType.EMERALD;
  const isLump = type === ItemType.COAL || type === ItemType.REDSTONE || type === ItemType.LAPIS_LAZULI || type === ItemType.GUNPOWDER || type === ItemType.STRING || type === ItemType.SEEDS;
  const isFood = type === ItemType.APPLE || type === ItemType.GOLDEN_APPLE || type === ItemType.RAW_BEEF || type === ItemType.COOKED_BEEF || type === ItemType.BREAD;
  const isRod = type === ItemType.FISHING_ROD;
  const isBow = type === ItemType.BOW;
  const isArrow = type === ItemType.ARROW;
  const isBucket = type === ItemType.BUCKET || type === ItemType.WATER_BUCKET || type === ItemType.LAVA_BUCKET;
  const isPearl = type === ItemType.ENDER_PEARL;
  const isBone = type === ItemType.BONE;
  const isFeather = type === ItemType.FEATHER;
  const isStick = type === ItemType.STICK;
  const isSkycoin = type === ItemType.SKYCOIN;
  const isAOTE = type === ItemType.ASPECT_OF_THE_END;
  const isMinion = type === ItemType.MINION;
  const isWheat = type === ItemType.WHEAT;
  const isCane = type === ItemType.SUGAR_CANE;
  const isLily = type === ItemType.LILY_PAD;
  const isLantern = type === ItemType.LANTERN;
  const isCampfire = type === ItemType.CAMPFIRE;
  const isMushroom = type === ItemType.MUSHROOM_RED || type === ItemType.MUSHROOM_BROWN;
  const isTorch = type === ItemType.TORCH;
  
  if (isPickaxe) {
    // Handle (0.8 high, centered at origin)
    const handleGeo = new THREE.BoxGeometry(0.1, 0.8, 0.1);
    const handle = new THREE.Mesh(handleGeo, handleMaterial);
    handle.position.y = 0.1;
    group.add(handle);
    
    // Pickaxe head
    const headGroup = new THREE.Group();
    headGroup.position.y = 0.45; // Top of handle
    
    // Central part (Connecting block)
    const headBlockGeo = new THREE.BoxGeometry(0.18, 0.2, 0.18);
    const headBlock = new THREE.Mesh(headBlockGeo, material);
    headGroup.add(headBlock);
    
    const darkerMaterial = material.clone();
    darkerMaterial.color.multiplyScalar(0.7);

    // Curved head using multiple segments
    for(let i=0; i<4; i++) {
        const segGeo = new THREE.BoxGeometry(0.12, 0.12, 0.15);
        const lSeg = new THREE.Mesh(segGeo, material);
        const rSeg = new THREE.Mesh(segGeo, material);
        
        const x = 0.1 + i * 0.1;
        const y = -i * i * 0.02;
        
        lSeg.position.set(-x, y, 0);
        rSeg.position.set(x, y, 0);
        lSeg.rotation.z = i * 0.15;
        rSeg.rotation.z = -i * 0.15;
        
        headGroup.add(lSeg);
        headGroup.add(rSeg);
        
        if (i === 3) {
            // Tips
            const tipGeo = new THREE.BoxGeometry(0.1, 0.1, 0.12);
            const lTip = new THREE.Mesh(tipGeo, darkerMaterial);
            const rTip = new THREE.Mesh(tipGeo, darkerMaterial);
            lTip.position.set(-x - 0.08, y - 0.05, 0);
            rTip.position.set(x + 0.08, y - 0.05, 0);
            lTip.rotation.z = 0.8;
            rTip.rotation.z = -0.8;
            headGroup.add(lTip);
            headGroup.add(rTip);
        }
    }
    group.add(headGroup);

  } else if (isSword) {
    // Handle (Grip)
    const gripGeo = new THREE.BoxGeometry(0.1, 0.35, 0.1);
    const grip = new THREE.Mesh(gripGeo, handleMaterial);
    grip.position.y = -0.15;
    group.add(grip);
    
    // Pommel
    const pommelGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    const pommel = new THREE.Mesh(pommelGeo, material);
    pommel.position.y = -0.35;
    group.add(pommel);
    
    // Crossguard
    const guardGeo = new THREE.BoxGeometry(0.55, 0.1, 0.12);
    const guard = new THREE.Mesh(guardGeo, material);
    guard.position.y = 0.05;
    group.add(guard);

    // Guard details
    const guardDetailGeo = new THREE.BoxGeometry(0.12, 0.15, 0.15);
    const guardDetail = new THREE.Mesh(guardDetailGeo, material);
    guardDetail.position.y = 0.05;
    group.add(guardDetail);
    
    // Blade (Main part)
    const bladeGeo = new THREE.BoxGeometry(0.18, 0.9, 0.04);
    const blade = new THREE.Mesh(bladeGeo, material);
    blade.position.y = 0.55;
    group.add(blade);

    // Blade central ridge (shading)
    const ridgeMaterial = material.clone();
    ridgeMaterial.color.multiplyScalar(0.9);
    const ridgeGeo = new THREE.BoxGeometry(0.04, 0.85, 0.06);
    const ridge = new THREE.Mesh(ridgeGeo, ridgeMaterial);
    ridge.position.y = 0.55;
    group.add(ridge);
    
    // Blade tip
    const tipGeo = new THREE.BoxGeometry(0.14, 0.14, 0.04);
    const tip = new THREE.Mesh(tipGeo, material);
    tip.position.y = 1.05;
    tip.rotation.z = Math.PI / 4;
    group.add(tip);
  } else if (isShovel) {
    // Handle
    const handleGeo = new THREE.BoxGeometry(0.1, 1.0, 0.1);
    const handle = new THREE.Mesh(handleGeo, handleMaterial);
    handle.position.y = 0.2;
    group.add(handle);
    
    // Shovel head (more curved)
    const headGroup = new THREE.Group();
    headGroup.position.y = 0.75;

    const bladeGeo = new THREE.BoxGeometry(0.3, 0.35, 0.04);
    const blade = new THREE.Mesh(bladeGeo, material);
    headGroup.add(blade);
    
    // Curved edges
    const sideGeo = new THREE.BoxGeometry(0.04, 0.35, 0.08);
    const sideL = new THREE.Mesh(sideGeo, material);
    sideL.position.x = -0.13;
    sideL.rotation.y = 0.4;
    headGroup.add(sideL);
    
    const sideR = new THREE.Mesh(sideGeo, material);
    sideR.position.x = 0.13;
    sideR.rotation.y = -0.4;
    headGroup.add(sideR);

    // Tip
    const tipGeo = new THREE.BoxGeometry(0.2, 0.1, 0.05);
    const darkerMaterial = material.clone();
    darkerMaterial.color.multiplyScalar(0.8);
    const tip = new THREE.Mesh(tipGeo, darkerMaterial);
    tip.position.y = 0.2;
    headGroup.add(tip);
    
    group.add(headGroup);
  } else if (isAxe) {
    // Handle
    const handleGeo = new THREE.BoxGeometry(0.1, 0.9, 0.1);
    const handle = new THREE.Mesh(handleGeo, handleMaterial);
    handle.position.y = 0.1;
    group.add(handle);
    
    // Axe head (refined heavy look)
    const headGroup = new THREE.Group();
    headGroup.position.set(0.1, 0.65, 0);
    
    const bitMainGeo = new THREE.BoxGeometry(0.3, 0.4, 0.15);
    const bitMain = new THREE.Mesh(bitMainGeo, material);
    headGroup.add(bitMain);
    
    // Blade bit
    const bitGeo = new THREE.BoxGeometry(0.15, 0.5, 0.04);
    const darkerMaterial = material.clone();
    darkerMaterial.color.multiplyScalar(0.8);
    const bit = new THREE.Mesh(bitGeo, darkerMaterial);
    bit.position.x = 0.15;
    headGroup.add(bit);
    
    // Back bit
    const backGeo = new THREE.BoxGeometry(0.1, 0.2, 0.12);
    const back = new THREE.Mesh(backGeo, material);
    back.position.x = -0.15;
    headGroup.add(back);
    
    group.add(headGroup);
  } else if (isStick) {
    const stickGroup = new THREE.Group();
    const geo = new THREE.BoxGeometry(0.06, 1.0, 0.06);
    const stick = new THREE.Mesh(geo, handleMaterial);
    stickGroup.add(stick);
    
    // Some knots
    const knotGeo = new THREE.BoxGeometry(0.08, 0.05, 0.08);
    for(let i=0; i<3; i++) {
        const knot = new THREE.Mesh(knotGeo, handleMaterial);
        knot.position.y = (Math.random()-0.5)*0.8;
        knot.rotation.y = Math.random()*Math.PI;
        stickGroup.add(knot);
    }
    group.add(stickGroup);
  } else if (isIngot) {
    const ingotGroup = new THREE.Group();
    // Ingot shape (trapezoidal prism approx)
    const baseGeo = new THREE.BoxGeometry(0.4, 0.12, 0.22);
    const ingot = new THREE.Mesh(baseGeo, material);
    ingotGroup.add(ingot);
    
    const topGeo = new THREE.BoxGeometry(0.32, 0.04, 0.18);
    const top = new THREE.Mesh(topGeo, material);
    top.position.y = 0.08;
    ingotGroup.add(top);

    // Bevel details
    const edgeMaterial = material.clone();
    edgeMaterial.color.multiplyScalar(0.8);
    const sideGeo = new THREE.BoxGeometry(0.42, 0.05, 0.02);
    const sideL = new THREE.Mesh(sideGeo, edgeMaterial);
    sideL.position.z = 0.12;
    ingotGroup.add(sideL);
    const sideR = new THREE.Mesh(sideGeo, edgeMaterial);
    sideR.position.z = -0.12;
    ingotGroup.add(sideR);

    group.add(ingotGroup);
  } else if (isGem) {
    const gemGroup = new THREE.Group();
    const isDiamond = type === ItemType.DIAMOND;
    
    if (isDiamond) {
        // Classic diamond shape (double pyramid/octahedron)
        const topGeo = new THREE.CylinderGeometry(0, 0.2, 0.2, 4);
        const top = new THREE.Mesh(topGeo, material);
        top.position.y = 0.1;
        gemGroup.add(top);
        
        const bottomGeo = new THREE.CylinderGeometry(0.2, 0, 0.2, 4);
        const bottom = new THREE.Mesh(bottomGeo, material);
        bottom.position.y = -0.1;
        gemGroup.add(bottom);
    } else {
        // Emerald (tall hexagonal prism)
        const baseGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.4, 6);
        const gem = new THREE.Mesh(baseGeo, material);
        gemGroup.add(gem);
    }
    
    // Shine detail
    const shineMaterial = new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      emissive: '#FFFFFF',
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.8
    });
    const shineGeo = new THREE.BoxGeometry(0.04, 0.15, 0.04);
    const shine = new THREE.Mesh(shineGeo, shineMaterial);
    shine.position.set(0.08, 0.08, 0.08);
    gemGroup.add(shine);
    
    group.add(gemGroup);
  } else if (isLump) {
    // Irregular lump for coal, redstone, lapis, seeds
    const lumpGroup = new THREE.Group();
    
    // Use several small boxes for "rough" look
    const count = type === ItemType.SEEDS ? 8 : 4;
    const spread = type === ItemType.SEEDS ? 0.15 : 0.2;
    const size = type === ItemType.SEEDS ? 0.05 : 0.15;
    
    for(let i=0; i<count; i++) {
        const itemGeo = new THREE.BoxGeometry(size, size, size);
        const piece = new THREE.Mesh(itemGeo, material);
        piece.position.set(
            (Math.random()-0.5)*spread,
            (Math.random()-0.5)*spread,
            (Math.random()-0.5)*spread
        );
        piece.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
        lumpGroup.add(piece);
    }

    if (type === ItemType.LAPIS_LAZULI || type === ItemType.REDSTONE) {
        // Add some "sparkle" for ores
        const sparkMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', emissive: '#FFFFFF', emissiveIntensity: 0.3 });
        const sparkGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
        const spark = new THREE.Mesh(sparkGeo, sparkMat);
        spark.position.set(0.1, 0.1, 0.1);
        lumpGroup.add(spark);
    }
    
    group.add(lumpGroup);
  } else if (isFood) {
    const isApple = type === ItemType.APPLE || type === ItemType.GOLDEN_APPLE;
    if (isApple) {
      const appleGeo = new THREE.SphereGeometry(0.2, 12, 12);
      const apple = new THREE.Mesh(appleGeo, material);
      apple.scale.set(1, 0.85, 1);
      group.add(apple);
      
      const stemGeo = new THREE.BoxGeometry(0.04, 0.15, 0.04);
      const stemMat = new THREE.MeshStandardMaterial({ color: '#4A2B00' });
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.y = 0.18;
      stem.rotation.z = 0.2;
      group.add(stem);
    } else if (type === ItemType.BREAD) {
      const breadGroup = new THREE.Group();
      const breadGeo = new THREE.BoxGeometry(0.4, 0.18, 0.28);
      const bread = new THREE.Mesh(breadGeo, material);
      breadGroup.add(bread);
      
      const darkerMat = material.clone();
      darkerMat.color.multiplyScalar(0.7);
      const slitGeo = new THREE.BoxGeometry(0.06, 0.02, 0.3);
      for(let i=0; i<3; i++) {
          const slit = new THREE.Mesh(slitGeo, darkerMat);
          slit.position.set(-0.12 + i*0.12, 0.09, 0);
          breadGroup.add(slit);
      }
      group.add(breadGroup);
    } else {
      // Meat (Beef)
      const meatGroup = new THREE.Group();
      const meatGeo = new THREE.BoxGeometry(0.4, 0.15, 0.3);
      const meat = new THREE.Mesh(meatGeo, material);
      meatGroup.add(meat);
      
      const boneMat = new THREE.MeshStandardMaterial({ color: '#EEEEEE' });
      const boneGeo = new THREE.BoxGeometry(0.12, 0.1, 0.45);
      const bone = new THREE.Mesh(boneGeo, boneMat);
      bone.position.x = -0.15;
      meatGroup.add(bone);

      // Fat detail
      const fatMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF' });
      const fatGeo = new THREE.BoxGeometry(0.1, 0.16, 0.2);
      const fat = new THREE.Mesh(fatGeo, fatMat);
      fat.position.set(0.1, 0, 0.08);
      meatGroup.add(fat);

      group.add(meatGroup);
    }
  } else if (isRod) {
    const rodGroup = new THREE.Group();
    const handleGeo = new THREE.BoxGeometry(0.06, 1.2, 0.06);
    const handle = new THREE.Mesh(handleGeo, handleMaterial);
    handle.rotation.z = -Math.PI / 4;
    rodGroup.add(handle);
    
    // Reel
    const reelGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.1, 8);
    const reel = new THREE.Mesh(reelGeo, material);
    reel.position.set(-0.1, -0.1, 0);
    reel.rotation.z = Math.PI/2;
    rodGroup.add(reel);

    // Line
    const lineGeo = new THREE.BoxGeometry(0.01, 1.2, 0.01);
    const lineMat = new THREE.MeshStandardMaterial({ color: '#eeeeee' });
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.position.set(0.42, 0.35, 0);
    rodGroup.add(line);
    
    // Float
    const floatGeo = new THREE.SphereGeometry(0.05, 8, 8);
    const floatMat = new THREE.MeshStandardMaterial({ color: '#FF5555' });
    const float = new THREE.Mesh(floatGeo, floatMat);
    float.position.set(0.42, -0.25, 0);
    rodGroup.add(float);

    group.add(rodGroup);
  } else if (isBow) {
    const bowGroup = new THREE.Group();
    
    // Angled segments for bow
    for(let i=0; i<3; i++) {
        const segGeo = new THREE.BoxGeometry(0.06, 0.4, 0.06);
        const topSeg = new THREE.Mesh(segGeo, handleMaterial);
        const botSeg = new THREE.Mesh(segGeo, handleMaterial);
        
        const angle = i * 0.5;
        topSeg.position.set(Math.sin(angle)*0.3, i*0.35, 0);
        topSeg.rotation.z = -angle * 0.8;
        
        botSeg.position.set(Math.sin(angle)*0.3, -i*0.35, 0);
        botSeg.rotation.z = angle * 0.8;
        
        bowGroup.add(topSeg);
        bowGroup.add(botSeg);
    }
    
    // String
    const stringGeo = new THREE.BoxGeometry(0.01, 1.6, 0.01);
    const stringMat = new THREE.MeshStandardMaterial({ color: '#ffffff' });
    const string = new THREE.Mesh(stringGeo, stringMat);
    string.position.x = 0;
    bowGroup.add(string);
    
    group.add(bowGroup);
  } else if (isArrow) {
    const arrowGroup = new THREE.Group();
    const shaftGeo = new THREE.BoxGeometry(0.03, 0.9, 0.03);
    const shaft = new THREE.Mesh(shaftGeo, handleMaterial);
    arrowGroup.add(shaft);
    
    const tipGeo = new THREE.ConeGeometry(0.06, 0.2, 4);
    const tipMat = new THREE.MeshStandardMaterial({ color: '#666666' });
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.y = 0.45;
    arrowGroup.add(tip);
    
    // Fletching (Feathers)
    const fletchMat = new THREE.MeshStandardMaterial({ color: '#EEEEEE', side: THREE.DoubleSide });
    for(let i=0; i<3; i++) {
        const fletchGeo = new THREE.PlaneGeometry(0.12, 0.2);
        const fletch = new THREE.Mesh(fletchGeo, fletchMat);
        const angle = (i/3) * Math.PI * 2;
        fletch.position.set(Math.cos(angle)*0.05, -0.35, Math.sin(angle)*0.05);
        fletch.rotation.y = angle;
        arrowGroup.add(fletch);
    }
    group.add(arrowGroup);
  } else if (isBucket) {
    const bucketGroup = new THREE.Group();
    const bodyGeo = new THREE.CylinderGeometry(0.18, 0.14, 0.35, 12, 1, true);
    const bucket = new THREE.Mesh(bodyGeo, material);
    bucketGroup.add(bucket);
    
    const bottomGeo = new THREE.CircleGeometry(0.14, 12);
    const bottom = new THREE.Mesh(bottomGeo, material);
    bottom.rotation.x = Math.PI / 2;
    bottom.position.y = -0.175;
    bucketGroup.add(bottom);
    
    const handleGeo = new THREE.TorusGeometry(0.18, 0.015, 8, 12, Math.PI);
    const handle = new THREE.Mesh(handleGeo, material);
    handle.position.y = 0.15;
    bucketGroup.add(handle);

    if (type !== ItemType.BUCKET) {
      const liquidColor = type === ItemType.WATER_BUCKET ? '#3F76E4' : '#F07613';
      const liquidGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.05, 12);
      const liquidMat = new THREE.MeshStandardMaterial({ 
        color: liquidColor, 
        transparent: type === ItemType.WATER_BUCKET,
        opacity: 0.8
      });
      const liquid = new THREE.Mesh(liquidGeo, liquidMat);
      liquid.position.y = 0.1;
      bucketGroup.add(liquid);
    }
    group.add(bucketGroup);
  } else if (isPearl) {
    const pearlGroup = new THREE.Group();
    const pearlGeo = new THREE.SphereGeometry(0.2, 16, 16);
    const pearl = new THREE.Mesh(pearlGeo, material);
    pearlGroup.add(pearl);
    
    // Pupil/Eye detail
    const pupilGeo = new THREE.BoxGeometry(0.22, 0.08, 0.12);
    const pupilMat = new THREE.MeshStandardMaterial({ color: '#002200', emissive: '#004400', emissiveIntensity: 1.0 });
    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    pearlGroup.add(pupil);

    // Inner glow
    const glowMat = new THREE.MeshStandardMaterial({ 
        color: '#177b6d', 
        emissive: '#177b6d', 
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.6
    });
    const glowGeo = new THREE.SphereGeometry(0.12, 12, 12);
    const glow = new THREE.Mesh(glowGeo, glowMat);
    pearlGroup.add(glow);

    group.add(pearlGroup);
  } else if (isBone) {
    const shaftGeo = new THREE.BoxGeometry(0.08, 0.8, 0.08);
    const shaft = new THREE.Mesh(shaftGeo, material);
    group.add(shaft);
    
    const endGeo = new THREE.BoxGeometry(0.15, 0.15, 0.2);
    const end1 = new THREE.Mesh(endGeo, material);
    end1.position.y = 0.4;
    group.add(end1);
    
    const end2 = new THREE.Mesh(endGeo, material);
    end2.position.y = -0.4;
    group.add(end2);
  } else if (isFeather) {
    const quillGeo = new THREE.BoxGeometry(0.02, 0.6, 0.02);
    const quill = new THREE.Mesh(quillGeo, material);
    group.add(quill);
    
    const vaneGeo = new THREE.BoxGeometry(0.2, 0.5, 0.01);
    const vane = new THREE.Mesh(vaneGeo, material);
    vane.position.y = 0.1;
    group.add(vane);
  } else if (isSkycoin) {
    const geo = new THREE.CylinderGeometry(0.15, 0.15, 0.04, 16);
    const coin = new THREE.Mesh(geo, material);
    coin.rotation.x = Math.PI / 2;
    group.add(coin);
    
    const innerGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.05, 16);
    const darkerMaterial = material.clone();
    darkerMaterial.color.multiplyScalar(0.8);
    const inner = new THREE.Mesh(innerGeo, darkerMaterial);
    inner.rotation.x = Math.PI / 2;
    group.add(inner);
  } else if (isAOTE) {
    // Special Magic Sword - Aspect of the End
    const aoteMaterial = new THREE.MeshStandardMaterial({
      color: '#55FFFF',
      emissive: '#00AAAA',
      emissiveIntensity: 0.8,
      metalness: 0.9,
      roughness: 0.1
    });
    
    const bladeGeo = new THREE.BoxGeometry(0.12, 1.2, 0.04);
    const blade = new THREE.Mesh(bladeGeo, aoteMaterial);
    blade.position.y = 0.6;
    group.add(blade);

    // Crossguard detail
    const guardGeo = new THREE.BoxGeometry(0.4, 0.05, 0.08);
    const guard = new THREE.Mesh(guardGeo, aoteMaterial);
    guard.position.y = 0.05;
    group.add(guard);
    
    // Core crystal
    const crystalGeo = new THREE.OctahedronGeometry(0.1);
    const crystalMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', emissive: '#FFFFFF', emissiveIntensity: 1.0 });
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.position.y = 0.05;
    group.add(crystal);
    
    const gripGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.3);
    const grip = new THREE.Mesh(gripGeo, handleMaterial);
    grip.position.y = -0.15;
    group.add(grip);
    
    // Floating "energy" bits
    for(let i=0; i<4; i++) {
        const spikeGeo = new THREE.ConeGeometry(0.02, 0.15, 4);
        const spike = new THREE.Mesh(spikeGeo, aoteMaterial);
        const angle = (i / 4) * Math.PI * 2;
        spike.position.set(Math.cos(angle)*0.18, 0.4 + i*0.2, Math.sin(angle)*0.18);
        spike.rotation.x = Math.PI / 2;
        group.add(spike);
    }
  } else if (isMinion) {
    // 3D Minion Model
    const minionGroup = new THREE.Group();
    
    // Body (Yellow)
    const bodyGeo = new THREE.BoxGeometry(0.3, 0.4, 0.3);
    const minionBodyMat = new THREE.MeshStandardMaterial({ color: '#FFFF55' });
    const body = new THREE.Mesh(bodyGeo, minionBodyMat);
    minionGroup.add(body);
    
    // Overalls (Blue)
    const overallsGeo = new THREE.BoxGeometry(0.32, 0.15, 0.32);
    const overallsMat = new THREE.MeshStandardMaterial({ color: '#5555FF' });
    const overalls = new THREE.Mesh(overallsGeo, overallsMat);
    overalls.position.y = -0.13;
    minionGroup.add(overalls);
    
    // Eyes/Goggles
    const goggleGeo = new THREE.BoxGeometry(0.33, 0.08, 0.1);
    const goggleMat = new THREE.MeshStandardMaterial({ color: '#111111' });
    const goggles = new THREE.Mesh(goggleGeo, goggleMat);
    goggles.position.set(0, 0.05, 0.12);
    minionGroup.add(goggles);
    
    const eyeGeo = new THREE.BoxGeometry(0.05, 0.05, 0.02);
    const eyeMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF' });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.06, 0.05, 0.18);
    minionGroup.add(leftEye);
    
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.06, 0.05, 0.18);
    minionGroup.add(rightEye);
    
    group.add(minionGroup);
  } else if (isWheat) {
    // 3D Wheat Bundle Model
    const bundleGroup = new THREE.Group();
    const wheatMat = new THREE.MeshStandardMaterial({ color: '#E3B044' });
    const stalkGeo = new THREE.BoxGeometry(0.04, 0.6, 0.04);
    
    for(let i=0; i<5; i++) {
        const stalk = new THREE.Mesh(stalkGeo, wheatMat);
        stalk.position.set((Math.random()-0.5)*0.15, 0, (Math.random()-0.5)*0.15);
        stalk.rotation.set((Math.random()-0.5)*0.3, 0, (Math.random()-0.5)*0.3);
        bundleGroup.add(stalk);
    }
    
    // Tie
    const tieGeo = new THREE.TorusGeometry(0.08, 0.02, 4, 8);
    const tieMat = new THREE.MeshStandardMaterial({ color: '#8B5A2B' });
    const tie = new THREE.Mesh(tieGeo, tieMat);
    tie.rotation.x = Math.PI / 2;
    bundleGroup.add(tie);
    
    group.add(bundleGroup);
  } else if (isCane) {
    // 3D Sugar Cane Model
    const caneGroup = new THREE.Group();
    const caneMat = new THREE.MeshStandardMaterial({ color: '#68B936' });
    const segmentGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.8);
    
    for(let i=0; i<3; i++) {
        const cane = new THREE.Mesh(segmentGeo, caneMat);
        cane.position.set(-0.1 + i*0.1, 0, 0);
        cane.rotation.z = (i-1)*0.1;
        caneGroup.add(cane);
        
        // Darker green lines for segments
        const ringGeo = new THREE.TorusGeometry(0.065, 0.01, 4, 8);
        const ringMat = new THREE.MeshStandardMaterial({ color: '#4A8522' });
        for(let j=0; j<3; j++) {
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.position.set(-0.1 + i*0.1, -0.3 + j*0.3, 0);
            ring.rotation.x = Math.PI / 2;
            caneGroup.add(ring);
        }
    }
    group.add(caneGroup);
  } else if (isLily) {
    const lilyGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.02, 16);
    const lilyMat = new THREE.MeshStandardMaterial({ color: '#317424' });
    const lily = new THREE.Mesh(lilyGeo, lilyMat);
    
    // Add a small notch
    const notchGeo = new THREE.BoxGeometry(0.2, 0.03, 0.2);
    const notch = new THREE.Mesh(notchGeo, lilyMat);
    notch.position.set(0.25, 0, 0);
    lily.add(notch); // This won't work well for union, but for a simple model it's okay
    
    group.add(lily);
  } else if (isLantern) {
    const lanternGroup = new THREE.Group();
    const bodyGeo = new THREE.BoxGeometry(0.2, 0.25, 0.2);
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#3c322b', metalness: 0.8 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    lanternGroup.add(body);
    
    const glowGeo = new THREE.BoxGeometry(0.12, 0.15, 0.12);
    const glowMat = new THREE.MeshStandardMaterial({ color: '#ffcc00', emissive: '#ffcc00', emissiveIntensity: 1.0 });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    lanternGroup.add(glow);

    const handleGeo = new THREE.TorusGeometry(0.08, 0.02, 6, 12, Math.PI);
    const handle = new THREE.Mesh(handleGeo, bodyMat);
    handle.position.y = 0.15;
    lanternGroup.add(handle);
    
    group.add(lanternGroup);
  } else if (isCampfire) {
    const fireGroup = new THREE.Group();
    const logGeo = new THREE.BoxGeometry(0.4, 0.1, 0.1);
    const log1 = new THREE.Mesh(logGeo, handleMaterial);
    log1.position.z = 0.1;
    fireGroup.add(log1);
    const log2 = new THREE.Mesh(logGeo, handleMaterial);
    log2.position.z = -0.1;
    fireGroup.add(log2);

    const flameGeo = new THREE.ConeGeometry(0.15, 0.3, 4);
    const flameMat = new THREE.MeshStandardMaterial({ color: '#ff4400', emissive: '#ff4400', emissiveIntensity: 1.0 });
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.y = 0.15;
    fireGroup.add(flame);
    
    group.add(fireGroup);
  } else if (isMushroom) {
    const mushGroup = new THREE.Group();
    const stemGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.2, 8);
    const stemMat = new THREE.MeshStandardMaterial({ color: '#d1ccb6' });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    mushGroup.add(stem);
    
    const capGeo = new THREE.SphereGeometry(0.2, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const cap = new THREE.Mesh(capGeo, material);
    cap.position.y = 0.1;
    mushGroup.add(cap);

    if (type === ItemType.MUSHROOM_RED) {
        // Spots
        const spotGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
        const spotMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF' });
        for(let i=0; i<4; i++) {
            const spot = new THREE.Mesh(spotGeo, spotMat);
            const angle = (i/4) * Math.PI * 2;
            spot.position.set(Math.cos(angle)*0.15, 0.2, Math.sin(angle)*0.15);
            mushGroup.add(spot);
        }
    }
    
    group.add(mushGroup);
  } else if (isTorch) {
    const torchGroup = new THREE.Group();
    // Wood part (tapered look)
    const stickGeo = new THREE.BoxGeometry(0.1, 0.7, 0.1);
    const stick = new THREE.Mesh(stickGeo, handleMaterial);
    torchGroup.add(stick);
    
    // Top burnt part
    const burntGeo = new THREE.BoxGeometry(0.11, 0.15, 0.11);
    const burntMat = new THREE.MeshStandardMaterial({ color: '#2b1b0a' });
    const burnt = new THREE.Mesh(burntGeo, burntMat);
    burnt.position.y = 0.3;
    torchGroup.add(burnt);
    
    // Flame (Glowing bits)
    const flameMat = new THREE.MeshStandardMaterial({ 
      color: '#FF9800', 
      emissive: '#FF9800', 
      emissiveIntensity: 2.0,
      metalness: 0,
      roughness: 1
    });
    
    // Multi-staged flame
    const flameGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.y = 0.42;
    torchGroup.add(flame);
    
    const flameTopGeo = new THREE.BoxGeometry(0.08, 0.15, 0.08);
    const flameTop = new THREE.Mesh(flameTopGeo, flameMat);
    flameTop.position.y = 0.5;
    torchGroup.add(flameTop);
    
    // Hot core
    const coreGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
    const coreMat = new THREE.MeshStandardMaterial({ 
      color: '#FFFF8D', 
      emissive: '#FFFF8D', 
      emissiveIntensity: 3.0 
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.y = 0.43;
    torchGroup.add(core);
    
    group.add(torchGroup);
  }

  // Common properties
  group.traverse(child => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return group;
}
