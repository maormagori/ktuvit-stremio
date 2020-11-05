const superagent = require("superagent");

const KTUVIT = {
    BASE_URL: "https://www.ktuvit.me/",
    SEARCH_URL: BASE_URL+"Services/ContentProvider.svc/SearchPage_search",
}
function addHeaders(link, data){
    const headers = {
        "accept": "application/json, text/javascript, */*; q=0.01",
        "cookie": "Login=u=7CA271EC2204B13FAE3F3CFE9D24F3AC&g=3B82622A00E8D3D24F982498638320F48803A3A8CED4220DEDCFBE2A06219528853A8A8AFC7589346C15A2979E58EC07"
    }
    return new Promise((resolve, reject)=>{
        superagent.post(link)
        .withCredentials()
        .set(headers)
        .send(data)
        .then((res) => {resolve(res)})
        .catch((err) => {reject(err)})
    })
    
}


addHeaders('https://www.ktuvit.me/Services/ContentProvider.svc/SearchPage_search',{"request":{"FilmName":"breaking bad","Actors":[],"Studios":null,"Directors":[],"Genres":[],"Countries":[],"Languages":[],"Year":"2008","Rating":[],"Page":1,"SearchType":"1","WithSubsOnly":false}}).then(res=>console.log(res))