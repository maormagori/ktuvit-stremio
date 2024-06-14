const { createLogger, format, transports } = require("winston");

const customFormat = format.printf((info) => {
  const { level, message, timestamp, stack, ...meta } = info;
  const metaString = JSON.stringify(meta);
  return `${timestamp} [${level}]: ${stack || message} ${metaString}`;
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
      format: customFormat,
    }),
  ],
});

module.exports = logger;
