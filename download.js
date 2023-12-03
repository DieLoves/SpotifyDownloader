require("dotenv").config()

const axios = require('axios');
const fs = require('fs');
const { URL } = require("url");
const NodeID3 = require('node-id3');
const { verify } = require("crypto");

const headers = {
    "User-Agent": getUserAgent(),
    Origin: "https://spotifydown.com",
    Referer: "https://spotifydown.com/"
}

// const path_to_load_list = "./list.json"
// const path_to_dir_load = "./Loki"
// const index_start = 36

// let interval = "random"

// const list = require(path_to_load_list)

if (!process.env.SPOTIFY_URL) new Error("SPOTIFY_URL not found")
if (!process.env.DIR_NAME_TO_DOWNLOAD) new Error("DIR_NAME_TO_DOWNLOAD not found")
if (!process.env.INDEX_START) new Error("INDEX_START not found")
if (!process.env.INTERVAL) new Error("INTERVAL not found")
if (!process.env.USER_AGENT) new Error("USER_AGENT not found")
if (!process.env.PATH_TO_RANDOM_USER_AGENT) new Error("PATH_TO_RANDOM_USER_AGENT not found")
if (!process.env.INTERVAL_RANDOM_FROM) new Error("INTERVAL_RANDOM_FROM not found")
if (!process.env.INTERVAL_RANDOM_TO) new Error("INTERVAL_RANDOM_TO not found")
if (!process.env.DOWNLOAD_IMAGE_ALBUM) new Error("DOWNLOAD_IMAGE_ALBUM not found")
if (!process.env.SPECIFY_AUTHOR_IN_TITLE) new Error("SPECIFY_AUTHOR_IN_TITLE not found")


// const proxy = process.env.USE_PROXY == "true" ? process.env.PROXY_DATA == "random" ? verify(getRandomProxy(process.env.PROXY_LIST_PATH, process.env.PROXY_PROTOCOL)) : verify({ protocol: process.env.PROXY_PROTOCOL, host: process.env.PROXY_DATA.split(":")[0], port: process.env.PROXY_DATA.split(":")[1]}) : false

let urlComponents

try {
    urlComponents = new URL(process.env.SPOTIFY_URL)
} catch (e) {
    console.error("This is...id?")
}

async function main() {
    if (!urlComponents || urlComponents.host == "spotify.link") {
        console.log("Loading...please wait... (max. 20 seconds)")
        const { id, type } = await convert(process.env.SPOTIFY_URL, !urlComponents)
        const stageParams = await getTrackOrPlaylist(id,type)
        stage2(stageParams.title, stageParams.tracklist, stageParams.cover)
    } else if (urlComponents.host != "open.spotify.com" || urlComponents.pathname.split("/").length < 3 || !["track", "playlist", "album"].includes(urlComponents.pathname.split("/")[1])) new Error("SPOTIFY_URL host not specified")
    else {
        const id = urlComponents.pathname.split("/")[2]
        const type = urlComponents.pathname.split("/")[1]
        const stageParams = await getTrackOrPlaylist(id,type)
        stage2(stageParams.title, stageParams.tracklist, stageParams.cover)
    }
}

async function stage2(name, list, cover) {
    if (!fs.existsSync(process.env.DIR_NAME_TO_DOWNLOAD)) fs.mkdirSync(process.env.DIR_NAME_TO_DOWNLOAD)
    if (!fs.existsSync(process.env.DIR_NAME_TO_DOWNLOAD + "/" + name)) fs.mkdirSync(process.env.DIR_NAME_TO_DOWNLOAD + "/" + format(name))

    if (process.env.DOWNLOAD_IMAGE_ALBUM == "true") {
        await axios(cover, {
            headers,
            responseType: "arraybuffer"
        }).then((res) => fs.writeFileSync(process.env.DIR_NAME_TO_DOWNLOAD + "/" + format(name) + "/albumImage.png", res.data))
        .catch((err) => console.log())
    }
    const start_time = Date.now()
    const length = list.length
    list.splice(0, process.env.INDEX_START <= 0 ? 0 : process.env.INDEX_START - 1)
    let count = process.env.INDEX_START <= 0 ? 0 : process.env.INDEX_START - 1

    for (const item of list) {
        count++
        const inter = process.env.INTERVAL.toLowerCase() == "random" ? getRandomNumber(process.env.INTERVAL_RANDOM_FROM, process.env.INTERVAL_RANDOM_TO) : process.env.INTERVAL
        console.log(`[${count}/${length}]: Start download ${format(`${item.artists} - ${item.title}`)} (${item.id}). Interval: ${inter}`)
        await start(item.id, name, item.cover, item.artists)
        await timeout(inter)
    }

    console.log(`Downloaded: ${count}/${length} complete (${Date.now() - start_time} ms.)`)
}

