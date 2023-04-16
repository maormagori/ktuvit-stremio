const assert = require("assert");
const {
  extractTitleInfo,
  fetchSubsMiddleware,
  formatSubs,
  initSubs,
} = require("../../../routes/subs");
const { type } = require("../../../common/ktuvitEnums");

const mockRequests = {
  pulpFiction: {
    params: {
      type: type.MOVIE,
      imdbId: "tt0110912",
      query:
        "videoHash=fe4032afd8b70beb&videoSize=1567260672&filename=Pulp.Fiction.1994.1080p.BluRay.H264.AAC-LAMA.mkv.json",
    },
  },
};

describe("Subs route", function () {
  before(async function () {
    await initSubs();
  });

  it("should extract title info with correct ktuvit ID", async function () {});
});
