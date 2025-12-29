// This automation attempts to build Apps Script compatible files from a UMD module bundled by rollup.
// All functions in this automation are synchronous. They are not meant to be run from a server.
// By Richie Woo 
// richie.woo@berkeley.edu

import * as fs from "fs";
import * as path from "path";
import * as acorn from "acorn";
import * as acornwalk from "acorn-walk";
import * as escodegen from "escodegen";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

console.time("Execution Time");

console.log("Beginning JS Module to Apps Script conversion.");

// Initialize variables
var rawFileData = new String();
var funcDefs = new Object();
var wrapperFile = new String();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename); //__dirname does not exist in ES scripts natively

// Initialize paths to directories
const dirAuto = path.join (__dirname, "C6-Sheets/js-gs-automation")
const dirDist = path.join(__dirname, "C6-Sheets/dist");
const dirVer = path.join(__dirname, "C6-Sheets/verify");

// Define file names
const fnameRAW = "C6-Multiplatform-Raw.js";
const fnameHELP = "C6-Sheets-Helpers.js";
const fnameWRAP = "C6-Wrapped-Functions.js";

// Initialize paths to static files
const fileMin = path.join(__dirname, "dist/c6-sim.min.js");
const fileDef = path.join(dirAuto, "Function-Definitions.json");
const fileHelp = path.join(dirAuto, fnameHELP);

// Arrays of locations to save files
var locRAW = [];
for (const location of [dirAuto, dirDist, dirVer]) {
  locRAW.push(path.join(location, fnameRAW));
};

var locHELP = [];
for (const location of [dirDist, dirVer]) {
  locHELP.push(path.join(location, fnameHELP));
};

var locWRAP = [];
for (const location of [dirAuto, dirDist, dirVer]) {
  locWRAP.push(path.join(location, fnameWRAP));
};

// Check if required directories exist
if (!fs.existsSync(dirDist)) {
    fs.mkdir(dirDist, { recursive: true }, (err) => {
        if (err) {
            console.error('Error creating directory:', err);
            return;
        }});
};
if (!fs.existsSync(dirVer)) {
    fs.mkdir(dirVer, { recursive: true }, (err) => {
        if (err) {
            console.error('Error creating directory:', err);
            return;
        }});
};

// Read bundled UMD module file into memory.
// UMD module file was created by running "npm run build"
try {
  const data = fs.readFileSync(fileMin, 'utf8');
  rawFileData = data.toString();
} catch (err) {
  console.error('Error reading file synchronously:', err);
}

// Parse the raw file as AST
var astData = acorn.parse(rawFileData, {ecmaVersion: "latest"});

// Prepare a blank AST to add things to.
var finalAST = acorn.parse("", {ecmaVersion : "latest"});

// Reverse modulization by selectively extracting nodes of the module AST
acornwalk.ancestor(astData, {
  // We want to keep all top level function declarations.
  FunctionDeclaration(node, ancestors) {
    // The UMD module includes 6 layers of wrapping on the AST before we hit the main functions in the module.
    const parent = ancestors[ancestors.length - 6];
    // The topmost layer is called "Program". 
    // We want to make sure that we are not recursively adding additional function declarations declared inside functions, so we want only the functions that exist 6 layers below "Program".
    if (parent.type === "Program") {
      finalAST.body.push(node)
    }
  },
  // Primarily for the Polynucleotide class declaration.
  ClassDeclaration(node, ancestors) {
    const parent = ancestors[ancestors.length - 6];
    if (parent.type === "Program") {
      finalAST.body.push(node)
    }
  },
  // Certain variable declarations required for some functions to work.
  // Many exceptions exist due to modulization.
  VariableDeclaration(node, ancestors) {
    const parent = ancestors[ancestors.length - 6];
    if (parent.type === "Program") {
      // VariableDeclaration.declarations may include one or more declarations. 
      // Traverse through all to determine if the variable declaration should be kept or removed.
      node.declarations.forEach(declarator => {
        // Many cases exist where we don't want to keep the variable declaration.
        // Case 1: Remove locks on functions.
        const callDec = declarator.init.callee;
        var callObj = "";
        var callProperty = "";
        try {
          callObj = callDec.object.name;
          callProperty = callDec.property.name;
        } catch (err) {
          // We don't care! So nonchalant.
        }
        const case1 = (!((callObj === "Object") && (callProperty == "freeze")));

        // Case 2: Remove the final module statement
        const callID = declarator.id.name;
        const case2 = (callID != "C6");

        // Case 3: Remove featureDBGlobal declaration
        const case3 = (callID != "featureDbGlobal");

        // Final Test
        if (case1 && case2 && case3) {
          finalAST.body.push(node)
        }
      })
    }
  },
  // Some for loop code runs immediately to generate dictionaries and maps that we want to keep.
  // This statement is the most dangerous, since future versions of C6-Multiplatform may contain such statements that may break or lag C6-Sheets.
  ForInStatement(node, ancestors) {
    const parent = ancestors[ancestors.length - 6];
    if (parent.type === "Program") {
      finalAST.body.push(node)
    }
  }
});

