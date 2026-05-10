import { Project, SyntaxKind, FunctionDeclaration } from "ts-morph";
import fs from "fs";

async function main() {
  const project = new Project();
  project.addSourceFilesAtPaths("src/server/**/*.ts");

  const gameServerFile = project.getSourceFileOrThrow("src/server/GameServer.ts");
  const createGameServerFunc = gameServerFile.getFunctionOrThrow("createGameServer");

  // Since we want to just split the file, a simpler way is to:
  // 1. Create a GameServerEngine class in GameServerEngine.ts
  // 2. Put the body of createGameServer in the constructor
  // 3. Keep createGameServer as a wrapper.
  
  // Actually, string replacement via a script might be much more predictable 
  // than fighting with AST transformations for simple closure extraction.
  
}

main().catch(console.error);
