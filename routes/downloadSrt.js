const { initKtuvitManager } = require("../clients/ktuvit");
const logger = require("../common/logger");

let ktuvit;
const initSrtDownloader = async () => {
  ktuvit = await initKtuvitManager();
};

const downloadSrtFromKtuvit = (req, res) => {
  res.setHeader("Content-Type", "application/octet-stream; charset=utf-8");

  const titleKtuvitId = req.params?.ktuvitId;
  const subKtuvitId = req.params?.subId;

  const pipeFile = (fileBuffer) => {
    res.end(Buffer.from(fileBuffer));
  };

  try {
    ktuvit.downloadSubtitle(titleKtuvitId, subKtuvitId, pipeFile);
  } catch (err) {
    logger.error("Error downloading SRT file.", err, {
      ktuvitTitleID: titleKtuvitId,
      ktuvitSubID: subKtuvitId,
    });
    res.status(500).send("Could not fetch SRT file.");
  }
};

module.exports = { initSrtDownloader, downloadSrtFromKtuvit };
