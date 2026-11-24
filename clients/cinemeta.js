const CINEMETA_URL = "https://v3-cinemeta.strem.io";
const REQUEST_TIMEOUT_MS = 5000;

// Ktuvit's own title-name lookup goes through IMDb's suggestion endpoint,
// which blocks the production server. Cinemeta serves the same name and is
// reachable from there, so we ask it first.
const getTitleName = async (type, imdbId) => {
  const response = await fetch(`${CINEMETA_URL}/meta/${type}/${imdbId}.json`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Cinemeta responded with status ${response.status}`);
  }

  const body = await response.json();
  return body.meta?.name;
};

module.exports = { getTitleName };
