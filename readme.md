# love.js
The standalone version of the love.js player allows you to run Love2D game on the web.
This player is based on the previous work of Davidobot and Tanner Rogalsky using Emscripten.
The standalone version is maintained and developed by: https://2dengine.com

## Installation
Copy all the files on you server and drop your .love project files in the same directory.
Please make sure NOT to overwrite your existing .htaccess files on your Apache server.

## Usage
You can use the following URL parameter to choose which game to run:
```
example.com/player/?g=mygame.love
```
The player will use about a sixth of the total system memory by default.
Memory allocation in megabytes is controlled using the following parameter:
```
example.com/player/?g=mygame.love&m=500
```
Player controls can be enabled using the following parameter:
```
example.com/player/?g=mygame.love&f=1
```

## Cookie consent
To disable the cookie consent dialog you need to call the following function before the game loads:
```
setCookie('cookie_consent', true);
```

## Credits
https://github.com/Davidobot/love.js

https://github.com/TannerRogalsky/love.js/

https://projects.lukehaas.me/css-loaders/