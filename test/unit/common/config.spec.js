const assert = require("assert");
const { execFileSync } = require("child_process");
const path = require("path");
const productionConfig = require("../../../config/production.json");

describe("hostname configuration", function () {
  const readHostname = (addonHostname) =>
    execFileSync(
      process.execPath,
      ["-e", 'process.stdout.write(require("config").get("HOSTNAME"))'],
      {
        cwd: path.resolve(__dirname, "../../.."),
        env: {
          ...process.env,
          NODE_ENV: "production",
          HOSTNAME: "docker-container-hostname",
          ADDON_HOSTNAME: addonHostname,
        },
        encoding: "utf8",
      }
    );

  it("should preserve the production hostname when Docker sets HOSTNAME", function () {
    assert.strictEqual(readHostname(""), productionConfig.HOSTNAME);
  });

  it("should use an explicitly configured addon hostname", function () {
    assert.strictEqual(readHostname("192.168.1.50"), "192.168.1.50");
  });
});
