import { Injectable, Inject } from '@nestjs/common';
import {
  ClientKafka,
  Ctx,
  EventPattern,
  KafkaContext,
  Payload,
} from '@nestjs/microservices';

const QUEUE_EVENT_TOPIC = process.env.KAFKA_QUEUE_TOPIC || 'queue_event';

@Injectable()
export class QueueConsumerService {
  constructor(
    @Inject('KAFKA_SERVICE') private readonly kafkaClient: ClientKafka,
  ) {}

  @EventPattern(QUEUE_EVENT_TOPIC) // <- topic dos logs no Kafka
  async handleLogEvent(@Payload() data: any, @Ctx() context: KafkaContext) {
    const topic = context.getTopic();
    const message = context.getMessage();

    const logPayload = {
      timestamp: new Date().toISOString(),
      topic,
      partition: context.getPartition(),
      offset: message.offset,
      value: data,
    };

    console.log('Log recebido do Kafka:', logPayload);
  }
}
