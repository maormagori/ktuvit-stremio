const assert = require("assert");
const sinon = require("sinon");
const proxyquire = require("proxyquire").noCallThru();

describe("writeToLogger", function () {
  let mockLogger;
  let writeToLogger;

  beforeEach(function () {
    mockLogger = { http: sinon.spy() };
    ({ writeToLogger } = proxyquire("../../../common/httpLogger", {
      "./logger": mockLogger,
    }));
  });

  it("should log morgan's output at the http level", function () {
    writeToLogger("GET /manifest.json 200 512 - 3 ms\n");

    assert.ok(mockLogger.http.calledOnce);
  });

  it("should strip the newline morgan appends, since winston adds its own", function () {
    writeToLogger("GET /manifest.json 200 512 - 3 ms\n");

    assert.strictEqual(
      mockLogger.http.firstCall.args[0],
      "GET /manifest.json 200 512 - 3 ms"
    );
  });
});
