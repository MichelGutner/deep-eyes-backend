import { CircularBuffer } from './circular-buffer.service';

export class BatchProcessor<T> {
  private isProcessing = false;
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly buffer: CircularBuffer<T>,
    private readonly config: BatchConfig,
    private readonly processor: (batches: T[][]) => Promise<void>,
  ) {
    this.startProcess();
  }

  async startProcess() {
    this.flushInterval = setInterval(() => {
      void this.processBatch();
    }, this.config.flushIntervalMs);
  }

  async processBatch(): Promise<T[][] | undefined> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const items = this.buffer.drain();
      if (items.length === 0) return;

      const chunks = this.chunkArray(items, this.config.maxBatchSize);

      await this.processor(chunks);
      return chunks;
    } finally {
      this.isProcessing = false;
    }
  }

  private chunkArray(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  async flush(): Promise<void> {
    await this.processBatch();
  }

  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }
}

export class BatchConfig {
  constructor(
    public readonly flushIntervalMs: number = 5000,
    public readonly maxBatchSize: number = 100,
    public readonly maxRetries: number = 3,
  ) {}
}
