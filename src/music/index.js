'use strict';
// Ownership: public entry point of the music domain (the radar panel's Music tab).

const { buildMusicModel } = require('./model/catalog');
const { handlesMusicMessage, handleMusicMessage } = require('./host');
const { buildMusicTabHtml } = require('./render-music-tab');

module.exports = { buildMusicModel, handlesMusicMessage, handleMusicMessage, buildMusicTabHtml };
