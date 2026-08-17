const assert = require("assert");
const config = require("config");
const logger = require("../../../common/logger");

describe("logger", function () {
  it("should take its level from the configuration", function () {
    assert.strictEqual(logger.level, config.get("logLevel"));
  });
});
