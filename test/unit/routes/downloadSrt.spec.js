const assert = require("assert");
const sinon = require("sinon");
const proxyquire = require("proxyquire").noCallThru();

const HEBREW_TEXT = "שלום עולם\nThis is a Hebrew subtitle line.";

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
      cb(HEBREW_TEXT);
      return Promise.resolve();
    });

    const req = { params: { ktuvitId: "TITLE123", subId: "SUB456" } };
    downloadSrtFromKtuvit(req, res);

    const [buffer] = res.end.firstCall.args;
    assert.ok(Buffer.isBuffer(buffer), "Response should be a Buffer");
    assert.strictEqual(
      buffer.toString("utf8"),
      HEBREW_TEXT,
      "Buffer should decode to the original string as UTF-8"
    );
  });

  it("should serve ISO-8859-8 decoded content as UTF-8", function () {
    const iso88598Decoded = "שבת שלום";
    mockKtuvit.downloadSubtitle.callsFake((titleId, subId, cb) => {
      cb(iso88598Decoded);
      return Promise.resolve();
    });

    const req = { params: { ktuvitId: "TITLE123", subId: "SUB456" } };
    downloadSrtFromKtuvit(req, res);

    const [buffer] = res.end.firstCall.args;
    assert.strictEqual(buffer.toString("utf8"), iso88598Decoded);
  });

  it("should set content-type header with utf-8 charset", function () {
    mockKtuvit.downloadSubtitle.callsFake((titleId, subId, cb) => {
      cb("");
      return Promise.resolve();
    });

    const req = { params: { ktuvitId: "TITLE123", subId: "SUB456" } };
    downloadSrtFromKtuvit(req, res);

    assert.ok(
      res.setHeader.calledWith("Content-Type", "application/x-subrip; charset=utf-8")
    );
  });
});
