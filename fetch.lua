--- The fetch module is used to access resources over HTTP and HTTPS.
-- @module fetch
-- @alias fetch
local fetch = {}
love.fetch = fetch

local function tojson(data)
  local list = {}
  for k, v in pairs(data) do
    local t = type(v)
    if t == 'table' then
      v = tojson(v)
    elseif t == 'string' then
      v = string.format('%q', v)
    else
      v = tostring(v)
    end
    table.insert(list, string.format('%q:%s', k, v))
  end
  return '{'..table.concat(list, ',')..'}'
end

local lfs = love.filesystem
local sav = lfs.getSaveDirectory()
local requests = {}

--- Creates a new "fetch" request.
-- All requests are asynchronous and allow you to specify a callback function.
-- @tparam string url URL address
-- @tparam[opt] table ops Table with advanced options such as "body", "method" and "headers"
-- @tparam function func Callback function
-- @treturn string The request handle if successful or nil otherwise
function fetch.request(url, ops, func)
  if type(ops) == 'function' then
    func = ops
    ops = nil
  end
  ops = ops or {}
  ops.body = ops.body or ops.data

  local ok, handle = pcall(os.tmpname)
  if not ok then
    return
  end
  handle = handle:gsub("[/%.]", "")..".tmp"
  -- fetch using love.js
  local json = tojson(ops)
  -- uses the global print function to send data to JS
  print('@fetch', sav..'/'..handle, url, json)

  requests[handle] = func or false
  
  return handle
end

--- Updates all pending fetch requests.
-- Calling this function may trigger any user-defined callbacks.
function fetch.update()
  local marked = {}
  for handle, func in pairs(requests) do
    if lfs.getInfo(handle) then
      local res = lfs.read(handle)
      if res then
        local code = res:sub(1, 3)
        local body = res:sub(4)
        code = tonumber(code) or 0
        lfs.remove(handle)
        table.insert(marked, handle)
        if type(func) == "function" then
          func(code, body)
        end
      end
    end
  end
  for _, handle in ipairs(marked) do
    requests[handle] = nil
  end
end

--- Cleans up temporary fetch files from the user directory.
local list = lfs.getDirectoryItems('')
for _, v in ipairs(list) do
  if v:match('%.tmp$') then
    if lfs.getRealDirectory(v) == sav then
      lfs.remove(v)
    end
  end
end
-- hack required to initialize the "/home/web_user/love" database
lfs.remove('fetch.tmp')

return fetch