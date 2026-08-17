const morgan = require("morgan");
const logger = require("./logger");

// Only request metadata and the response's status/size are formatted here.
// Response bodies are never logged, which matters most for the /srt/ route:
// we want a record that a subtitle was requested and whether serving it
// succeeded, not the contents of the subtitle file itself.
// Client IPs and user agents are left out as well since they add nothing to a
// subtitle request but would follow the logs into a future transporter.
const HTTP_LOG_FORMAT =
  ":method :url :status :res[content-length] - :response-time ms";

// Morgan terminates every line with a newline of its own, and winston adds one
// when it writes to a transport.
const writeToLogger = (message) => logger.http(message.trim());

const httpLogger = morgan(HTTP_LOG_FORMAT, {
  stream: { write: writeToLogger },
});

module.exports = { httpLogger, HTTP_LOG_FORMAT, writeToLogger };
