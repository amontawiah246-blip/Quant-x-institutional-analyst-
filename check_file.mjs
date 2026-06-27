import fs from 'fs';
try {
  const stats = fs.statSync('Quant-x-institutional-analyst--main.zip(21)');
  console.log('Size:', stats.size);
} catch(e) {
  console.log('Error:', e.message);
}
