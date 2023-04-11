require("dotenv").config();
const logger = require("./common/logger");
const config = require("config");
const express = require("express");
const cors = require("cors");
const { serveManifest } = require("./routes/manifest");
const landing = require("./routes/landing/landing");
const { initKtuvitManager } = require("./clients/ktuvit");
const {
  extractTitleInfo,
  fetchSubsMiddleware,
  formatSubs,
  initSubs,
} = require("./routes/subs");

const PORT = config.get("PORT");
const HTTP = config.get("ssl") ? "https" : "http";
const HOSTNAME = config.get("HOSTNAME");

const addon = express();
addon.use(cors());

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
  extractTitleInfo,
  fetchSubsMiddleware,
  formatSubs,
]);

async function init() {
  logger.info("Starting initialization.");
  try {
    await initKtuvitManager();
    await initSubs();
    addon.listen(PORT, function () {
      logger.info(`Started addon on: ${HTTP}://${HOSTNAME}:${PORT}`);
    });
  } catch (err) {
    logger.error("Failed starting the addon.", err);
  }
}

init();
