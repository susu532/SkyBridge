import fs from 'fs';
import path from 'path';

function findOverview(dir: string) {
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      try {
        if (fs.statSync(fullPath).isDirectory()) {
          findOverview(fullPath);
        } else if (file === 'overview.txt') {
          console.log("FOUND:", fullPath);
          console.log(fs.readFileSync(fullPath, 'utf8').substring(0, 1000));
        }
      } catch (e) {}
    }
  } catch (e) {}
}

findOverview('/.gemini');
