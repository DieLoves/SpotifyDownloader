require("dotenv").config()

const axios = require('axios');
const fs = require('fs');
const { URL } = require("url");
const NodeID3 = require('node-id3');
const { verify } = require("crypto");

const {
    SPOTIFY_URL,
    DIR_NAME_TO_DOWNLOAD,
    INDEX_START,
    INTERVAL,
    USER_AGENT,
    PATH_TO_RANDOM_USER_AGENT,
    INTERVAL_RANDOM_FROM,
    INTERVAL_RANDOM_TO,
    DOWNLOAD_IMAGE_ALBUM,
    SPECIFY_AUTHOR_IN_TITLE,
} = process.env;

const envs = ["SPOTIFY_URL", "DIR_NAME_TO_DOWNLOAD", "INDEX_START", "INTERVAL", "USER_AGENT", "PATH_TO_RANDOM_USER_AGENT", "INTERVAL_RANDOM_FROM", "INTERVAL_RANDOM_TO", "DOWNLOAD_IMAGE_ALBUM", "SPECIFY_AUTHOR_IN_TITLE"]

function validateEnvVariables(envVars) {
    for (const envVar of envVars) {
        if (!process.env[envVar]) {
            throw new Error(`${envVar} not found in environment variables`);
        }
    }
}

function initialize() {
    validateEnvVariables(envs);
}

const headers = {
    "User-Agent": USER_AGENT == "random" ? getUserAgent() : USER_AGENT,
    Origin: "https://spotifydown.com",
    Referer: "https://spotifydown.com/"
};

async function main() {
    try {
        initialize();
        const urlComponents = new URL(SPOTIFY_URL);
        let id, type;
        if (urlComponents.host == "open.spotify.com" && urlComponents.pathname.split("/").length >= 3 && ["track", "playlist", "album"].includes(urlComponents.pathname.split("/")[1])) {
            id = urlComponents.pathname.split("/")[2];
            type = urlComponents.pathname.split("/")[1];
        } else {
            console.log("Loading...please wait... (max. 20 seconds)");
            const { id: convertedId, type: convertedType } = await convert(SPOTIFY_URL, urlComponents.host !== "spotify.link");
            id = convertedId;
            type = convertedType;
        }
        const stageParams = await getTrackOrPlaylist(id, type);
        console.log(stageParams)
        await stage2(stageParams.title, stageParams.tracklist, stageParams.cover);
    } catch (e) {
        console.error(e.message);
    }
}

async function stage2(name, list, cover) {
    const dirPath = `${DIR_NAME_TO_DOWNLOAD}/${name}`;
    await fs.mkdirSync(dirPath, { recursive: true });
    if (DOWNLOAD_IMAGE_ALBUM === "true") {
        try {
            const response = await axios.get(cover, {
                headers,
                responseType: "arraybuffer"
            });
            await fs.writeFileSync(`${dirPath}/albumImage.png`, response.data);
        } catch (error) {
            console.error("Failed to download album image:", error.message);
        }
    }
    const startIndex = INDEX_START <= 0 ? 0 : INDEX_START - 1;
    const itemsToDownload = list.slice(startIndex);
    for (let i = 0; i < itemsToDownload.length; i++) {
        const item = itemsToDownload[i];
        const interval = INTERVAL.toLowerCase() === "random" ? getRandomNumber(INTERVAL_RANDOM_FROM, INTERVAL_RANDOM_TO) : INTERVAL;
        console.log(`[${i + 1}/${itemsToDownload.length}]: Start download ${format(`${item.artists} - ${item.title}`)} (${item.id}). Interval: ${interval}`);
        await start(item.id, name, item.cover, item.artists);
        await timeout(interval);
    }
    console.log(`Downloaded: ${itemsToDownload.length}/${list.length} complete`);
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
    return new Promise((resolve, reject) => {
        axios.get(`https://api.spotifydown.com/metadata/${type}/${id}`, { headers })
            .then((response) => {
                if (!response.data.success) {
                    console.log(response.data);
                    process.exit(0);
                }
                const result = {
                    title: response.data.title,
                    cover: response.data.cover,
                    tracklist: []
                };
                if (type === "playlist" || type === "album") {
                    return axios.get(`https://api.spotifydown.com/trackList/${type}/${id}`, { headers })
                        .then((tracklistResponse) => {
                            result.tracklist = tracklistResponse.data.trackList;
                            resolve(result);
                        });
                } else {
                    result.tracklist.push(response.data);
                    resolve(result);
                }
            })
            .catch((error) => {
                reject(error);
            });
    });
}


