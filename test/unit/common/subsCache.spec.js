const assert = require("assert");
const sinon = require("sinon");
const proxyquire = require("proxyquire").noCallThru();

const FOUND_TTL = 60000;
const EMPTY_TTL = 5000;

const SUBS = [
  { id: "SUB1", subName: "Freies.Land.2019.D.BDRip.1.46Gb.MegaPeer.avi.srt" },
  { id: "SUB2", subName: "Freies.Land.2019.DVDRIP.MegaPeer.avi.srt" },
];

// Shaped like the req.title that extractTitleInfo builds: season and episode
// are strings for a series and present but undefined for a movie, and the
// resolved ktuvitID always comes along.
const movie = (overrides = {}) => ({
  type: "movie",
  imdbID: "tt9407490",
  season: undefined,
  episode: undefined,
  ktuvitID: "KT9407490",
  ...overrides,
});

const episode = (overrides = {}) => ({
  type: "series",
  imdbID: "tt0903747",
  season: "2",
  episode: "5",
  ktuvitID: "KT0903747",
  ...overrides,
});

// The arguments Stremio appends to every subtitles request. They differ per
// viewer and must never split a cache entry.
const release = (title, filename, videoHash, videoSize) => ({
  ...title,
  filename,
  videoHash,
  videoSize,
});

// Every fetch hands back its own array so that a test mutating a result cannot
// change the fixture the next assertion relies on.
const countingFetch = (subs = SUBS) =>
  sinon.stub().callsFake(async () => [...subs]);

// lru-cache resolves its clock at require time, so a test that installs a fake
// one has to make it load again afterwards. Only the expiry suite needs this.
const forgetLruCache = () =>
  Object.keys(require.cache)
    .filter((file) => file.includes("lru-cache"))
    .forEach((file) => delete require.cache[file]);

const loadCache = (overrides = {}) => {
  const values = {
    "subsCache.maxEntries": 500,
    "subsCache.foundTtlMs": FOUND_TTL,
    "subsCache.emptyTtlMs": EMPTY_TTL,
    ...overrides,
  };

  return proxyquire("../../../common/subsCache", {
    config: { get: (key) => values[key] },
    "./logger": { debug: sinon.spy(), info: sinon.spy(), error: sinon.spy() },
  });
};

const SHARE_ONE_FETCH = [
  {
    what: "a movie asked for by two different releases",
    first: release(
      movie(),
      "Freies.Land.2019.D.BDRip.1.46Gb.MegaPeer.avi",
      "fe4032afd8b70beb",
      "1567260672"
    ),
    second: release(
      movie(),
      "Freies.Land.2019.DVDRIP.MegaPeer.avi",
      "fe40328b70beb",
      "1401229312"
    ),
  },
  {
    what: "a movie asked for twice by the same release",
    first: release(movie(), "Freies.Land.2019.DVDRIP.avi", "aaa", "1"),
    second: release(movie(), "Freies.Land.2019.DVDRIP.avi", "aaa", "1"),
  },
  {
    what: "a movie with no extra arguments at all",
    first: movie(),
    second: movie(),
  },
  {
    what: "a movie whose undefined season and episode keys are absent instead",
    first: movie(),
    second: { type: "movie", imdbID: "tt9407490", ktuvitID: "KT9407490" },
  },
  {
    what: "an episode asked for by two different releases",
    first: release(
      episode(),
      "Breaking.Bad.S02E05.1080p.WEB-DL.mkv",
      "abc123",
      "1567260672"
    ),
    second: release(
      episode(),
      "Breaking.Bad.S02E05.720p.HDTV.x264.mkv",
      "def456",
      "734003200"
    ),
  },
  {
    what: "an episode asked for with and without extra arguments",
    first: episode(),
    second: release(episode(), "Breaking.Bad.S02E05.BluRay.mkv", "ghi789", "2"),
  },
  {
    what: "one title reached through two different imdb ids",
    first: movie(),
    second: movie({ imdbID: "tt9999999" }),
  },
];

