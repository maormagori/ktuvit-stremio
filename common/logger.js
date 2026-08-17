const { createLogger, format, transports } = require("winston");
const config = require("config");

const customFormat = format.printf((info) => {
  const { level, message, timestamp, stack, ...meta } = info;
  const metaString = Object.keys(meta).length ? JSON.stringify(meta) : "";
  return `${timestamp} [${level}]: ${stack || message} ${metaString}`;
});

const logger = createLogger({
  level: config.get("logLevel"),
  format: format.combine(
    format.timestamp({
      format: "DD-MM-YYYY HH:mm:ss",
    }),
    format.errors({ stack: true }),
    format.splat()
  ),
  transports: [
    new transports.Console({
      format: customFormat,
    }),
  ],
});

module.exports = logger;
