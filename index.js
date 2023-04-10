const logger = require("./common/logger");
const express = require("express");
let cors = require("cors");

const addon = express();
addon.use(cors);

addon.listen(3000, function () {
  logger.info("Started server on default values.");
});
