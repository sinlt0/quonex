require('dotenv').config();
const { spawn } = require('child_process');

const mode = process.argv[2] || 'start';
const port = process.env.PORT || '3000';

const child = spawn('npx', ['next', mode, '-p', port], { stdio: 'inherit', shell: true });

child.on('exit', code => {
  process.exit(code === null ? 1 : code);
});
