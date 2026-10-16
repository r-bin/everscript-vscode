'use strict';
// Ownership: public entry of the Secret of Mana -> Evermore conversion (README.md).
module.exports = {
    ...require('./rooms'),
    ...require('./convert'),
    ...require('./virtual-rom'),
    ids: require('./ids'),
};
