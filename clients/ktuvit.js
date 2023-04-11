const ktuvitManager = require("ktuvit-api");
const config = require("config");
const logger = require("../common/logger");

const KTUVIT_EMAIL = config.get("ktuvit.email");
const KTUVIT_HASHED_PASS = config.get("ktuvit.hashedPassword");

let ktuvit;

const initKtuvitManager = async () => {
  try {
    if (ktuvit) {
      return ktuvit;
    }

    const loginCookie = await ktuvitManager.getLoginCookie(
      KTUVIT_EMAIL,
      KTUVIT_HASHED_PASS
    );

    ktuvit = new ktuvitManager(loginCookie);
  } catch (err) {
    logger.error("Error initializing ktuvit manager:", err);
  }
};

module.exports = { initKtuvitManager };
