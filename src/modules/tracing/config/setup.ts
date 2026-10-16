import { NodeSDK } from '@opentelemetry/sdk-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'deep-eyes-backend',
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-kafkajs': {
        producerHook: (span, message) => {
          span.setAttribute('kafkajs.message.topic', message.topic);
        },
        consumerHook: (span, message) => {
          span.setAttribute('kafkajs.message.topic', message.topic);
        },
      },
    }),
  ],
});

export async function initializeTelemetry() {
  try {
    sdk.start();
    console.log('✅ OpenTelemetry iniciado com sucesso!');
  } catch (e) {
    console.error('❌ Erro ao iniciar o OpenTelemetry:', e);
  }
}

export async function shutdownTelemetry() {
  try {
    await sdk.shutdown();
  } catch (e) {
    console.error('❌ Error shutting down telemetry', e);
  }
}
