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
      req.onerror(function (e) {
        reject(e);
      });
      req.onsuccess(function (db) {
        resolve();
      });
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

      if (Module._console)
        return;
      
      var _console = window.console;
      Module._console = _console;
      
      Module.writeFile = function(path, data) {
        if (!path || path == '.')
          return;
        // thanks to Nivas from stackoverflow.com/questions/3820381
        var offset = path.lastIndexOf('/');
        var base = path.substring(offset + 1);
        var path = path.substring(0, offset);
        Module.FS_createPath('/', path, true, true);
        Module.FS_createDataFile(path, base, data, true, true, true);
      }

      Module.commands = {};

      // fetch requests
      Module.commands.fetch = function(args) {
        var output = '';
        var ops = (args[4]) ? JSON.parse(args[4]) : {};
        ops.headers = ops.headers || {};
        if (ops.body && typeof(ops.body) === 'object') {
          var form = new FormData();
          for (var k in ops.body)
            form.append(k, ops.body[k]);
          ops.body = form;
        }
        var code = 0;
        fetch(args[3], ops)
          .then(function (res) {
            code = Array.from(String(res.status), Number);
            return res.arrayBuffer();
          })
          .then(function (data) {
            while (code.length < 3)
              code.unshift(0);
            for (var i = 0; i < code.length; i++)
              code[i] += 48;
            code = Uint8Array.from(code);
            if (data && data.byteLength > 0) {
              output = new Uint8Array(data.byteLength + 3);
              output.set(code);
              output.set(new Uint8Array(data), 3);
            } else {
              output = code;
            }
          })
          .catch (function (error) {
            output = error;
            _console.warn(error);
          })
          .finally (function () {
            Module.writeFile(args[2], output);
          });
      }

      // clipboard support
      Module.commands.clipboard = function(args) {
        Module.pauseMainLoop();
        var output = '';
        navigator.clipboard.readText()
          .then(function (text) {
            output = text;
          })
          .catch (function (error) {
            _console.warn(error);
          })
          .finally (function () {
            Module.writeFile(args[2], output);
            Module.resumeMainLoop();
          });
      }

      // text-to-speech
      Module.commands.speak = function(args) {
        var synth = window.speechSynthesis;
        if (synth) {
          if (synth.speaking)
            synth.cancel();
          var ops = (args[4]) ? JSON.parse(args[4]) : {};
          var utter = new SpeechSynthesisUtterance(args[3]);
          utter.volume = ops.volume;
          utter.rate = ops.rate;
          synth.speak(utter);
          output = 'true';
        } else {
          output = 'false';
        }
        Module.writeFile(args[2], output);
      }

      // package reloading
      Module.commands.reload = function(args) {
        deletePkgs()
          .then(function () {
            window.location.reload();
          });
      }

      // execute command
      Module.command = function (cmd) {
        var args = cmd.match(/^([^\t]+)\t([^\t]+)\t([^\t]+)\t?(.*)/);
        if (!args)
          return;
        var func = Module.commands[args[1]];
        if (func)
          func(args);
      }

      // grab the console and process fetch requests
      window.console = {};
      for (var k in _console)
        if (typeof _console[k] == 'function')
          window.console[k] = _console[k].bind(_console);

      // handle custom Lua messages from the console
      window.console.log = function () {
        var a = arguments[0];
        if (typeof(a) === 'string' && a.startsWith('@'))
          Module.command(a.substring(1));
        return _console.info.apply(null, arguments);
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

  // Disable scrolling using the arrow keys
  var prevent = [37, 38, 39, 40, 13];
  window.onkeydown = function (e) {
    if (prevent.indexOf(e.keyCode) > -1)
      e.preventDefault();
  }

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
