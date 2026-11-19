import "@/lib/shutdown";
import { initTelemetry } from "@/lib/telemetry";
import { logger } from "@/lib/logger";
import { createServer } from "http";
import next from "next";

initTelemetry();

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const port = parseInt(process.env.PORT ?? "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      await handle(req, res);
    } catch (err) {
      logger.error({ err, url: req.url }, "Error handling request");
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  }).listen(port, hostname, () => {
    logger.info(`> Ready on http://${hostname}:${port}`);
  });
});
