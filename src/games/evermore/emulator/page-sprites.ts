// The emulator page's sprite readers: the host's own (maps/sprites.ts, maps/character-record.ts),
// bundled for the page as the global EvsSprites (tools/bundle-pages.mts → dist/webview/evermore-sprites.js,
// loaded through host.js webviewFiles()). The page draws entities outside the screen with them.
export { readSpriteInfo, composeSprite } from '../maps/sprites';
export { paletteAt } from '../maps/character-record';
export { bgr555 } from '../../../platform/snes/tiles';
