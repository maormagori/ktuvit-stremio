const assert = require("assert");
const sinon = require("sinon");
const proxyquire = require("proxyquire").noCallThru();

describe("Ktuvit initialization", function () {
  let client;
  let fetchStub;
  let manager;
  let logger;
  let config;
  let clock;
  const cookie = "u=abcdef&g=123ABC";

  beforeEach(function () {
    clock = sinon.useFakeTimers({ toFake: ["Date"] });
    fetchStub = sinon.stub(globalThis, "fetch");
    manager = sinon.stub();
    manager.KTUVIT = { LOGIN_URL: "https://ktuvit.test/login" };
    logger = { info: sinon.spy(), error: sinon.spy() };
    config = { get: sinon.stub().returns("SECRET_CREDENTIAL") };
    client = proxyquire("../../../clients/ktuvit", {
      "ktuvit-api": manager,
      config,
      "../common/logger": logger,
    });
    fetchStub.resolves({
      ok: true,
      headers: {
        getSetCookie: () => [`Login=${cookie}; Path=/`, "Other=value"],
      },
      body: { cancel: sinon.stub().resolves() },
    });
  });

  afterEach(function () {
    sinon.restore();
    clock.restore();
  });

  it("loads safely without reading credentials and shares concurrent login attempts", async function () {
    assert.ok(config.get.notCalled);
    const results = await Promise.all([
      client.initKtuvitManager(),
      client.initKtuvitManager(),
      client.initKtuvitManager(),
    ]);
    assert.ok(fetchStub.calledOnce);
    assert.ok(manager.calledOnceWithExactly(cookie));
    assert.strictEqual(results[0], results[1]);
    assert.strictEqual(await client.initKtuvitManager(), results[0]);
    const options = fetchStub.firstCall.args[1];
    assert.strictEqual(options.redirect, "error");
    assert.strictEqual(options.method, "POST");
    assert.deepStrictEqual(JSON.parse(options.body), {
      request: { Email: "SECRET_CREDENTIAL", Password: "SECRET_CREDENTIAL" },
    });
  });

  it("finds Login by name at any position", async function () {
    fetchStub.resolves({
      ok: true,
      headers: {
        getSetCookie: () => ["Other=x", "Session=y", `Login=${cookie}; Secure`],
      },
    });
    await client.initKtuvitManager();
    assert.ok(manager.calledOnceWithExactly(cookie));
  });

  it("backs off failed login and recovers without restarting or logging secrets", async function () {
    fetchStub
      .onFirstCall()
      .rejects(new Error("SECRET_CREDENTIAL response body"));
    await assert.rejects(client.initKtuvitManager(), /temporarily unavailable/);
    await assert.rejects(client.initKtuvitManager(), /temporarily unavailable/);
    assert.ok(fetchStub.calledOnce);
    assert.ok(!JSON.stringify(logger.error.args).includes("SECRET"));
    clock.tick(30000);
    await client.initKtuvitManager();
    assert.ok(fetchStub.calledTwice);
  });

  it("returns non-cacheable 503 for missing credentials", async function () {
    config.get.throws(new Error("missing SECRET_CREDENTIAL"));
    const res = {
      setHeader: sinon.spy(),
      status: sinon.stub().returnsThis(),
      send: sinon.spy(),
    };
    const next = sinon.spy();
    await client.ensureKtuvitReady({}, res, next);
    assert.ok(res.status.calledWith(503));
    assert.ok(res.setHeader.calledWith("Cache-Control", "no-store"));
    assert.ok(res.setHeader.calledWith("Retry-After", "30"));
    assert.ok(next.notCalled);
    assert.ok(fetchStub.notCalled);
  });

  it("bounds hung authentication with a ten second abort signal", async function () {
    const controller = new AbortController();
    const timeout = sinon
      .stub(AbortSignal, "timeout")
      .returns(controller.signal);
    fetchStub.callsFake(
      (url, options) =>
        new Promise((resolve, reject) => {
          options.signal.addEventListener("abort", () =>
            reject(new Error("timeout"))
          );
        })
    );
    const pending = client.initKtuvitManager();
    await Promise.resolve();
    assert.ok(timeout.calledOnceWithExactly(10000));
    controller.abort();
    await assert.rejects(pending, /temporarily unavailable/);
    clock.tick(30000);
    fetchStub.resolves({
      ok: true,
      headers: { getSetCookie: () => [`Login=${cookie}`] },
    });
    await client.initKtuvitManager();
  });

  it("rejects failed HTTP responses and malformed cookies", async function () {
    fetchStub.resolves({
      ok: false,
      headers: { getSetCookie: () => [`Login=${cookie}`] },
    });
    await assert.rejects(client.initKtuvitManager());
    clock.tick(30000);
    fetchStub.resolves({
      ok: true,
      headers: { getSetCookie: () => ["Login=invalid"] },
    });
    await assert.rejects(client.initKtuvitManager());
    assert.ok(manager.notCalled);
  });

  it("reinitializes only on explicit unauthorized errors from the current manager", async function () {
    const current = await client.initKtuvitManager();
    client.invalidateKtuvitManager(new Error("network"), current);
    await client.initKtuvitManager();
    assert.ok(fetchStub.calledOnce);
    client.invalidateKtuvitManager({ status: 401 }, {});
    await client.initKtuvitManager();
    assert.ok(fetchStub.calledOnce);
    client.invalidateKtuvitManager({ response: { status: 403 } }, current);
    await client.initKtuvitManager();
    assert.ok(fetchStub.calledTwice);
  });
});
