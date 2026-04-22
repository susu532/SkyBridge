import * as fs from 'fs';

const chunkTs = fs.readFileSync('src/game/Chunk.ts', 'utf-8');
const workerTs = fs.readFileSync('src/game/ChunkMesher.worker.ts', 'utf-8');

// Extract the contents of buildMesh
const buildMeshStartMatch = chunkTs.match(/async buildMesh\([^)]*\)[^{]*\{/);
if (!buildMeshStartMatch) {
  console.log("Could not find buildMesh start");
  process.exit(1);
}

const buildMeshStartIndex = buildMeshStartMatch.index! + buildMeshStartMatch[0].length;
let braceCount = 1;
let buildMeshEndIndex = -1;

for (let i = buildMeshStartIndex; i < chunkTs.length; i++) {
  if (chunkTs[i] === '{') braceCount++;
  else if (chunkTs[i] === '}') {
    braceCount--;
    if (braceCount === 0) {
      buildMeshEndIndex = i;
      break;
    }
  }
}

const buildMeshBody = chunkTs.substring(buildMeshStartIndex, buildMeshEndIndex);
const modifiedWorkerBody = buildMeshBody
  .replace(/this\.blocks/g, 'data.blocks')
  .replace(/this\.light/g, 'data.light')
  .replace(/this\.x/g, 'data.chunkX')
  .replace(/this\.z/g, 'data.chunkZ')
  .replace(/chunkCache/g, 'neighborsArray') 
  .replace(/await new Promise[^\n]+/g, '')
  .replace(/c\.blocks/g, 'c.blocks')
  .replace(/c \= neighborsArray\[([^\]]+)\]/g, 'c = { blocks: data.neighborsBlocks[$1], light: data.neighborsLight[$1] }')
  .replace(/const isCMeshed = c && \(c\.mesh [^\n]+/g, 'const isCMeshed = !!(c && c.blocks);')
  .replace(/c\.light/g, 'c.light');

let newWorkerContent = workerTs + `
// Auto-generated greedy mesher
export function runMesher(data: ChunkMesherRequest): ChunkMesherResponse | null {
  ${modifiedWorkerBody}
}
`;

fs.writeFileSync('src/game/ChunkMesher.worker.ts', newWorkerContent);
console.log("Worker generated!");

