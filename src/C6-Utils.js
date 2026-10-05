
// C6-Utils.js - General Utility Functions for Web Applications
// Adapted from C6-Utils.gs for browser-based applications

// Function to merge multiple strings or arrays into a single string with a delimiter
function merge(...args) {
    if (args.length < 2) {
        throw new Error("At least two arguments are required");
    }

    const delimiter = args.pop();
    if (typeof delimiter !== "string") {
        throw new Error("The last argument must be a delimiter string");
    }

    return args.flat().join(delimiter);
}

// Function to extract a field from a JSON object or array as a string
function field(objJSON, fieldName) {
    try {
        const obj = JSON.parse(objJSON);
        const value = obj[fieldName];
        return typeof value === "object" ? JSON.stringify(value) : value;
    } catch (error) {
        throw new Error("Invalid JSON format or field not found.");
    }
}

// Simplified version: Converts an array of [key, value] pairs into a JSON object string
function makeJSON(inputArray) {
    const obj = {};
    inputArray.forEach(([key, value]) => {
        if (typeof key === 'string' && key.trim()) {
            obj[key.trim()] = value === 'null' ? null :
                              value === 'undefined' ? undefined :
                              value;
        }
    });
    return JSON.stringify(obj);
}




export {
  merge,
  field,
  makeJSON
};

// **EVERY LINE ENDING, NOT JUST THE TWO THAT ARE COMMON.** Splitting on '\n' alone reads a
// CR-only file — the line ending classic Mac OS wrote, and what ApE and several older lab tools
// still emit — as ONE line. Nothing throws: a `_oligos.txt` yields its first oligo and no other,
// a construction file yields its first step, and the error that eventually surfaces is "the
// template's sequence is not in the project", which points at the wrong file entirely. Found
// 2026-10-04 converting Pimar's legacy construction files; Pimar has since normalised its own
// files, which is exactly why this has to be fixed here and not there — UCB_iGEM_Assembly and
// whatever comes next have not.
//
// Use this wherever a text file becomes lines. `/\r?\n/` is not enough; the `\r` alternative
// must be there.
const LINES = /\r\n|\r|\n/;

export { LINES };
