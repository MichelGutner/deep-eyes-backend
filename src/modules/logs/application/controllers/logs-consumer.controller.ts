import { Controller, Inject } from '@nestjs/common';
import { LogEntity } from '../../domain';
import {
  Ctx,
  KafkaContext,
  MessagePattern,
  Payload,
} from '@nestjs/microservices';
import { ESServiceInterface } from '@/modules/elasticsearch';
import { Logger } from '@/logger/application';

@Controller('logs-consumer')
export class LogsConsumerController {
  constructor(
    @Inject('ESService')
    private readonly esService: ESServiceInterface,
    @Inject('Logger')
    private readonly logger: Logger,
  ) {}

  @MessagePattern(process.env.KAFKA_TOPIC || 'logs')
  async consumeLogEvents(
    @Payload() data: LogEntity,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    const topic = context.getTopic();
    const partition = context.getPartition();
    const { offset, key, value } = context.getMessage();

    try {
      const document: LogEntity =
        typeof value === 'string' ? JSON.parse(value) : value;
      const result = await this.esService.indexDocument<LogEntity>(
        'logs-test-development', // replace with entity name from document
        document,
      );

      this.logger.debug(`✅ Indexed log in Elasticsearch: ${result._id}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to index log | topic=${topic} partition=${partition} offset=${offset}`,
        error.stack || error,
      );
    }
  }
}
