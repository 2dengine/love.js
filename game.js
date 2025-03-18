export default async (canvas, uri, arg, ops) => {
  return new Promise(async (resolve, reject) => {
    const indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
    const fetchPkg = async () => {
      // Open the local database used to cache packages
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open('EM_PRELOAD_CACHE', 1);
        req.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (db.objectStoreNames.contains('PACKAGES'))
            db.deleteObjectStore('PACKAGES');
          db.createObjectStore('PACKAGES');
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
            resolve();
          }
        });
        return await fetchPkg();
      }
        
      // Check if there's a cached package, and if so whether it's the latest available
      let data = null;
      if (!ops.nocache) {
        data = await new Promise((resolve, reject) => {
          const trans = db.transaction(['PACKAGES'], 'readonly');
          const store = trans.objectStore('PACKAGES');
          //const req = store.get('package/'+pkg);
          const req = store.get(uri);
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
          const store = trans.objectStore('PACKAGES');
          //const req = store.put(data, 'package/'+pkg);
          const req = store.put(data, uri);
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
    
    const data = await fetchPkg();
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
      //const data = await fetchPkg();
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
      if (typeof(a)  === 'string' && a.startsWith('@fetch')) {
        const list = a.match(/^@fetch\t([^\t]+?)\t([^\t]+)\t?(.*)/);
        if (list && list.length >= 2) {
          let code = 0;
          let output = '';
          try {
            const ops = (list[3]) ? JSON.parse(list[3]) : {};
            ops.headers = ops.headers || {};
            if (ops.body && typeof(ops.body) === 'object') {
              const form = new FormData();
              for (let k in ops.body)
                form.append(k, ops.body[k]);
              ops.body = form;
            }
            const res = await fetch(list[2], ops);
            code = res.status;
            //output = await res.text();
            output = await res.arrayBuffer();
          } catch (error) {
            output = error;
            _console.warn(error);
          } finally {
            let scode = '000'+code.toString();
            scode = scode.substr(scode.length - 3);
            scode = scode.split('').map(x => x.charCodeAt());
            scode = Uint8Array.from(scode);
            let data = scode;
            if (output.byteLength > 0) {
              data = new Uint8Array(output.byteLength + 3);
              data.set(Uint8Array.from(scode), 0);
              data.set(new Uint8Array(output), 3);
            }
            // thanks to Nivas from stackoverflow.com/questions/3820381
            const offset = list[1].lastIndexOf('/');
            const base = list[1].substring(offset + 1);
            const path = list[1].substring(0, offset);
            Module.FS_createPath('/', path, true, true);
            Module.FS_createDataFile(path, base, data, true, true, true);
          }
          return;
        }
      }
      return _console.info(...args);
    }
  });
};
