import './telemetry';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { TelemetryInterceptor } from './interceptors/telemetry.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: '*', // or '*' to allow all (not recommended in production)
  });

  app.useGlobalInterceptors(new TelemetryInterceptor());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Start Kafka microservice for consumers
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: process.env.KAFKA_BROKERS
          ? process.env.KAFKA_BROKERS.split(',')
          : ['localhost:9092'],
        clientId: process.env.KAFKA_CLIENT_ID || 'default-client-id',
      },
      consumer: {
        groupId: process.env.KAFKA_GROUP_ID || 'default-group-id',
      },
    },
  });

  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
