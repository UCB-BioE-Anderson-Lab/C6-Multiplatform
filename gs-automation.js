// This automation attempts to build Apps Script compatible files from a UMD module bundled by rollup.
// Base assumptions:
// 1: We are working with a UMD module.
// 2: The source files and UMD module file are beautified, such that all global/top level functions to be 
//    exposed to the user are not inside another function and their function declaration begins a line in 
//    the source files.

import * as fs from "fs";

var rawFileData = new String();

// Read rolled up IIFE module file into memory.
// IIFE module file was created in the previous command in the "npm run buildgs" chain
try {
  const data = fs.readFileSync('dist/c6-sim.min.js', 'utf8');
  rawFileData = data.toString()
} catch (err) {
  console.error('Error reading file synchronously:', err);
}

// Things to remove to "reverse" module-ization
const regexesToMatch = [
  /\(function \(global, factory\) {(.*?)'use strict';/gms, // Delete module factory function header
  /  \/\/ src\/index\.js(.*)}\)\);/gms, // Delete module factory function tail and remnant of src/index.js
  /^[^\n]*?\/\*#__PURE__\*\/(.*?)}\);/gms, // Delete locks on functions
  /^  /gm // Untabs entire file
]

// Rollup does not allow you to create a "plain" file, so the rolled up file needs to have its modulization reversed.
for (const regex of regexesToMatch) {
  rawFileData = rawFileData.replace(regex, "");
}

// Prepend all function names with "JS_" to indicate this function is unadulterated from the module file.
const funcRegex = /^function /gm;
rawFileData = rawFileData.replace(funcRegex, "function JS_")

// Write finished file to local storage.
fs.writeFileSync('js-gs-automation/sheets.js', rawFileData);