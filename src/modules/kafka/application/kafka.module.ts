import { Global, Inject, Module, OnModuleInit, Provider } from '@nestjs/common';
import { ClientKafka, ClientsModule, Transport } from '@nestjs/microservices';
import { KafkaService } from './services/kafka.service';
import { kafkaConfig } from '../kafka.config';

const kafkaServiceProvider: Provider = {
  provide: 'KafkaService',
  useClass: KafkaService,
};

@Global()
@Module({
  imports: [
    ClientsModule.register([
      {
        name: process.env.KAFKA_SERVICE || 'KAFKA_SERVICE',
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
  controllers: [],
  providers: [kafkaServiceProvider],
  exports: [kafkaServiceProvider],
})
export class KafkaModule implements OnModuleInit {
  constructor(
    @Inject(process.env.KAFKA_SERVICE) private readonly client: ClientKafka,
  ) {}
  async onModuleInit() {
    await this.client.connect();
  }

  async onModuleDestroy() {
    await this.client.close();
  }
}
