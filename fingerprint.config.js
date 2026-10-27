/** @type {import('expo/fingerprint').Config} */
const { SourceSkips } = require('expo/fingerprint');

// npm scripts and .gitignore don't change the native app, so editing them must not make over-the-air
// updates look incompatible with installed APKs. .gitignore is also hashed byte for byte, so a checkout
// with different line endings would change the fingerprint.
module.exports = {
  sourceSkips: SourceSkips.PackageJsonScriptsAll | SourceSkips.GitIgnore,
};
