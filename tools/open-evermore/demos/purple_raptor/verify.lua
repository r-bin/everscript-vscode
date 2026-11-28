local t = emu.memType
local f = 0
local inRoom = 0
local nmiStart = nil
local done = false
local maxFrames = 1200

local function emit(tag, name, detail)
  local d = tostring(detail or ""):gsub('"', '\\"')
  print(string.format('%s {"name":"%s","detail":"%s"}', tag, name, d))
end

local function u16(mem, addr)
  return emu.read(addr, mem, false) + emu.read(addr + 1, mem, false) * 256
end

local function countVisibleSprites()
  local n = 0
  for i = 0, 127 do
    local y = emu.read(i * 4 + 1, t.snesSpriteRam, false)
    if y > 0 and y < 224 then n = n + 1 end
  end
  return n
end

local function countPurpleObjColors()
  local hits = 0
  for i = 128, 255 do
    local w = u16(t.snesCgRam, i * 2)
    local r = w & 31
    local g = (w >> 5) & 31
    local b = (w >> 10) & 31
    if r >= 6 and b >= 6 and r > g + 2 and b > g + 2 then
      hits = hits + 1
    end
  end
  return hits
end

emu.addEventCallback(function()
  if inRoom > 15 and inRoom <= 45 then
    emu.setInput({ right = true }, 0)
  else
    emu.setInput({}, 0)
  end
end, emu.eventType.inputPolled)

emu.addEventCallback(function()
  if done then return end
  f = f + 1
  local room = emu.read(0x0ADB, t.snesWorkRam, false)
  if room == 0x15 then
    inRoom = inRoom + 1
    if nmiStart == nil then nmiStart = u16(t.snesWorkRam, 0x0100) end
    if inRoom == 90 then
      local formReq = u16(t.snesWorkRam, 0x2363)
      local sprites = countVisibleSprites()
      local purpleObj = countPurpleObjColors()
      local nmiNow = u16(t.snesWorkRam, 0x0100)
      emit("OE_PASS", "entered_brians_room", string.format("room=0x%02X frame=%d", room, f))
      if formReq == 14 then
        emit("OE_PASS", "dog_form_index_6", string.format("DOG_FORM_INDEX=%d", formReq))
      else
        emit("OE_FAIL", "dog_form_index_6", string.format("expected DOG_FORM_INDEX=14 got %d", formReq))
      end
      if purpleObj >= 2 then
        emit("OE_PASS", "purple_obj_cgram", string.format("purpleColors=%d", purpleObj))
      else
        emit("OE_FAIL", "purple_obj_cgram", string.format("purpleColors=%d < 2", purpleObj))
      end
      if sprites >= 4 and nmiNow ~= nmiStart then
        emit("OE_PASS", "sprites_and_nmi", string.format("oam=%d nmi=%d->%d", sprites, nmiStart, nmiNow))
      else
        emit("OE_FAIL", "sprites_and_nmi", string.format("oam=%d nmi=%d->%d", sprites, nmiStart, nmiNow))
      end
      local png = emu.takeScreenshot()
      if png and #png > 0 then
        local hex = png:gsub(".", function(ch) return string.format("%02x", string.byte(ch)) end)
        print("OE_PNGHEX purple_raptor " .. hex)
      end
      print('OE_DONE {"frame":' .. f .. '}')
      done = true
      emu.stop(0)
    end
  end
  if f >= maxFrames and not done then
    emit("OE_FAIL", "entered_brians_room", string.format("timed out waiting for room 0x15 (last=0x%02X)", room))
    print('OE_DONE {"frame":' .. f .. '}')
    done = true
    emu.stop(0)
  end
end, emu.eventType.endFrame)