// Load in function definitions JSON
try {
  const data = fs.readFileSync(fileDef, 'utf8');
  funcDefs = Object.values(JSON.parse(data.toString()));
} catch (err) {
  console.error('Error reading file synchronously:', err);
};

// Create new map of old function names and their "JS_"-prefixed versions for later
const funcMap = new Map(
  funcDefs.map(funcDef => [funcDef.title, ("JS_" + funcDef.title.toString())])
);

// Traverse through the AST and prepend names of top level functions with the JS_ prefix according to the map we made previously.
acornwalk.simple(finalAST, {
  FunctionDeclaration(node) {
    if (funcMap.has(node.id.name)) {
        node.id.name = funcMap.get(node.id.name);
    };
  }
});

// Prepend names of function calls inside function expressions with the JS_ prefix, using ancestors to cover all instances.
// This is so JS functions don't use non-JS wrapped functions leading to type errors.
acornwalk.ancestor(finalAST, {
  // We are traversing through the Identifier objects which give us the names of function calls.
  Identifier(node, ancestors) {
    // We only want to action upon the functions that are named in our map.
    if (funcMap.has(node.name)) {
      // We want to identify what contains this function call.
      const parent = ancestors[ancestors.length - 2];
      // We want to make sure not to accidentally rename variables that have the same name as our function.
      if (
        (parent.type === 'FunctionDeclaration' && parent.id === node) ||
        (parent.type === 'CallExpression' && parent.callee === node) ||
        (parent.type === 'VariableDeclarator' && parent.id === node)
      ) {
        // Finally, rename the identifier for the function call to the "JS_" version.
        node.name = funcMap.get(node.name);
      };
    };
  }
});

// Regenerate text JavaScript code using the modified AST.
// Currently no support for comments.
const transformedFile = escodegen.generate(finalAST);

// Write finished raw function file to local storage.
for (const location of locRAW) {
  fs.writeFileSync(location, transformedFile);
};

// Copy Sheets Helpers File to dist_appscript and gs_verification.
for (const location of locHELP) {
  fs.copyFileSync(fileHelp, location);
};

// Verify and report numbers
console.log("");
console.log("Numbers Check:");
// Report number of all functions in C6-Multiplatform-Raw that have the "JS_" suffix added
// Currently broken due to the AST-based refactor.
const count = (str) => {
  const re = /JS_/g;
  return ((str || '').match(re) || []).length;
}
console.log("C6-Multiplatform-Raw contains " + count(transformedFile) + " functions with \"JS_\" prefix.");

// Report number of functions in function descriptions JSON
console.log("Function Descriptions file contains " + funcDefs.length.toString() + " functions to wrap.");

// Get number of functions that will have a custom wrapper
const count_true = funcDefs.reduce((acc, cur) => cur.clean === true ? ++acc : acc, 0);
console.log("Sheets wrappers: " + count_true.toString() + " (functions that will have input cleaning)");

// Get number of functions that will have a passthrough wrapper
const count_false = funcDefs.reduce((acc, cur) => cur.clean === false ? ++acc : acc, 0);
console.log("Passthru wrappers: " + count_false.toString() + " (helper functions or excluded functions)");

// Note: Yes, we can generate AST code to create the function wrapper files.
// However, it's so much easier to just regex...
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
  const header = "/**"; // Starting line of block comment.
  const tail = "\n */"; // Ending line of block comment.
  const line = "\n * "; // Empty line of block comment.
  const custom = "\n * @customfunction" // Tells Apps Script to display this JSDoc Description as a tooltip.
  const parameter = "\n * @param {<type>} <paramName>"; //No actual benefit in google sheets, but nice to have
  var finalString = header; // Initialize the description string that we will later append to.

  // Add lines of description text.
  for (const chunk of description.match(/.{1,80}/g)) {
    finalString = finalString + line + chunk;
  }

  finalString = finalString + line;

  // Map of appropriate syntax between the names of types in the helper file and the appropriate JSDoc syntax.
  const inputsConvert = {
    "String" : "string",
    "Boolean" : "boolean",
    "Number" : "number",
    "JSON" : "string",
    "Polynucleotide" : "Polynucleotide",
    "ssPolynucleotide" : "Polynucleotide",
    "dsPolynucleotide" : "Polynucleotide",
    "StringArray" : "string[]",
    "PolyArray" : "Polynucleotide[]",
    "2DArray" : "string[][]",
    "Pass" : "*",
    "Array" : "Array",
    "SpecialMerge" : "string[]",
    "ConstructionFile" : "*"
  }

  // Loop through all inputs and add an entry in the description.
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
    // For full wrappers
    case clean:
      wrapperFile = wrapperFile + createDescription(description, inputSchema) + "\n";
      wrapperFile = wrapperFile + createWrapper(title, inputSchema, flatten) + "\n";
      break;
      // For passthrough wrappers
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
for (const location of locWRAP) {
  fs.writeFileSync(location, wrapperFile);
};

// Report time and completion state.
console.log("");
console.timeEnd("Execution Time");
console.log("Finished JS Module to Apps Script conversion.");