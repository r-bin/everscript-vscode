local t = emu.memType
local f = 0
local inRoom = 0
local heldInput = {}
local holdFrames = 0
local done = false
local maxFrames = 1200

local function emit(tag, name, detail)
  local d = tostring(detail or ""):gsub('"', '\\"')
  print(string.format('%s {"name":"%s","detail":"%s"}', tag, name, d))
end

local function u16(mem, addr)
  return emu.read(addr, mem, false) + emu.read(addr + 1, mem, false) * 256
end

local function press(input, frames)
  heldInput = input
  holdFrames = frames or 4
end

emu.addEventCallback(function()
  if holdFrames > 0 then
    emu.setInput(heldInput, 0)
    holdFrames = holdFrames - 1
  else
    emu.setInput({}, 0)
  end
end, emu.eventType.inputPolled)

emu.addEventCallback(function()
  if done then return end
  f = f + 1
  local room = emu.read(0x0ADB, t.snesWorkRam, false)
  local mud = emu.read(0x28FA, t.snesWorkRam, false)  -- temp[198]
  local moss = emu.read(0x28F8, t.snesWorkRam, false) -- temp[196]

  if (room == 0x5C and mud == 5 and moss == 5) or inRoom > 0 then
    inRoom = inRoom + 1
    if inRoom == 45 then
      emit("OE_PASS", "setup_ingredients", string.format("room=0x%02X mud=%d moss=%d", room, mud, moss))
      press({ y = true }, 4)
    elseif inRoom == 75 then
      press({ up = true }, 4)
    elseif inRoom == 110 then
      press({ up = true }, 4)
    elseif inRoom == 145 then
      local alchCnt = u16(t.snesWorkRam, 0x07EC)
      local firstItem = u16(t.snesWorkRam, 0x07F0)
      if alchCnt >= 1 and firstItem == 84 then
        emit("OE_PASS", "alchemy_ring_open", string.format("alchCnt=%d first=%d", alchCnt, firstItem))
      else
        emit("OE_FAIL", "alchemy_ring_open", string.format("expected alchCnt>=1 first=84 got cnt=%d first=%d", alchCnt, firstItem))
      end
      press({ b = true }, 4)
    elseif inRoom == 180 then
      press({ b = true }, 4)
    elseif inRoom == 290 then
      if mud == 4 and moss == 4 then
        emit("OE_PASS", "ingredients_consumed", string.format("mud=%d moss=%d", mud, moss))
      else
        emit("OE_FAIL", "ingredients_consumed", string.format("expected mud=4 moss=4 got mud=%d moss=%d", mud, moss))
      end
      local png = emu.takeScreenshot()
      if png and #png > 0 then
        local hex = png:gsub(".", function(ch) return string.format("%02x", string.byte(ch)) end)
        print("OE_PNGHEX turd_ball " .. hex)
      end
      print('OE_DONE {"frame":' .. f .. '}')
      done = true
      emu.stop(0)
    end
  end

  if f >= maxFrames and not done then
    local png = emu.takeScreenshot()
    if png and #png > 0 then
      local hex = png:gsub(".", function(ch) return string.format("%02x", string.byte(ch)) end)
      print("OE_PNGHEX turd_ball " .. hex)
    end
    emit("OE_FAIL", "timeout", string.format("room=0x%02X inRoom=%d mud=%d moss=%d", room, inRoom, mud, moss))
    print('OE_DONE {"frame":' .. f .. '}')
    done = true
    emu.stop(0)
  end
end, emu.eventType.endFrame)
