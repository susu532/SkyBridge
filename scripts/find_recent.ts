import * as fs from 'fs';
import * as path from 'path';

function walk(dir: string) {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.resolve(dir, file);
    if (file.includes('node_modules')) return;
    if (file.includes('.git')) return;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      const ms = Date.now() - stat.mtimeMs;
      if (ms < 30 * 60 * 1000) {
         results.push(file + " (" + Math.round(ms/1000) + "s ago)");
      }
    }
  });
  return results;
}

const recent = walk(process.cwd());
console.log(recent.join('\n'));
