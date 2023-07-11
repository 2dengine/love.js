export default async (canvas, uri, arg) => {
  return new Promise((resolve, reject) => {
    let Module = {}; //window.Module;
    //if (typeof Module === 'undefined')
      //Module = eval('(function() { try { return Module || {} } catch(e) { return {} } })()');

    const mem = (navigator.deviceMemory || 1)*1e+9;
    Module.INITIAL_MEMORY = Math.floor(mem/6);
    Module.canvas = canvas;

    const pkg = uri.substring(uri.lastIndexOf('/') + 1);
    Module.arguments = [pkg];
    if (arg && Array.isArray(arg))
      for (let i = 0; i < arg.length; i++)
        Module.arguments.push(String(arg[i]));
      
    //let result = null;

    const runWithFS = async () => {
      Module.addRunDependency('fp '+pkg);

      // Open the local database used to cache packages
      const db = await new Promise((resolve, reject) => {
        const indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
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
      
      // Check if there's a cached package, and if so whether it's the latest available
      let data = await new Promise((resolve, reject) => {
        const trans = db.transaction(['PACKAGES'], 'readonly');
        const meta = trans.objectStore('PACKAGES');
        const getRequest = meta.get('package/'+pkg);
        getRequest.onerror = (error) => {
          reject(error);
        };
        getRequest.onsuccess = (event) => {
          resolve(event.target.result);
        };
      });
    
      // Fetch the package remotely, if we do not have it in local storage
      if (!data || !(data instanceof ArrayBuffer)) {
        console.log(uri);
        const res = await fetch(uri);
        if (!res.ok)
          return reject('Could not fetch the package');
        data = await res.arrayBuffer();

        // Cache remote package for subsequent requests
        await new Promise((resolve, reject) => {
          const trans = db.transaction(['PACKAGES'], 'readwrite');
          const packages = trans.objectStore('PACKAGES');
          const req = packages.put(data, 'package/'+pkg);
          req.onerror = (error) => {
            reject(error);
          };
          req.onsuccess = (event) => {
            resolve();
          };
        });
      };
      
      let byteArray = new Uint8Array(data);
      // Copy the entire loaded file into a spot in the heap.
      // Files will refer to slices in the heap, but cannot be freed
      // (we may be allocating before malloc is ready, during startup).
      if (Module['SPLIT_MEMORY'])
        Module.printErr('warning: you should run the file packager with --no-heap-copy when SPLIT_MEMORY is used, otherwise copying into the heap may fail due to the splitting');
      let ptr = Module.getMemory(byteArray.length);
      Module['HEAPU8'].set(byteArray, ptr);
      Module.FS_createDataFile(pkg, null, byteArray, true, true, true);
      Module.removeRunDependency('fp '+pkg);
      //if (Module.loadingComplete)
        //Module.loadingComplete();
      //result = 'loaded';
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
      let s = document.createElement('script');
      s.type = 'text/javascript';
      s.src = 'release/love.js';
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