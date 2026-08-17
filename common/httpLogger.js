const morgan = require("morgan");
const logger = require("./logger");

const HTTP_LOG_FORMAT =
  ":method :url :status :res[content-length] - :response-time ms";

const writeToLogger = (message) => logger.http(message.trim());

const httpLogger = morgan(HTTP_LOG_FORMAT, {
  stream: { write: writeToLogger },
});

module.exports = { httpLogger, writeToLogger };
