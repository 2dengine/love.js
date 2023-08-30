# love.js
The standalone love.js player allows you to run Love2D games on the web.
This player is based on the previous work of Davidobot and Tanner Rogalsky using Emscripten.
The standalone version is maintained and developed by: https://2dengine.com

## Installation
Copy all of the love.js files on you server, preferably in a separate directory.
To run or embed the love.js player, you need to set the correct HTTP headers on your server.
The included .htaccess file sets these headers automatically on most Apache servers.
If you are running any other kind of web server (NGINX, OpenResty, Windows Server, etc) you will need to to configure the correct headers on your own (see "Cross-Origin-Opener-Policy" and "Cross-Origin-Embedder-Policy").

## Usage
The player.js script creates an HTML canvas element and renders Love2D inside that canvas.
You have to use "iframes" if you want to embed multiple instances of love.js on the same page.
The easiest way is to embed the player as follows:
```
<script src="player.js?g=mygame.love"></script>
```
Please note that we use the "?g=" parameter to choose which game to run.

Additionally, you can pass an array of arguments to your game using the "&arg=" parameter:
```
example.com/player/?g=mygame.love&arg=['--first','--second']
```

## Limitations
love.js is still a work-in-progress and has several known bugs.
The games run slower compared to other platforms since love.js does not take advantage of LuaJIT.
Additionally, WebGL shaders work differently compared to their desktop counterparts.
Certain games may fail to run or crash on systems with limited memory.
love.filesystem may crash if you try to access non-existent files.
There are some audio compatibility issues especially when streaming music.

## GDPR 2016/679
love.js uses indexedDB to cache game packages and store data on the user's device.
love.js shows a consent dialog in accordance with GDPR 2016/679.
If you have already obtained consent from the data subject you can skip the cookie consent dialog as follows:
```
indexedDB.open('EM_PRELOAD_CACHE', 1);
```

## Credits
Front-end by 2dengine LLC (MIT License)
https://github.com/2dengine/love.js

Emscripten port by David Khachaturov (MIT License)
https://github.com/Davidobot/love.js

Original port by Tanner Rogalsky (MIT License)
https://github.com/TannerRogalsky/love.js/

CSS spinner by Luke Haas (MIT License)
https://projects.lukehaas.me/css-loaders/