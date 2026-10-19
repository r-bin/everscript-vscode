'use strict';
// Ownership: root export for the sprites subsystem domain.

const { readCharacter, readAllCharacters, CHARACTER_TABLE, CHARACTER_COUNT } = require('../../../../dist/games/evermore/sprites/character-model');
const { renderAnimation, resolveExternalScript } = require('../../../../dist/games/evermore/sprites/animation-decoder');
const { getRawSpriteIndex, renderRawSprite, SPRITE_LIST_START } = require('../../../../dist/games/evermore/sprites/raw-sprites');
const { buildSpritesTabHtml } = require('../../../../dist/games/evermore/sprites/sprites-tab');
const { buildAnimationCatalog } = require('../../../../dist/games/evermore/sprites/animation-catalog');
const { characterThumbs, listPalettes, renderInPalettes, thumbFor } = require('../../../../dist/games/evermore/sprites/thumbnails');

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
