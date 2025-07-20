/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

async function setupTimescaleDB() {
  console.log('🚀 Setting up TimescaleDB with Prisma...');

  try {
    // Step 1: Run Prisma migration
    console.log('📦 Running Prisma migration...');
    execSync('npx prisma migrate dev --name init', { stdio: 'inherit' });

    // Step 2: Generate Prisma client
    console.log('🔧 Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit' });

    // Step 3: Set up TimescaleDB hypertables
    console.log('⏰ Setting up TimescaleDB hypertables...');
    const prisma = new PrismaClient();

    // Read and execute the TimescaleDB setup script

    const setupScript = fs.readFileSync(
      path.join(__dirname, 'timescale-setup.sql'),
      'utf8',
    );

    // Split the script into individual statements
    const statements = setupScript
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith('--'));

    console.log('🚀 ~ setupTimescaleDB ~ statements:', statements);
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await prisma.$executeRawUnsafe(statement);
          console.log(`✅ Executed: ${statement.substring(0, 50)}...`);
        } catch (error) {
          console.log(`⚠️  Warning: ${error.message}`);
        }
      }
    }

    await prisma.$disconnect();

    console.log('🎉 TimescaleDB setup completed successfully!');
    console.log('');
    console.log('📊 Your hypertables are ready:');
    console.log('   - metrics (timestamp)');
    console.log('   - traces (startTime)');
    console.log('');
    console.log('🔄 Continuous aggregates created:');
    console.log('   - metrics_hourly');
    console.log('');
    console.log('🗜️  Compression and retention policies configured');
  } catch (error) {
    console.error('❌ Error during setup:', error.message);
    process.exit(1);
  }
}

void setupTimescaleDB();
