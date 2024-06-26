const { initKtuvitManager } = require("../clients/ktuvit");
const { type } = require("../common/ktuvitEnums");
const logger = require("../common/logger");
const config = require("config");
const { distance } = require("fastest-levenshtein");

let ktuvit;

const LOCAL_SERVER_ENCODER_URL = "http://127.0.0.1:11470/subtitles.vtt?from=";
const imdbIDRegex = /^tt\d{7,9}$/;

const initSubs = async () => {
  ktuvit = await initKtuvitManager();
  logger.info("Done initializing subs.");
};

const exitEarlyWithEmptySubtitlesArray = (res) => {
  res.send({ subtitles: [] });
};

const fetchSubsMiddleware = async (req, res, next) => {
  try {
    const ktuvitFetchedSubs = await fetchSubsFromKtuvit(req.title);
    req.ktuvitSubs = ktuvitFetchedSubs;
    next();
  } catch (err) {
    logger.error(err, {
      description: "Error occurred while fetching title subs from ktuvit",
      title: JSON.stringify(req.title || {}),
    });
    req.ktuvitSubs = [];
    next();
  }
};

const extractTitleInfo = async (req, res, next) => {
  const type = req.params.type;
  const [imdbID, season, episode] = deconstructImdbId(req.params.imdbId);

  if (!imdbIDRegex.test(imdbID)) {
    logger.info("Invalid imdb ID", { imdbID });
    exitEarlyWithEmptySubtitlesArray(res);
    return;
  }

  const extraArgs = extractExtraArgs(req.params?.query);

  try {
    const ktuvitID = await ktuvit.getKtuvitID({
      type: type,
      imdbId: imdbID,
    });

    if (!ktuvitID) {
      exitEarlyWithEmptySubtitlesArray(res);
    } else {
      req.title = { type, imdbID, season, episode, ktuvitID, ...extraArgs };
      next();
    }
  } catch (err) {
    logger.error(err, {
      type,
      imdbID,
      season,
      episode,
      extraArgs,
      description: "Unable to get title's ktuvit ID",
    });
    exitEarlyWithEmptySubtitlesArray(res);
  }
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
      return ktuvit.getSubsIDsListMovie(title.ktuvitID);
    case type.SERIES:
      return ktuvit.getSubsIDsListEpisode(
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

  for (const ktuvitSub of req.ktuvitSubs) {
    stremioSubs.subtitles.push({
      // Sub's file name will serve as the ID as requested by users.
      id: `[KTUVIT]${ktuvitSub.subName}`,
      lang: "heb",
      url: config.get("enableLocalServerEncoding")
        ? LOCAL_SERVER_ENCODER_URL + formatSrtUrl(ktuvitSub.id)
        : formatSrtUrl(req.title.ktuvitID, ktuvitSub.id),
    });
  }

  sortSubsByFilename(stremioSubs, req?.title?.filename);
  res.send(stremioSubs);
};

const formatSrtUrl = (ktuvitTitleId, ktuvitSubId) => {
  const PORT = config.get("PORT");
  const HTTP = config.get("ssl") ? "https" : "http";
  const HOSTNAME = config.get("HOSTNAME");

  // Production deployment is behind a proxy so I remove the useless port.
  const PRODUCTION = config.util.getEnv("NODE_ENV") === "production";
  const addonUrl = `${HTTP}://${HOSTNAME}${PRODUCTION ? "" : `:${PORT}`}`;

  const finalSrtRoute = `${addonUrl}/srt/${ktuvitTitleId}/${ktuvitSubId}.srt`;

  return finalSrtRoute;
};

const sortSubsByFilename = (stremioSubsArray, titleFilename) => {
  if (!titleFilename) {
    logger.debug("No filename was found. Returning unsorted subtitles array.");
    return;
  }

  stremioSubsArray.subtitles.sort((firstSub, secondSub) => {
    return (
      distance(titleFilename, firstSub.id.replace("[KTUVIT]", "")) -
      distance(titleFilename, secondSub.id.replace("[KTUVIT]", ""))
    );
  });
};

module.exports = {
  extractTitleInfo,
  fetchSubsMiddleware,
  formatSubs,
  initSubs,
};
