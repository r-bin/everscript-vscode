'use strict';
// Ownership: public entry point of the scripts-tab domain (the radar panel's Scripts tab).

const { handlesScriptsMessage, handleScriptsMessage } = require('../../../../dist/games/evermore/scripts-tab/host');
const { buildScriptsTabHtml } = require('../../../../dist/games/evermore/scripts-tab/render-scripts-tab');

module.exports = { handlesScriptsMessage, handleScriptsMessage, buildScriptsTabHtml };
