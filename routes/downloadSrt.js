const { initKtuvitManager } = require("../clients/ktuvit");

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

  ktuvit.downloadSubtitle(titleKtuvitId, subKtuvitId, pipeFile);
};

module.exports = { initSrtDownloader, downloadSrtFromKtuvit };
