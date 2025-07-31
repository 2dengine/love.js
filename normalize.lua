-- Hacks which ensure that love.js behaves more closely to the downloadable version

local lfs = love.filesystem

local _lfs_getInfo = lfs.getInfo
local _lfs_read = lfs.read
function lfs.read(fn, ...)
  if not _lfs_getInfo(fn, 'file') then
    return nil, 'File does not exist: '..fn
  end
  return _lfs_read(fn, ...)
end

local _lfs_newFile = lfs.newFileData
function lfs.newFileData(fn, arg, ...)
  if not arg and not _lfs_getInfo(fn, 'file') then
    return nil, 'File does not exist: '..fn
  end
  return _lfs_newFile(fn, arg, ...)
end

local reg = debug.getregistry()
if not reg then
  return
end

local _File_open = reg.File.open
reg.File.open = function(file, ...)
  local fn = file:getFilename()
  if not _lfs_getInfo(fn) then
    return nil, 'File does not exist: '..fn
  end
  return _File_open(file, ...)
end