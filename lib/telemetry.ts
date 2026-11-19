import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { logger } from "@/lib/logger";

const prometheusExporter = new PrometheusExporter(
  { port: parseInt(process.env.OTEL_PROMETHEUS_PORT ?? "9464", 10) },
  () =>
    logger.info(
      { port: process.env.OTEL_PROMETHEUS_PORT ?? "9464" },
      "Prometheus metrics server started",
    ),
);

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]: "web-absensi-bimbel-backend",
    [SemanticResourceAttributes.SERVICE_VERSION]:
      process.env.npm_package_version ?? "0.1.0",
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
      process.env.NODE_ENV ?? "development",
  }),
  instrumentations: [getNodeAutoInstrumentations()],
  metricReaders: [prometheusExporter],
});

export function initTelemetry() {
  if (process.env.OTEL_ENABLED !== "true") {
    logger.info("OpenTelemetry disabled (set OTEL_ENABLED=true to enable)");
    return;
  }

  try {
    sdk.start();
    logger.info("OpenTelemetry initialized");

    process.on("SIGTERM", async () => {
      await sdk.shutdown();
      logger.info("OpenTelemetry shutdown completed");
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to initialize OpenTelemetry");
  }
}
