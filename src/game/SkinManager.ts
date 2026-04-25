import * as THREE from 'three';

const SKIN_WIDTH = 64;
const SKIN_HEIGHT = 64;

// Standard 64x64 Minecraft skin layout [x, y, w, h]
const UV_MAP = {
  head: {
    right: [0, 8, 8, 8], left: [16, 8, 8, 8],
    top: [8, 0, 8, 8], bottom: [16, 0, 8, 8],
    front: [8, 8, 8, 8], back: [24, 8, 8, 8]
  },
  body: {
    right: [16, 20, 4, 12], left: [28, 20, 4, 12],
    top: [20, 16, 8, 4], bottom: [28, 16, 8, 4],
    front: [20, 20, 8, 12], back: [32, 20, 8, 12]
  },
  armR: {
    right: [40, 20, 4, 12], left: [48, 20, 4, 12],
    top: [44, 16, 4, 4], bottom: [48, 16, 4, 4],
    front: [44, 20, 4, 12], back: [52, 20, 4, 12]
  },
  armL: {
    right: [32, 52, 4, 12], left: [40, 52, 4, 12],
    top: [36, 48, 4, 4], bottom: [40, 48, 4, 4],
    front: [36, 52, 4, 12], back: [44, 52, 4, 12]
  },
  legR: {
    right: [0, 20, 4, 12], left: [8, 20, 4, 12],
    top: [4, 16, 4, 4], bottom: [8, 16, 4, 4],
    front: [4, 20, 4, 12], back: [12, 20, 4, 12]
  },
  legL: {
    right: [16, 52, 4, 12], left: [24, 52, 4, 12],
    top: [20, 48, 4, 4], bottom: [24, 48, 4, 4],
    front: [20, 52, 4, 12], back: [28, 52, 4, 12]
  }
};

const UV_MAP_OUTER = {
  head: {
    right: [32, 8, 8, 8], left: [48, 8, 8, 8],
    top: [40, 0, 8, 8], bottom: [48, 0, 8, 8],
    front: [40, 8, 8, 8], back: [56, 8, 8, 8]
  },
  body: {
    right: [16, 36, 4, 12], left: [28, 36, 4, 12],
    top: [20, 32, 8, 4], bottom: [28, 32, 8, 4],
    front: [20, 36, 8, 12], back: [32, 36, 8, 12]
  },
  armR: {
    right: [40, 36, 4, 12], left: [48, 36, 4, 12],
    top: [44, 32, 4, 4], bottom: [48, 32, 4, 4],
    front: [44, 36, 4, 12], back: [52, 36, 4, 12]
  },
  armL: {
    right: [48, 52, 4, 12], left: [56, 52, 4, 12],
    top: [52, 48, 4, 4], bottom: [56, 48, 4, 4],
    front: [52, 52, 4, 12], back: [60, 52, 4, 12]
  },
  legR: {
    right: [0, 36, 4, 12], left: [8, 36, 4, 12],
    top: [4, 32, 4, 4], bottom: [8, 32, 4, 4],
    front: [4, 36, 4, 12], back: [12, 36, 4, 12]
  },
  legL: {
    right: [0, 52, 4, 12], left: [8, 52, 4, 12],
    top: [4, 48, 4, 4], bottom: [8, 48, 4, 4],
    front: [4, 52, 4, 12], back: [12, 52, 4, 12]
  }
};

export function applySkinUVs(geometry: THREE.BufferGeometry, part: keyof typeof UV_MAP, isOuter: boolean = false, crop?: 'top' | 'bottom') {
  const uvs = geometry.attributes.uv;
  const map = isOuter ? UV_MAP_OUTER[part] : UV_MAP[part];
  
  // Three.js BoxGeometry face order: 0:Right(+X), 1:Left(-X), 2:Top(+Y), 3:Bottom(-Y), 4:Front(+Z), 5:Back(-Z)
  // Character faces -Z (Front is index 5)
  const faces = ['left', 'right', 'top', 'bottom', 'back', 'front'] as const;
  
  for (let i = 0; i < 6; i++) {
    const faceName = faces[i];
    let [x, y, w, h] = map[faceName];
    
    if (crop === 'bottom') {
      if (faceName !== 'top' && faceName !== 'bottom') {
        y += h / 2;
        h /= 2;
      } else if (faceName === 'top') {
        // Use bottom texture for top of hand to make it look like skin
        const bottomFace = map['bottom'];
        x = bottomFace[0];
        y = bottomFace[1];
        w = bottomFace[2];
        h = bottomFace[3];
      }
    } else if (crop === 'top') {
      if (faceName !== 'top' && faceName !== 'bottom') {
        h /= 2;
      } else if (faceName === 'bottom') {
        // Use top texture for bottom of sleeve
        const topFace = map['top'];
        x = topFace[0];
        y = topFace[1];
        w = topFace[2];
        h = topFace[3];
      }
    }
    
    // Convert to 0-1 range, flipping Y
    const u1 = x / SKIN_WIDTH;
    const v1 = 1.0 - ((y + h) / SKIN_HEIGHT);
    const u2 = (x + w) / SKIN_WIDTH;
    const v2 = 1.0 - (y / SKIN_HEIGHT);

    const offset = i * 4;
    
    // Rotate 90 deg left (counter-clockwise) to fix sideways texture
    uvs.setXY(offset + 0, u2, v2);
    uvs.setXY(offset + 1, u1, v2);
    uvs.setXY(offset + 2, u2, v1);
    uvs.setXY(offset + 3, u1, v1);
  }
  uvs.needsUpdate = true;
}

