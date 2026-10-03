'use strict';
// Ownership: root export for the sprites subsystem domain.

const { readCharacter, readAllCharacters, CHARACTER_TABLE, CHARACTER_COUNT } = require('./character-model');
const { renderAnimation, resolveExternalScript } = require('./animation-decoder');
const { getRawSpriteIndex, renderRawSprite, SPRITE_LIST_START } = require('./raw-sprites');
const { buildSpritesTabHtml } = require('./sprites-tab');
const { buildAnimationCatalog } = require('./animation-catalog');
const { characterThumbs, listPalettes, renderInPalettes, thumbFor } = require('./thumbnails');

module.exports = {
    readCharacter,
    readAllCharacters,
    CHARACTER_TABLE,
    CHARACTER_COUNT,
    renderAnimation,
    resolveExternalScript,
    getRawSpriteIndex,
    renderRawSprite,
    SPRITE_LIST_START,
    buildSpritesTabHtml,
    buildAnimationCatalog,
    characterThumbs,
    listPalettes,
    renderInPalettes,
    thumbFor,
};