main()

function getRandomNumber(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}

function start(id, album_name, cover, artists) {
    return new Promise(async (resolve, reject) => {
        const link = await getStream(id)
        await load(link.name, link.link, album_name, cover, artists)
        resolve(true)
    })
}

function timeout(time) {
    return new Promise(async (resolve, reject) => {
        setTimeout(() => resolve(true), time)
    })
}

function getTrackOrPlaylist(id, type) {
    return new Promise(async (resolve, reject) => {
        try {
            const answer = await axios(`https://api.spotifydown.com/metadata/${type}/${id}`, {
                headers
            })
            if (answer.data.success == false) {
                console.log(answer.data)
                process.exit(0)
            }
            if (type == "playlist" || type == "album") {
                const tracklist = await axios(`https://api.spotifydown.com/trackList/${type}/${id}`, {
                    headers
                })
                resolve({
                    title: answer.data.title,
                    cover: answer.data.cover,
                    tracklist: tracklist.data.trackList
                })
            } else {
                resolve({
                    title: answer.data.album,
                    cover: answer.data.cover,
                    tracklist: [answer.data]
                })
            }
        } catch (e) {
            reject(e)
        }
    })
}

function convert(id, isID) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log(`https://spotify.link/${id}`)
            const answer = await axios(`https://api.spotifydown.com/convertUrl/${isID ? encodeURIComponent(`https://spotify.link/${id}`) : encodeURIComponent(id)}`, {
                method: "get",
                headers
            })
            console.log({
                type: answer.data.type,
                id: answer.data.id
            })   
            resolve({
                type: answer.data.type,
                id: answer.data.id
            })   
        } catch (e) {
            console.error(e)
            reject("URL invalid")
        }
    })
}

function getStream(id) {
    return new Promise(async (resolve, reject) => {
        try {
            const answer = await axios("https://api.spotifydown.com/download/" + id, {
                method: "get",
                headers
            })
            resolve({
                name: Boolean(process.env.SPECIFY_AUTHOR_IN_TITLE) ? format(answer.data.metadata.artists, true) + " - " + format(answer.data.metadata.title) : format(answer.data.metadata.title),
                link: answer.data.link
            })
        } catch (e) {
            reject(e)
        }
    })
}

function load(title, url, album_name, cover, artist) {
    return new Promise(async (resolve, reject) => {
        try {
            const response = await axios({
                method: 'GET',
                url: url,
                responseType: "stream",
                headers
              });

            const path_to_dir = `${process.env.DIR_NAME_TO_DOWNLOAD}/${album_name}`
            const path = `${process.env.DIR_NAME_TO_DOWNLOAD}/${album_name}/${title}.mp3`
            
            // Создаем поток для записи файла
            const fileStream = fs.createWriteStream(path);
        
            // Подписываемся на события для обработки данных и ошибок
            response.data.pipe(fileStream);

            resolve(new Promise(async (resolve, reject) => {
                fileStream.on('finish', async () => {
                  console.log(`Файл успешно загружен по пути: ${path}`);
                  if (cover) {
                    await downloadCover(path_to_dir + `/${title}.png`, cover)
                    
                    const success = NodeID3.write({ APIC: path_to_dir + `/${title}.png`, album: album_name, artist }, path)
                    if (!success) {
                        console.error(`Failed to write cover`)
                    }
                    fs.rmSync(path_to_dir + `/${title}.png`)
                  }
                  resolve();
                });
            
                fileStream.on('error', (err) => {
                  console.error('Ошибка при загрузке файла:', err.message);
                  reject(err);
                });
              }))
        } catch (e) {
            reject(e)
        }
    })
}

