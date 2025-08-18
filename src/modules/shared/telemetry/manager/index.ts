import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BaseExporter, ExportResult } from '../exporters/base.exporter';
import { KafkaExporter } from '../exporters/kafka.exporter';
import { LogEntity } from '@/modules/logs/domain';

@Injectable()
export class TelemetryManager implements OnModuleInit, OnModuleDestroy {
  private exporters: BaseExporter[] = [];
  private isShuttingDown = false;

  constructor() {
    this.initializeExporters();
  }

  private initializeExporters(): void {
    if (process.env.KAFKA_BROKERS) {
      this.exporters.push(
        new KafkaExporter({
          brokers: process.env.KAFKA_BROKERS.split(','),
          topic: process.env.KAFKA_TOPIC || 'telemetry-events',
          clientId: process.env.KAFKA_CLIENT_ID || 'telemetry-client-id',
        }),
      );
    }
  }

  async onModuleInit() {
    for (const exporter of this.exporters) {
      try {
        await exporter.connect();
      } catch (error) {
        console.error(
          `Failed to connect exporter ${exporter.constructor.name}:`,
          error,
        );
      }
    }
  }

  async onModuleDestroy() {
    for (const exporter of this.exporters) {
      try {
        await exporter.shutdown();
      } catch (error) {
        console.error(
          `Failed to disconnect exporter ${exporter.constructor.name}:`,
          error,
        );
      }
    }
  }
  private async exportToAll(
    exportFn: (exporter: BaseExporter) => Promise<ExportResult[]>,
  ) {
    for (const exporter of this.exporters) {
      try {
        await exportFn(exporter);
      } catch (error) {
        console.error(
          `Error exporting to ${exporter.constructor.name}:`,
          error,
        );
      }
    }
  }

  async emit(event: LogEntity): Promise<void> {
    if (this.isShuttingDown) {
      console.warn('TelemetryManager is shutting down, event dropped', event);
      return;
    }
    await this.exportToAll((exporter) => exporter.export([event]));
  }

  async emitBatch(events: LogEntity[]): Promise<void> {
    if (this.isShuttingDown || !events.length) return;
    await this.exportToAll((exporter) => exporter.export(events));
  }

  getExporters(): BaseExporter[] {
    return [...this.exporters];
  }
}
