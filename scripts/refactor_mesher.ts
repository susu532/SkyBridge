import fs from 'fs';

let content = fs.readFileSync('src/game/ChunkMesher.worker.ts', 'utf-8');

const classDefs = `
class DynamicFloat32Buffer {
  data: Float32Array;
  length: number = 0;
  constructor(initialSize = 32768) {
    this.data = new Float32Array(initialSize);
  }
  push4(a: number, b: number, c: number, d: number) {
    if (this.length + 4 > this.data.length) this._grow(4);
    this.data[this.length++] = a; this.data[this.length++] = b;
    this.data[this.length++] = c; this.data[this.length++] = d;
  }
  push8(a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) {
    if (this.length + 8 > this.data.length) this._grow(8);
    this.data[this.length++] = a; this.data[this.length++] = b;
    this.data[this.length++] = c; this.data[this.length++] = d;
    this.data[this.length++] = e; this.data[this.length++] = f;
    this.data[this.length++] = g; this.data[this.length++] = h;
  }
  push12(a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) {
    if (this.length + 12 > this.data.length) this._grow(12);
    this.data[this.length++] = a; this.data[this.length++] = b;
    this.data[this.length++] = c; this.data[this.length++] = d;
    this.data[this.length++] = e; this.data[this.length++] = f;
    this.data[this.length++] = g; this.data[this.length++] = h;
    this.data[this.length++] = i; this.data[this.length++] = j;
    this.data[this.length++] = k; this.data[this.length++] = l;
  }
  _grow(minAmount: number) {
    const newSize = Math.max(this.data.length * 2, this.data.length + minAmount);
    const newData = new Float32Array(newSize);
    newData.set(this.data);
    this.data = newData;
  }
  toArray() {
    return new Float32Array(this.data.buffer, 0, this.length);
  }
}

class DynamicUint32Buffer {
  data: Uint32Array;
  length: number = 0;
  constructor(initialSize = 16384) {
    this.data = new Uint32Array(initialSize);
  }
  push6(a: number, b: number, c: number, d: number, e: number, f: number) {
    if (this.length + 6 > this.data.length) this._grow(6);
    this.data[this.length++] = a; this.data[this.length++] = b;
    this.data[this.length++] = c; this.data[this.length++] = d;
    this.data[this.length++] = e; this.data[this.length++] = f;
  }
  _grow(minAmount: number) {
    const newSize = Math.max(this.data.length * 2, this.data.length + minAmount);
    const newData = new Uint32Array(newSize);
    newData.set(this.data);
    this.data = newData;
  }
  toArray() {
    return new Uint32Array(this.data.buffer, 0, this.length);
  }
}

class LayerData {
  positions = new DynamicFloat32Buffer(32768);
  normals = new DynamicFloat32Buffer(32768);
  uvs = new DynamicFloat32Buffer(16384);
  tileBases = new DynamicFloat32Buffer(16384);
  colors = new DynamicFloat32Buffer(32768);
  sways = new DynamicFloat32Buffer(16384);
  indices = new DynamicUint32Buffer(16384);
  offset = 0;
}
`;

content = content.replace(
  /    const opaque = \{ positions: \[\] as number\[\], normals: \[\] as number\[\], uvs: \[\] as number\[\], tileBases: \[\] as number\[\], colors: \[\] as number\[\], sways: \[\] as number\[\], indices: \[\] as number\[\], offset: 0 \};\n    const transparent = \{ positions: \[\] as number\[\], normals: \[\] as number\[\], uvs: \[\] as number\[\], tileBases: \[\] as number\[\], colors: \[\] as number\[\], sways: \[\] as number\[\], indices: \[\] as number\[\], offset: 0 \};/g,
  classDefs + `\n    const opaque = new LayerData();\n    const transparent = new LayerData();`
);

