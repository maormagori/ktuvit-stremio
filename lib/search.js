const KtuvitManager = require('../bin/ktuvitHelper');
const config = require('../bin/config');
const superagent = require('superagent');


async function searchMovie(manager, imdbId, name, year){
    const ktuvitId = await manager.getKtuvitID({name: name, year: year, type: 'movie', imdbId: imdbId});
    var subList = await manager.getSubsIDsListMovie(ktuvitId);
    return {ktuvitId: ktuvitId, subList: subList}
}

async function searchEpisode(manager, imdbId, name, year, season, episode){
    const ktuvitId = await manager.getKtuvitID({name: name, year: year, type: 'series', imdbId: imdbId});
    var subList = await manager.getSubsIDsListEpisode(ktuvitId, season, episode);
    return {ktuvitId: ktuvitId, subList: subList} 
}

async function search(loginCookie ,type, id){
    var manager = new KtuvitManager(loginCookie);
    try{
        var cinemetaInfo = await getTitleInfo(type, id);
        switch (type){
            case 'movie': 
                return formatSubs(await searchMovie(manager, cinemetaInfo.imdbId,cinemetaInfo.name,cinemetaInfo.year)
                ,loginCookie);
            case 'series':  
                return formatSubs(await searchEpisode(manager, cinemetaInfo.imdbId,cinemetaInfo.name,cinemetaInfo.year,id.split(':')[1],id.split(':')[2])
                , loginCookie);
        }
    } catch (e){
        console.error('search() error:');
        console.log(e);
    }
}

async function getTitleInfo(itemType, itemImdbId){
    
    try{
        var res = await superagent.get(config.cinemeta_url + itemType +'/'+ itemImdbId.split(':')[0] + '.json');
        return {name: res.body.meta.name, year: res.body.meta.year, imdbId: res.body.meta.id};
    } catch (e) {
        console.error('cinemeta error')
        console.log(e)
    }
	
}

function formatSubs(subs,loginCookie) {
    return subs.subList.map(sub => {
        return({
        url: `${config.local}/${loginCookie}/srt?subId=${sub.id}&ktuvitId=${subs.ktuvitId}`,
        lang: 'heb',
        id: `[KTUVIT]${sub.id}`
        })}
    )
}

module.exports = {
    search: search
}
