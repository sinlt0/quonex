const { exec, spawn } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

async function runSetupStep(command) {
  try {
    console.log(`\n🚀 Running setup step: ${command}...`);
    const { stdout, stderr } = await execPromise(command);

    if (stdout) console.log(stdout);
    if (stderr) console.error(`⚠️ Stderr/Warnings:\n${stderr}`);

    console.log(`✅ Success: ${command}`);
  } catch (error) {
    console.error(`❌ Setup failed for "${command}":`, error.message);
    process.exit(1);
  }
}

function startService(command, args, label) {
  console.log(`\n⚡ Launching ${label}...`);
  const child = spawn(command, args, { stdio: 'inherit', shell: true });

  child.on('error', (err) => {
    console.error(`❌ ${label} process error:`, err);
  });

  child.on('exit', (code, signal) => {
    console.log(`⚠️ ${label} exited with code ${code} (Signal: ${signal})`);
  });

  return child;
}

async function main() {
  await runSetupStep('npm run prisma:generate');

  console.log('\n🔄 Syncing database schema...');
  await runSetupStep('npx prisma db push');

  await runSetupStep('npm run deploy');
  await runSetupStep('npm run commands:manifest');
  await runSetupStep('npm run dashboard:build');

  console.log('\n🎉 Setup complete. Starting bot and dashboard...');

  const botProcess = startService('npm', ['start'], 'Discord Bot');
  const dashboardProcess = startService('npm', ['run', 'dashboard:start'], 'Next.js Dashboard');

  const handleShutdown = () => {
    console.log('\n🛑 Stopping running services...');
    if (botProcess) botProcess.kill('SIGTERM');
    if (dashboardProcess) dashboardProcess.kill('SIGTERM');
    process.exit(0);
  };

  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);
}

main();
