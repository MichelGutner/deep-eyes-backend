import { Kafka, KafkaConfig, Producer, ProducerRecord } from 'kafkajs';
import { BaseExporter, ExportResult } from './base.exporter';
import { LogEntity } from '@/modules/logs/domain';

export interface KafkaExporterConfig extends KafkaConfig {
  topic: string;
}

export class KafkaExporter extends BaseExporter {
  private producer: Producer;
  private isConnected = false;

  constructor(private readonly kafkaConfig: KafkaExporterConfig) {
    super(kafkaConfig);

    const kafka = new Kafka({
      ...kafkaConfig,
      clientId: kafkaConfig.clientId || 'telemetry-kafka-exporter',
    });

    this.producer = kafka.producer();
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.producer.connect();
      this.isConnected = true;
    }
  }

  async export(events: LogEntity[]): Promise<ExportResult[]> {
    if (!events.length) return Promise.resolve([]);

    try {
      await this.ensureConnected();

      const messages = events
        .filter((event) => this.shouldProcess(event))
        .map((event) => ({
          key: event.id,
          value: LogEntity.serialize(event),
          headers: {
            traceparent: `00-${event.trace?.traceId}-10`,
          },
        }));

      const record: ProducerRecord = {
        topic: this.kafkaConfig.topic,
        messages,
      };

      await this.producer.send(record);
      return events.map(() => ({ success: true }));
    } catch (error) {
      console.error('Kafka exporter error', error);

      return events.map(() => ({
        success: false,
        error: error as Error,
        retryable: this.isRetryableError(error),
      }));
    }
  }

  private isRetryableError(error: Error): boolean {
    const retryableErrors = [
      'KafkaJSNumberOfRetriesExceeded',
      'KafkaJSConnectionError',
      'KafkaJSNonRetriableError',
    ];

    return !retryableErrors.some((e) => error.name.includes(e));
  }

  private async ensureConnected(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }
  }

  async shutdown(): Promise<void> {
    if (this.isConnected) {
      await this.producer.disconnect();
      this.isConnected = false;
    }
  }
}
