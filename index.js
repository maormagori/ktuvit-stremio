require("dotenv").config();
const logger = require("./common/logger");
const { httpLogger } = require("./common/httpLogger");
const config = require("config");
const express = require("express");
const cors = require("cors");
const { serveManifest } = require("./routes/manifest");
const landing = require("./routes/landing/landing");
const { ensureKtuvitReady } = require("./clients/ktuvit");
const {
  extractTitleInfo,
  fetchSubsMiddleware,
  formatSubs,
} = require("./routes/subs");
const { downloadSrtFromKtuvit } = require("./routes/downloadSrt");

const PORT = config.get("PORT");
const HTTP = config.get("ssl") ? "https" : "http";
const HOSTNAME = config.get("HOSTNAME");

const addon = express();
addon.use(cors());
addon.use(httpLogger);

const respondWithHeaders = function (req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Content-Type", "application/json");
  next();
};

addon.get("/manifest.json", [respondWithHeaders, serveManifest]);

addon.get("/", landing);

//Addon's readme request
addon.get("/README.md", (req, res) => {
  res.sendFile(`${__dirname}/README.md`);
});

addon.get("/subtitles/:type/:imdbId/:query?.json", [
  respondWithHeaders,
  ensureKtuvitReady,
  extractTitleInfo,
  fetchSubsMiddleware,
  formatSubs,
]);

addon.get("/srt/:ktuvitId/:subId?.srt", [
  ensureKtuvitReady,
  downloadSrtFromKtuvit,
]);

const server = addon.listen(PORT, function () {
  logger.info(`Started addon on: ${HTTP}://${HOSTNAME}:${PORT}`);
});

module.exports = { addon, server };