const NEED_THEIR_OWN_FETCH = [
  {
    what: "two different movies",
    first: movie(),
    second: movie({ imdbID: "tt0111161", ktuvitID: "KT0111161" }),
  },
  {
    what: "two episodes of the same season",
    first: episode(),
    second: episode({ episode: "6" }),
  },
  {
    what: "the same episode number in two seasons",
    first: episode(),
    second: episode({ season: "3" }),
  },
  {
    what: "the same season and episode of two different series",
    first: episode(),
    second: episode({ imdbID: "tt0944947", ktuvitID: "KT0944947" }),
  },
  {
    what: "one imdb id that now resolves to a different ktuvit id",
    first: movie(),
    second: movie({ ktuvitID: "KT9407490_REINDEXED" }),
  },
  {
    what: "the same ktuvit id with nothing but the type to tell them apart",
    first: { type: "movie", ktuvitID: "KT0903747" },
    second: { type: "series", ktuvitID: "KT0903747" },
  },
  {
    what: "two releases of two different movies",
    first: release(movie(), "Freies.Land.2019.BDRip.avi", "aaa", "1"),
    second: release(
      movie({ imdbID: "tt0111161", ktuvitID: "KT0111161" }),
      "Shawshank.1994.BDRip.avi",
      "bbb",
      "2"
    ),
  },
];

describe("subsCache getOrFetch", function () {
  let getOrFetch;

  beforeEach(function () {
    ({ getOrFetch } = loadCache());
  });

  SHARE_ONE_FETCH.forEach(({ what, first, second }) => {
    it(`should ask Ktuvit once for ${what}`, async function () {
      const fetchSubs = countingFetch();

      const firstSubs = await getOrFetch(first, fetchSubs);
      const secondSubs = await getOrFetch(second, fetchSubs);

      assert.strictEqual(
        fetchSubs.callCount,
        1,
        `Expected one Ktuvit call for ${what}, got ${fetchSubs.callCount}`
      );
      assert.deepStrictEqual(firstSubs, SUBS);
      assert.deepStrictEqual(secondSubs, SUBS);
    });
  });

  NEED_THEIR_OWN_FETCH.forEach(({ what, first, second }) => {
    it(`should ask Ktuvit twice for ${what}`, async function () {
      const fetchSubs = countingFetch();

      await getOrFetch(first, fetchSubs);
      await getOrFetch(second, fetchSubs);

      assert.strictEqual(
        fetchSubs.callCount,
        2,
        `Expected two Ktuvit calls for ${what}, got ${fetchSubs.callCount}`
      );
    });
  });

  it("should ask Ktuvit once however many releases of one episode arrive", async function () {
    const fetchSubs = countingFetch();
    const releases = [
      "Breaking.Bad.S02E05.1080p.WEB-DL.mkv",
      "Breaking.Bad.S02E05.720p.HDTV.x264.mkv",
      "Breaking.Bad.S02E05.BluRay.x264-GROUP.mkv",
      "Breaking.Bad.S02E05.DVDRip.XviD.avi",
      "Breaking.Bad.S02E05.2160p.HDR.mkv",
    ];

    for (const filename of releases) {
      await getOrFetch(episode({ filename }), fetchSubs);
    }

    assert.strictEqual(
      fetchSubs.callCount,
      1,
      `Expected 1 Ktuvit call for ${releases.length} releases, got ${fetchSubs.callCount}`
    );
  });

  it("should share one fetch between requests that arrive together", async function () {
    let resolveFetch;
    const fetchSubs = sinon
      .stub()
      .returns(new Promise((resolve) => (resolveFetch = resolve)));

    const inFlight = Promise.all([
      getOrFetch(episode(), fetchSubs),
      getOrFetch(episode(), fetchSubs),
      getOrFetch(episode(), fetchSubs),
    ]);
    resolveFetch(SUBS);
    const results = await inFlight;

    assert.strictEqual(
      fetchSubs.callCount,
      1,
      "Requests arriving before the first one resolves should reuse it"
    );
    results.forEach((subs) => assert.deepStrictEqual(subs, SUBS));
  });

  it("should not cache a failed fetch", async function () {
    const fetchSubs = sinon.stub();
    fetchSubs.onFirstCall().rejects(new Error("ktuvit is down"));
    fetchSubs.onSecondCall().callsFake(async () => [...SUBS]);

    await assert.rejects(() => getOrFetch(movie(), fetchSubs));
    const subs = await getOrFetch(movie(), fetchSubs);

    assert.strictEqual(
      fetchSubs.callCount,
      2,
      "A failure must not be remembered as this title's subtitles"
    );
    assert.deepStrictEqual(subs, SUBS);
  });

  it("should hand out a copy so a caller cannot reorder the cached list", async function () {
    const expectedOrder = SUBS.map((sub) => sub.id);
    const fetchSubs = countingFetch();

    const first = await getOrFetch(movie(), fetchSubs);
    first.reverse();

    const second = await getOrFetch(movie(), fetchSubs);

    assert.deepStrictEqual(
      second.map((sub) => sub.id),
      expectedOrder,
      "Sorting the returned array must not affect what the next request reads"
    );
  });

  it("should evict the least recently used title once it is full", async function () {
    ({ getOrFetch } = loadCache({ "subsCache.maxEntries": 2 }));
    const fetchSubs = countingFetch();

    await getOrFetch(movie({ ktuvitID: "KT1" }), fetchSubs);
    await getOrFetch(movie({ ktuvitID: "KT2" }), fetchSubs);
    await getOrFetch(movie({ ktuvitID: "KT3" }), fetchSubs);
    await getOrFetch(movie({ ktuvitID: "KT1" }), fetchSubs);

    assert.strictEqual(
      fetchSubs.callCount,
      4,
      "The oldest title should have been evicted, forcing a refetch"
    );
  });
});

