# Secret of Evermore MSU-1 — The "For Dummies" Guide

## 1. What is this?
If you run the patched game right now, **it will look, play, and sound 100% identical to the original 1995 cartridge**. 

That is not a mistake—it is a feature!

The patch adds an **invisible CD-ROM drive (called MSU-1)** to the Super Nintendo. But until you actually put "music CDs" (files called `track-1.pcm`, `track-2.pcm`, etc.) into your game folder, the game intelligently says:
> *"No CD files found. I will just play the original 1995 synthesizer music so the game doesn't go silent or crash."*

---

## 2. Why does Evermore freeze when entering certain rooms?
In the original 1995 game:
- The Super Nintendo only had **64 Kilobytes** of sound memory (ARAM).
- That tiny 64 KB memory had to hold the sound driver, all the sound effects (swords swinging, dogs barking, magic chimes), AND all the musical instruments for the current room's background song.
- When you moved from Prehistoria (jungle music) to the Volcano (fire music), the old instruments had to be wiped out, and the game had to upload new musical instrument recordings through a slow, narrow cable into the sound chip.
- **That upload caused the famous 1 to 3 second freeze** where the screen halts before the music starts.

---

## 3. What does MSU-1 change?
With MSU-1:
1. **The sound chip no longer has to load or play music.** Music streams directly from your SD card or PC hard drive like an MP3 or CD.
2. **The 1-3 second freeze disappears.** The game doesn't have to upload 24 KB of instrument samples across the slow communication ports. It just sends a single command: *"Play Track 6"*, and track 6 starts playing in a couple of milliseconds.
3. **CD-Quality, Orchestrated Audio:** Instead of muffled 4-bit SNES instruments, you can listen to real recorded symphonies, live acoustic guitars, studio drums, or remastered soundtracks.
4. **All Sound Effects Stay Safe:** The original sound chip still handles all the sound effects—the boy swinging his bone crusher, the dog barking, the alchemy chimes, and monster screams all sound authentic.

---

## 4. How do I make the CD music play?
You need 3 things in the same folder:

```
MyGameFolder/
  ├── Secret_of_Evermore.sfc        <-- The patched ROM (out/soe-msu1.sfc)
  ├── Secret_of_Evermore.msu        <-- An empty 0-byte text file named .msu
  ├── Secret_of_Evermore-1.pcm      <-- Title Screen Music (CD audio)
  ├── Secret_of_Evermore-2.pcm      <-- Battle with Thraxx
  ├── Secret_of_Evermore-3.pcm      <-- In the Arena
  └── ...
```

*(Note: The name before the dash must exactly match the ROM name! If your ROM is `SoE.sfc`, your files must be `SoE.msu`, `SoE-1.pcm`, `SoE-2.pcm`, etc.)*

### How to convert a song into a `.pcm` file:
Use our bundled tool:
```bash
node tools/msu1/render-pcm.mts my_song.wav Secret_of_Evermore-1.pcm
```
You can also specify a **loop point** (in sample frames). For example, if the intro is 4 seconds long and the track should loop back to 4.0 seconds ($4.0 \times 44,100 = 176,400$ samples):
```bash
node tools/msu1/render-pcm.mts my_song.wav Secret_of_Evermore-1.pcm 176400
```

---

## 5. Where can I play this?
- **On a real Super Nintendo:** Using an **FXPak Pro** (formerly SD2SNES) flash cartridge.
- **On PC / Mac:** In an emulator that supports MSU-1:
  - **Mesen** (Developer recommended, most accurate)
  - **bsnes** / **higan**
  - **snes9x** (v1.55 or newer)
