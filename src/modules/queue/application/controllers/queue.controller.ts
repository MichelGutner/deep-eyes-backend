import { Body, Controller, Post } from '@nestjs/common';
import { QueueProducerService } from '../services/producer.service';
import { QueueConsumerService } from '../services/consumer.service';
import {
  EventPattern,
  Payload,
  Ctx,
  KafkaContext,
} from '@nestjs/microservices';

const QUEUE_EVENT_TOPIC = process.env.KAFKA_QUEUE_TOPIC || 'queue_event';

@Controller('queue')
export class QueueController {
  constructor(
    private readonly producerService: QueueProducerService,
    private readonly consumer: QueueConsumerService,
  ) {}

  @Post()
  sendMessage(@Body() message: any) {
    this.producerService.send(message);
  }

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
