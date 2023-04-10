const KtuvitManager = require('../bin/ktuvitHelper');

async function sendSRT(req, res) {
    var manager = new KtuvitManager(req.params.loginCookie);
    manager.downloadSubtitle(req.query.ktuvitId,req.query.subId,(buffer) =>{
        res.set('Content-Type','text/plain');
        res.set('charset', 'UTF-8');
        res.send(buffer);})
}

module.exports = {
    sendSRT: sendSRT
}
