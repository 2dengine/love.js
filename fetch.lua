--[[
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
]]

--- The fetch module is used to access resources over HTTP and HTTPS.
-- It requires love.js and depends on normalize.js to work
-- @module fetch
-- @alias fetch
local fetch = {}
love.fetch = fetch

local lfs = love.filesystem
local sav = lfs.getSaveDirectory()
local requests = {}

--- Creates a new "fetch" request.
-- All requests are asynchronous by default and allow you to specify a callback function.
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
  ops.method = ops.method or 'GET'
  ops.body = ops.body or ops.data

  local ok, handle = pcall(os.tmpname)
  if not ok then
    if type(func) == "function" then
      func(0, 'Could not create new fetch request')
    end
    return
  end
  handle = handle:gsub("[/%.]", "").."_fetch.tmp"
  ops.url = url
  ops.sink = sav..'/'..handle
  -- fetch using love.js
  love.system.js('fetch', ops)

  requests[handle] = func or false
  return handle
end

--- Updates pending fetch requests.
-- This is an internal function called automatically unless you overwrite love.run.
-- Calling this function may trigger any user-defined callbacks.
-- @tparam[opt] string handle Request handle
-- @treturn number Number of processed requests
local marked = {}
local updating = false
function fetch.update()
  if updating then
    return
  end
  updating = true
  local count = 0
  for k, func in pairs(requests) do
    if lfs.getInfo(k) then
      local res = lfs.read(k)
      if res then
        local code = res:sub(1, 3)
        local body = res:sub(4)
        code = tonumber(code) or 0
        lfs.remove(k)
        -- the following causes a weird Lua error "invalid argument to next"
        --requests[k] = nil
        count = count + 1
        marked[count] = k
        if type(func) == "function" then
          func(code, body)
        end
      end
    end
  end
  for i = #marked, 1, -1 do
    local handle = marked[i]
    marked[i] = nil
    requests[handle] = nil
  end
  updating = false
  return count
end

--- Cleans up temporary fetch files from the user directory.
local list = lfs.getDirectoryItems('')
for _, v in ipairs(list) do
  if v:match('_fetch%.tmp$') then
    if lfs.getRealDirectory(v) == sav then
      lfs.remove(v)
    end
  end
end
-- hack required to initialize the "/home/web_user/love" database
lfs.remove('fetch.tmp')

return fetch