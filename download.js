require("dotenv").config()

const axios = require('axios');
const fs = require('fs');
const { URL } = require("url");
console.log(process.env)

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

const urlComponents = new URL(process.env.SPOTIFY_URL)

async function main() {
    if (urlComponents.host != "open.spotify.com" || urlComponents.pathname.split("/").length < 3 || !["track", "playlist"].includes(urlComponents.pathname.split("/")[1])) new Error("SPOTIFY_URL host not specified")
    const id = urlComponents.pathname.split("/")[2]
    const type = urlComponents.pathname.split("/")[1]
    const stageParams = await getTrackOrPlaylist(id,type)
    stage2(stageParams.title, stageParams.tracklist)
}

async function stage2(name, list) {
    if (!fs.existsSync(process.env.DIR_NAME_TO_DOWNLOAD)) fs.mkdirSync(process.env.DIR_NAME_TO_DOWNLOAD)
    if (!fs.existsSync(process.env.DIR_NAME_TO_DOWNLOAD + "/" + name)) fs.mkdirSync(process.env.DIR_NAME_TO_DOWNLOAD + "/" + format(name))

    const start_time = Date.now()
    const length = list.length
    list.splice(0, process.env.INDEX_START <= 0 ? 0 : process.env.INDEX_START - 1)
    let count = process.env.INDEX_START <= 0 ? 0 : process.env.INDEX_START - 1

    for (const item of list) {
        count++
        const inter = process.env.INTERVAL.toLowerCase() == "random" ? getRandomNumber(1500, 4500) : process.env.INTERVAL
        console.log(`[${count}/${length}]: Start download ${format(`${item.artists} - ${item.title}`)} (${item.id}). Interval: ${inter}`)
        await start(item.id, name)
        await timeout(inter)
    }

    console.log(`Downloaded: ${count}/${length} complete (${Date.now() - start_time} ms.)`)
}

main()

function getRandomNumber(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}

function start(id, album_name) {
    return new Promise(async (resolve, reject) => {
        const link = await getStream(id)
        await load(link.name, link.link, album_name)
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
            if (type == "playlist") {
                const tracklist = await axios(`https://api.spotifydown.com/trackList/playlist/${id}`, {
                    headers
                })
                resolve({
                    title: answer.data.title,
                    tracklist: tracklist.data.trackList
                })
            } else {
                resolve({
                    title: answer.data.album,
                    tracklist: [answer.data]
                })
            }
        } catch (e) {
            reject(e)
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
                name: format(answer.data.metadata.artists, true) + " - " + format(answer.data.metadata.title),
                link: answer.data.link
            })
        } catch (e) {
            reject(e)
        }
    })
}

function load(title, url, album_name) {
    return new Promise(async (resolve, reject) => {
        try {
            const response = await axios({
                method: 'GET',
                url: url,
                responseType: "stream",
                headers
              });
            
            // Создаем поток для записи файла
            const fileStream = fs.createWriteStream(`${process.env.DIR_NAME_TO_DOWNLOAD}/${album_name}/${title}.mp3`);
        
            // Подписываемся на события для обработки данных и ошибок
            response.data.pipe(fileStream);

            resolve(new Promise((resolve, reject) => {
                fileStream.on('finish', () => {
                  console.log(`Файл успешно загружен по пути: ${`${process.env.DIR_NAME_TO_DOWNLOAD}/${album_name}/${title}.mp3`}`);
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
    if (isAuthor) {
        title_trim = title_trim.split(", ")[0]
    }
    return title_trim
}

function getUserAgent() {
    if (process.env.USER_AGENT == "random" && !fs.existsSync(process.env.PATH_TO_RANDOM_USER_AGENT)) new Error("USER_AGENT must be empty") 
    if (process.env.USER_AGENT == "random") {
        console.log(process.env.PATH_TO_RANDOM_USER_AGENT)
        const userAgents = fs.readFileSync(process.env.PATH_TO_RANDOM_USER_AGENT).toString().split(process.env.USER_AGENT_SEPARATOR)
        return userAgents[getRandomNumber(0, userAgents.length - 1)]
    } else {
        return process.env.USER_AGENT
    }
}