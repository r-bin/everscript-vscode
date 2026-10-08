'use strict';
// Ownership: public entry point of the rom domain (the radar panel's ROM tab).

const { buildRomModel } = require('./build');
const { handlesRomMessage, handleRomMessage } = require('./host');
const { buildRomTabHtml } = require('./render-rom-tab');

module.exports = { buildRomModel, handlesRomMessage, handleRomMessage, buildRomTabHtml };
