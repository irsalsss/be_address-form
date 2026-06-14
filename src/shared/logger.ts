import pino from "pino";
import { env } from "./config/env.js";

const isDev = env.NODE_ENV === "development";

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.token",
      "*.secret",
      "*.apiKey",
    ],
    censor: "[REDACTED]",
  },
  ...(isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, singleLine: false },
        },
      }
    : {}),
});
