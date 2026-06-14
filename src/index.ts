import { buildApp } from "./app.js";
import { env } from "./shared/config/env.js";
import { logger } from "./shared/logger.js";

async function main() {
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "shutdown signal received");
    try {
      await app.close();
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "error during shutdown");
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  try {
    await app.listen({ host: env.HOST, port: env.PORT });
  } catch (err) {
    logger.error({ err }, "failed to start");
    process.exit(1);
  }
}

void main();
