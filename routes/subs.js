const { initKtuvitManager } = require("../clients/ktuvit");
const { type } = require("../common/ktuvitEnums");
const logger = require("../common/logger");
const config = require("config");
const { distance } = require("fastest-levenshtein");

let ktuvit;
const LOCAL_SERVER_ENCODER_URL = "http://127.0.0.1:11470/subtitles.vtt?from=";

const initSubs = async () => {
  ktuvit = await initKtuvitManager();
};

const fetchSubsMiddleware = async (req, res, next) => {
  if (!req.title.ktuvitID) {
    next();
  }

  try {
    const ktuvitFetchedSubs = await fetchSubsFromKtuvit(req.title);
    req.ktuvitSubs = ktuvitFetchedSubs;
    next();
  } catch (err) {
    logger.error("Error occurred while fetching title subs from ktuvit: ", err);
    req.ktuvitSubs = [];
    next();
  }
};

const extractTitleInfo = async (req, res, next) => {
  const type = req.params.type;
  const [imdbID, season, episode] = deconstructImdbId(req.params.imdbId);
  const extraArgs = extractExtraArgs(req.params?.query);

  const ktuvitID = await ktuvit.getKtuvitID({
    type: type,
    imdbId: imdbID,
  });

  req.title = { type, imdbID, season, episode, ktuvitID, ...extraArgs };

  next();
};

const deconstructImdbId = (imdbParam) => {
  return imdbParam.split(":");
};

const extractExtraArgs = (query) => {
  if (!query) {
    return {};
  }
  const extraArgs = {};
  for (const arg of query.split("&")) {
    const [key, value] = arg.split("=");
    extraArgs[key] = value;
  }

  return extraArgs;
};

const fetchSubsFromKtuvit = async (title) => {
  switch (title.type) {
    case type.MOVIE:
      return await ktuvit.getSubsIDsListMovie(title.ktuvitID);
    case type.SERIES:
      return await ktuvit.getSubsIDsListEpisode(
        title.ktuvitID,
        title.season,
        title.episode
      );
    default:
      logger.info("Unknown type found", { type: title.type });
      return [];
  }
};

const formatSubs = (req, res) => {
  // Definition for a Stremio sub file can found here: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/responses/subtitles.md
  const stremioSubs = { subtitles: [] };

  for (const ktuvitSub of req.ktuvitSubs)
    stremioSubs.subtitles.push({
      // Sub's file name will serve as the ID as requested by users.
      id: ktuvitSub.subName,
      lang: "heb",
      url: config.get("enableLocalServerEncoding")
        ? LOCAL_SERVER_ENCODER_URL + formatSrtUrl(ktuvitSub.id)
        : formatSrtUrl(ktuvitSub.id),
    });

  sortSubsByFilename(stremioSubs);
  res.send(stremioSubs);
};

const formatSrtUrl = (ktuvitSubId) => {
  const PORT = config.get("PORT");
  const HTTP = config.get("ssl") ? "https" : "http";
  const HOSTNAME = config.get("HOSTNAME");

  const addonUrl = `${HTTP}://${HOSTNAME}:${PORT}`;
  const finalSrtRoute = `${addonUrl}/srt/${ktuvitSubId}`;

  return finalSrtRoute;
};

const sortSubsByFilename = (stremioSubsArray, titleFilename) => {
  if (!titleFilename) {
    logger.debug("No filename was found. Returning unsorted subtitles array.");
    return;
  }

  stremioSubsArray.sort((firstSub, secondSub) => {
    return (
      distance(titleFilename, firstSub.version) -
      distance(titleFilename, secondSub.version)
    );
  });
};
module.exports = {
  extractTitleInfo,
  fetchSubsMiddleware,
  formatSubs,
  initSubs,
};