const skinCache = new Map<string, THREE.Texture>();

export function generateSkin(seed: string): THREE.Texture {
  if (skinCache.has(seed)) {
    return skinCache.get(seed)!;
  }
  
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  // Simple seeded random
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const random = () => {
    const x = Math.sin(hash++) * 10000;
    return x - Math.floor(x);
  };

  const skinColors = ['#ffccaa', '#e0ac69', '#8d5524', '#c68642', '#f1c27d'];
  const hairColors = ['#000000', '#4a3219', '#e6ce70', '#7c2a1b', '#888888', '#5c1010'];
  const eyeColors = ['#3b82f6', '#22c55e', '#8b4513', '#000000', '#6366f1'];
  const shirtColors = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ec4899', '#ffffff', '#1f2937', '#0d9488'];
  const pantsColors = ['#1e3a8a', '#172554', '#374151', '#1f2937', '#422006', '#0f172a'];

  const skinColor = skinColors[Math.floor(random() * skinColors.length)];
  const hairColor = hairColors[Math.floor(random() * hairColors.length)];
  const eyeColor = eyeColors[Math.floor(random() * eyeColors.length)];
  const shirtColor = shirtColors[Math.floor(random() * shirtColors.length)];
  const pantsColor = pantsColors[Math.floor(random() * pantsColors.length)];
  const shoeColor = '#111111';

  // Fill with transparent first
  ctx.clearRect(0, 0, 64, 64);

  // Helper to draw regions
  const fillRegion = (map: any, color: string) => {
    for (const face of Object.values(map)) {
      const [x, y, w, h] = face as number[];
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    }
  };

  // 1. Base Skin
  fillRegion(UV_MAP.head, skinColor);
  fillRegion(UV_MAP.armR, skinColor);
  fillRegion(UV_MAP.armL, skinColor);
  
  // 2. Shirt
  fillRegion(UV_MAP.body, shirtColor);
  // Sleeves (top half of arms)
  const drawSleeve = (map: any) => {
    for (const [faceName, face] of Object.entries(map)) {
      const [x, y, w, h] = face as number[];
      if (faceName === 'top' || faceName === 'bottom') {
         if (faceName === 'top') { ctx.fillStyle = shirtColor; ctx.fillRect(x, y, w, h); }
      } else {
         ctx.fillStyle = shirtColor;
         ctx.fillRect(x, y, w, Math.floor(h / 2)); // Half sleeve
      }
    }
  };
  drawSleeve(UV_MAP.armR);
  drawSleeve(UV_MAP.armL);

  // 3. Pants
  fillRegion(UV_MAP.legR, pantsColor);
  fillRegion(UV_MAP.legL, pantsColor);

  // 4. Shoes (bottom part of legs)
  const drawShoe = (map: any) => {
    for (const [faceName, face] of Object.entries(map)) {
      const [x, y, w, h] = face as number[];
      if (faceName === 'bottom') {
        ctx.fillStyle = shoeColor; ctx.fillRect(x, y, w, h);
      } else if (faceName !== 'top') {
        ctx.fillStyle = shoeColor;
        ctx.fillRect(x, y + h - 3, w, 3); // 3 pixels high shoes
      }
    }
  };
  drawShoe(UV_MAP.legR);
  drawShoe(UV_MAP.legL);

  // 5. Hair
  // Top, Back, Right, Left
  ctx.fillStyle = hairColor;
  ctx.fillRect(UV_MAP.head.top[0], UV_MAP.head.top[1], 8, 8);
  ctx.fillRect(UV_MAP.head.back[0], UV_MAP.head.back[1], 8, 8);
  ctx.fillRect(UV_MAP.head.right[0], UV_MAP.head.right[1], 8, 8);
  ctx.fillRect(UV_MAP.head.left[0], UV_MAP.head.left[1], 8, 8);
  // Front hair (top 2 pixels)
  ctx.fillRect(UV_MAP.head.front[0], UV_MAP.head.front[1], 8, 2);
  // Side hair extensions
  ctx.fillRect(UV_MAP.head.right[0] + 4, UV_MAP.head.right[1], 4, 8); // Back half of right side
  ctx.fillRect(UV_MAP.head.left[0], UV_MAP.head.left[1], 4, 8); // Back half of left side

  // 6. Face (Front)
  const fx = UV_MAP.head.front[0];
  const fy = UV_MAP.head.front[1];
  
  // Eyes (y=4, x=1 and x=5)
  ctx.fillStyle = '#ffffff'; // Sclera
  ctx.fillRect(fx + 1, fy + 4, 2, 2);
  ctx.fillRect(fx + 5, fy + 4, 2, 2);
  ctx.fillStyle = eyeColor; // Pupil
  const lookDir = random() > 0.5 ? 1 : 0;
  ctx.fillRect(fx + 1 + lookDir, fy + 4, 1, 2);
  ctx.fillRect(fx + 5 + lookDir, fy + 4, 1, 2);
  
  // Mouth (y=6, x=3 to 5)
  ctx.fillStyle = '#aa5555';
  ctx.fillRect(fx + 3, fy + 6, 2, 1);

  // 7. Outer Layer Details
  // Add a random accessory (glasses, headband, or nothing)
  const accessoryType = Math.floor(random() * 3);
  const outerFx = UV_MAP_OUTER.head.front[0];
  const outerFy = UV_MAP_OUTER.head.front[1];
  
  if (accessoryType === 0) {
    // Glasses
    ctx.fillStyle = '#222222';
    ctx.fillRect(outerFx, outerFy + 3, 8, 1); // Frame top
    ctx.fillRect(outerFx, outerFy + 4, 1, 2); // Left edge
    ctx.fillRect(outerFx + 3, outerFy + 4, 2, 2); // Middle
    ctx.fillRect(outerFx + 7, outerFy + 4, 1, 2); // Right edge
    ctx.fillRect(outerFx + 1, outerFy + 6, 2, 1); // Left bottom
    ctx.fillRect(outerFx + 5, outerFy + 6, 2, 1); // Right bottom
    // Sides
    ctx.fillRect(UV_MAP_OUTER.head.right[0] + 1, UV_MAP_OUTER.head.right[1] + 3, 7, 1);
    ctx.fillRect(UV_MAP_OUTER.head.left[0], UV_MAP_OUTER.head.left[1] + 3, 7, 1);
  } else if (accessoryType === 1) {
    // Headband
    const bandColor = shirtColors[Math.floor(random() * shirtColors.length)];
    ctx.fillStyle = bandColor;
    ctx.fillRect(outerFx, outerFy + 2, 8, 2);
    ctx.fillRect(UV_MAP_OUTER.head.right[0], UV_MAP_OUTER.head.right[1] + 2, 8, 2);
    ctx.fillRect(UV_MAP_OUTER.head.left[0], UV_MAP_OUTER.head.left[1] + 2, 8, 2);
    ctx.fillRect(UV_MAP_OUTER.head.back[0], UV_MAP_OUTER.head.back[1] + 2, 8, 2);
  }

  // Jacket Overlay (sometimes)
  if (random() > 0.5) {
    const jacketColor = pantsColors[Math.floor(random() * pantsColors.length)];
    ctx.fillStyle = jacketColor;
    // Body outer
    fillRegion(UV_MAP_OUTER.body, jacketColor);
    // Open front
    ctx.clearRect(UV_MAP_OUTER.body.front[0] + 2, UV_MAP_OUTER.body.front[1], 4, 12);
    // Arm outer (sleeves)
    fillRegion(UV_MAP_OUTER.armR, jacketColor);
    fillRegion(UV_MAP_OUTER.armL, jacketColor);
  }

  // 8. Add Noise for texture
  const imgData = ctx.getImageData(0, 0, 64, 64);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i+3] > 0) { // If not transparent
      const noise = (random() - 0.5) * 30;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i+1] = Math.min(255, Math.max(0, data[i+1] + noise));
      data[i+2] = Math.min(255, Math.max(0, data[i+2] + noise));
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  
  skinCache.set(seed, texture);
  
  return texture;
}
