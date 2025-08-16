import { Global, Module, Provider } from '@nestjs/common';
import { RetryPolice } from './services/retry-police.service';
import { ResilienceService } from './services/resilience.service';

const providers: Provider[] = [
  {
    provide: 'RetryPoliceService',
    useClass: RetryPolice,
  },
  {
    provide: 'ResilienceService',
    useClass: ResilienceService,
  },
];

@Global()
@Module({
  imports: [],
  exports: providers,
  providers: providers,
})
export class ResilienceModule {}