content = content.replace(
  `      layer.positions.push(
        p0![0], p0![1], p0![2],
        p1![0], p1![1], p1![2],
        p2![0], p2![1], p2![2],
        p3![0], p3![1], p3![2]
      );
      
      layer.normals.push(
        nx, ny, nz,
        nx, ny, nz,
        nx, ny, nz,
        nx, ny, nz
      );
      
      layer.tileBases.push(
        u, v,
        u, v,
        u, v,
        u, v
      );
      
      layer.uvs.push(
        0, 0,
        1, 0,
        1, 1,
        0, 1
      );
      
      layer.colors.push(
        l0, l0, l0,
        l1, l1, l1,
        l2, l2, l2,
        l3, l3, l3
      );

      const pushSway = (v: number[]) => {
        let val = 0;
        if (isLeaves(blockType) || isPlant(blockType)) {
          val = (v[1] > y) ? 1.0 : 0.0;
        } else if (isWater(blockType)) {
          val = 2.0;
        }
        layer.sways.push(val);
      };
      pushSway(p0!); pushSway(p1!); pushSway(p2!); pushSway(p3!);

      if (layer === opaque && ao[0] + ao[2] < ao[1] + ao[3]) {
        layer.indices.push(layer.offset + 1, layer.offset + 2, layer.offset + 3, layer.offset + 1, layer.offset + 3, layer.offset);
      } else {
        layer.indices.push(layer.offset, layer.offset + 1, layer.offset + 2, layer.offset, layer.offset + 2, layer.offset + 3);
      }`,
  `      layer.positions.push12(
        p0![0], p0![1], p0![2],
        p1![0], p1![1], p1![2],
        p2![0], p2![1], p2![2],
        p3![0], p3![1], p3![2]
      );
      
      layer.normals.push12(
        nx, ny, nz,
        nx, ny, nz,
        nx, ny, nz,
        nx, ny, nz
      );
      
      layer.tileBases.push8(
        u, v,
        u, v,
        u, v,
        u, v
      );
      
      layer.uvs.push8(
        0, 0,
        1, 0,
        1, 1,
        0, 1
      );
      
      layer.colors.push12(
        l0, l0, l0,
        l1, l1, l1,
        l2, l2, l2,
        l3, l3, l3
      );

      const getSway = (v: number[]) => {
        if (isLeaves(blockType) || isPlant(blockType)) {
          return (v[1] > y) ? 1.0 : 0.0;
        } else if (isWater(blockType)) {
          return 2.0;
        }
        return 0.0;
      };
      layer.sways.push4(getSway(p0!), getSway(p1!), getSway(p2!), getSway(p3!));

      if (layer === opaque && ao[0] + ao[2] < ao[1] + ao[3]) {
        layer.indices.push6(layer.offset + 1, layer.offset + 2, layer.offset + 3, layer.offset + 1, layer.offset + 3, layer.offset);
      } else {
        layer.indices.push6(layer.offset, layer.offset + 1, layer.offset + 2, layer.offset, layer.offset + 2, layer.offset + 3);
      }`
);


content = content.replace(
  `        if (reverse) {
          layer.positions.push(
            p3[0], p3[1], p3[2],
            p2[0], p2[1], p2[2],
            p1[0], p1[1], p1[2],
            p0[0], p0[1], p0[2]
          );
          layer.sways.push(
            (isTorch || p3[1] <= y) ? 0.0 : 1.0,
            (isTorch || p2[1] <= y) ? 0.0 : 1.0,
            (isTorch || p1[1] <= y) ? 0.0 : 1.0,
            (isTorch || p0[1] <= y) ? 0.0 : 1.0
          );
          layer.tileBases.push(u, v, u, v, u, v, u, v);
          layer.uvs.push(
            0, 1,
            1, 1,
            1, 0,
            0, 0
          );
        } else {
          layer.positions.push(
            p0[0], p0[1], p0[2],
            p1[0], p1[1], p1[2],
            p2[0], p2[1], p2[2],
            p3[0], p3[1], p3[2]
          );
          layer.sways.push(
            (isTorch || p0[1] <= y) ? 0.0 : 1.0,
            (isTorch || p1[1] <= y) ? 0.0 : 1.0,
            (isTorch || p2[1] <= y) ? 0.0 : 1.0,
            (isTorch || p3[1] <= y) ? 0.0 : 1.0
          );
          layer.tileBases.push(u, v, u, v, u, v, u, v);
          layer.uvs.push(
            0, 0,
            1, 0,
            1, 1,
            0, 1
          );
        }
        layer.normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0); // Up normal for simplicity
        const light = getLightLevel(x,y,z,0,0,0);
        const lightMult = isTorch ? 1.0 : Math.max(0.1, Math.pow(0.85, 15 - light));
        const color = isTorch ? 1.4 : lightMult;
        
        // Add subtle AO by darkening the bottom vertices
        const cLow = color * 0.75;
        const cHigh = color;

        if (reverse) {
          layer.colors.push(cHigh, cHigh, cHigh, cHigh, cHigh, cHigh, cLow, cLow, cLow, cLow, cLow, cLow);
        } else {
          layer.colors.push(cLow, cLow, cLow, cLow, cLow, cLow, cHigh, cHigh, cHigh, cHigh, cHigh, cHigh);
        }
        layer.indices.push(layer.offset, layer.offset + 1, layer.offset + 2, layer.offset, layer.offset + 2, layer.offset + 3);`,
  `        if (reverse) {
          layer.positions.push12(
            p3[0], p3[1], p3[2],
            p2[0], p2[1], p2[2],
            p1[0], p1[1], p1[2],
            p0[0], p0[1], p0[2]
          );
          layer.sways.push4(
            (isTorch || p3[1] <= y) ? 0.0 : 1.0,
            (isTorch || p2[1] <= y) ? 0.0 : 1.0,
            (isTorch || p1[1] <= y) ? 0.0 : 1.0,
            (isTorch || p0[1] <= y) ? 0.0 : 1.0
          );
          layer.tileBases.push8(u, v, u, v, u, v, u, v);
          layer.uvs.push8(
            0, 1,
            1, 1,
            1, 0,
            0, 0
          );
        } else {
          layer.positions.push12(
            p0[0], p0[1], p0[2],
            p1[0], p1[1], p1[2],
            p2[0], p2[1], p2[2],
            p3[0], p3[1], p3[2]
          );
          layer.sways.push4(
            (isTorch || p0[1] <= y) ? 0.0 : 1.0,
            (isTorch || p1[1] <= y) ? 0.0 : 1.0,
            (isTorch || p2[1] <= y) ? 0.0 : 1.0,
            (isTorch || p3[1] <= y) ? 0.0 : 1.0
          );
          layer.tileBases.push8(u, v, u, v, u, v, u, v);
          layer.uvs.push8(
            0, 0,
            1, 0,
            1, 1,
            0, 1
          );
        }
        layer.normals.push12(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0); // Up normal for simplicity
        const light = getLightLevel(x,y,z,0,0,0);
        const lightMult = isTorch ? 1.0 : Math.max(0.1, Math.pow(0.85, 15 - light));
        const color = isTorch ? 1.4 : lightMult;
        
        // Add subtle AO by darkening the bottom vertices
        const cLow = color * 0.75;
        const cHigh = color;

        if (reverse) {
          layer.colors.push12(cHigh, cHigh, cHigh, cHigh, cHigh, cHigh, cLow, cLow, cLow, cLow, cLow, cLow);
        } else {
          layer.colors.push12(cLow, cLow, cLow, cLow, cLow, cLow, cHigh, cHigh, cHigh, cHigh, cHigh, cHigh);
        }
        layer.indices.push6(layer.offset, layer.offset + 1, layer.offset + 2, layer.offset, layer.offset + 2, layer.offset + 3);`
);

