// This automation attempts to build Apps Script compatible files from a UMD module bundled by rollup.

import * as fs from "fs";

var rawFileData = new String();

try {
  const data = fs.readFileSync('dist/IIFEc6-sim.min.js', 'utf8');
  rawFileData = data.toString()
} catch (err) {
  console.error('Error reading file synchronously:', err);
}

const regexesToMatch = [
  /var C6 = \(function \(\) {\n  'use strict';/gm,
  /\/\/ src\/index\.js(.*)return C6;(.*)}\)\(\);/gms,
  /^[^\n]*?\/\*#__PURE__\*\/(.*?)}\);/gms,
  /^  /gm
]

for (const regex of regexesToMatch) {
  const count = (str) => {
    const re = regex;
    return ((str || '').match(re) || []).length;
  }
  console.log(count(rawFileData))
  rawFileData = rawFileData.replace(regex, "");
}

fs.writeFileSync('js-gs-automation/sheets.js', rawFileData);