const ktuvitManager = require("ktuvit-api");
const config = require("config");
const logger = require("../common/logger");

const KTUVIT_EMAIL = config.get("ktuvit.email");
const KTUVIT_HASHED_PASS = config.get("ktuvit.hashedPassword");

let ktuvit;
const loginCookieRegex = /^u=[A-F0-9]+&g=[A-F0-9]+$/;

const initKtuvitManager = async () => {
  if (ktuvit) {
    return ktuvit;
  }

  const loginCookie = await ktuvitManager.getLoginCookie(
    KTUVIT_EMAIL,
    KTUVIT_HASHED_PASS
  );
  if (!loginCookieRegex.test(loginCookie)) {
    throw new Error("Failed to login to Ktuvit.");
  }

  ktuvit = new ktuvitManager(loginCookie);
  logger.info("Done initializing Ktuvit manager.");
};

module.exports = { initKtuvitManager };
