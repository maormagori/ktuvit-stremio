const assert = require("assert");
const sinon = require("sinon");
const { getTitleName } = require("../../../clients/cinemeta");

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("cinemeta getTitleName", function () {
  let fetchStub;

  beforeEach(function () {
    fetchStub = sinon.stub(global, "fetch");
  });

  afterEach(function () {
    sinon.restore();
  });

  it("should request the movie meta URL and return its name", async function () {
    fetchStub.resolves(jsonResponse({ meta: { name: "Heat" } }));

    const name = await getTitleName("movie", "tt0113277");

    assert.strictEqual(name, "Heat");
    assert.strictEqual(
      fetchStub.firstCall.args[0],
      "https://v3-cinemeta.strem.io/meta/movie/tt0113277.json"
    );
  });

  it("should request the series meta URL for a series", async function () {
    fetchStub.resolves(jsonResponse({ meta: { name: "The Sopranos" } }));

    const name = await getTitleName("series", "tt0141842");

    assert.strictEqual(name, "The Sopranos");
    assert.strictEqual(
      fetchStub.firstCall.args[0],
      "https://v3-cinemeta.strem.io/meta/series/tt0141842.json"
    );
  });

  it("should pass an abort signal so a stalled request times out", async function () {
    fetchStub.resolves(jsonResponse({ meta: { name: "Heat" } }));

    await getTitleName("movie", "tt0113277");

    assert.ok(fetchStub.firstCall.args[1].signal instanceof AbortSignal);
  });

  it("should reject with the status when Cinemeta does not answer OK", async function () {
    fetchStub.resolves(jsonResponse({}, 503));

    await assert.rejects(getTitleName("movie", "tt0113277"), /status 503/);
  });

  it("should return undefined when the meta has no name", async function () {
    fetchStub.resolves(jsonResponse({}));

    assert.strictEqual(await getTitleName("movie", "tt0113277"), undefined);
  });
});
