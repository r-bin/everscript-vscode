// Ownership: a 16x16 block of colour indices (256 bytes, row by row): its mirror images
// and a key equal blocks share. Pure.

const flipH = (px: Uint8Array) => { const o = new Uint8Array(256); for (let i = 0; i < 256; i++) o[i] = px[(i & ~15) | (15 - (i & 15))]; return o; };
const flipV = (px: Uint8Array) => { const o = new Uint8Array(256); for (let i = 0; i < 256; i++) o[i] = px[(15 - (i >> 4)) * 16 + (i & 15)]; return o; };
const keyOf = (px: Uint8Array): string => Buffer.from(px.buffer, px.byteOffset, px.length).toString('latin1');

export { flipH, flipV, keyOf };
