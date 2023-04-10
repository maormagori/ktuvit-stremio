const config = require("config");

const MANIFEST = {
  id: "me.stremio.ktuvit",
  contactEmail: config.get("addonAuthorEmail"),
  version: process.env.npm_package_version,
  catalogs: [],
  resources: ["subtitles"],
  types: ["movie", "series"],
  name: "Ktuvit.me Subtitles",
  description:
    "An unofficial Stremio addon for Hebrew subtitles from Ktuvit.me. Developed by Maor Development",
  logo: "https://i0.wp.com/kodibeginner.com/wp-content/uploads/2020/10/ktuvit-me.jpg?w=300&ssl=1",
};

module.exports = (req, res) => {
  res.send(MANIFEST);
};
