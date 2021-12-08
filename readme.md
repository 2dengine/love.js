# love.js
The standalone version of the love.js player allows you to run Love2D game on the web.
This player is based on the previous work of Davidobot and Tanner Rogalsky using Emscripten.

## Installation
Copy all the files on you server and drop your .love project files in the same directory.
Please make sure NOT to overwrite your existing .htaccess files on your Apache server.
You can use the ?g=mygame.love parameter to choose which game to run.
Memory allocation in megabytes is controlled using the following: ?g=mygame.love&m=500
If not specified, the game will use about a sixth of the total system memory.
Player controls can be enabled using the following: ?g=mygame.love&f=1

## Credits
https://github.com/Davidobot/love.js
https://github.com/TannerRogalsky/love.js/