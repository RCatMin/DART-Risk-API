import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino(
  isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" },
        },
      },
);
