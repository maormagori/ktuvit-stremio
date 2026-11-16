const ktuvitManager = require("ktuvit-api");
const config = require("config");
const logger = require("../common/logger");

const LOGIN_TIMEOUT_MS = 10000;
const RETRY_DELAY_MS = 30000;
const loginCookieRegex = /^u=[A-F0-9]+&g=[A-F0-9]+$/i;
let ktuvit;
let initialization;
let retryAt = 0;

const initKtuvitManager = async () => {
  if (ktuvit) {
    return ktuvit;
  }
  if (initialization) {
    return initialization;
  }
  if (Date.now() < retryAt) {
    throw new Error("Ktuvit is temporarily unavailable.");
  }

  initialization = Promise.resolve().then(async () => {
    try {
      const email = config.get("ktuvit.email");
      const password = config.get("ktuvit.hashedPassword");
      if (!email || !password) {
        throw new Error("Missing Ktuvit credentials.");
      }
      logger.info("Requesting a login cookie from Ktuvit.");
      const response = await fetch(ktuvitManager.KTUVIT.LOGIN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: { Email: email, Password: password } }),
        redirect: "error",
        signal: AbortSignal.timeout(LOGIN_TIMEOUT_MS),
      });
      try {
        if (!response.ok) {
          throw new Error("Ktuvit login failed.");
        }
        const cookie = response.headers
          .getSetCookie()
          .find((value) => /^Login=/i.test(value));
        const loginCookie = cookie?.split(";")[0].slice("Login=".length);
        if (!loginCookieRegex.test(loginCookie || "")) {
          throw new Error("Ktuvit login failed.");
        }
        ktuvit = new ktuvitManager(loginCookie);
        logger.info("Done initializing Ktuvit manager.");
        return ktuvit;
      } finally {
        await response.body?.cancel();
      }
    } catch {
      ktuvit = undefined;
      retryAt = Date.now() + RETRY_DELAY_MS;
      logger.error("Unable to initialize Ktuvit manager.");
      throw new Error("Ktuvit is temporarily unavailable.");
    } finally {
      initialization = undefined;
    }
  });
  return initialization;
};

const invalidateKtuvitManager = (err, manager = ktuvit) => {
  const status = err?.status || err?.statusCode || err?.response?.status;
  if ((status === 401 || status === 403) && manager === ktuvit) {
    ktuvit = undefined;
    retryAt = 0;
  }
};

const ensureKtuvitReady = async (req, res, next) => {
  try {
    req.ktuvitManager = await initKtuvitManager();
    next();
  } catch {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader(
      "Retry-After",
      String(Math.max(1, Math.ceil((retryAt - Date.now()) / 1000)))
    );
    res.status(503).send({ error: "Ktuvit is temporarily unavailable." });
  }
};

module.exports = {
  initKtuvitManager,
  invalidateKtuvitManager,
  ensureKtuvitReady,
};
