const assert = require("assert");
const sinon = require("sinon");
const { formatSubs } = require("../../../routes/subs");

const LOCAL_SERVER_PREFIX = "http://127.0.0.1:11470/subtitles.vtt?from=";

describe("formatSubs", function () {
  let res;

  beforeEach(function () {
    res = { send: sinon.spy() };
  });

  it("should return a direct /srt/ URL, not the local server proxy", function () {
    const req = {
      ktuvitSubs: [{ id: "SUB123", subName: "My.Subtitle.srt" }],
      title: { ktuvitID: "TITLE456" },
    };

    formatSubs(req, res);

    const { subtitles } = res.send.firstCall.args[0];
    assert.ok(
      subtitles[0].url.includes("/srt/TITLE456/SUB123.srt"),
      `Expected URL to contain /srt/TITLE456/SUB123.srt, got: ${subtitles[0].url}`
    );
    assert.ok(
      !subtitles[0].url.startsWith(LOCAL_SERVER_PREFIX),
      `Expected URL not to start with local server proxy prefix, got: ${subtitles[0].url}`
    );
  });

  it("should set correct subtitle id and lang", function () {
    const req = {
      ktuvitSubs: [{ id: "SUB123", subName: "My.Subtitle.srt" }],
      title: { ktuvitID: "TITLE456" },
    };

    formatSubs(req, res);

    const { subtitles } = res.send.firstCall.args[0];
    assert.strictEqual(subtitles[0].id, "[KTUVIT]My.Subtitle.srt");
    assert.strictEqual(subtitles[0].lang, "heb");
  });

  it("should return an empty subtitles array when no subs are found", function () {
    const req = {
      ktuvitSubs: [],
      title: { ktuvitID: "TITLE456" },
    };

    formatSubs(req, res);

    const { subtitles } = res.send.firstCall.args[0];
    assert.deepStrictEqual(subtitles, []);
  });
});

describe("fetchSubsMiddleware", function () {
  const proxyquire = require("proxyquire").noCallThru();

  const SUBS = [{ id: "SUB1", subName: "Freies.Land.2019.DVDRIP.avi.srt" }];

  const titleFor = (filename) => ({
    type: "movie",
    imdbID: "tt9407490",
    season: undefined,
    episode: undefined,
    ktuvitID: "KT9407490",
    filename,
  });

  let fetchSubsMiddleware;
  let getSubsIDsListMovie;

  beforeEach(async function () {
    getSubsIDsListMovie = sinon.stub().callsFake(async () => [...SUBS]);

    const subs = proxyquire("../../../routes/subs", {
      "../clients/ktuvit": {
        initKtuvitManager: async () => ({ getSubsIDsListMovie }),
      },
      "../common/logger": {
        debug: sinon.spy(),
        info: sinon.spy(),
        error: sinon.spy(),
      },
      "../common/subsCache": proxyquire("../../../common/subsCache", {
        config: {
          get: (key) =>
            ({
              "subsCache.maxEntries": 500,
              "subsCache.foundTtlMs": 60000,
              "subsCache.emptyTtlMs": 5000,
            }[key]),
        },
        "./logger": {
          debug: sinon.spy(),
          info: sinon.spy(),
          error: sinon.spy(),
        },
      }),
    });

    ({ fetchSubsMiddleware } = subs);
    await subs.initSubs();
  });

  const callWith = async (filename) => {
    const req = { title: titleFor(filename) };
    await fetchSubsMiddleware(req, { send: sinon.spy() }, () => {});
    return req;
  };

  it("should ask Ktuvit once for two viewers watching different releases", async function () {
    await callWith("Freies.Land.2019.D.BDRip.1.46Gb.MegaPeer.avi");
    await callWith("Freies.Land.2019.DVDRIP.MegaPeer.avi");

    assert.strictEqual(
      getSubsIDsListMovie.callCount,
      1,
      "The second viewer should have been served from the cache"
    );
  });

  it("should still put the subs on the request when they come from the cache", async function () {
    await callWith("Freies.Land.2019.D.BDRip.avi");
    const second = await callWith("Freies.Land.2019.DVDRIP.avi");

    assert.deepStrictEqual(second.ktuvitSubs, SUBS);
  });

  it("should fall back to an empty list when Ktuvit fails, without caching it", async function () {
    getSubsIDsListMovie.onFirstCall().rejects(new Error("ktuvit is down"));

    const failed = await callWith("Freies.Land.2019.D.BDRip.avi");
    assert.deepStrictEqual(failed.ktuvitSubs, []);

    const retried = await callWith("Freies.Land.2019.DVDRIP.avi");
    assert.deepStrictEqual(retried.ktuvitSubs, SUBS);
    assert.strictEqual(
      getSubsIDsListMovie.callCount,
      2,
      "A failure must not be cached as this title's subtitles"
    );
  });
});
