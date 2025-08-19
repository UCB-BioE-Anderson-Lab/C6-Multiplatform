// This automation attempts to build Apps Script compatible files from a UMD module bundled by rollup.

import * as fs from "fs";

var rawFileData = new String();

// Read rolled up IIFE module file into memory.
// IIFE module file was created in the previous command in the "npm run buildgs" chain
try {
  const data = fs.readFileSync('dist/IIFEc6-sim.min.js', 'utf8');
  rawFileData = data.toString()
} catch (err) {
  console.error('Error reading file synchronously:', err);
}

// Delete the temporary IIFE module file (created to reduce number of regexes needed)
fs.unlink('dist/IIFEc6-sim.min.js', (err) => {
  if (err) throw err;
  console.log('path/file.txt was deleted');
}); 

// Things to remove to "reverse" module-ization
const regexesToMatch = [
  /var C6 = \(function \(\) {\n  'use strict';/gm, // Delete module factory function header
  /\/\/ src\/index\.js(.*)return C6;(.*)}\)\(\);/gms, // Delete module factory function tail and remnant of src/index.js
  /^[^\n]*?\/\*#__PURE__\*\/(.*?)}\);/gms, // Delete locks on functions
  /^  /gm // Untabs entire file
]

// Rollup does not allow you to create a "plain" file, so the rolled up file needs to have its modulization reversed.
for (const regex of regexesToMatch) {
  rawFileData = rawFileData.replace(regex, "");
}

// Write finished file to local storage.
fs.writeFileSync('js-gs-automation/sheets.js', rawFileData);