function downloadCover(path, cover) {
    return new Promise(async(resolve, reject) => {
        await axios(cover, {
            headers,
            responseType: "arraybuffer"
        }).then((res) => {
            fs.writeFileSync(path, res.data)
            resolve(true)
        })
        .catch((err) => reject(err))
    })
}

function format(title, isAuthor = false) {
    function escapeRegExp(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    const list_blocked_chars = ["\\", "/", ":", "*", "?", '"', "<", ">", "|", "+", "%", "!", "@", ","]
    const list_blocked_end_string = ["."]
    let title_trim = title.trim()
    for (const char of list_blocked_chars) {
        if (isAuthor && char == ",") continue
        const escapedChar = escapeRegExp(char);
        title_trim = title_trim.replace(new RegExp(escapedChar  , "gi"), "_");
    }
    for (const char of list_blocked_end_string) {
        if (title_trim.endsWith(char)) {
            title_trim = title_trim.slice(0, title_trim.length - 1)
        }
    }
    if (isAuthor && title_trim.length > 150) {
        title_trim = title_trim.split(", ")[0]
    }
    return title_trim
}

async function getRandomProxy(path, protocol, isVerify = true) {
    return new Promise(async (resolve, reject) => {
        if (isURL(path)) {
            const proxys = await axios(path)
            .catch(e => {
                console.error(`Get proxy list failed: ${e.toString()}`)
                reject(new Error(e))
            }) 
            const proxy_split = proxys.data.toString().split(process.env.PROXY_LIST_SEPARATOR).map(x => x.replaceAll("\r", ""))
            if (proxy_split && isVerify) {
                for (const proxy_next of proxy_split) {
                    const proxy = proxy_next.split(":")
                    if (!proxy || proxy.length > 2) continue
                    await axios(headers.Origin, {
                        proxy: {
                            host: proxy[0],
                            port: proxy[1]
                        }
                    }).then(res => {
                        resolve({
                            host: proxy[0],
                            port: proxy[1]
                        })
                    })
                    .catch(e => {
                        console.error(`Proxy ${proxy_next} failed: ${e.toString()}`)
                    })
                }
            }
        } else {
            if (!fs.existsSync(path)) new Error("PROXY_LIST must be empty")
            const proxys = fs.readFileSyn(path).toString().split(process.env.PROXY_LIST_SEPARATOR).map(x => x.replaceAll("\r", ""))
            if (isVerify) {
                for (const proxy_next of proxys) {
                    const proxy = proxy_next.split(":")
                    if (!proxy || proxy.length > 2) continue
                    await axios(headers.Origin, {
                        proxy: {
                            host: proxy[0],
                            port: proxy[1]
                        }
                    }).then(res => {
                        resolve({
                            host: proxy[0],
                            port: proxy[1]
                        })
                    })
                    .catch(e => {
                        console.error(`Proxy ${proxy_next} failed: ${e.toString()}`)
                    })
                }
            }
        }
    })
}

function isURL(var1) {
    try {
        new URL(var1)
        return true
    } catch (e) {
        return false
    }
}

function getUserAgent() {
    if (process.env.USER_AGENT == "random" && !fs.existsSync(process.env.PATH_TO_RANDOM_USER_AGENT)) new Error("USER_AGENT must be empty") 
    if (process.env.USER_AGENT == "random") {
        console.log(process.env.PATH_TO_RANDOM_USER_AGENT)
        const userAgents = fs.readFileSync(process.env.PATH_TO_RANDOM_USER_AGENT).toString().split(process.env.USER_AGENT_SEPARATOR).map(x => x.replaceAll("\r", ""))
        return userAgents[getRandomNumber(0, userAgents.length - 1)]
    } else {
        return process.env.USER_AGENT
    }
}