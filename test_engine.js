const { spawn } = require('child_process');
const proc = spawn('python3', ['engine.py']);
let stdout = '', stderr = '';
proc.stdout.on('data', d => stdout += d.toString());
proc.stderr.on('data', d => stderr += d.toString());
proc.on('close', code => {
  console.log('Code:', code);
  console.log('STDOUT:', stdout.slice(0, 500));
  console.log('STDERR:', stderr);
});
