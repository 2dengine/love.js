(function() {
  function startGame(canvas, uri, arg, ops) {
    return new Promise(async function (resolve, reject) {
      var indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
      var openDB = async function () {
        if (!indexedDB) {
          console.warn('IndexedDB is not supported');
          return null;
        }
        // Open the local database used to cache packages
        var db = await new Promise(function (resolve, reject) {
          var req = indexedDB.open('EM_PRELOAD_CACHE', 1);
          req.onupgradeneeded = function (event) {
            var targ = event.target.result;
            if (targ.objectStoreNames.contains('PACKAGES'))
              targ.deleteObjectStore('PACKAGES');
            targ.createObjectStore('PACKAGES');
          };
          req.onerror = function (error) {
            reject(error);
          };
          req.onsuccess = function (event) {
            resolve(event.target.result);
          };
        });
        // Check if the database is malformed
        if (!db.objectStoreNames.contains('PACKAGES')) {
          db.close();
          await new Promise(function (resolve, reject) {
            var req = indexedDB.deleteDatabase('EM_PRELOAD_CACHE');
            req.onerror = function (error) {
              reject(error);
            }
            req.onsuccess = function (event) {
              resolve(event.target.result);
            }
          });
          db = await openDB();
        }
        return db;
      }

      var deletePkg = async function (uri) {
        var db = await openDB();
        // Delete the store package from cache
        var ok = await new Promise(function (resolve, reject) {
          var trans = db.transaction(['PACKAGES'], 'readwrite');
          var req = trans.objectStore('PACKAGES').delete(uri);
          req.onerror = function (error) {
            reject(error);
          };
          req.onsuccess = function (event) {
            resolve();
          };
        });
        return ok;
      }
      
      var fetchPkg = async function (usecache) {
        // Open the local database used to cache packages
        var db = await openDB();
        // Check if there's a cached package, and if so whether it's the latest available
        var data = null;
        if (usecache && db) {
          data = await new Promise(function (resolve, reject) {
            var trans = db.transaction(['PACKAGES'], 'readonly');
            var req = trans.objectStore('PACKAGES').get(uri);
            req.onerror = function (error) {
              reject(error);
            };
            req.onsuccess = function (event) {
              resolve(event.target.result);
            };
          });
        }

        // Fetch the package remotely, if we do not have it in local storage
        if (!data || !(data instanceof Uint8Array)) {
          console.log('fetching:'+uri);
          var res = await fetch(uri);
          if (!res.ok)
            return reject('Could not fetch the love package');
          data = await res.arrayBuffer();
          // Check if the header is a valid ZIP archive
          data = new Uint8Array(data);
          var head = [80,75,3,4];
          for (var i = 0; i < head.length; i++)
            if (data[i] != head[i])
              return reject('The fetched resource is not a valid love package');
          // Cache remote package for subsequent requests
          if (db) {
            await new Promise(function (resolve, reject) {
              var trans = db.transaction(['PACKAGES'], 'readwrite');
              var req = trans.objectStore('PACKAGES').put(data, uri);
              req.onerror = function (error) {
                reject(error);
              };
              req.onsuccess = function (event) {
                resolve();
              };
            });
          }
        };
        return data;
      }

      var data = await fetchPkg(!ops.nocache);
      if (!data)
        return reject('Could not parse the package contents');
      //var pkg = 'game.love';
      var pkg = uri.substring(uri.lastIndexOf('/') + 1);
      var Module = {};

      var mem = (navigator.deviceMemory || 1)*1e+9;
      Module.INITIAL_MEMORY = Math.min(4*data.length + 2e+7, mem);
      Module.canvas = canvas;
      Module.printErr = window.onerror;
      
      Module.arguments = [pkg];
      if (arg && Array.isArray(arg))
        for (var i = 0; i < arg.length; i++)
          Module.arguments.push(String(arg[i]));

      var runWithFS = async function () {
        Module.addRunDependency('fp '+pkg);
        var ptr = Module.getMemory(data.length);
        Module['HEAPU8'].set(data, ptr);
        Module.FS_createDataFile('/', pkg, data, true, true, true);
        Module.removeRunDependency('fp '+pkg);

        resolve(Module);
        Module.finishedDataFileDownloads ++;
      }

      if (Module.calledRun) {
        runWithFS();
      } else {
        // FS is not initialized yet, wait for it
        if (!Module.preRun)
          Module.preRun = [];
        Module.preRun.push(runWithFS);
      }
      
      Module.load_libs = async function () {
        // include fetch.lua
        var req = await fetch('./fetch.lua');
        var lua = await req.text();
        Module.FS_createPath('/', '/usr/local/share/lua/5.1', true, true);
        Module.FS_createDataFile('/usr/local/share/lua/5.1', 'fetch.lua', lua, true, true, true);
      }

      if (window.Love === undefined) {
        // this operation initiates local storage
        if (ops.version == null)
          ops.version = '11.5';
        var s = document.createElement('script');
        s.type = 'text/javascript';
        s.src = ops.version + ((ops.compat) ? '/compat/love.js' : '/release/love.js');
        s.async = true;
        s.onload = function () {
          Love(Module);
          Module.load_libs();
        };
        document.body.appendChild(s);
      } else {
        window.Module.pauseMainLoop();
        Love(Module);
        Module.load_libs();
      }

      window.Module = Module;

      if (Module._console)
        return;
      
      // grab the console and process fetch requests
      var _console = window.console;
      Module._console = _console;
      window.console = {};
      for (var k in _console)
        if (typeof _console[k] == 'function')
          window.console[k] = _console[k].bind(_console);

      // handle custom Lua messages from the console
      //window.console.log = async function (...args) {
      window.console.log = async function () {
        //var a = args[0];
        var a = arguments[0];
        if (typeof(a)  === 'string' && a.startsWith('@')) {
          var list = a.match(/^@([^\t]+)\t([^\t]+)\t([^\t]+)\t?(.*)/);
          if (list) {
            var output = '';
            try {
              if (list[1] == 'fetch') {
                // fetch api requests
                var ops = (list[4]) ? JSON.parse(list[4]) : {};
                ops.headers = ops.headers || {};
                if (ops.body && typeof(ops.body) === 'object') {
                  var form = new FormData();
                  for (var k in ops.body)
                    form.append(k, ops.body[k]);
                  ops.body = form;
                }
                var res = await fetch(list[3], ops);
                var code = Array.from(String(res.status), Number);
                while (code.length < 3)
                  code.unshift(0);
                for (var i = 0; i < code.length; i++)
                  code[i] += 48;
                code = Uint8Array.from(code);

                var data = await res.arrayBuffer();
                if (data && data.byteLength > 0) {
                  output = new Uint8Array(data.byteLength + 3);
                  output.set(code);
                  output.set(new Uint8Array(data), 3);

                } else {
                  output = code;
                }
              } else if (list[1] == 'speak') {
                // text-to-speech functionality
                var synth = window.speechSynthesis;
                if (synth) {
                  if (synth.speaking)
                    synth.cancel();
                  var ops = (list[4]) ? JSON.parse(list[4]) : {};
                  var utter = new SpeechSynthesisUtterance(list[3]);
                  utter.volume = ops.volume;
                  utter.rate = ops.rate;
                  synth.speak(utter);
                  output = 'true';
                } else {
                  output = 'false';
                }
              } else if (list[1] == 'reload') {
                // package reloading
                await deletePkg(uri);
                window.location.reload();
              }
            } catch (error) {
              output = error;
              _console.warn(error);
            } finally {
              // thanks to Nivas from stackoverflow.com/questions/3820381
              if (list[2] && list[2] != '.') {
                var offset = list[2].lastIndexOf('/');
                var base = list[2].substring(offset + 1);
                var path = list[2].substring(0, offset);
                Module.FS_createPath('/', path, true, true);
                Module.FS_createDataFile(path, base, output, true, true, true);
              }
            }
            return;
          }
        }
        //return _console.info(...args);
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

  // Runs the requested package
  window.runLove = function () {
    //state = 'loading';
    spinner.className = 'loading';
    startGame(canvas, uri, arg, ops)
      .then(function (res) {
        canvas.style.display = 'block';
        canvas.focus();
        spinner.className = '';
      })
      .catch(function (err) {
        console.log(err);
        if (uri != 'nogame.love') {
          uri = 'nogame.love';
          arg = null;
          window.runLove();
        }
      });
  }
  
  // Handling errors
  //window.alert = window.onerror = function (msg) {
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

  // Disable window scrolling using the arrow keys
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

  window.runLove();
})();
