import { NodeSDK } from '@opentelemetry/sdk-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

const serviceName = 'deep-eyes-backend';

const otlpEndpoint = process.env.OTLP_ENDPOINT || 'http://localhost:4318';

const traceExporter = new OTLPTraceExporter({
  url: `${otlpEndpoint}/v1/traces`,
});

const metricExporter = new OTLPMetricExporter({
  url: `${otlpEndpoint}/v1/metrics`,
});

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
  }),
  traceExporter: traceExporter,
  metricReader: new PeriodicExportingMetricReader({
    exporter: metricExporter,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-kafkajs': {
        producerHook: (span, message) => {
          span.setAttribute('kafkajs.message.topic', message.topic);
          span.setAttribute(
            'kafkajs.message.partition',
            message.message.partition?.toString() || '0',
          );
          span.setAttribute(
            'kafkajs.message.timestamp',
            message.message.timestamp?.toString() || '',
          );
          span.setAttribute(
            'kafkajs.message.value',
            message.message.value?.toString() || '',
          );
        },
        consumerHook: (span, message) => {
          span.setAttribute('kafkajs.message.topic', message.topic);
        },
      },
    }),
  ],
});

const reset = '\x1b[0m';
const blue = '\x1b[34m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const red = '\x1b[31m';

export async function initializeTelemetry() {
  try {
    // Verifica se já foi inicializado
    if (sdk['_started']) {
      console.log(
        `${yellow}⚠️  OpenTelemetry já foi inicializado anteriormente.${reset}`,
      );
      return;
    }

    console.log(`${blue}🚀 Iniciando OpenTelemetry...${reset}`);
    sdk.start();
    console.log(`${green}✅ OpenTelemetry iniciado com sucesso! 🎉${reset}`);
  } catch (e) {
    console.error(`${red}❌ Erro ao iniciar o OpenTelemetry:${reset}`, e);
  }
}

export async function shutdownTelemetry() {
  try {
    await sdk.shutdown();
    console.log('Telemetry shutdown');
  } catch (e) {
    console.error(`${red}❌ Error shutting down telemetry`, e);
  }
}
