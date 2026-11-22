/**
 * MSU-1 Track Manifest for Secret of Evermore
 *
 * Maps vanilla Evermore song IDs (0x00..0x45) to MSU-1 track numbers (1..70).
 * In MSU-1 convention:
 *   track-1.pcm corresponds to Evermore song ID 0x00 (Main Title)
 *   track-70.pcm corresponds to Evermore song ID 0x45 (Intruder Alarm)
 */

export interface Msu1Track {
    songId: number;       // Evermore internal song ID ($00..$45)
    msuTrack: number;     // 1-based MSU-1 track number ($01..$46)
    name: string;
    loops: boolean;       // whether the track loops or plays once (e.g. fanfares, game over)
    pcmFileName: string;  // e.g. "soe_msu1-1.pcm" or "<rom>-1.pcm"
}

export const MSU1_TRACKS: Msu1Track[] = [
    { songId: 0x00, msuTrack: 1, name: "Main Title", loops: true, pcmFileName: "track-1.pcm" },
    { songId: 0x01, msuTrack: 2, name: "Battle with Thraxx", loops: true, pcmFileName: "track-2.pcm" },
    { songId: 0x02, msuTrack: 3, name: "In the Arena", loops: true, pcmFileName: "track-3.pcm" },
    { songId: 0x03, msuTrack: 4, name: "Escape from Evermore", loops: true, pcmFileName: "track-4.pcm" },
    { songId: 0x04, msuTrack: 5, name: "Return to Podunk", loops: true, pcmFileName: "track-5.pcm" },
    { songId: 0x05, msuTrack: 6, name: "Village on the Plateau", loops: true, pcmFileName: "track-6.pcm" },
    { songId: 0x06, msuTrack: 7, name: "Within the Volcano", loops: true, pcmFileName: "track-7.pcm" },
    { songId: 0x07, msuTrack: 8, name: "Swamplands", loops: true, pcmFileName: "track-8.pcm" },
    { songId: 0x08, msuTrack: 9, name: "Southern Jungle", loops: true, pcmFileName: "track-9.pcm" },
    { songId: 0x09, msuTrack: 10, name: "Bugmuck Tar Pits", loops: true, pcmFileName: "track-10.pcm" },
    { songId: 0x0a, msuTrack: 11, name: "Desert of Doom", loops: true, pcmFileName: "track-11.pcm" },
    { songId: 0x0b, msuTrack: 12, name: "Queen Bluegarden", loops: true, pcmFileName: "track-12.pcm" },
    { songId: 0x0c, msuTrack: 13, name: "High in the Sky", loops: true, pcmFileName: "track-13.pcm" },
    { songId: 0x0d, msuTrack: 14, name: "Control Room", loops: true, pcmFileName: "track-14.pcm" },
    { songId: 0x0e, msuTrack: 15, name: "Hall of Collosia", loops: true, pcmFileName: "track-15.pcm" },
    { songId: 0x0f, msuTrack: 16, name: "Horace Highwater", loops: true, pcmFileName: "track-16.pcm" },
    { songId: 0x10, msuTrack: 17, name: "Major Enemy", loops: true, pcmFileName: "track-17.pcm" },
    { songId: 0x11, msuTrack: 18, name: "Merchant in the Cave", loops: true, pcmFileName: "track-18.pcm" },
    { songId: 0x12, msuTrack: 19, name: "Elephant Graveyard", loops: true, pcmFileName: "track-19.pcm" },
    { songId: 0x13, msuTrack: 20, name: "Pirates of Crustacia", loops: true, pcmFileName: "track-20.pcm" },
    { songId: 0x14, msuTrack: 21, name: "Lively Nobilia Marketplace", loops: true, pcmFileName: "track-21.pcm" },
    { songId: 0x15, msuTrack: 22, name: "Menu", loops: true, pcmFileName: "track-22.pcm" },
    { songId: 0x16, msuTrack: 23, name: "Machinery", loops: true, pcmFileName: "track-23.pcm" },
    { songId: 0x17, msuTrack: 24, name: "Game Over", loops: false, pcmFileName: "track-24.pcm" },
    { songId: 0x18, msuTrack: 25, name: "Raptor Attack!", loops: true, pcmFileName: "track-25.pcm" },
    { songId: 0x19, msuTrack: 26, name: "Victory Fanfare", loops: false, pcmFileName: "track-26.pcm" },
    { songId: 0x1a, msuTrack: 27, name: "Good Night", loops: false, pcmFileName: "track-27.pcm" },
    { songId: 0x1b, msuTrack: 28, name: "The Seashore", loops: true, pcmFileName: "track-28.pcm" },
    { songId: 0x1c, msuTrack: 29, name: "Many Years Ago...", loops: true, pcmFileName: "track-29.pcm" },
    { songId: 0x1d, msuTrack: 30, name: "The Professor's Room", loops: true, pcmFileName: "track-30.pcm" },
    { songId: 0x1e, msuTrack: 31, name: "Quiet Plaza", loops: true, pcmFileName: "track-31.pcm" },
    { songId: 0x1f, msuTrack: 32, name: "Omnitopia Surface", loops: true, pcmFileName: "track-32.pcm" },
    { songId: 0x20, msuTrack: 33, name: "Storekeepers", loops: true, pcmFileName: "track-33.pcm" },
    { songId: 0x21, msuTrack: 34, name: "Great Pyramid", loops: true, pcmFileName: "track-34.pcm" },
    { songId: 0x22, msuTrack: 35, name: "Underground Path", loops: true, pcmFileName: "track-35.pcm" },
    { songId: 0x23, msuTrack: 36, name: "Hidden River", loops: true, pcmFileName: "track-36.pcm" },
    { songId: 0x24, msuTrack: 37, name: "Staff Roll", loops: false, pcmFileName: "track-37.pcm" },
    { songId: 0x25, msuTrack: 38, name: "A Boy and His Dog", loops: true, pcmFileName: "track-38.pcm" },
    { songId: 0x26, msuTrack: 39, name: "Engine Rumble", loops: true, pcmFileName: "track-39.pcm" },
    { songId: 0x27, msuTrack: 40, name: "Empty / Unused", loops: false, pcmFileName: "track-40.pcm" },
    { songId: 0x28, msuTrack: 41, name: "Unused 0x28", loops: false, pcmFileName: "track-41.pcm" },
    { songId: 0x29, msuTrack: 42, name: "Palace Fountains", loops: true, pcmFileName: "track-42.pcm" },
    { songId: 0x2a, msuTrack: 43, name: "Fire Eyes", loops: true, pcmFileName: "track-43.pcm" },
    { songId: 0x2b, msuTrack: 44, name: "Puppet Show", loops: true, pcmFileName: "track-44.pcm" },
    { songId: 0x2c, msuTrack: 45, name: "Minor Minion", loops: true, pcmFileName: "track-45.pcm" },
    { songId: 0x2d, msuTrack: 46, name: "Distant Wind", loops: true, pcmFileName: "track-46.pcm" },
    { songId: 0x2e, msuTrack: 47, name: "Death of a Minotaur", loops: true, pcmFileName: "track-47.pcm" },
    { songId: 0x2f, msuTrack: 48, name: "Fields of Gothica", loops: true, pcmFileName: "track-48.pcm" },
    { songId: 0x30, msuTrack: 49, name: "City of Ebony", loops: true, pcmFileName: "track-49.pcm" },
    { songId: 0x31, msuTrack: 50, name: "Over the Waterfall", loops: true, pcmFileName: "track-50.pcm" },
    { songId: 0x32, msuTrack: 51, name: "Darkness of the Temple", loops: true, pcmFileName: "track-51.pcm" },
    { songId: 0x33, msuTrack: 52, name: "Dark Forest", loops: true, pcmFileName: "track-52.pcm" },
    { songId: 0x34, msuTrack: 53, name: "City of Ivory", loops: true, pcmFileName: "track-53.pcm" },
    { songId: 0x35, msuTrack: 54, name: "Omnitopia Hallways", loops: true, pcmFileName: "track-54.pcm" },
    { songId: 0x36, msuTrack: 55, name: "Quicksand Fields", loops: true, pcmFileName: "track-55.pcm" },
    { songId: 0x37, msuTrack: 56, name: "Tinker Tinderbox", loops: true, pcmFileName: "track-56.pcm" },
    { songId: 0x38, msuTrack: 57, name: "Deserted Castle", loops: true, pcmFileName: "track-57.pcm" },
    { songId: 0x39, msuTrack: 58, name: "Dank Dungeon", loops: true, pcmFileName: "track-58.pcm" },
    { songId: 0x3a, msuTrack: 59, name: "Regal Castle", loops: true, pcmFileName: "track-59.pcm" },
    { songId: 0x3b, msuTrack: 60, name: "Freak Show!!!", loops: true, pcmFileName: "track-60.pcm" },
    { songId: 0x3c, msuTrack: 61, name: "Item Fanfare", loops: false, pcmFileName: "track-61.pcm" },
    { songId: 0x3d, msuTrack: 62, name: "Northern Jungle", loops: true, pcmFileName: "track-62.pcm" },
    { songId: 0x3e, msuTrack: 63, name: "Lonely Halls", loops: true, pcmFileName: "track-63.pcm" },
    { songId: 0x3f, msuTrack: 64, name: "Dark Greenhouse", loops: true, pcmFileName: "track-64.pcm" },
    { songId: 0x40, msuTrack: 65, name: "Vigor the Indestructible!", loops: true, pcmFileName: "track-65.pcm" },
    { songId: 0x41, msuTrack: 66, name: "Racing Pigs!", loops: true, pcmFileName: "track-66.pcm" },
    { songId: 0x42, msuTrack: 67, name: "Collapse of Ivor Tower", loops: true, pcmFileName: "track-67.pcm" },
    { songId: 0x43, msuTrack: 68, name: "Volcano Pipes", loops: true, pcmFileName: "track-68.pcm" },
    { songId: 0x44, msuTrack: 69, name: "Final Battle ~ Carltron", loops: true, pcmFileName: "track-69.pcm" },
    { songId: 0x45, msuTrack: 70, name: "Intruder Alarm", loops: true, pcmFileName: "track-70.pcm" }
];

export function getMsu1Track(songId: number): Msu1Track | undefined {
    return MSU1_TRACKS.find(t => t.songId === songId);
}

