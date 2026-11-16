const assert = require("assert");
const sinon = require("sinon");
const proxyquire = require("proxyquire").noCallThru();
const { formatSubs } = require("../../../routes/subs");

const LOCAL_SERVER_PREFIX = "http://127.0.0.1:11470/subtitles.vtt?from=";

const responseSpy = () => ({
  send: sinon.spy(),
  setHeader: sinon.spy(),
  status: sinon.stub().returnsThis(),
});

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

describe("subtitle URLs", function () {
  const cases = [
    {
      name: "use the local host and port by default",
      publicUrl: "",
      env: "development",
      expected: "http://localhost:3000",
    },
    {
      name: "preserve production URLs without the internal port",
      publicUrl: "",
      env: "production",
      expected: "https://addon.example",
    },
    {
      name: "use an external HTTPS origin without the internal port",
      publicUrl: "https://pi.tailnet.ts.net",
      env: "development",
      expected: "https://pi.tailnet.ts.net",
    },
    {
      name: "remove trailing slashes from the external URL",
      publicUrl: "https://pi.tailnet.ts.net/",
      env: "development",
      expected: "https://pi.tailnet.ts.net",
    },
  ];

  for (const { name, publicUrl, env, expected } of cases) {
    it(`should ${name}`, function () {
      const values = {
        publicUrl,
        PORT: 3000,
        HOSTNAME: env === "production" ? "addon.example" : "localhost",
        ssl: env === "production",
        enableLocalServerEncoding: false,
      };
      const { formatSubs } = proxyquire("../../../routes/subs", {
        config: {
          get: (key) => values[key],
          util: { getEnv: () => env },
        },
      });
      const req = {
        ktuvitSubs: [{ id: "SUB123", subName: "My.Subtitle.srt" }],
        title: { ktuvitID: "TITLE456" },
      };
      const res = { send: sinon.spy() };

      formatSubs(req, res);

      assert.strictEqual(
        res.send.firstCall.args[0].subtitles[0].url,
        `${expected}/srt/TITLE456/SUB123.srt`
      );
    });
  }
});

