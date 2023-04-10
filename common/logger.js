const { createLogger, format, transports } = require("winston");
const config = require("config");

const customFormat = format.printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level}]: ${message}`;
});

const logger = createLogger({
  level: "info",
  format: format.combine(
    format.timestamp({
      format: "DD-MM-YYYY HH:mm:ss",
    }),
    format.errors({ stack: true }),
    format.splat()
  ),
  transports: [
    new transports.Console({
      format: format.combine(format.colorize(), customFormat),
    }),
  ],
});

if (config.util.getEnv("NODE_ENV") !== "development")
  logger.add(
    new transports.File({ filename: "ktuvit.log", format: format.json() })
  );

module.exports = logger;
