import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import kafkaConfig from './modules/queue/kafka.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: '*', // or '*' to allow all (not recommended in production)
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Start Kafka microservice for consumers
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: kafkaConfig.brokers,
        clientId: kafkaConfig.clientId,
      },
      consumer: {
        groupId: kafkaConfig.groupId,
      },
    },
  });

  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
