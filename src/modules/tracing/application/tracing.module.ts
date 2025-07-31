import { Global, Module, Provider } from '@nestjs/common';
import { TracingService } from './tracing.service';

const tracingProvider: Provider = {
  provide: 'TracingService',
  useClass: TracingService,
};

@Global()
@Module({
  imports: [],
  providers: [tracingProvider],
  exports: [tracingProvider],
})
export class TracingModule {}
