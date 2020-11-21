const express = require('express'),
    config = require('./bin/config'),
    cors = require('cors'),
    {search} = require('./lib/search'),
    {sendSRT} = require('./lib/fetch');

const addon = express();
addon.use(cors());

addon.get('/:settings/subtitles/:type/:imdbId/:query.json', getSubs)

async function getSubs(req, res){
    try {
        console.log(req);
	    const subtitles = await search(req.params.settings, req.params.type, req.params.imdbId);
	    respond(res, { "subtitles" : subtitles});
	} catch (err) {
		console.log("search error:");
		console.log(err);
	}
} 

function respond(res, data) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Content-Type', 'application/json');
    res.send(data);
  };


addon.get('/:loginCookie/srt', sendSRT)


addon.listen(config.port, function() {
	console.log(config)
    console.log(`Add-on Repository URL: ${config.local}/manifest.json`)
  });
