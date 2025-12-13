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

// Initialize variables
var rawFileData = new String();
var funcDefs = new Object();
var wrapperFile = new String();

// Load in function definitions JSON
try {
  const data = fs.readFileSync('js-gs-automation/Function-Definitions.json', 'utf8');
  funcDefs = Object.values(JSON.parse(data.toString()));
} catch (err) {
  console.error('Error reading file synchronously:', err);
};

// Check if required directories exist
if (!fs.existsSync("dist_appsscript")) {
    fs.mkdir("dist_appscript", { recursive: true }, (err) => {
        if (err) {
            console.error('Error creating directory:', err);
            return;
        }});
};
if (!fs.existsSync("gs_verification")) {
    fs.mkdir("gs_verification", { recursive: true }, (err) => {
        if (err) {
            console.error('Error creating directory:', err);
            return;
        }});
};

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
  /^  /gm, // Untabs entire file
  /(\/\/ Internal feature database)(.*?)(let featureDbGlobal = \[\];)(.*?)(initializeFeatureDatabase)(.*?)(}\)\(\);)/gms // Delete JS automatic feature database init
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
fs.writeFileSync('dist_appsscript/C6-Multiplatform-Raw.js', rawFileData);
fs.writeFileSync('gs_verification/C6-Multiplatform-Raw.js', rawFileData);

// Copy Sheets Helpers File to dist_appscript and rename to gs.
fs.copyFileSync("js-gs-automation/C6-Sheets-Helpers.js", "dist_appsscript/C6-Sheets-Helpers.js");
fs.copyFileSync("js-gs-automation/C6-Sheets-Helpers.js", "gs_verification/C6-Sheets-Helpers.js");

// Verify and report numbers
console.log("");
console.log("Numbers Check:");
// Report number of all functions in C6-Multiplatform-Raw that have the "JS_" suffix added
const count = (str) => {
  const re = /JS_/g;
  return ((str || '').match(re) || []).length;
}
console.log("C6-Multiplatform-Raw contains " + count(rawFileData) + " functions with \"JS_\" prefix.");

// Report number of functions in function descriptions JSON
console.log("Function Descriptions file contains " + funcDefs.length.toString() + " functions to wrap.");

// Get number of functions that will have a custom wrapper
const count_true = funcDefs.reduce((acc, cur) => cur.clean === true ? ++acc : acc, 0);
console.log("Sheets wrappers: " + count_true.toString() + " (functions that will have input cleaning)");

// Get number of functions that will have a passthrough wrapper
const count_false = funcDefs.reduce((acc, cur) => cur.clean === false ? ++acc : acc, 0);
console.log("Passthru wrappers: " + count_false.toString() + " (helper functions or excluded functions)");

// Wrapper making function
function createWrapper(title, inputSchema, flatten) {
  let wrapper = "function <name>(<inputs>) {\n  const varDict = <varDict>; \n  return verifyOutputs(JS_<name>(...verifyInputs(varDict, <flatten>, [...arguments])));\n}";
  wrapper = wrapper.replaceAll("<name>", title.toString());
  wrapper = wrapper.replace("<varDict>", JSON.stringify(inputSchema));
  wrapper = wrapper.replace("<inputs>", Object.keys(inputSchema).toString())
  wrapper = wrapper.replace("<flatten>", flatten.toString())
  return wrapper + "\n";
}

// Passthrough Wrapper making function
function createPass(title) {
  const template =  "function <name>(...inputArray) {\n  return JS_<name>(...inputArray);\n}";
  return template.replaceAll("<name>", title) + "\n";
}

// Description making function
function createDescription(description, inputSchema) {
  const header = "/**";
  const tail = "\n */";
  const line = "\n * ";
  const custom = "\n * @customfunction"
  const parameter = "\n * @param {<type>} <paramName>"; //No actual benefit in google sheets, but nice to have
  var finalString = header;
  for (const chunk of description.match(/.{1,80}/g)) {
    finalString = finalString + line + chunk;
  }

  finalString = finalString + line;

  const inputsConvert = {
    "String" : "string",
    "Boolean" : "boolean",
    "Number" : "number",
    "JSON" : "string",
    "Polynucleotide" : "Polynucleotide",
    "StringArray" : "string[]",
    "PolyArray" : "Polynucleotide[]",
    "2DArray" : "string[][]",
    "Pass" : "*",
    "Array" : "Array",
    "SpecialMerge" : "string[]"
  }

  for (const [inputName, typesArray] of Object.entries(inputSchema)) {
    let docParam = "(";
    if (typesArray.length == 1) {
      docParam = inputsConvert[typesArray[0]];
    } else {
      for (const type of typesArray) {
        docParam = docParam + inputsConvert[type] + "|";
      }
      docParam = docParam.slice(0, -1) + ")";
    }
    finalString = finalString + parameter.replace("<type>", docParam).replace("<paramName>", inputName);
  }

  finalString = finalString + custom + tail;

  return finalString;
}

// Build wrapper file
for (const def of funcDefs) {
  let title = def.title;
  let inputSchema = def.inputSchema;
  let description = def.description;
  let clean = def.clean;
  let flatten = def.flatten;

  switch (true) {
    case clean:
      wrapperFile = wrapperFile + createDescription(description, inputSchema) + "\n";
      wrapperFile = wrapperFile + createWrapper(title, inputSchema, flatten) + "\n";
      break;
    case !clean:
      if (inputSchema == undefined) {
        inputSchema = {"arbitrary": ["Pass"]}
      }
      if (description !== undefined) {
        wrapperFile = wrapperFile + createDescription(description, inputSchema) + "\n";
      }
      wrapperFile = wrapperFile + createPass(title) + "\n";
      break;
  }
}

// Write wrapper file
fs.writeFileSync('js-gs-automation/C6-Wrapped-Functions.js', wrapperFile);
fs.writeFileSync('dist_appsscript/C6-Wrapped-Functions.js', wrapperFile);
fs.writeFileSync('gs_verification/C6-Wrapped-Functions.js', wrapperFile);

// Report time and completion state.
console.log("");
console.timeEnd("Execution Time");
console.log("Finished JS Module to Apps Script conversion.");