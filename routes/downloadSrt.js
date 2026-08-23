const { initKtuvitManager } = require("../clients/ktuvit");
const config = require("config");
const logger = require("../common/logger");

const DETECTION_BYTES = config.get("bytesNeededForDetection");

// Ktuvit sometimes returns an error message (e.g. an expired download
// identifier) with a 200 status instead of actual subtitle content. Requiring
// a timestamp line catches that case regardless of the exact wording.
const SRT_TIMESTAMP_PATTERN =
  /\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/;

let ktuvit;
const initSrtDownloader = async () => {
  ktuvit = await initKtuvitManager();
  logger.info("Done initializing srt downloader.");
};

const downloadSrtFromKtuvit = (req, res) => {
  const titleKtuvitId = req.params?.ktuvitId;
  const subKtuvitId = req.params?.subId;

  const respondWithError = (err, description) => {
    logger.error(err || new Error(description), {
      ktuvitTitleID: titleKtuvitId,
      ktuvitSubID: subKtuvitId,
      description,
    });
    // Never let a failed fetch be cached (by Cloudflare or anyone else) as if
    // it were a valid subtitle file.
    res.setHeader("Cache-Control", "no-store");
    res.status(502).send("Could not fetch SRT file.");
  };

  const pipeFile = (fileContent, err) => {
    if (err || !SRT_TIMESTAMP_PATTERN.test(fileContent || "")) {
      respondWithError(err, "Ktuvit did not return a valid SRT file.");
      return;
    }

    logger.debug("Serving SRT file.", {
      ktuvitTitleID: titleKtuvitId,
      ktuvitSubID: subKtuvitId,
      bytes: Buffer.byteLength(fileContent),
    });

    res.setHeader("Content-Type", "application/x-subrip; charset=utf-8");
    res.end(Buffer.from(fileContent));
  };

  logger.info("Requesting subtitle download from Ktuvit.", {
    ktuvitTitleID: titleKtuvitId,
    ktuvitSubID: subKtuvitId,
    bytesAmountForDetection: DETECTION_BYTES,
  });

  ktuvit
    .downloadSubtitle(titleKtuvitId, subKtuvitId, pipeFile, {
      bytesAmountForDetection: DETECTION_BYTES,
    })
    .catch((err) => respondWithError(err, "Error downloading SRT file."));
};

module.exports = { initSrtDownloader, downloadSrtFromKtuvit };
