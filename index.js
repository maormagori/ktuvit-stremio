const express = require("express"),
  config = require("./bin/config"),
  cors = require("cors"),
  { search } = require("./lib/search"),
  { sendSRT } = require("./lib/fetch"),
  configure = require("./configure/configure");

const addon = express();
addon.use(cors());

/**
 * The addon manifest: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/responses/manifest.md
 */
const manifest = {
  id: "me.stremio.ktuvit",
  contactEmail: "maor.development@gmail.com",
  version: process.env.npm_package_version,
  catalogs: [],
  resources: ["subtitles"],
  types: ["movie", "series"],
  behaviorHints: { configurable: true, configurationRequired: true },
  name: "Ktuvit.me Subtitles",
  description:
    "An unofficial Stremio addon for Hebrew subtitles from Ktuvit.me. Developed by Maor Development",
  logo: "https://i0.wp.com/kodibeginner.com/wp-content/uploads/2020/10/ktuvit-me.jpg?w=300&ssl=1",
};

addon.get("/manifest.json", function (req, res) {
  respond(res, manifest);
});

addon.get("/", function (req, res) {
  res.send(configure(manifest));
});
addon.get("/:settings/subtitles/:type/:imdbId/:query.json", getSubs);

async function getSubs(req, res) {
  try {
    console.log(req);
    const subtitles = await search(
      req.params.settings,
      req.params.type,
      req.params.imdbId
    );
    respond(res, { subtitles: subtitles });
  } catch (err) {
    console.log("search error:");
    console.log(err);
  }
}

function respond(res, data) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Content-Type", "application/json");
  res.send(data);
}

addon.get("/:loginCookie/srt", sendSRT);

addon.listen(config.port, function () {
  console.log(config);
  console.log(`Add-on Repository URL: ${config.local}/manifest.json`);
});
