'use strict';
// Thin shim — delegates all exports to the rooms/ subsystem.
// See rooms/parsing/, rooms/rendering/ for the actual implementations.
// This file is kept for backward compatibility with existing require() calls.

module.exports = require('./rooms');
