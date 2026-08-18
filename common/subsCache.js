const { LRUCache } = require("lru-cache");
const config = require("config");
const logger = require("./logger");

const MAX_ENTRIES = Number(config.get("subsCache.maxEntries"));
const FOUND_TTL = Number(config.get("subsCache.foundTtlMs"));
const EMPTY_TTL = Number(config.get("subsCache.emptyTtlMs"));

const cache = new LRUCache({ max: MAX_ENTRIES, ttl: FOUND_TTL });

// Keyed on exactly what fetchSubsFromKtuvit passes to Ktuvit: the type decides
// which endpoint is called, and the Ktuvit ID with the season and episode are
// its arguments. Stremio's filename, hash and size are what make every URL
// unique and route based caching useless, and none of them reach the key, so
// two releases of one episode share an entry and each request still gets its
// own ordering from sortSubsByFilename afterwards.
const keyFor = (title) => {
  const parts = [title.type, title.ktuvitID];

  if (title.season !== undefined) {
    parts.push(title.season);
  }
  if (title.episode !== undefined) {
    parts.push(title.episode);
  }

  return parts.join(":");
};

// Handed out as a copy so that a caller sorting the list in place cannot
// reorder what the next request will read.
const copyOf = (subs) => (Array.isArray(subs) ? [...subs] : subs);

const getOrFetch = async (title, fetchSubs) => {
  const key = keyFor(title);
  const cached = cache.get(key);

  if (cached) {
    logger.debug("Subs cache hit.", { key });
    return copyOf(await cached);
  }

  logger.debug("Subs cache miss.", { key });

  // The pending promise is cached, not just its result, so requests that
  // arrive while the first one is still in flight share it instead of each
  // starting their own fetch. A newly released episode gets asked for by many
  // clients at once, which is exactly when that matters.
  const pending = fetchSubs();
  cache.set(key, pending);

  try {
    const subs = await pending;
    // An empty list expires quickly: it usually means the subs are not up yet,
    // not that this title will never have any.
    cache.set(key, subs, {
      ttl: Array.isArray(subs) && subs.length ? FOUND_TTL : EMPTY_TTL,
    });
    return copyOf(subs);
  } catch (err) {
    // A failed fetch is never cached. Keeping it would turn one bad response
    // from Ktuvit into an empty subtitles list for everyone until it expired.
    cache.delete(key);
    throw err;
  }
};

module.exports = { getOrFetch };
