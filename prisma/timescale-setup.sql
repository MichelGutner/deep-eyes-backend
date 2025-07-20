-- TimescaleDB Setup Script
-- Run this after Prisma migration to convert tables to hypertables

-- Enable TimescaleDB extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Convert metrics table to hypertable
SELECT create_hypertable('metrics', 'timestamp', if_not_exists => TRUE);

-- Convert traces table to hypertable
SELECT create_hypertable('traces', 'startTime', if_not_exists => TRUE);

-- Create compression policies for automatic data retention
-- Compress metrics older than 30 days
SELECT add_compression_policy('metrics', INTERVAL '30 days');

-- Compress traces older than 7 days
SELECT add_compression_policy('traces', INTERVAL '7 days');

-- Create retention policies (optional - adjust as needed)
-- Delete metrics older than 365 days
SELECT add_retention_policy('metrics', INTERVAL '365 days');

-- Delete traces older than 30 days
SELECT add_retention_policy('traces', INTERVAL '30 days');

-- Create continuous aggregates for common queries (optional)
-- Hourly metrics aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_hourly
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 hour', timestamp) AS bucket,
    applicationId,
    name,
    type,
    avg(value) as avg_value,
    min(value) as min_value,
    max(value) as max_value,
    count(*) as count
FROM metrics
GROUP BY bucket, applicationId, name, type;

-- Daily metrics aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_daily
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 day', timestamp) AS bucket,
    applicationId,
    name,
    type,
    avg(value) as avg_value,
    min(value) as min_value,
    max(value) as max_value,
    count(*) as count
FROM metrics
GROUP BY bucket, applicationId, name, type;

SELECT add_continuous_aggregate_policy('metrics_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');

SELECT add_continuous_aggregate_policy('metrics_daily',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day'); 