import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const sourceDir = path.join(rootDir, 'extracted_zip', 'Quant-x-institutional-analyst--main');

const protectedItems = [
  'extracted_zip',
  'Quant-x-institutional-analyst--main.zip(21)',
  'replace_workspace.mjs',
  'list_all.mjs',
  'unzip.cjs',
  'unzip.js',
  'check_file.mjs'
];

try {
  console.log("Cleaning old workspace...");
  const items = fs.readdirSync(rootDir);
  for (const item of items) {
    if (!protectedItems.includes(item)) {
      fs.rmSync(path.join(rootDir, item), { recursive: true, force: true });
      console.log(`Deleted: ${item}`);
    }
  }

  console.log("\nCopying new files...");
  const newItems = fs.readdirSync(sourceDir);
  for (const item of newItems) {
    fs.cpSync(path.join(sourceDir, item), path.join(rootDir, item), { recursive: true });
  }
  console.log("Workspace replaced successfully.");
  
  console.log("\n--- Checking engine.py ---");
  const engineExists = fs.existsSync('engine.py');
  console.log("engine.py exists:", engineExists);
  
  console.log("\n--- Checking server.ts for engine.py reference ---");
  const serverCode = fs.readFileSync('server.ts', 'utf-8');
  const engineLines = serverCode.split('\n').map((l, i) => [i+1, l]).filter(([i, l]) => l.includes('engine.py'));
  engineLines.forEach(([i, l]) => console.log(`Line ${i}: ${l.trim()}`));

  console.log("\n--- Checking src/lib/utils.ts ---");
  const utilsExists = fs.existsSync('src/lib/utils.ts');
  console.log("src/lib/utils.ts exists:", utilsExists);

  console.log("\n--- Checking src/ for utils.ts imports ---");
  function searchUtils(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fp = path.join(dir, file);
      if (fs.statSync(fp).isDirectory()) {
        searchUtils(fp);
      } else if (fp.endsWith('.tsx') || fp.endsWith('.ts')) {
        const code = fs.readFileSync(fp, 'utf-8');
        const lines = code.split('\n');
        lines.forEach((l, i) => {
          if (l.includes('lib/utils') || l.includes('@/lib/utils') || l.includes('../utils') || l.includes('./utils')) {
            console.log(`${fp}:${i+1}: ${l.trim()}`);
          }
        });
      }
    }
  }
  searchUtils('src');
  
} catch (e) {
  console.error(e);
  process.exit(1);
}
