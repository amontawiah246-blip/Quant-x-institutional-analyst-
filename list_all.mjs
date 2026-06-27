import fs from 'fs';
import path from 'path';

function walkDir(dir, fileList = [], baseDir = '') {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const relPath = path.join(baseDir, file);
    if (fs.statSync(filePath).isDirectory()) {
      walkDir(filePath, fileList, relPath);
    } else {
      fileList.push(relPath);
    }
  }
  return fileList;
}

const targetDir = './extracted_zip/Quant-x-institutional-analyst--main';
const allFiles = walkDir(targetDir);

const organized = {};
for (const file of allFiles) {
  const dir = path.dirname(file);
  if (!organized[dir]) organized[dir] = [];
  organized[dir].push(path.basename(file));
}

for (const dir in organized) {
  console.log(`\nFolder: /${dir === '.' ? '' : dir}`);
  for (const file of organized[dir]) {
    console.log(`  - ${file}`);
  }
}
