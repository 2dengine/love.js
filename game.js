var Module;

if (typeof Module === 'undefined')
  Module = eval('(function() { try { return Module || {} } catch(e) { return {} } })()');

Module.MAX_MEMORY = (navigator.deviceMemory || 1)*1e+9;
Module.INITIAL_MEMORY = Math.floor(Module.MAX_MEMORY/6);

var LoadModule = function(uri, arg) {
  let pkg = uri.substring(uri.lastIndexOf('/') + 1);
  
  var runWithFS = function() {
    // Fetch a package from the specified URL
    function fetchRemotePackage(url, callback) {
      let xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'arraybuffer';
      xhr.onerror = function(event) {
        throw new Error(url);
      };
      xhr.onload = function(event) {
        if (xhr.status == 200 || xhr.status == 304 || xhr.status == 206 || (xhr.status == 0 && xhr.response))
          callback(xhr.response);
        else
          throw new Error(xhr.statusText);
      };
      xhr.send(null);
    };
    // Check if there's a cached package, and if so whether it's the latest available
    function fetchCachedPackage(db, packageName, callback) {
      let transaction = db.transaction(['PACKAGES'], "readonly");
      let meta = transaction.objectStore('PACKAGES');
      let getRequest = meta.get("package/" + packageName);
      getRequest.onerror = function(error) {
        throw new Error(error);
      };
      getRequest.onsuccess = function(event) {
        callback(event.target.result);
      };
    };
    function cacheRemotePackage(db, packageName, packageData, callback) {
      var transaction_packages = db.transaction(['PACKAGES'], "readwrite");
      var packages = transaction_packages.objectStore('PACKAGES');
      var putPackageRequest = packages.put(packageData, "package/" + packageName);
      putPackageRequest.onsuccess = function(event) {
        if (callback)
          callback(packageData);
      };
    };
    function openDatabase(indexedDB, callback) {
      let openRequest;
      try {
        openRequest = indexedDB.open("EM_PRELOAD_CACHE", 1);
      } catch (error) {
        throw new Error(error);
        return;
      }
      openRequest.onerror = function(error) {
        throw new Error(error);
      };
      openRequest.onupgradeneeded = function(event) {
        let db = event.target.result;
        if(db.objectStoreNames.contains('PACKAGES'))
          db.deleteObjectStore('PACKAGES');
        let packages = db.createObjectStore('PACKAGES');
      };
      openRequest.onsuccess = function(event) {
        callback(event.target.result);
      };
    };

    function processPackageData(buffer) {
      Module.finishedDataFileDownloads ++;
      if (!buffer || !(buffer instanceof ArrayBuffer)) {
        throw new Error('Processing package data failed');
        return false;
      }
      let byteArray = new Uint8Array(buffer);
      // Copy the entire loaded file into a spot in the heap.
      // Files will refer to slices in the heap, but cannot be freed
      // (we may be allocating before malloc is ready, during startup).
      if (Module['SPLIT_MEMORY'])
        Module.printErr('warning: you should run the file packager with --no-heap-copy when SPLIT_MEMORY is used, otherwise copying into the heap may fail due to the splitting');
      let ptr = Module.getMemory(byteArray.length);
      Module['HEAPU8'].set(byteArray, ptr);
      Module.FS_createDataFile(pkg, null, byteArray, true, true, true);
      Module.removeRunDependency('fp '+pkg);
      Module.loadingComplete();
      return true;
    };

    Module.addRunDependency('fp '+pkg);
    let indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
    openDatabase(indexedDB, function(db) {
      fetchCachedPackage(db, pkg, function(result) {
        if (!result || !processPackageData(result)) {
          fetchRemotePackage(pkg, function(data) {
            cacheRemotePackage(db, pkg, data);
            processPackageData(data);
          });
        };
      });
    });
  }
  
  Module.INITIAL_MEMORY = Math.min(Module.INITIAL_MEMORY, Module.MAX_MEMORY);
  Module.arguments = [pkg];
  if (arg)
    for (let i = 0; i < arg.length; i++)
      Module.arguments.push(String(arg[i]));

  if (Module.calledRun) {
    runWithFS();
  } else {
    // FS is not initialized yet, wait for it
    if (!Module.preRun) Module.preRun = [];
    Module.preRun.push(runWithFS);
  }

  Love(Module);
}
