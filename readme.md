# love.js
The standalone version of the love.js player allows you to run Love2D games on the web.
This player is based on the previous work of Davidobot and Tanner Rogalsky using Emscripten.
The standalone version is maintained and developed by: https://2dengine.com

## Installation
Copy all of the love.js files on you server, preferably in a separate directory.
To run or embed the love.js player, you need to set the correct HTTP headers on your server.
The included .htaccess file sets these headers automatically on most Apache servers.
If you are running any other kind of web server (NGINX, OpenResty, Windows Server, etc) you will need to to configure the correct headers on your own (see "Cross-Origin-Opener-Policy" and "Cross-Origin-Embedder-Policy").

## Usage
We use the following URL parameter "?g=" to choose which game to run:
```
example.com/player/?g=mygame.love
```
You can pass an array of arguments to your game using the "&arg=" parameter:
```
example.com/player/?g=mygame.love&arg=['--first','--second']
```
Some games may fail to run on systems with limited system memory.

## Cookie consent
To skip the cookie consent dialog you need to call the following function:
```
window.runLove();
```

## Credits
https://github.com/Davidobot/love.js (MIT)

https://github.com/TannerRogalsky/love.js/ (MIT)

https://projects.lukehaas.me/css-loaders/ (MIT)