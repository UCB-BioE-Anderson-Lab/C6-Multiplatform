// This automation attempts to build Apps Script compatible files from a UMD module bundled by rollup.
// All functions in this automation are synchronous. They are not meant to be run from a server.
// Base assumptions:
// 1: We are working with a UMD module.
// 2: The source files and UMD module file are beautified, such that all global/top level functions to be 
//    exposed to the user are not inside another function and their function declaration begins a line in 
//    the source files.

import * as fs from "fs";
import * as path from "path";

console.time("Execution Time");

console.log("Beginning JS Module to Apps Script conversion.");

// Initialize variables and required directories
var rawFileData = new String();
if (!fs.existsSync("dist_appsscript")) {
    fs.mkdir("dist_appscript", { recursive: true }, (err) => {
        if (err) {
            console.error('Error creating directory:', err);
            return;
        }});
}

// Read bundled UMD module file into memory.
// UMD module file was created by running "npm run build"
try {
  const data = fs.readFileSync('dist/c6-sim.min.js', 'utf8');
  rawFileData = data.toString();
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

// Rollup does not allow you to create a "plain" file, so the bundled file needs to be freed from its 
// factory function and any other modulizations.
for (const regex of regexesToMatch) {
  rawFileData = rawFileData.replace(regex, "");
}

// Prepend all function names with "JS_" to indicate this function is the original from the module file.
const funcRegex = /^function /gm; //TABS MUST BE PROPERLY SET IN THE SOURCE FILES!
rawFileData = rawFileData.replace(funcRegex, "function JS_");

// Write finished raw function file to local storage.
fs.writeFileSync('js-gs-automation/C6-Multiplatform-Raw.js', rawFileData);
fs.writeFileSync('dist_appsscript/C6-Multiplatform-Raw.gs', rawFileData);

// Copy Sheets Helpers File to dist_appscript and rename to gs.
fs.copyFileSync("js-gs-automation/C6-Sheets-Helpers.js", "dist_appsscript/C6-Sheets-Helpers.gs");

// Source inputs JSON


// Verify and report numbers
// Get number of all functions in C6-Multiplatform-Raw that have the "JS_" suffix added

// Get number of functions that will have a custom wrapper

// Get number of functions that will have a passthrough wrapper

// Build wrapper file

// Report time and completion state.
console.timeEnd("Execution Time");
console.log("Finished JS Module to Apps Script conversion.");