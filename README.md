# SpotifyDownloader
### v. 1.3

## Required for installation:
1. node.js (https://nodejs.org/en/download/current)

## Instructions:
1) Install node.js
2) Clone the package from the repository ```git clone https://github.com/DieLoves/SpotifyDownloader```
3) Go through the terminal to the downloaded repository
4) Customize the .env file to your liking
5) Write ```npm run start```

## That you will be able to download thanks to the script:
- [x] Download playlists by links and IDs
- [x] Download tracks by links and IDs
- [x] Download albums by links and IDs
- [x] Download playlists/tracks/albums via shortened links (https://spotify.link)
- [x] Support randomization to timing
- [x] Support changing track artwork
- [x] Support changing track tags
- [ ] Support downloading all tracks from an artist by link and IDs

## .env file Documentation
| FIELD                                                                                                                              | Description                                                                                                                                                             | Supported data type |
|------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------|
| SPOTIFY_URL                                                                                                                        | Link or IDs to the album/playlist/track                                                                                                                                 | **str**             |
| DIR_NAME_TO_DOWNLOAD                                                                                                               | Folder path for uploading albums/playlists/tracks there                                                                                                                 | **str**             |
| INDEX_START                                                                                                                        | Which track in the album/playlist to start downloading from. The default is 0, so the download will start from the first track                                          | **int**             |
| INTERVAL                                                                                                                           | The interval to be used between track downloads. You can specify "random" in this case a random number will be generated in the range specified in the following fields | **int**             |
| INTERVAL_RANDOM_FROM                                                                                                               | Range for the interval in case of "random" value. Here you specify the minimum value for the range                                                                      | **int**             |
| INTERVAL_RANDOM_TO                                                                                                                 | Range for the interval in case of "random" value. Here you specify the maximum value for the range.                                                                     | **int**             |
| USER_AGENT                                                                                                                         | You can specify your USER-AGENT or use the value "random" to use a random USER_AGENT                                                                                    | **str**             |
| PATH_TO_RANDOM_USER_AGENT                                                                                                          | Path to the .txt file where USER_AGENT will be taken from if "random" is specified in the USER_AGENT field.                                                             | **str** |
| USER_AGENT_SEPARATOR | A field in which you can insert a separator, by which the script will take a random USER_AGENT from the file.                                                           | **str** |
| DOWNLOAD_IMAGE_ALBUM                                                                                                               | Whether to upload an album photo and save it in the album/playlist/track folder? | **boolean** |
| SPECIFY_AUTHOR_IN_TITLE | Use only the track title without the author (the author will be indicated in the track tags in any case) | **boolean** |

## Author:
[DieLoves](https://github.com/DieLoves)