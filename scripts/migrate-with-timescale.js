/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync, execFile } = require('child_process');

function setupTimescaleDB() {
  console.log('🚀 Setting up TimescaleDB with Prisma...');

  try {
    // Step 1: Run Prisma migration
    console.log('📦 Running Prisma migration...');
    execSync('npx prisma migrate dev --name init', { stdio: 'inherit' });

    // Step 2: Generate Prisma client
    console.log('🔧 Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit' });

    console.log('🎉 TimescaleDB setup completed successfully!');

    execFile('node', ['scripts/init-timescale.js'], (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ Error executing script: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`⚠️  Script stderr: ${stderr}`);
      }
      console.log(`✅ Script output: ${stdout}`);
    });
  } catch (error) {
    console.error('❌ Error during setup:', error.message);
    process.exit(1);
  }
}

void setupTimescaleDB();
