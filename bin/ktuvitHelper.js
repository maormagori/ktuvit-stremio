const superagent = require("superagent")
    require('superagent-charset')(superagent),
    jsdom = require('jsdom');

class KtuvitManager {
    
    constructor(loginCookie){
        this.KTUVIT = {
            BASE_URL: "https://www.ktuvit.me/",
            SEARCH_URL: "https://www.ktuvit.me/Services/ContentProvider.svc/SearchPage_search",
            MOVIE_INFO_URL: "https://www.ktuvit.me/MovieInfo.aspx?ID=",
            EPISODE_INFO_URL: "https://www.ktuvit.me/Services/GetModuleAjax.ashx?",
            REQUEST_DOWNLOAD_IDENTIFIER_URL: "https://www.ktuvit.me/Services/ContentProvider.svc/RequestSubtitleDownload",
            DOWNLOAD_SUB_URL: "https://www.ktuvit.me/Services/DownloadFile.ashx?DownloadIdentifier="
        };
        this.loginCookie = loginCookie;
        this.headers = {
            "accept": "application/json, text/javascript, */*; q=0.01",
            "cookie": `Login=${this.loginCookie}`
        }
        
    }
    


    postWithLoginInfo(link, data){
        return new Promise((resolve, reject)=>{
            superagent.post(link)
            .withCredentials()
            //.timeout({deadline: 6000})
            .set(this.headers)
            .send({"request" :data})
            .then((res) => {console.log("PING!"); resolve(res)})
            .catch((err) => {reject(err)})
        })
    }

    getWithLoginInfo(link){
        return new Promise((resolve, reject)=>{
            superagent.get(link)
            .withCredentials()
            //.timeout({deadline: 6000})
            .set(this.headers)
            .then((res) => {console.log("PING!"); resolve(res)})
            .catch((err) => {reject(err)})
        })
    }

    /**
     * 
     * @param {Object} item      The title to search. includes: name, year, type, imdbId. All strings.
     */
    async getKtuvitID(item){

        const query = {"FilmName": item.name,
                    "Actors": [],
                    "Studios": null,
                    "Directors": [],
                    "Genres": [],
                    "Countries": [],
                    "Languages": [],
                    "Year": `${item.year}`.split("-")[0],
                    "Rating": [],
                    "Page": 1,
                    "SearchType": item.type === "movie" ? "0":"1",
                    "WithSubsOnly": false
        };

        console.log(query)

        if (item.type === "movie")
            query.SearchType = "0";
        else
            query.SearchType = "1";

        try{
            let res = await this.postWithLoginInfo(this.KTUVIT.SEARCH_URL,query);
            return this.findIDInResults(res.body, item.imdbId);
        } catch (err) {
            console.log("addHeaders: Bad Request:");
            console.log(err);
        }
        

    }

    findIDInResults(body, imdbId){
        //console.log(body);
        console.log({ImdbId: imdbId,body: body});
        const films = [...JSON.parse(body.d).Films]

        return films.find(title => title.ImdbID == imdbId).ID;
    }

    async getSubsIDsListEpisode(ktuvitID, season, episode){
        
        //bulding the query. A simple query builder string.
        var query_string = `moduleName=SubtitlesList&SeriesID=${ktuvitID}&Season=${season}&Episode=${episode}`

        var res = await this.getWithLoginInfo(this.KTUVIT.EPISODE_INFO_URL+query_string);
        var subtitlesIDs = this.extractSubsFromHtml(res.text);
        //console.log(subtitlesIDs);
        return subtitlesIDs;

    }

    async getSubsIDsListMovie(ktuvitID){
        var res = await this.getWithLoginInfo(this.KTUVIT.MOVIE_INFO_URL+ktuvitID);
        var subtitlesIDs = this.extractSubsFromHtml(res.text);
        return subtitlesIDs;
    }

    extractSubsFromHtml(html) {
        //The episode html only contains the subtitle rows and since I built this function
        //for the movie's html, I need to add the missing information.
        html = html.includes('<!DOCTYPE html>') ? html:`<!DOCTYPE html><table id="subtitlesList"><thead><tr/></thead>${html}</table>`

        var dummyDom = new jsdom.JSDOM(html).window;
        var subtitlesListElement = dummyDom.document.getElementById('subtitlesList');
        subtitlesListElement = [...subtitlesListElement.rows];
        subtitlesListElement.shift();
        //console.log(subtitlesListElement.length);
        var subtitlesIDs = subtitlesListElement.map((sub) => {
            //Getting sub's file name from html.
            //I don't care it's this way, it works.
            //I never learned jquery so don't judge me.
            let subName = sub.cells[0].querySelector("div").innerHTML.split('<br>')[0];
            
            //trimming sub's name
            subName = subName.trim();

            //Getting the sub's ktuvit id.
            let id  = sub.cells[5].firstElementChild.getAttribute('data-subtitle-id');
            return {subName: subName, id: id};
        });

        return subtitlesIDs;
    }

    async downloadSubtitle(KtuvitId, subId, cb, shouldDecode=false){
        const downloadIdentifierRequest = {
            "FilmID": KtuvitId,
            "SubtitleID": subId,
            "FontSize": 0,
            "FontColor": "",
            "PredefinedLayout": -1
        };

        let downloadIdentifier = await this.postWithLoginInfo(this.KTUVIT.REQUEST_DOWNLOAD_IDENTIFIER_URL,downloadIdentifierRequest);
        downloadIdentifier = JSON.parse(downloadIdentifier.body.d).DownloadIdentifier
        
        await superagent.get(this.KTUVIT.DOWNLOAD_SUB_URL + downloadIdentifier)
            .charset('ISO-8859-8')
            .withCredentials()
            .set(this.headers)
            .buffer()
            .then(res => {cb(res)})
            .catch(err => err)
    }

    //Not using this parser. Might be useful to implement it.
    // parseBuffer(res, resolve){
    //     let buffer = [];
    //     res.on('data', (chunk)=>{
    //         buffer.push(iconv.decode(chunk, 'ISO 8859-8'));
    //     });
    //     res.on('end', ()=>
    //         resolve(null, Buffer.concat(buffer)));
    // }

}

const manager = new KtuvitManager("u=7CA271EC2204B13FAE3F3CFE9D24F3AC&g=3B82622A00E8D3D24F982498638320F48803A3A8CED4220DEDCFBE2A06219528853A8A8AFC7589346C15A2979E58EC07")
//manager.getKtuvitID({year: 2008, type: 'series',name: 'Breaking Bad', imdbId: 'tt0903747'}).then(id=>console.log(id));
//manager.getSubsIDsListMovie("3E488DFBF1B06910D8EAD33F60680FF9");
//manager.getSubsIDsListEpisode("C6DCA1F5779E310E8FC2DD53AC4C40FC",4,8);

manager.downloadSubtitle('C6DCA1F5779E310E8FC2DD53AC4C40FC','41E986A04698829FFCE5CFD430C7F4F3',(buffer) => {console.log(buffer)},true);