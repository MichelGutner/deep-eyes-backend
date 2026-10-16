import './telemetry';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { TelemetryInterceptor } from './interceptors/telemetry.interceptor';
import { Kafka } from 'kafkajs';

const KAFKA_BROKERS = process.env.KAFKA_BROKERS
  ? process.env.KAFKA_BROKERS.split(',')
  : ['localhost:9092'];

const KAFKA_TOPICS = [
  process.env.KAFKA_TOPIC || 'logs',
  'telemetry-events',
];

async function ensureKafkaTopics() {
  const kafka = new Kafka({
    clientId: 'deep-eyes-admin',
    brokers: KAFKA_BROKERS,
  });
  const admin = kafka.admin();
  try {
    await admin.connect();
    const existing = await admin.listTopics();
    const toCreate = KAFKA_TOPICS
      .filter(t => !existing.includes(t))
      .map(topic => ({ topic, numPartitions: 1, replicationFactor: 1 }));
    if (toCreate.length > 0) {
      await admin.createTopics({ topics: toCreate, waitForLeaders: true });
      console.log(`✅ Kafka topics created: ${toCreate.map(t => t.topic).join(', ')}`);
    }
  } catch (err) {
    console.warn(`⚠️  Could not ensure Kafka topics (broker may not be ready): ${err.message}`);
  } finally {
    await admin.disconnect();
  }
}

async function bootstrap() {
  await ensureKafkaTopics();

  const app = await NestFactory.create(AppModule);

  app.enableCors({ origin: '*' });
  app.useGlobalInterceptors(new TelemetryInterceptor());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: KAFKA_BROKERS,
        clientId: process.env.KAFKA_CLIENT_ID || 'default-client-id',
        retry: { retries: 5, initialRetryTime: 1000 },
      },
      consumer: {
        groupId: process.env.KAFKA_GROUP_ID || 'default-group-id',
        allowAutoTopicCreation: true,
      },
    },
  });

  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
