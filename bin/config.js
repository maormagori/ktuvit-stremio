/**
 * @author Maor M.
 * @summary Addon configuration module.
 * 
 * Contains all the info the addon needs about server addresses and ports.
 */


var env = process.env.NODE_ENV ? 'beamup':'local';
var config = {

    cinemeta_url: "https://v3-cinemeta.strem.io/meta/"

}

switch (env) {
    //Public server build.
    case 'beamup':
		config.port = process.env.PORT
        config.local = ""
        break;

    //Local sever build.
    case 'local':
		config.port = 7000
        config.local = "http://127.0.0.1:" + config.port;
        break;
}

module.exports = config;