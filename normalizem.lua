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

-- normalizem.lua is a series of hacks which ensure that
-- any optional love.js modules behave as expected

if love.event then
  local _love_event_push = love.event.push
  function love.event.push(event, action, ...)
    if event == 'quit' and action == 'reload' then
      love.system.js('reload')
      return
    end
    return _love_event_push(event, action, ...)
  end
end

if love.audio then
  local playing = {}
  local function _cleanup_playing()
    for s in pairs(playing) do
      if not s:isPlaying() then
        playing[s] = nil
      end
    end
  end
  local _love_audio_play = love.audio.play
  function love.audio.play(...)
    _cleanup_playing()
    -- track currently playing
    for i = 1, select("#", ...) do
      local s = select(i, ...)
      playing[s] = true
    end
    return _love_audio_play(...)
  end

  local _love_audio_stop = love.audio.stop
  function love.audio.stop(source, ...)
    if source then
      return _love_audio_stop(source, ...)
    end
    for s in pairs(playing) do
      s:stop()
      playing[s] = nil
    end
  end

  local reg = debug.getregistry()
  if reg then
    local _Source_play = reg.Source.play
    reg.Source.play = function(source, ...)
      _cleanup_playing()
      playing[source] = true
      return _Source_play(source, ...)
    end
  end
end

