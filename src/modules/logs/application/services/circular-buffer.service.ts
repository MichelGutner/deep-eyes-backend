import { ILog } from "@/modules/shared/telemetry/domain/log.interface";
import { LogLevel } from "@/types/logs";

export interface SamplingConfig {
  enabled: boolean;
  rate: number;
}

export class CircularBuffer<T> {
  private buffer: (T | null)[];
  private head = 0;
  private tail = 0;
  private count = 0;

  private sampledCount = 0;
  private droppedCount = 0;

  constructor(
    private readonly capacity: number,
  ) {
    this.buffer = new Array<T | null>(capacity).fill(null);
  }

  push(item: T): void {
    if (this.shouldSample(item as ILog)) {
      this.buffer[this.tail] = item;
      this.tail = (this.tail + 1) % this.capacity;

      if (this.count < this.capacity) {
        this.count++;
      } else {
        this.head = (this.head + 1) % this.capacity;
      }
    }
  }

  private shouldSample(item: ILog): boolean {
    if (!item?.request?.samplingPolicies) return true;
    const policies = item.request.samplingPolicies;
    const rate = policies[item.level?.toLocaleLowerCase() as LogLevel]

    const accepted = Math.random() < rate;
    if (accepted) this.sampledCount++;
    else this.droppedCount++;

    // debug and error must be keeped in collector

    // Exibe a cada 100 eventos
    if ((this.sampledCount + this.droppedCount) % 100 === 0) {
      const percent =
        (this.sampledCount / (this.sampledCount + this.droppedCount)) * 100;
      console.log(
        `[Sampling Stats] Sampled: ${this.sampledCount}, Dropped: ${this.droppedCount}, Effective Rate: ${percent.toFixed(2)}%`,
      );
    }

    return accepted;
  }

  drain(): T[] {
    const items: T[] = [];
    while (this.count > 0) {
      const item = this.buffer[this.head];
      if (item !== null) {
        items.push(item);
      }
      this.head = (this.head + 1) % this.capacity;
      this.count--;
    }
    return items;
  }

  size(): number {
    return this.buffer.length;
  }
}