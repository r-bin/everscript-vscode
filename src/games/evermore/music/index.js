'use strict';
// Ownership: public entry point of the music domain (the radar panel's Music tab).

const { buildMusicModel } = require('../../../../dist/games/evermore/music/model/catalog');
const { handlesMusicMessage, handleMusicMessage, sfxNames } = require('../../../../dist/games/evermore/music/host');
const { buildMusicTabHtml } = require('../../../../dist/games/evermore/music/render-music-tab');
const { trackTimeline, trackSequence } = require('./model/track-timeline');

module.exports = { buildMusicModel, handlesMusicMessage, handleMusicMessage, sfxNames, buildMusicTabHtml, trackTimeline, trackSequence };
