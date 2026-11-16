const assert = require("assert");
const http = require("http");
const sinon = require("sinon");
const proxyquire = require("proxyquire").noCallThru();

// Keep real HTTP routing and the real readiness middleware, with a controlled
// upstream login so an outage never depends on the external Ktuvit service.
describe("addon availability", function () {
  let server;
  let login;
  let config;
  let clock;
  let abort;

  beforeEach(function () {
    clock = sinon.useFakeTimers({ toFake: ["Date"] });
    abort = new AbortController();
    sinon.stub(AbortSignal, "timeout").returns(abort.signal);
    login = sinon.stub(globalThis, "fetch");
    config = { get: sinon.stub().returns("credential") };
    const manager = sinon.stub();
    manager.KTUVIT = { LOGIN_URL: "https://ktuvit.test/login" };
    const logger = { info: sinon.spy(), error: sinon.spy() };
    const client = proxyquire("../../clients/ktuvit", {
      "ktuvit-api": manager,
      config,
      "../common/logger": logger,
    });
    ({ server } = proxyquire("../../index", {
      config: {
        get: (key) => ({ PORT: 0, ssl: false, HOSTNAME: "localhost" }[key]),
      },
      "./clients/ktuvit": client,
      "./common/logger": logger,
      "./common/httpLogger": { httpLogger: (req, res, next) => next() },
      "./routes/subs": {
        extractTitleInfo: (req, res, next) => next(),
        fetchSubsMiddleware: (req, res, next) => next(),
        formatSubs: (req, res) => res.send({ subtitles: [] }),
      },
      "./routes/downloadSrt": {
        downloadSrtFromKtuvit: (req, res) => res.send("subtitle"),
      },
    }));
  });

  afterEach(async function () {
    await new Promise((resolve) => server.close(resolve));
    sinon.restore();
    clock.restore();
  });

  const get = (path) =>
    new Promise((resolve, reject) => {
      const request = http.get(
        { port: server.address().port, path, agent: false },
        (response) => {
          let body = "";
          response.on("data", (chunk) => {
            body += chunk;
          });
          response.on("end", () =>
            resolve({
              status: response.statusCode,
              headers: response.headers,
              body,
            })
          );
        }
      );
      request.on("error", reject);
    });

  const unavailable = (response) => {
    assert.strictEqual(response.status, 503);
    assert.strictEqual(response.headers["cache-control"], "no-store");
    assert.strictEqual(response.headers["retry-after"], "30");
    assert.ok(!response.body.includes("credential"));
  };

  it("serves manifest and landing with missing credentials, and rejects dependent routes", async function () {
    config.get.throws(new Error("Missing credentials"));
    assert.strictEqual((await get("/manifest.json")).status, 200);
    assert.strictEqual((await get("/")).status, 200);
    unavailable(await get("/subtitles/movie/tt1234567.json"));
    unavailable(await get("/srt/title/sub.srt"));
    assert.ok(login.notCalled);
  });

  it("keeps public routes live during hung login, then recovers after the deadline and backoff", async function () {
    let loginStarted;
    const started = new Promise((resolve) => {
      loginStarted = resolve;
    });
    login.callsFake(
      (url, options) =>
        new Promise((resolve, reject) => {
          loginStarted();
          options.signal.addEventListener("abort", () =>
            reject(new Error("secret response"))
          );
        })
    );
    const subtitles = get("/subtitles/movie/tt1234567.json");
    await started;
    const download = get("/srt/title/sub.srt");
    const manifest = await get("/manifest.json");
    assert.strictEqual(manifest.status, 200);
    assert.strictEqual(JSON.parse(manifest.body).id, "me.stremio.ktuvit");
    assert.strictEqual((await get("/")).status, 200);
    assert.ok(login.calledOnce);
    abort.abort();
    unavailable(await subtitles);
    unavailable(await download);
    unavailable(await get("/srt/title/sub.srt"));
    assert.ok(login.calledOnce);
    clock.tick(30000);
    login.resolves({
      ok: true,
      headers: {
        getSetCookie: () => ["Other=value", "Login=u=123&g=abc; Path=/"],
      },
    });
    assert.strictEqual(
      (await get("/subtitles/movie/tt1234567.json")).status,
      200
    );
    assert.strictEqual((await get("/srt/title/sub.srt")).status, 200);
    assert.ok(login.calledTwice);
  });
});
