import * as fs from 'fs';
import * as path from 'path';

function replaceInFile(filePath: string) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (!content.includes('import { useGameStore }')) {
    content = "import { useGameStore } from '../store/gameStore';\n" + content;
  }
  
  content = content.replace(
    /window\.dispatchEvent\(new CustomEvent\('gameMessage', {\s*detail:\s*{\s*text:\s*(.+?),\s*color:\s*(.+?)\s*}\s*}\)\);/g,
    'useGameStore.getState().addMessage($1, $2);'
  );
  
  content = content.replace(
    /window\.dispatchEvent\(new CustomEvent\('showNotification', {\s*detail:\s*{\s*text:\s*(.+?),\s*color:\s*(.+?)\s*}\s*}\)\);/g,
    'useGameStore.getState().addMessage($1, $2);'
  );

  fs.writeFileSync(filePath, content, 'utf8');
}

['src/game/Player.ts', 'src/game/Game.ts', 'src/game/PlayerPhysics.ts', 'src/game/PlayerInputController.ts'].forEach(file => {
  replaceInFile(path.join(process.cwd(), file));
});