describe("fetchSubsMiddleware", function () {
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
  let logger;
  let invalidateKtuvitManager;

  beforeEach(async function () {
    getSubsIDsListMovie = sinon.stub().callsFake(async () => [...SUBS]);
    invalidateKtuvitManager = sinon.spy();
    logger = {
      debug: sinon.spy(),
      info: sinon.spy(),
      error: sinon.spy(),
    };

    const subs = proxyquire("../../../routes/subs", {
      "../clients/ktuvit": {
        initKtuvitManager: async () => ({ getSubsIDsListMovie }),
        invalidateKtuvitManager,
      },
      "../common/logger": logger,
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
    const res = responseSpy();
    const next = sinon.spy();
    await fetchSubsMiddleware(req, res, next);
    return { req, res, next };
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

    assert.deepStrictEqual(second.req.ktuvitSubs, SUBS);
  });

  it("should return an uncacheable 502 when Ktuvit fails and retry the next request", async function () {
    getSubsIDsListMovie
      .onFirstCall()
      .rejects(new Error("upstream authentication cookie: secret"));

    const failed = await callWith("Freies.Land.2019.D.BDRip.avi");
    sinon.assert.calledOnceWithExactly(failed.res.status, 502);
    sinon.assert.calledOnceWithExactly(
      failed.res.setHeader,
      "Cache-Control",
      "no-store"
    );
    sinon.assert.calledOnceWithExactly(failed.res.send, { subtitles: [] });
    sinon.assert.notCalled(failed.next);
    assert.ok(!JSON.stringify(logger.error.args).includes("secret"));

    const retried = await callWith("Freies.Land.2019.DVDRIP.avi");
    assert.deepStrictEqual(retried.req.ktuvitSubs, SUBS);
    sinon.assert.calledOnce(retried.next);
    sinon.assert.notCalled(retried.res.status);
    assert.strictEqual(
      getSubsIDsListMovie.callCount,
      2,
      "A failure must not be cached as this title's subtitles"
    );
  });

  it("should continue normally when Ktuvit returns an empty subtitle list", async function () {
    getSubsIDsListMovie.resolves([]);

    const { req, res, next } = await callWith("Freies.Land.2019.avi");

    assert.deepStrictEqual(req.ktuvitSubs, []);
    sinon.assert.calledOnce(next);
    sinon.assert.notCalled(res.status);
    sinon.assert.notCalled(res.setHeader);
  });

  it("should invalidate the request's manager when its subtitle fetch fails", async function () {
    const error = new Error("session expired");
    const manager = { getSubsIDsListMovie: sinon.stub().rejects(error) };
    const next = sinon.spy();

    await fetchSubsMiddleware(
      { title: titleFor("release.avi"), ktuvitManager: manager },
      responseSpy(),
      next
    );

    sinon.assert.calledOnceWithExactly(invalidateKtuvitManager, error, manager);
    sinon.assert.notCalled(getSubsIDsListMovie);
    sinon.assert.notCalled(next);
  });

  it("should only invalidate the fetching manager when a newer session joins its pending fetch", async function () {
    let rejectFetch;
    const pending = new Promise((resolve, reject) => {
      rejectFetch = reject;
    });
    const oldManager = {
      getSubsIDsListMovie: sinon.stub().returns(pending),
    };
    const newManager = {
      getSubsIDsListMovie: sinon.stub().resolves(SUBS),
    };
    const oldResponse = responseSpy();
    const newResponse = responseSpy();
    const oldNext = sinon.spy();
    const newNext = sinon.spy();
    const oldRequest = fetchSubsMiddleware(
      { title: titleFor("first.avi"), ktuvitManager: oldManager },
      oldResponse,
      oldNext
    );
    const joinedRequest = fetchSubsMiddleware(
      { title: titleFor("second.avi"), ktuvitManager: newManager },
      newResponse,
      newNext
    );
    const error = Object.assign(new Error("session expired"), { status: 401 });

    rejectFetch(error);
    await Promise.all([oldRequest, joinedRequest]);

    sinon.assert.calledOnceWithExactly(
      invalidateKtuvitManager,
      error,
      oldManager
    );
    sinon.assert.notCalled(newManager.getSubsIDsListMovie);
    sinon.assert.calledOnceWithExactly(oldResponse.status, 502);
    sinon.assert.calledOnceWithExactly(newResponse.status, 502);
    sinon.assert.notCalled(oldNext);
    sinon.assert.notCalled(newNext);

    const retry = { title: titleFor("third.avi"), ktuvitManager: newManager };
    await fetchSubsMiddleware(retry, responseSpy(), newNext);

    assert.deepStrictEqual(retry.ktuvitSubs, SUBS);
    sinon.assert.calledOnce(newManager.getSubsIDsListMovie);
    sinon.assert.calledOnce(newNext);
  });
});

describe("extractTitleInfo", function () {
  let extractTitleInfo;
  let getKtuvitID;
  let logger;
  let invalidateKtuvitManager;

  beforeEach(async function () {
    getKtuvitID = sinon.stub().resolves("KT9407490");
    invalidateKtuvitManager = sinon.spy();
    logger = {
      debug: sinon.spy(),
      info: sinon.spy(),
      error: sinon.spy(),
    };
    const subs = proxyquire("../../../routes/subs", {
      "../clients/ktuvit": {
        initKtuvitManager: async () => ({ getKtuvitID }),
        invalidateKtuvitManager,
      },
      "../common/logger": logger,
    });
    ({ extractTitleInfo } = subs);
    await subs.initSubs();
  });

  const requestFor = (imdbId = "tt9407490") => ({
    params: { type: "movie", imdbId },
  });

  it("should return an uncacheable 502 for title lookup failures without logging upstream secrets", async function () {
    const error = new Error("upstream authentication cookie: secret");
    getKtuvitID.onFirstCall().rejects(error);
    const res = responseSpy();
    const next = sinon.spy();

    await extractTitleInfo(requestFor(), res, next);

    sinon.assert.calledOnceWithExactly(res.status, 502);
    sinon.assert.calledOnceWithExactly(
      res.setHeader,
      "Cache-Control",
      "no-store"
    );
    sinon.assert.calledOnceWithExactly(res.send, { subtitles: [] });
    sinon.assert.notCalled(next);
    assert.ok(!JSON.stringify(logger.error.args).includes("secret"));

    const retried = requestFor();
    await extractTitleInfo(retried, responseSpy(), next);

    assert.strictEqual(retried.title.ktuvitID, "KT9407490");
    sinon.assert.calledOnce(next);
    sinon.assert.calledTwice(getKtuvitID);
  });

  it("should return a normal empty response for invalid IMDb IDs", async function () {
    const res = responseSpy();
    const next = sinon.spy();

    await extractTitleInfo(requestFor("invalid"), res, next);

    sinon.assert.calledOnceWithExactly(res.send, { subtitles: [] });
    sinon.assert.notCalled(res.status);
    sinon.assert.notCalled(res.setHeader);
    sinon.assert.notCalled(getKtuvitID);
    sinon.assert.notCalled(next);
  });

  it("should invalidate the request's manager when its title lookup fails", async function () {
    const error = new Error("session expired");
    const manager = { getKtuvitID: sinon.stub().rejects(error) };
    const next = sinon.spy();

    await extractTitleInfo(
      { ...requestFor(), ktuvitManager: manager },
      responseSpy(),
      next
    );

    sinon.assert.calledOnceWithExactly(invalidateKtuvitManager, error, manager);
    sinon.assert.notCalled(getKtuvitID);
    sinon.assert.notCalled(next);
  });

  it("should return a normal empty response for unknown titles", async function () {
    getKtuvitID.resolves(undefined);
    const res = responseSpy();
    const next = sinon.spy();

    await extractTitleInfo(requestFor(), res, next);

    sinon.assert.calledOnceWithExactly(res.send, { subtitles: [] });
    sinon.assert.notCalled(res.status);
    sinon.assert.notCalled(res.setHeader);
    sinon.assert.notCalled(next);
  });
});
