export default async (canvas, uri, arg, ops) => {
  return new Promise(async (resolve, reject) => {
    const indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
    
    const openDB = async () => {
      // Open the local database used to cache packages
      let db = await new Promise((resolve, reject) => {
        const req = indexedDB.open('EM_PRELOAD_CACHE', 1);
        req.onupgradeneeded = (event) => {
          const targ = event.target.result;
          if (targ.objectStoreNames.contains('PACKAGES'))
            targ.deleteObjectStore('PACKAGES');
          targ.createObjectStore('PACKAGES');
        };
        req.onerror = (error) => {
          reject(error);
        };
        req.onsuccess = (event) => {
          resolve(event.target.result);
        };
      });
      // Check if the database is malformed
      if (!db.objectStoreNames.contains('PACKAGES')) {
        db.close();
        await new Promise((resolve, reject) => {
          const req = indexedDB.deleteDatabase('EM_PRELOAD_CACHE');
          req.onerror = (error) => {
            reject(error);
          }
          req.onsuccess = (event) => {
            resolve(event.target.result);
          }
        });
        db = await openDB();
      }
      return db;
    }
    
    const deletePkg = async (uri) => {
      const db = await openDB();
      // Delete the store package from cache
      const ok = await new Promise((resolve, reject) => {
        const trans = db.transaction(['PACKAGES'], 'readwrite');
        const req = trans.objectStore('PACKAGES').delete(uri);
        req.onerror = (error) => {
          reject(error);
        };
        req.onsuccess = (event) => {
          resolve();
        };
      });
      return ok;
    }
    
    const fetchPkg = async (usecache) => {
      // Open the local database used to cache packages
      const db = await openDB();
      // Check if there's a cached package, and if so whether it's the latest available
      let data = null;
      if (usecache) {
        data = await new Promise((resolve, reject) => {
          const trans = db.transaction(['PACKAGES'], 'readonly');
          const req = trans.objectStore('PACKAGES').get(uri);
          req.onerror = (error) => {
            reject(error);
          };
          req.onsuccess = (event) => {
            resolve(event.target.result);
          };
        });
      }

      // Fetch the package remotely, if we do not have it in local storage
      if (!data || !(data instanceof Uint8Array)) {
        console.log('fetching:'+uri);
        const res = await fetch(uri);
        if (!res.ok)
          return reject('Could not fetch the love package');
        data = await res.arrayBuffer();
        // Check if the header is a valid ZIP archive
        data = new Uint8Array(data);
        const head = [80,75,3,4];
        for (let i = 0; i < head.length; i++)
          if (data[i] != head[i])
            return reject('The fetched resource is not a valid love package');
        // Cache remote package for subsequent requests
        await new Promise((resolve, reject) => {
          const trans = db.transaction(['PACKAGES'], 'readwrite');
          const req = trans.objectStore('PACKAGES').put(data, uri);
          req.onerror = (error) => {
            reject(error);
          };
          req.onsuccess = (event) => {
            resolve();
          };
        });
      };
      return data;
    }
    
    const data = await fetchPkg(!ops.nocache);
    if (!data)
      return reject('Could not parse the package contents');
    
    //const pkg = 'game.love';
    const pkg = uri.substring(uri.lastIndexOf('/') + 1);
    let Module = {};

    const mem = (navigator.deviceMemory || 1)*1e+9;
    Module.INITIAL_MEMORY = Math.min(4*data.length + 2e+7, mem);
    Module.canvas = canvas;
    Module.printErr = window.onerror;
    
    Module.arguments = [pkg];
    if (arg && Array.isArray(arg))
      for (let i = 0; i < arg.length; i++)
        Module.arguments.push(String(arg[i]));

    const runWithFS = async () => {
      Module.addRunDependency('fp '+pkg);
      const ptr = Module.getMemory(data.length);
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
    
    Module.load_libs = async () => {
      // include fetch.lua
      const req = await fetch('./fetch.lua');
      const lua = await req.text();
      Module.FS_createPath('/', '/usr/local/share/lua/5.1', true, true);
      Module.FS_createDataFile('/usr/local/share/lua/5.1', 'fetch.lua', lua, true, true, true);
    }

    if (window.Love === undefined) {
      // this operation initiates local storage
      if (ops.version == null)
        ops.version = '11.5';
      let s = document.createElement('script');
      s.type = 'text/javascript';
      s.src = ops.version + ((ops.compat) ? '/compat/love.js' : '/release/love.js');
      s.async = true;
      s.onload = () => {
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
    const _console = window.console;
    Module._console = _console;
    window.console = {};
    for (let k in _console)
      if (typeof _console[k] == 'function')
        window.console[k] = _console[k].bind(_console);

    window.console.log = async (...args) => {
      const a = args[0];
      if (typeof(a)  === 'string' && a.startsWith('@')) {
        const list = a.match(/^@([^\t]+)\t([^\t]+)\t([^\t]+)\t?(.*)/);
        if (list) {
          let output = '';
          try {
            if (list[1] == 'fetch') {
              // fetch api requests
              const ops = (list[4]) ? JSON.parse(list[4]) : {};
              ops.headers = ops.headers || {};
              if (ops.body && typeof(ops.body) === 'object') {
                const form = new FormData();
                for (let k in ops.body)
                  form.append(k, ops.body[k]);
                ops.body = form;
              }
              const res = await fetch(list[3], ops);
              let code = Array.from(String(res.code), Number);
              while (code.length < 3)
                code.unshift(0);
              code = Uint8Array.from(code);
              let data = await res.arrayBuffer();
              if (data && data.byteLength > 0) {
                output = new Uint8Array(output.byteLength + 3);
                output.set(code, 0);
                output.set(data, 3);
              } else {
                output = code;
              }
            } else if (list[1] == 'speak') {
              // text-to-speech functionality
              const synth = window.speechSynthesis;
              if (synth) {
                if (synth.speaking)
                  synth.cancel();
                const ops = (list[4]) ? JSON.parse(list[4]) : {};
                const utter = new SpeechSynthesisUtterance(list[3]);
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
              const offset = list[2].lastIndexOf('/');
              const base = list[2].substring(offset + 1);
              const path = list[2].substring(0, offset);
              Module.FS_createPath('/', path, true, true);
              Module.FS_createDataFile(path, base, output, true, true, true);
            }
          }
          return;
        }
      }
      return _console.info(...args);
    }
  });
};
