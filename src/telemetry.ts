import { initializeTelemetry } from './modules/tracing';

initializeTelemetry().catch((error) => {
  console.error('Failed to initialize OpenTelemetry:', error);
});

export { initializeTelemetry };
