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
