'use strict';
// The 65816 opcode matrix moved to src/shared/opcodes-65816.js (the soe:// asm view
// uses it too). This path stays: tools/gen-cdl-optable.js and the core's
// cdl-optable.h name it.
module.exports = require('../../shared/opcodes-65816');
