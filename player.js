/*
This file is part of "love.js" by 2dengine.
https://2dengine.com/doc/lovejs.html

MIT License

Copyright (c) 2022 2dengine LLC

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

(function() {
  // DOM
  var script = document.currentScript;
  var canvas = document.getElementById('canvas');
  if (!canvas) {
    canvas = document.createElement('CANVAS');
    canvas.id = 'canvas';
    script.parentNode.insertBefore(canvas, script);
  }
  canvas.oncontextmenu = function () {
    event.preventDefault();
  }
  
  var spinner = document.getElementById('spinner');
  if (!spinner) {
    spinner = document.createElement('DIV');
    spinner.id = 'spinner';
    script.parentNode.after(spinner, script);
  }
  spinner.className = 'pending';

  // Actual player object
  var Player = {};
  window.Player = Player;
  
  Player.version = '11.5';
  Player.cache = true;
  Player.arg = [];
  Player.uri = 'nogame.love';
  
  // Opens the IndexedDB connection
  var indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
  Player.openDB = function () {
    return new Promise(function (resolve, reject) {
      if (!indexedDB)
        reject('IndexedDB is not supported');
      // Open the local database used to cache packages
      var req = indexedDB.open('EM_PRELOAD_CACHE', 1);
      req.onupgradeneeded = function (event) {
        var db = event.target.result;
        if (db.objectStoreNames.contains('PACKAGES'))
          db.deleteObjectStore('PACKAGES');
        db.createObjectStore('PACKAGES');
      };
      req.onerror = function (error) {
        reject(error);
      };
      req.onsuccess = function (event) {
        // Check if the database is malformed
        var db = event.target.result;
        if (!db.objectStoreNames.contains('PACKAGES')) {
          db.close();
          var req2 = indexedDB.deleteDatabase('EM_PRELOAD_CACHE');
          req2.onerror = function (error) {
            reject(error);
          }
          req2.onsuccess = function (event) {
            resolve(db);
          }
        } else {
          resolve(db);
        }
      };
    });
  }

  // Deletes a stored IndexedDB package
  Player.deletePkg = function (uri) {
    // Delete the store package from cache
    return new Promise(function (resolve, reject) {
      Player.openDB()
        .then(function (db) {
          var trans = db.transaction(['PACKAGES'], 'readwrite');
          var req = trans.objectStore('PACKAGES').delete(uri);
          req.onerror = function (error) {
            reject(error);
          };
          req.onsuccess = function (event) {
            resolve();
          };
        })
        .catch(function (e) {
          reject(e);
        });
    });
  }
  
  // Deletes all stored IndexedDB packages
  Player.deletePkgs = function () {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.deleteDatabase('PACKAGES');
      req.onerror = function (e) {
        reject(e);
      };
      req.onsuccess = function (e) {
        resolve();
      };
    });
  }
  
  // Stores binary data into an IndexedDB package
  Player.storePkg = function(uri, data) {
    return new Promise(function (resolve, reject) {
      Player.openDB()
        .then(function (db) {
          var trans = db.transaction(['PACKAGES'], 'readwrite');
          var req = trans.objectStore('PACKAGES').put(data, uri);
          req.onerror = function (error) {
            reject(error);
          };
          req.onsuccess = function (event) {
            resolve();
          };
        })
        .catch(function (e) {
          reject(e);
        });
    });
  }
  
  // Reads the cached IndexedDB package
  Player.readPkg = function (uri) {
    return new Promise(function (resolve, reject) {
      Player.openDB()
        .then(function (db) {
          // Check if there's a cached package, and if so whether it's the latest available
          var trans = db.transaction(['PACKAGES'], 'readonly');
          var req = trans.objectStore('PACKAGES').get(uri);
          req.onerror = function (error) {
            reject(error);
          };
          req.onsuccess = function (event) {
            resolve(event.target.result);
          };
        })
        .catch(function (e) {
          reject(e);
        });
    });
  }

  // Fetches the package
  Player.requestPkg = function(uri) {
    return new Promise(function (resolve, reject) {
      var data;
      Player.readPkg(uri)
        .then (function (raw) {
          data = raw;
        })
        .catch (function(e) {
          console.warn(e);
        })
        .finally(function () {
          if (data && Player.cache) {
            resolve({ data: data, name: uri });
            return;
          }
          // Fetch the package remotely
          console.log('fetching:'+uri);
          fetch(uri, { credentials: "same-origin" })
            .then(function (res) {
              if (!res.ok)
                return reject('Could not fetch the love package');
              return res.arrayBuffer();
            })
            .then(function (data) {
              data = new Uint8Array(data);
              if (uri.endsWith('.love') || uri.endsWith('.zip')) {
                // Check if the header is a valid ZIP archive
                var head = [80,75,3,4];
                for (var i = 0; i < head.length; i++)
                  if (data[i] != head[i])
                    return reject('The fetched resource is not a valid love package');
              }
              // Cache remote package for subsequent requests
              Player.storePkg(uri, data);
              resolve({ data: data, name: uri });
            });
        });
    });
  }
  
  // Fetches all required packages
  Player.requestPkgs = function(uri) {
    return new Promise(function (resolve, reject) {
      var list = [ uri ];
      list.push('lua/normalize1.lua');
      list.push('lua/normalize2.lua');
      list.push('11.5/love.wasm');
      var loaded = 0;
      var cache = {};
      for (var i = 0; i < list.length; i++) {
        Player.requestPkg(list[i])
          .then(function (pkg) {
            cache[pkg.name] = pkg.data;
            loaded ++;
            if (list.length == loaded)
              resolve(cache);
          })
          .catch (function(e) {
            reject(e);
          });
      }
    });
  }
  
  // Appends and loads a script element
  Player.script = function(uri, func) {
    var s = document.createElement('script');
    s.type = 'text/javascript';
    s.src = uri;
    s.async = true;
    s.onload = func;
    document.body.appendChild(s);
  }

  // Runs the requested package
  Player.start = function (uri, arg) {    
    spinner.className = 'loading';
    uri = uri || Player.uri;
    arg = arg || Player.arg;
    Player.uri = uri;
    Player.arg = arg;

    // prepare arguments
    var vargs = arg.slice();
    var pkg = uri.substring(uri.lastIndexOf('/') + 1);
    vargs.unshift(pkg);
    
    Player.requestPkgs(uri)
      .then(function (cache) {
        var Module = window.Module || {};
        window.Module = Module;
        
        if (Module.exit)
          Module.exit(0);

        // allocate memory based on the system and package size
        var memory = (navigator.deviceMemory || 1)*1e+9;
        Module.INITIAL_MEMORY = Math.min(4*cache[uri].length + 2e+7, memory);
        Module.canvas = canvas;
        Module.warn = window.onerror;
        Module.args = vargs;
        Module.cache = cache;

        // import packages
        Module.prerun = function() {
          Module.FS.mkdirTree('/usr/local/share/lua/5.1');
          for (var file in cache) {
            var cfile = cache[file];
            if (file == uri) {
              // game
              //var ptr = Module.getMemory(cfile.length);
              //Module.HEAPU8.set(cfile, ptr);
              Module.FS.createDataFile('/', vargs[0], cfile, true, true, true);
            } else {
              // modules
              var fn = file.split('/').pop();
              Module.FS.createDataFile('/usr/local/share/lua/5.1', fn, cfile, true, true, true);
            }
          }
        };

        Module.postrun = function() {
          // hide the spinner
          canvas.style.display = 'block';
          canvas.focus();
          spinner.className = '';
        }
        
        if (window.Love === undefined) {
          // this operation initiates local storage
          Player.script(Player.version+'/love.js', function () {
            window.Love(Module);
          });
        } else {
          //Module.Browser.pauseMainLoop();
          window.Love(Module);
        }

        // capture commands
        if (Module._open)
          return;
        //Module._open = window.open;
        Module._open = window.open.bind(window);
        window.open = function(url) {
          // evaluate the JavaScript string
          if (url.startsWith('javascript:')) {
            url = url.substring(11);
            try {
              window._output = eval(url);
            } catch (e) {
              console.warn(e);
            }
            return;
          }
          return Module._open(url);
        }

        // the prompt can send UTF-8 strings to Lua synchronously
        window._output = null;
        //window.output = function(s) {
        //  _output = s;
        //}

        window.prompt = function(a) {
          var tmp = window._output;
          window._output = null;
          return tmp; // UTF8ToString(tmp);
        }
      })
      .catch(function (err) {
        console.log(err);
        if (uri != 'nogame.love')
          Player.start('nogame.love', []);
      })
  }
  
  // Event handling
  // Handling errors
  window.onerror = function (msg) {
    console.error(msg);
    if (spinner.className != '') {
      canvas.style.display = 'none';
      spinner.className = 'error';
    }
  };

  // Focus when running inside an iFrame
  window.onload = window.focus.bind(window);
  
  // Handle touch and mouse input
  window.onclick = window.ontouchstart = function (e) {
    window.focus();
  };
  
  // Disable scrolling while using the arrow keys
  var codes = [37, 38, 39, 40, 13];
  window.onkeydown = window.onkeyup = window.onkeypress = function (e) {
    if (codes.indexOf(e.keyCode || e.which || 0) > -1)
      e.preventDefault();
  }

  // Fix persistence issues when navigating back and forth
  window.onpageshow = function (event) {
    canvas.style.display = 'none';
    if (event.persisted)
      window.location.reload();
      //Player.start();
  };

  // Tries to sync the file-system when navigating away
  // This is not reliable, since async operations are not allowed at this point
  window.onbeforeunload = function(event) {
    // todo: love.event.exit when navigating away
    if (window.Module && window.Module.exit)
      window.Module.exit(0);
  };

  // Parse arguments from the URL address
  var url = new URL(script.src);
  if (!url.searchParams.has('g'))
    url = new URL(window.location.href);

  var search = url.searchParams;
  Player.version = search.get('v');
  if (search.get('n') == '1') {
    console.warn('disabling cache');
    Player.cache = false;
  }
  // ignore invalid version arguments
  if (Player.version != '11.5')
    Player.version = '11.5';
  
  var uri = search.get('g');
  if (uri == null)
    uri = 'nogame.love';
  
  var arg = search.get('arg');
  if (arg) {
    try {
      arg = JSON.parse(arg);
      if (!Array.isArray(arg)) {
        arg = [arg];
        for (var i = 0; i < arg.length; i++)
          arg[i] = String(arg[i]);
      }
    } catch (error) {
      console.warn(error);
    }
  }
  if (!Array.isArray(arg))
    arg = [];
  
  if (uri == 'norun')
    return;
  
  Player.start(uri, arg);
})();
