const fs = require('fs');

// Patch package.json
let pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (pkg.dependencies && pkg.dependencies.motion) {
  delete pkg.dependencies.motion;
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
  console.log('Removed motion from package.json');
}

// Append to .gitignore
let ig = fs.readFileSync('.gitignore', 'utf8');
const ignores = ['*.db', 'quant_signals.db', 'replace.cjs'];
for (const igItem of ignores) {
  if (!ig.includes(igItem)) {
    ig += `\n${igItem}`;
  }
}
fs.writeFileSync('.gitignore', ig);
console.log('Appended to .gitignore');

// Delete files
const filesToDelete = ['replace.cjs', 'quant_signals.db'];
for (const f of filesToDelete) {
  if (fs.existsSync(f)) {
    fs.unlinkSync(f);
    console.log(`Deleted ${f}`);
  }
}
