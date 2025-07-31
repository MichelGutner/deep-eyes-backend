import { Observable } from 'rxjs';

export type KafkaServiceInterface = {
  publishEvent: <T>(event: { topic: string; body: any }) => Observable<T>;
};
