const { createLogger, format, transports } = require("winston");

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

// Suspicious of this causing a "max file size exceeded" error
// so I'm disabling local logs on prod until remote logging feature is implemented

// if (config.util.getEnv("NODE_ENV") !== "development")
// logger.add(
//   new transports.File({ filename: "ktuvit.log", format: format.json() })
// );

module.exports = logger;
