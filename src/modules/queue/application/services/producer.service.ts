import { Injectable, Inject } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';

const QUEUE_EVENT_TOPIC = process.env.KAFKA_QUEUE_TOPIC || 'queue_event';

@Injectable()
export class QueueProducerService {
  constructor(
    @Inject('KAFKA_SERVICE') private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit() {
    await this.kafkaClient.connect();
  }

  send(message: any) {
    this.kafkaClient
      .emit(
        QUEUE_EVENT_TOPIC,
        new EventPayload(message.key || 'default-key', message.value || {}),
      )
      .subscribe({
        next: () => console.log('Message sent successfully'),
        error: (err) => console.error('Error sending message:', err),
      });
  }
}

export class EventPayload {
  constructor(
    public readonly key: string,
    public readonly value: any,
  ) {}
  toJSON() {
    return {
      key: this.key,
      value: this.value,
    };
  }
}
