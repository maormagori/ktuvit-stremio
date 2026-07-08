const assert = require("assert");
const sinon = require("sinon");
const proxyquire = require("proxyquire").noCallThru();

const srtWithText = (text) =>
  `1\n00:00:01,000 --> 00:00:04,000\n${text}\n`;

const HEBREW_TEXT = "שלום עולם\nThis is a Hebrew subtitle line.";
const KTUVIT_ERROR_MESSAGE = "הבקשה לא נמצאה, נא לנסות להוריד את הקובץ בשנית";

describe("downloadSrtFromKtuvit", function () {
  let downloadSrtFromKtuvit;
  let initSrtDownloader;
  let mockKtuvit;
  let res;

  beforeEach(async function () {
    mockKtuvit = {
      downloadSubtitle: sinon.stub(),
    };

    ({ initSrtDownloader, downloadSrtFromKtuvit } = proxyquire(
      "../../../routes/downloadSrt",
      {
        "../clients/ktuvit": {
          initKtuvitManager: async () => mockKtuvit,
        },
      }
    ));

    await initSrtDownloader();

    res = {
      setHeader: sinon.spy(),
      end: sinon.spy(),
      status: sinon.stub().returnsThis(),
      send: sinon.spy(),
    };
  });

  it("should serve subtitle content as a UTF-8 buffer", function () {
    mockKtuvit.downloadSubtitle.callsFake((titleId, subId, cb) => {
      cb(srtWithText(HEBREW_TEXT));
      return Promise.resolve();
    });

    const req = { params: { ktuvitId: "TITLE123", subId: "SUB456" } };
    downloadSrtFromKtuvit(req, res);

    const [buffer] = res.end.firstCall.args;
    assert.ok(Buffer.isBuffer(buffer), "Response should be a Buffer");
    assert.strictEqual(
      buffer.toString("utf8"),
      srtWithText(HEBREW_TEXT),
      "Buffer should decode to the original string as UTF-8"
    );
  });

  it("should serve ISO-8859-8 decoded content as UTF-8", function () {
    const iso88598Decoded = "שבת שלום";
    mockKtuvit.downloadSubtitle.callsFake((titleId, subId, cb) => {
      cb(srtWithText(iso88598Decoded));
      return Promise.resolve();
    });

    const req = { params: { ktuvitId: "TITLE123", subId: "SUB456" } };
    downloadSrtFromKtuvit(req, res);

    const [buffer] = res.end.firstCall.args;
    assert.strictEqual(buffer.toString("utf8"), srtWithText(iso88598Decoded));
  });

  it("should set content-type header with utf-8 charset", function () {
    mockKtuvit.downloadSubtitle.callsFake((titleId, subId, cb) => {
      cb(srtWithText(""));
      return Promise.resolve();
    });

    const req = { params: { ktuvitId: "TITLE123", subId: "SUB456" } };
    downloadSrtFromKtuvit(req, res);

    assert.ok(
      res.setHeader.calledWith("Content-Type", "application/x-subrip; charset=utf-8")
    );
  });

  it("should reject a non-SRT response with a non-cacheable error instead of serving it as a subtitle", function () {
    mockKtuvit.downloadSubtitle.callsFake((titleId, subId, cb) => {
      // Ktuvit returns this when the download identifier is stale/invalid,
      // with an HTTP 200 status, so we can't rely on the transport layer to
      // catch it for us.
      cb(KTUVIT_ERROR_MESSAGE);
      return Promise.resolve();
    });

    const req = { params: { ktuvitId: "TITLE123", subId: "SUB456" } };
    downloadSrtFromKtuvit(req, res);

    assert.ok(res.setHeader.calledWith("Cache-Control", "no-store"));
    assert.ok(res.status.calledWith(502));
    assert.ok(res.send.called);
    assert.ok(res.end.notCalled, "Invalid content should never be sent as the response body");
  });

  it("should reject with a non-cacheable error when the download callback reports an error", function () {
    mockKtuvit.downloadSubtitle.callsFake((titleId, subId, cb) => {
      cb(null, new Error("network failure"));
      return Promise.resolve();
    });

    const req = { params: { ktuvitId: "TITLE123", subId: "SUB456" } };
    downloadSrtFromKtuvit(req, res);

    assert.ok(res.setHeader.calledWith("Cache-Control", "no-store"));
    assert.ok(res.status.calledWith(502));
    assert.ok(res.end.notCalled);
  });

  it("should reject with a non-cacheable error when the initial request rejects", async function () {
    mockKtuvit.downloadSubtitle.callsFake(() => {
      return Promise.reject(new Error("could not obtain download identifier"));
    });

    const req = { params: { ktuvitId: "TITLE123", subId: "SUB456" } };
    downloadSrtFromKtuvit(req, res);

    // Let the rejected promise's .catch() handler run.
    await new Promise((resolve) => setImmediate(resolve));

    assert.ok(res.setHeader.calledWith("Cache-Control", "no-store"));
    assert.ok(res.status.calledWith(502));
    assert.ok(res.end.notCalled);
  });
});
