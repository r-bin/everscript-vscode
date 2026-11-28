local t = emu.memType
local f = 0
local settled = 0
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

local function bgPaletteStats()
  local rSum, gSum, bSum = 0, 0, 0
  -- Check BG palettes in CGRAM (words 1..127 across slots 0..7)
  for pal = 0, 7 do
    for c = 1, 15 do
      local w = u16(t.snesCgRam, (pal * 16 + c) * 2)
      rSum = rSum + (w & 31)
      gSum = gSum + ((w >> 5) & 31)
      bSum = bSum + ((w >> 10) & 31)
    end
  end
  return rSum, gSum, bSum
end

emu.addEventCallback(function()
  if done then return end
  f = f + 1
  local room = emu.read(0x0ADB, t.snesWorkRam, false)
  if room == 0x7F then
    settled = settled + 1
    if nmiStart == nil then nmiStart = u16(t.snesWorkRam, 0x0100) end
    if settled == 90 then
      local nmiNow = u16(t.snesWorkRam, 0x0100)
      local sprites = countVisibleSprites()
      local rSum, gSum, bSum = bgPaletteStats()
      emit("OE_PASS", "room_0x7f", string.format("room=0x%02X frame=%d", room, f))
      if nmiNow ~= nmiStart then
        emit("OE_PASS", "nmi_alive", string.format("%d->%d", nmiStart, nmiNow))
      else
        emit("OE_FAIL", "nmi_alive", "frame counter stalled")
      end
      if sprites >= 4 then
        emit("OE_PASS", "visible_sprites", string.format("oam=%d", sprites))
      else
        emit("OE_FAIL", "visible_sprites", string.format("oam=%d < 4", sprites))
      end
      if bSum > rSum and bSum > gSum then
        emit("OE_PASS", "blue_cgram", string.format("R=%d G=%d B=%d", rSum, gSum, bSum))
      else
        emit("OE_FAIL", "blue_cgram", string.format("not blue dominant R=%d G=%d B=%d", rSum, gSum, bSum))
      end
      local png = emu.takeScreenshot()
      if png and #png > 0 then
        local hex = png:gsub(".", function(ch) return string.format("%02x", string.byte(ch)) end)
        print("OE_PNGHEX brians_room_blue " .. hex)
      end
      print('OE_DONE {"frame":' .. f .. '}')
      done = true
      emu.stop(0)
    end
  end
  if f >= maxFrames and not done then
    emit("OE_FAIL", "room_0x7f", string.format("timed out waiting for room 0x7F (last room=0x%02X)", room))
    print('OE_DONE {"frame":' .. f .. '}')
    done = true
    emu.stop(0)
  end
end, emu.eventType.endFrame)
