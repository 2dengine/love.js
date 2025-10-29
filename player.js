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
  var Player = {};

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

  Player.fetchPkg = function(uri, nocache, love) {
    return new Promise(function (resolve, reject) {
      var data;
      Player.readPkg(uri)
        .then (function (cache) {
          data = cache;
        })
        .catch (function(e) {
          console.warn(e);
        })
        .finally(function () {
          if (data && !nocache) {
            resolve(data);
            return;
          }
          // Fetch the package remotely
          console.log('fetching:'+uri);
          fetch(uri)
            .then(function (res) {
              if (!res.ok)
                return reject('Could not fetch the love package');
              return res.arrayBuffer();
            })
            .then(function (data) {
              data = new Uint8Array(data);
              if (love) {
                // Check if the header is a valid ZIP archive
                var head = [80,75,3,4];
                for (var i = 0; i < head.length; i++)
                  if (data[i] != head[i])
                    return reject('The fetched resource is not a valid love package');
              }
              // Cache remote package for subsequent requests
              Player.storePkg(uri, data);
              resolve(data);
            });
        });
    });
  }
  
  Player.fetchPkgs = function(uri, nocache) {
    return new Promise(function (resolve, reject) {
      var list = [ uri ];
      list.push('fetch.lua');
      list.push('normalize.lua');
      var loaded = 0;
      var cache = {};
      for (let i = 0; i < list.length; i++) {
        Player.fetchPkg(list[i], nocache, i == 0)
          .then(function (raw) {
            cache[list[i]] = raw;
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

  Player.runPkgs = function(uri, cache, arg, canvas, ops) {
    return new Promise(function (resolve, reject) {
      //var pkg = 'game.love';
      var Module = {};

      var data = cache[uri];
      var mem = (navigator.deviceMemory || 1)*1e+9;
      Module.INITIAL_MEMORY = Math.min(4*data.length + 2e+7, mem);
      Module.canvas = canvas;
      Module.printErr = window.onerror;
      Module.arguments = arg;

      Module.runWithFS = function () {
        // import packages
        Module.FS_createPath('/', '/usr/local/share/lua/5.1', true, true);
        for (var file in cache) {
          var data = cache[file];
          Module.addRunDependency('fp '+file);
          if (file == uri) {
            // game
            var ptr = Module.getMemory(data.length);
            Module.HEAPU8.set(data, ptr);
            Module.FS_createDataFile('/', arg[0], data, true, true, true);
          } else {
            // module
            Module.FS_createDataFile('/usr/local/share/lua/5.1', file, cache[file], true, true, true);
          }
          Module.removeRunDependency('fp '+file);
          Module.finishedDataFileDownloads ++;
        }
      };

      if (Module.calledRun) {
        Module.runWithFS();
      } else {
        // FS is not initialized yet, wait for it
        if (!Module.preRun)
          Module.preRun = [];
        Module.preRun.push(Module.runWithFS);
      }

      if (window.Love === undefined) {
        // this operation initiates local storage
        var version = ops.version ||  '11.5';
        var s = document.createElement('script');
        s.type = 'text/javascript';
        s.src = version + ((ops.compat) ? '/compat/love.js' : '/release/love.js');
        s.async = true;
        s.onload = function () {
          resolve(Module);
        };
        document.body.appendChild(s);
      } else {
        window.Module.pauseMainLoop();
        resolve(Module);
      }

      window.Module = Module;

      if (Module._open)
        return;
      Module._open = window.open;
      window.open = function(url) {
        if (Module.command(url))
          return;
        //return Module._open(url);
        return Module._open.apply(null, arguments);
      }

      // the prompt can send UTF-8 strings to Lua synchronously
      var _prompt = null;
      window.prompt = function(a) {
        var tmp = _prompt;
        _prompt = null;
        return tmp;
      }

      // the following function sends binary data to Lua
      Module.writeFile = function(path, data) {
        if (!path || path == '.')
          return;
        // thanks to Nivas from stackoverflow.com/questions/3820381
        var file = path;
        var base = '/';
        var offset = path.lastIndexOf('/');
        if (offset >= 0) {
          file = path.substring(offset + 1);
          base = path.substring(0, offset);
        }
        Module.FS_createPath('/', base, true, true);
        Module.FS_createDataFile(base, file, data, true, true, true);
      }

      Module.commands = {};

      // fetch requests
      Module.commands.fetch = function(ops) {
        ops = ops || {};
        ops.method = ops.method || 'GET';
        ops.headers = ops.headers || {};
        if (ops.body && typeof(ops.body) === 'object') {
          var form = new FormData();
          for (var k in ops.body)
            form.append(k, ops.body[k]);
          ops.body = form;
        }
        
        var code = 0;
        var data = null;
        fetch(ops.url, ops)
          .then(function (res) {
            code = res.status;
            return res.arrayBuffer();
          })
          .then(function (array) {
            data = array;
          })
          .catch (function (error) {
            var msg = error.toString();
            var bytes = new Uint8Array(msg.length);
            for (var i = 0; i < msg.length; i++)
              bytes[i] = msg.charCodeAt(i);
            data = bytes.buffer;
            console.warn(error);
          })
          .finally (function () {
            var acode = Array.from(String(code), Number);
            while (acode.length < 3)
              acode.unshift(0);
            for (var i = 0; i < acode.length; i++)
              acode[i] += 48;
            acode = Uint8Array.from(acode);
            var length = (data) ? data.byteLength : 0;
            var output = new Uint8Array(length + 3);
            output.set(acode);
            if (data && data.byteLength > 0)
              output.set(new Uint8Array(data), 3);
            Module.writeFile(ops.sink, output);
          });
      }

      // clipboard support
      var _clipboard = false;
      function updateClipboard() {
        // reading from the clipboard can only be done in a secure context
        // and it doesn't work well in Mozilla-based browsers
        navigator.clipboard.readText()
          .then(function (text) {
            _clipboard = text;
          })
          .catch(function (error) {})
          .finally(function() {
            setTimeout(function() {
              updateClipboard();
            }, 10);
          });
      }
      Module.commands.clipboard = async function(ops) {
        if (ops.text !== undefined) {
          _clipboard = ops.text;
          navigator.clipboard.writeText(ops.text)
            .catch(function () {});
          document.execCommand('copy');
        } else {
          if (_clipboard === false) {
            _clipboard = '';
            updateClipboard();
          }
          _prompt = _clipboard;
        }
      }

      // text-to-speech
      Module.commands.speak = function(ops) {
        var synth = window.speechSynthesis;
        if (synth) {
          if (synth.speaking)
            synth.cancel();
          // works in most modern browsers, but not all
          var utter = new SpeechSynthesisUtterance(ops.utterance);
          utter.volume = ops.volume || 1;
          utter.rate = ops.rate || 1;
          synth.speak(utter);
        }
      }

      // package reloading
      Module.commands.reload = function(ops) {
        Player.deletePkgs()
          .then(function () {
            window.location.reload();
          });
      }

      // execute command
      var regex = /^([\w]+)(.*)/;
      Module.command = function (cmd) {
        if (!cmd.startsWith('javascript:'))
          return;
        cmd = cmd.substring(11);
        var matches = regex.exec(cmd);
        if (!matches[1])
          return false;
        var ops;
        try {
          ops = JSON.parse(matches[2]);
        } catch (error) {};
        ops = ops || {};
        var func = Module.commands[matches[1]];
        if (!func)
          return false;
        func(ops);
        return true;
      }

    });

  };

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
  
  // Parse arguments from the URL address
  var url = new URL(script.src);
  if (!url.searchParams.has('g'))
    url = new URL(window.location.href);

  var search = url.searchParams;
  var arg = search.get('arg');
  var uri = search.get('g');
  var ops = {
    compat: search.get('c'),
    version: search.get('v'),
    nocache: search.get('n') == '1',
  };
  if (uri == null)
    uri = 'nogame.love';
  if (arg) {
    try {
      arg = JSON.parse(arg);
      if (!Array.isArray(arg))
        arg = [arg];
    } catch (error) {
      arg = null;
      console.log(error);
    }
  }
  
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
  window.onclick = function (e) {
    window.focus();
  };
/*
  // Disable scrolling while using the arrow keys
  var codes = [37, 38, 39, 40, 13];
  window.onkeydown = window.onkeyup = window.onkeypress = function (e) {
    if (codes.indexOf(e.keyCode || e.which || 0) > -1)
      e.preventDefault();
  }
*/
  // Fixes a persistence bug when using the back and forward buttons
  window.onpageshow = function (event) {
    canvas.style.display = 'none';
    if (event.persisted)
      window.location.reload();
  };
  
  if (!window.SharedArrayBuffer) {
    throw new Error('The Cross-Origin Policy is not configured properly');
    return;
  }

  // Runs the requested package
  Player.runLove = function () {
    spinner.className = 'loading';
    Player.fetchPkgs(uri, ops.nocache)
      .then(function (cache) {
        // prepare arguments
        var pkg = uri.substring(uri.lastIndexOf('/') + 1);
        var varg = [pkg];
        if (arg && Array.isArray(arg))
          for (var i = 0; i < arg.length; i++)
            varg.push(String(arg[i]));

        Player.runPkgs(uri, cache, varg, canvas, ops)
          .then(function (Module) {
            Love(Module);
            canvas.style.display = 'block';
            canvas.focus();
            spinner.className = '';
          });
      })
      .catch(function (err) {
        console.log(err);
        if (uri != 'nogame.love') {
          uri = 'nogame.love';
          arg = null;
          Player.runLove();
        }
      })
  }
  
  Player.runLove();
})();
