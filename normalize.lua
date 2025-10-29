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

-- normalize.lua is a series of hacks which ensure that
-- love.js behaves more closely to the downloadable version

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

love.event = love.event or require('love.event')

local _love_event_push = love.event.push
function love.event.push(event, action, ...)
  if event == 'quit' and action == 'reload' then
    love.system.js('reload')
    return
  end
  return _love_event_push(event, action, ...)
end

love.system = love.system or require('love.system')

-- bare bones JSON encoding thanks to https://github.com/rxi/json.lua
local escape = {
  ["\\"]="\\",
  ["\""]="\"",
  ["\b"]="b",
  ["\f"]="f",
  ["\n"]="n",
  ["\r"]="r",
  ["\t"]="t",
}
local function encode(c)
  return "\\"..(escape[c] or string.format("u%04x", c:byte()))
end
local function tojson(data)
  local t = type(data)
  if t == "table" then
    local n = 0
    for _ in pairs(data) do
      n = n + 1
    end
    local list = {}
    if #data == n then
      for _, v in ipairs(data) do
        v = tojson(v)
        table.insert(list, v)
      end
      return '['..table.concat(list, ',')..']'
    else
      for k, v in pairs(data) do
        v = tojson(v)
        table.insert(list, string.format('%q:%s', k, v))
      end
      return '{'..table.concat(list, ',')..'}'
    end
  else
    if t == 'string' then
      return '"'..data:gsub('[%z\1-\31\\"]', encode)..'"'
    else
      return tostring(data)
    end
  end
end

function love.system.js(cmd, ops)
  local sz = tojson(ops)
  love.system.openURL('javascript:'..cmd..' '..sz)
  --print('javascript:'..cmd..' '..sz)
end

local cache = {}
local maxlines = 2^32
local function input(n)
  n = n or maxlines
  for i = 1, n do
    local line = io.read()
    if not line then
      break
    end
    cache[i] = line
  end
  local sz = table.concat(cache, '\n')
  for i = #cache, 1, -1 do
    cache[i] = nil
  end
  return sz
end

function love.system.getClipboardText()
  love.system.js('clipboard')
  return input(n)
end

function love.system.setClipboardText(text)
  local ops = { text = tostring(text) }
  love.system.js('clipboard', ops)
end