/** @type {import('expo/fingerprint').Config} */
const { SourceSkips } = require('expo/fingerprint');

// npm scripts don't change the native app, so adding one (e.g. a maintenance script) must not
// make over-the-air updates look incompatible with installed APKs.
module.exports = {
  sourceSkips: SourceSkips.PackageJsonScriptsAll,
};