async function convert(id, isID) {
    const url = `https://api.spotifydown.com/convertUrl/${isID ? encodeURIComponent(`https://spotify.link/${id}`) : encodeURIComponent(id)}`;
    const response = await axios.get(url, { headers });
    return { id: response.data.id, type: response.data.type };
}

function getStream(id) {
    return new Promise(async (resolve, reject) => {
        try {
            const answer = await axios("https://api.spotifydown.com/download/" + id, {
                method: "get",
                headers
            })
            resolve({
                name: process.env.SPECIFY_AUTHOR_IN_TITLE == "true" ? format(answer.data.metadata.artists, true) + " - " + format(answer.data.metadata.title) : format(answer.data.metadata.title),
                link: answer.data.link
            })
        } catch (e) {
            reject(e)
        }
    })
}

async function load(title, url, album_name, cover, artist) {
    try {
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: "stream",
            headers
        });

        const path_to_dir = `${process.env.DIR_NAME_TO_DOWNLOAD}/${album_name}`;
        const path = `${path_to_dir}/${title}.mp3`;

        const fileStream = fs.createWriteStream(path);

        response.data.pipe(fileStream);

        return new Promise((resolve, reject) => {
            fileStream.on('finish', async () => {
                console.log(`File successfully downloaded to: ${path}`);
                if (cover) {
                    await downloadCover(`${path_to_dir}/${title}.png`, cover);

                    const success = NodeID3.write({ APIC: `${path_to_dir}/${title}.png`, album: album_name, artist }, path);
                    if (!success) {
                        console.error(`Failed to write cover`);
                    }
                    fs.rmSync(`${path_to_dir}/${title}.png`);
                }
                resolve();
            });

            fileStream.on('error', (err) => {
                console.error('Error downloading file:', err.message);
                reject(err);
            });
        });
    } catch (error) {
        return Promise.reject(error);
    }
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
    const listBlockedChars = ["\\", "/", ":", "*", "?", '"', "<", ">", "|", "+", "%", "!", "@", ","];
    const listBlockedEndString = ["."];

    let formattedTitle = title.trim();

    // Replace blocked characters with underscores
    for (const char of listBlockedChars) {
        if (isAuthor && char === ",") continue;
        const escapedChar = char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedChar, "gi");
        formattedTitle = formattedTitle.replace(regex, "_");
    }

    // Remove blocked end strings
    for (const char of listBlockedEndString) {
        if (formattedTitle.endsWith(char)) {
            formattedTitle = formattedTitle.slice(0, -1);
        }
    }

    // Truncate title if it exceeds 150 characters and is an author
    if (isAuthor && formattedTitle.length > 150) {
        formattedTitle = formattedTitle.split(", ")[0];
    }

    return formattedTitle;
}


// Maybe....
// async function getRandomProxy(path, protocol, isVerify = true) {
//     return new Promise(async (resolve, reject) => {
//         if (isURL(path)) {
//             const proxys = await axios(path)
//             .catch(e => {
//                 console.error(`Get proxy list failed: ${e.toString()}`)
//                 reject(new Error(e))
//             })
//             const proxy_split = proxys.data.toString().split(process.env.PROXY_LIST_SEPARATOR).map(x => x.replaceAll("\r", ""))
//             if (proxy_split && isVerify) {
//                 for (const proxy_next of proxy_split) {
//                     const proxy = proxy_next.split(":")
//                     if (!proxy || proxy.length > 2) continue
//                     await axios(headers.Origin, {
//                         proxy: {
//                             host: proxy[0],
//                             port: proxy[1]
//                         }
//                     }).then(res => {
//                         resolve({
//                             host: proxy[0],
//                             port: proxy[1]
//                         })
//                     })
//                     .catch(e => {
//                         console.error(`Proxy ${proxy_next} failed: ${e.toString()}`)
//                     })
//                 }
//             }
//         } else {
//             if (!fs.existsSync(path)) new Error("PROXY_LIST must be empty")
//             const proxys = fs.readFileSyn(path).toString().split(process.env.PROXY_LIST_SEPARATOR).map(x => x.replaceAll("\r", ""))
//             if (isVerify) {
//                 for (const proxy_next of proxys) {
//                     const proxy = proxy_next.split(":")
//                     if (!proxy || proxy.length > 2) continue
//                     await axios(headers.Origin, {
//                         proxy: {
//                             host: proxy[0],
//                             port: proxy[1]
//                         }
//                     }).then(res => {
//                         resolve({
//                             host: proxy[0],
//                             port: proxy[1]
//                         })
//                     })
//                     .catch(e => {
//                         console.error(`Proxy ${proxy_next} failed: ${e.toString()}`)
//                     })
//                 }
//             }
//         }
//     })
// }

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