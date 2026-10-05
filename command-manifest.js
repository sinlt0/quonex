const fs = require('fs');
const path = require('path');
const { buildCommandManifest } = require('./src/utils/commandCounter');

function generate() {
  const manifest = buildCommandManifest();
  const outputPath = path.join(__dirname, 'dashboard', 'content', 'commands.json');

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));

  console.log(`Wrote ${manifest.length} commands to ${outputPath}`);
  process.exit(0);
}

generate();
