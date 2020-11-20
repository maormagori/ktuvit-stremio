const KtuvitManager = require('../bin/ktuvitHelper');
const config = require('../bin/config');
const superagent = require('superagent');


async function searchMovie(manager, imdbId, name, year){
    const ktuvitId = await manager.getKtuvitID({name: name, year: year, type: 'movie', imdbId: imdbId});
    return await manager.getSubsIDsListMovie(ktuvitId);
}

async function searchEpisode(manager, imdbId, name, year, season, episode){
    const ktuvitId = await manager.getKtuvitID({name: name, year: year, type: 'series', imdbId: imdbId});
    return await manager.getSubsIDsListEpisode(ktuvitId, season, episode);
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
    return subs.map(sub => {
        return({
        url: `${config.local}/${loginCookie}/srt?id=${sub.id}&filename=${sub.subName}`,
        lang: 'heb',
        id: `[KTUVIT]${sub.id}`
        })}
    )
}
search("u=7CA271EC2204B13FAE3F3CFE9D24F3AC&g=3B82622A00E8D3D24F982498638320F48803A3A8CED4220DEDCFBE2A06219528853A8A8AFC7589346C15A2979E58EC07",'movie','tt0800369').then(list=>{console.log(list)})