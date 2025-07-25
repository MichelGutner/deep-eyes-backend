import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { QueueController } from './controllers/queue.controller';
import { QueueProducerService } from './services/producer.service';
import { QueueConsumerService } from './services/consumer.service';
import kafkaConfig from '../kafka.config';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'KAFKA_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: kafkaConfig.clientId,
            brokers: kafkaConfig.brokers,
          },
          consumer: {
            groupId: kafkaConfig.groupId,
          },
        },
      },
    ]),
  ],
  controllers: [QueueController],
  providers: [QueueProducerService, QueueConsumerService],
  exports: [QueueProducerService, QueueConsumerService],
})
export class QueueModule {}
