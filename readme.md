# love.js
The standalone love.js player allows you to run LÖVE apps and games on the web.
love.js is based on the previous work by Davidobot and Tanner Rogalsky using Emscripten.
This standalone version is developed by 2dengine LLC and can run .love files directly.

The source code is available on [GitHub](https://github.com/2dengine/love.js) and the documentation is hosted on [2dengine.com](https://2dengine.com/doc/lovejs.html)

## Installation
The love.js player needs to be installed on a web server (it will not work if you open the "index.html" page locally in your browser).
Copy all of the love.js files on you server, preferably in a separate directory.
You need to set the correct HTTP headers on your server for the path where love.js is installed:
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
player.js?g=mygame.love&arg=["--first","--second"]
```

You can switch between different versions (11.3, 11.4 or 11.5) of LÖVE using the "&v" parameter:
```
player.js?g=mygame.love&v=11.3
```

For development purposes, you can disable the package-caching feature using the "&n" parameter:
```
player.js?g=mygame.love&n=1
```

Alternatively, you can flush the package cache and reload the page using:
```
love.event.push("quit", "reload")
```

## Limitations
We have developed a front-end that doesn't require building and can be used by both English and non-English speakers.
Nevertheless, "love.js" desperately needs refactoring which will take a lot of work.
love.js is still a work-in-progress and has several known bugs.

The games run slower compared to other platforms since love.js does not take advantage of LuaJIT.
Certain games may fail to run or crash on systems with limited memory.
Rendering works quite well across browsers although we have noticed font-related glitches.
Additionally, WebGL shaders work differently compared to their desktop counterparts.
There are some audio compatibility issues especially when streaming music.

We hope to get these issues resolved in the future.
Make sure to support our work, so we can continue developing this project.

## HTTP and HTTPS
This version of love.js includes "fetch.lua", a module that allows you to make HTTP/HTTPS requests.
"fetch.lua" works asynchronously, using callbacks:
```
function love.load
  love.fetch = require("fetch")
  love.fetch.request("https://2dengine.com/", function(code, body)
    print(code, body)
  end)
end

function love.update(dt)
  love.fetch.update()
end
```
"fetch.lua" is an experimental module and is not perfect by any means.
Please use it at your own discretion.

## Privacy
love.js uses indexedDB to cache game packages and store data on the user's device.
love.js itself is fully GDPR compliant because:
* Any cached data is stored locally and remains exclusively on the user's machine
* None of the scripts featured herein collect or process personal information

If your love.js game collects or processes personal information, you need to include the appropriate warnings yourself.

## Credits
[Front-end and improvements](https://github.com/2dengine/love.js) by 2dengine LLC (MIT License)

[Emscripten port](https://github.com/Davidobot/love.js) by David Khachaturov (MIT License)

[Original port](https://github.com/TannerRogalsky/love.js/) by Tanner Rogalsky (MIT License)

[CSS spinner](https://projects.lukehaas.me/css-loaders/) by Luke Haas (MIT License)

[print](https://github.com/MrcSnm/Love.js-Api-Player) technique by Marcelo Silva Nascimento Mancini (MIT License)

[io.read](https://github.com/HamdyElzanqali/love-with-js) technique by Hamdy Elzanqali

Please support our open source work by visiting https://2dengine.com