describe("subsCache getOrFetch expiry", function () {
  let getOrFetch;
  let clock;

  beforeEach(function () {
    clock = sinon.useFakeTimers();
    // lru-cache reads the clock through the global performance object, which
    // it captures once when it is first required. sinon replaces that object
    // rather than patching it, so a copy loaded before the fake clock went in
    // keeps reading the real one and never sees a tick. Drop it from the
    // require cache so the copy subsCache loads here reads the fake clock.
    forgetLruCache();
    // lru-cache stores the time an entry was cached and treats a zero
    // timestamp as "no expiry set". The fake clock starts performance.now() at
    // zero, so move it off zero before anything is cached, or every entry
    // would look permanently fresh.
    clock.tick(1);
    ({ getOrFetch } = loadCache());
  });

  afterEach(function () {
    clock.restore();
    // The copy loaded above is holding the fake performance object, which stops
    // advancing once the clock is restored. Drop it again so whatever loads
    // lru-cache next starts from the real clock.
    forgetLruCache();
  });

  it("should keep a found list for the whole found ttl", async function () {
    const fetchSubs = countingFetch();

    await getOrFetch(movie(), fetchSubs);
    clock.tick(FOUND_TTL - 1);
    await getOrFetch(movie(), fetchSubs);

    assert.strictEqual(
      fetchSubs.callCount,
      1,
      "A found list should still be served just before its ttl"
    );
  });

  it("should refetch a found list once the found ttl passes", async function () {
    const fetchSubs = countingFetch();

    await getOrFetch(movie(), fetchSubs);
    clock.tick(FOUND_TTL + 1);
    await getOrFetch(movie(), fetchSubs);

    assert.strictEqual(fetchSubs.callCount, 2);
  });

  it("should outlive the empty ttl when subtitles were found", async function () {
    const fetchSubs = countingFetch();

    await getOrFetch(movie(), fetchSubs);
    clock.tick(EMPTY_TTL + 1);
    await getOrFetch(movie(), fetchSubs);

    assert.strictEqual(
      fetchSubs.callCount,
      1,
      "The short ttl is only meant for empty results"
    );
  });

  it("should keep an empty list only until the empty ttl", async function () {
    const fetchSubs = countingFetch([]);

    await getOrFetch(episode(), fetchSubs);
    clock.tick(EMPTY_TTL - 1);
    await getOrFetch(episode(), fetchSubs);

    assert.strictEqual(
      fetchSubs.callCount,
      1,
      "Should still be served just before the empty ttl"
    );
  });

  it("should retry an empty list soon after, the subs may not be up yet", async function () {
    const fetchSubs = countingFetch([]);

    await getOrFetch(episode(), fetchSubs);
    clock.tick(EMPTY_TTL + 1);
    await getOrFetch(episode(), fetchSubs);

    assert.strictEqual(fetchSubs.callCount, 2);
  });
});