content = content.replace(
  `      layer.sways.push(swayVal, swayVal, swayVal, swayVal);

      layer.positions.push(p0![0], p0![1], p0![2], p1![0], p1![1], p1![2], p2![0], p2![1], p2![2], p3![0], p3![1], p3![2]);
      layer.normals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz, nx, ny, nz);
      layer.tileBases.push(u, v, u, v, u, v, u, v);
      layer.uvs.push(0, 0, w, 0, w, h, 0, h);
      layer.colors.push(l0, l0, l0, l1, l1, l1, l2, l2, l2, l3, l3, l3);

      if (layer === opaque && ao0 + ao2 < ao1 + ao3) {
        layer.indices.push(layer.offset + 1, layer.offset + 2, layer.offset + 3, layer.offset + 1, layer.offset + 3, layer.offset);
      } else {
        layer.indices.push(layer.offset, layer.offset + 1, layer.offset + 2, layer.offset, layer.offset + 2, layer.offset + 3);
      }`,
  `      layer.sways.push4(swayVal, swayVal, swayVal, swayVal);

      layer.positions.push12(p0![0], p0![1], p0![2], p1![0], p1![1], p1![2], p2![0], p2![1], p2![2], p3![0], p3![1], p3![2]);
      layer.normals.push12(nx, ny, nz, nx, ny, nz, nx, ny, nz, nx, ny, nz);
      layer.tileBases.push8(u, v, u, v, u, v, u, v);
      layer.uvs.push8(0, 0, w, 0, w, h, 0, h);
      layer.colors.push12(l0, l0, l0, l1, l1, l1, l2, l2, l2, l3, l3, l3);

      if (layer === opaque && ao0 + ao2 < ao1 + ao3) {
        layer.indices.push6(layer.offset + 1, layer.offset + 2, layer.offset + 3, layer.offset + 1, layer.offset + 3, layer.offset);
      } else {
        layer.indices.push6(layer.offset, layer.offset + 1, layer.offset + 2, layer.offset, layer.offset + 2, layer.offset + 3);
      }`
);

content = content.replace(
  `    const mapLayer = (layer: any) => {
      if (layer.positions.length === 0) return null;
      return {
        positions: new Float32Array(layer.positions),
        normals: new Float32Array(layer.normals),
        uvs: new Float32Array(layer.uvs),
        colors: new Float32Array(layer.colors),
        indices: new Uint32Array(layer.indices),
        tileBases: new Float32Array(layer.tileBases),
        sways: new Float32Array(layer.sways)
      };
    };`,
  `    const mapLayer = (layer: any) => {
      if (layer.offset === 0) return null;
      return {
        positions: layer.positions.toArray(),
        normals: layer.normals.toArray(),
        uvs: layer.uvs.toArray(),
        colors: layer.colors.toArray(),
        indices: layer.indices.toArray(),
        tileBases: layer.tileBases.toArray(),
        sways: layer.sways.toArray()
      };
    };`
);


fs.writeFileSync('src/game/ChunkMesher.worker.ts', content);
