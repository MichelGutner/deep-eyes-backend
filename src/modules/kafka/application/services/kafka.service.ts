/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable, Inject } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { KafkaServiceInterface } from '../interfaces/kafka-service.interface';
import { LogContract } from '@/modules/logs/domain';
import { serializerObject } from '@/utils';

@Injectable()
export class KafkaService implements KafkaServiceInterface {
  constructor(
    @Inject(process.env.KAFKA_SERVICE) private readonly client: ClientKafka,
  ) {}

  publishEvent(event: { topic: string; body: LogContract }) {
    return this.client.emit(event.topic, {
      key: event.body.service.name,
      value: serializerObject(event.body),
    });
  }
}
