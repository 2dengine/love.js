# love.js
The standalone love.js player allows you to run LÖVE apps and games on the web.
love.js is based on the previous work by Davidobot and Tanner Rogalsky using Emscripten.
This standalone version is developed by 2dengine LLC and can run .love files directly.
Please support our open source work by visiting https://2dengine.com

## Installation
The love.js player needs to be installed on a web server (it will not work if you open the "index.html" page locally in your browser).
Copy all of the love.js files on you server, preferably in a separate directory.
You need to set the correct HTTP headers from your server for the path where love.js is installed:
```
Header set Cross-Origin-Opener-Policy "same-origin"
Header set Cross-Origin-Embedder-Policy "require-corp"
```
The included .htaccess file sets these headers automatically on most Apache servers.
If it doesn't work in your case, please consider enabling the "AllowOverride" directive and "mod_headers".
If you are running any other kind of web server (NGINX, OpenResty, Windows Server, etc) you will need to configure the correct headers on your own.

## Usage
The player.js script creates an HTML canvas element and renders LÖVE inside that canvas.
You have to use "iframes" if you want to embed multiple instances of love.js on the same page.
The easiest way is to embed the player as follows:
```
<script src="player.js?g=mygame.love"></script>
```
Use the "?g=" parameter to choose which game to run.

Additionally, you can pass an array of arguments to your LÖVE app using the "&arg=" parameter:
```
example.com/player/?g=mygame.love&arg=['--first','--second']
```

You can switch between different versions (11.3, 11.4 or 11.5) of LÖVE using the "&v" parameter:
```
example.com/player/?g=mygame.love&v=11.3
```

## Limitations
love.js is still a work-in-progress and has several known bugs.
The games run slower compared to other platforms since love.js does not take advantage of LuaJIT.
Additionally, WebGL shaders work differently compared to their desktop counterparts.
Certain games may fail to run or crash on systems with limited memory.
love.filesystem may crash if you try to access non-existent files.
There are also some audio compatibility issues especially when streaming music.

## GDPR 2016/679
love.js uses indexedDB to cache game packages and store data on the user's device.
love.js itself is fully GDPR compliant because:
* Any cached data is stored locally and remains exclusively on the user's machine
* None of the scripts featured herein collect or process personal information

If your love.js game collects or processes personal information, you need to include the appropriate warnings yourself.

## Credits
Front-end by 2dengine LLC (MIT License)
https://github.com/2dengine/love.js

Emscripten port by David Khachaturov (MIT License)
https://github.com/Davidobot/love.js

Original port by Tanner Rogalsky (MIT License)
https://github.com/TannerRogalsky/love.js/

CSS spinner by Luke Haas (MIT License)
https://projects.lukehaas.me/css-loaders/
