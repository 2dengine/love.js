export default async (canvas, uri, arg, version, compat) => {
  return new Promise(async (resolve, reject) => {      
    const fetchPkg = async () => {
      // Open the local database used to cache packages
      const db = await new Promise((resolve, reject) => {
        //const indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
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
            resolve();
          }
        });
        return await fetchPkg();
      }
        
      // Check if there's a cached package, and if so whether it's the latest available
      let data = await new Promise((resolve, reject) => {
        const trans = db.transaction(['PACKAGES'], 'readonly');
        const meta = trans.objectStore('PACKAGES');
        //const getRequest = meta.get('package/'+pkg);
        const getRequest = meta.get(uri);
        getRequest.onerror = (error) => {
          reject(error);
        };
        getRequest.onsuccess = (event) => {
          resolve(event.target.result);
        };
      });

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
          const packages = trans.objectStore('PACKAGES');
          //const req = packages.put(data, 'package/'+pkg);
          const req = packages.put(data, uri);
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
    
    const pkg = 'game.love'; //uri.substring(uri.lastIndexOf('/') + 1);
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

      // Copy the entire loaded file into a spot in the heap.
      // Files will refer to slices in the heap, but cannot be freed
      // (we may be allocating before malloc is ready, during startup).
      if (Module['SPLIT_MEMORY'])
        Module.printErr('warning: you should run the file packager with --no-heap-copy when SPLIT_MEMORY is used, otherwise copying into the heap may fail due to the splitting');

      //const data = await fetchPkg();
      const ptr = Module.getMemory(data.length);
      Module['HEAPU8'].set(data, ptr);
      Module.FS_createDataFile(pkg, null, data, true, true, true);
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

    if (window.Love === undefined) {
      // this operation initiates local storage
      if (version == null)
        version = '11.5';
      let s = document.createElement('script');
      s.type = 'text/javascript';
      s.src = version + ((compat) ? '/compat/love.js' : '/release/love.js');
      s.async = true;
      s.onload = () => {
        Love(Module);
      };
      document.body.appendChild(s);
    } else {
      window.Module.pauseMainLoop();
      Love(Module);
    }

    window.Module = Module;
  });
};
