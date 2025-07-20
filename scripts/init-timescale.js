/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const { Client } = require('pg');

const prisma = new PrismaClient();
const client = new Client({ connectionString: process.env.DATABASE_URL });

const run = async () => {
  try {
    await client.connect();

    // 🧩 1. Enable TimescaleDB extension
    await client.query(`CREATE EXTENSION IF NOT EXISTS timescaledb;`);

    // 📊 2. Convert tables to hypertables
    await client.query(
      `SELECT create_hypertable('metrics', 'timestamp', if_not_exists => TRUE);`,
    );
    await client.query(
      `SELECT create_hypertable('traces', 'start_time', if_not_exists => TRUE);`,
    );

    await client.query(`
      ALTER TABLE metrics SET (
        timescaledb.compress,
        timescaledb.compress_segmentby = 'application_id'
      );
    `);

    // Enable compression for 'traces'
    await client.query(`
      ALTER TABLE traces SET (
        timescaledb.compress,
        timescaledb.compress_segmentby = 'application_id'
      );
    `);

    // 🗜️ 3. Add compression policies
    await client.query(
      `SELECT add_compression_policy('metrics', INTERVAL '30 days');`,
    );
    await client.query(
      `SELECT add_compression_policy('traces', INTERVAL '7 days');`,
    );

    // 🧹 4. Add retention policies
    await client.query(
      `SELECT add_retention_policy('metrics', INTERVAL '365 days');`,
    );
    await client.query(
      `SELECT add_retention_policy('traces', INTERVAL '30 days');`,
    );

    // 📈 6. Create continuous aggregates (materialized views)
    await client.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_hourly
      WITH (timescaledb.continuous) AS
      SELECT 
        time_bucket('1 hour', timestamp) AS bucket,
        "application_id",
        name,
        type,
        avg(value) AS avg_value,
        min(value) AS min_value,
        max(value) AS max_value,
        count(*) AS count
      FROM metrics
      GROUP BY bucket, "application_id", name, type;
    `);

    await client.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_daily
      WITH (timescaledb.continuous) AS
      SELECT 
        time_bucket('1 day', timestamp) AS bucket,
        "application_id",
        name,
        type,
        avg(value) AS avg_value,
        min(value) AS min_value,
        max(value) AS max_value,
        count(*) AS count
      FROM metrics
      GROUP BY bucket, "application_id", name, type;
    `);

    // 🔁 7. Add continuous aggregate policies
    await client.query(`
      SELECT add_continuous_aggregate_policy('metrics_hourly',
        start_offset => INTERVAL '3 hours',
        end_offset => INTERVAL '1 hour',
        schedule_interval => INTERVAL '1 hour');
    `);

    await client.query(`
      SELECT add_continuous_aggregate_policy('metrics_daily',
        start_offset => INTERVAL '3 days',
        end_offset => INTERVAL '1 day',
        schedule_interval => INTERVAL '1 day');
    `);

    console.log('📊 Your hypertables are ready:');
    console.log('   - metrics (timestamp)');
    console.log('   - traces (start_time)');
    console.log('');
    console.log('🔄 Continuous aggregates created:');
    console.log('   - metrics_hourly');
    console.log('');
    console.log('🗜️  Compression and retention policies configured');

    console.log('✅ TimescaleDB setup completed successfully.');
  } catch (e) {
    console.error('❌ TimescaleDB setup failed:', e);
    process.exit(1);
  } finally {
    await client.end();
    await prisma.$disconnect();
  }
};

void run();
