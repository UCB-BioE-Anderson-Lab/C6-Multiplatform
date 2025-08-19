// This automation attempts to build Apps Script compatible files from a UMD module bundled by rollup.

import * as UglifyJS from "uglify-js";
import * as fs from "fs";

var rawFileData = new String();

try {
  const data = fs.readFileSync('dist/c6-sim.min.js', 'utf8');
  rawFileData = data
} catch (err) {
  console.error('Error reading file synchronously:', err);
}

const uglifyOptions = {
    compress: true,
    mangle: false,
    output: {
        beautify: true
    }
}

rawFileData = UglifyJS.minify(rawFileData, uglifyOptions)

fs.writeFileSync('js-gs-automation/sheets.js', rawFileData.code);

var targetStrings = [
    '((global,factory)=>{"object"==typeof exports&&"undefined"!=typeof module?module.exports=factory():"function"==typeof define&&define.amd?define(factory):(global="undefined"!=typeof globalThis?globalThis:global||self).C6=factory()})(this,function(){'
]