const landingTemplate = require("./landingTemplate");
const { MANIFEST } = require("../manifest");

module.exports = (req, res) => {
  res.type("html");
  res.send(landingTemplate(MANIFEST));
};
