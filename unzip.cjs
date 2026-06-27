const { execSync } = require('child_process');
try {
  execSync('npm install adm-zip --no-save', { stdio: 'inherit' });
  const AdmZip = require('adm-zip');
  const zip = new AdmZip('Quant-x-institutional-analyst--main.zip(21)');
  
  // Extract to a temporary directory first
  zip.extractAllTo('./extracted_zip', true);
  
  const entries = zip.getEntries();
  const files = entries.map(e => e.entryName);
  const fs = require('fs');
  fs.writeFileSync('zip_contents.txt', JSON.stringify(files, null, 2));
  console.log('Successfully extracted ' + files.length + ' files.');
} catch (e) {
  console.error('Error during extraction:', e);
}
