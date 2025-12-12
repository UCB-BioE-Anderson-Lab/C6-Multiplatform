# C6-Sheets Automation ReadMe

## Overview

C6-Sheets Automation is a pipeline to convert C6-Multiplatform from its JavaScript source code to C6-Sheets, C6-Multiplaform's Google Apps Script-based implementation that provides Google Sheets-ready functions, and verify the integrity and consistency of the converted functions. It consists of a script (`gs-automation.js`), its surrounding framework of files (`./js-gs-automation`), two CLASP-ready folders (`./gs_verification` and `./dist_appscript`) and their respective Apps Script Projects ([Verification Apps Script Project](https://script.google.com/u/0/home/projects/1591i1OQCLkEVPmzA0KNEJhQ-IoRVz6sgo8UU_zV0vtsxSMY7PZxE6EuI) and C6-Sheets Official Release Apps Script Project) and Google Sheets ([C6-Sheets Verification Sheet](https://docs.google.com/spreadsheets/d/1Xp9TUpKCamB7soZmO-tdmZvVwFSFR6n40VdhAMCOL4E/edit?usp=sharing)). The pipeline was created with the following goals:

* Expose C6-Multiplatform functions from its UMD module to Google Apps Script to be used as Google Sheets functions.
* Ensure that inputs and outputs for these functions are appropriately handled such that they present properly in Google Sheets.
* Ensure that there is a consistent method to verify that function calls in Google Sheets behave as expected compared to the JavaScript C6-Multiplatform functions.
* Allow easy user modification of function wrapper behavior in C6-Sheets.
* Allow easy generation of C6-Sheets from C6-Multiplatform.
* Open up the possibility for an Apps Script-based implementation of C6-Multiplatform as a Model Context Protocol (MCP) server.

This ReadMe assumes familiarity of the following:

* [JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
* [Google Apps Script](https://developers.google.com/apps-script/overview)
* [CLASP (Command Line Apps Script Projects)](https://developers.google.com/apps-script/guides/clasp)
* What a [JavaScript Module](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) is. 
    * And, to a lesser extent, what [UMD Modules](https://github.com/umdjs/umd) are.
* What C6-Multiplatform is and how to use it.
* How C6-Multiplatform is built.

## Function Wrappers

The primary purpose of the pipeline is to generate function wrappers that expose raw C6-Multiplatform JavaScript functions as Apps Script functions to be used in Google Sheets. Unlike JavaScript, since there is no native Object or Class type representation available to Sheets users (since function calls that output an Object return an empty cell), the wrappers aim to convert text-based inputted function arguments to their appropriate types and convert Object type function outputs to text-based formats readable and usable by Sheets users. Furthermore, the wrapper logic standardizes how function inputs and outputs on Sheets are processed to ensure maximum similarity between C6-Sheets and C6-Multiplatform.

An example of a function wrapper is:
```
/**
 * Designs oligos or gene synthesis sequences for a BioBrick (RFC10).
 * 
 * @param {(string|Polynucleotide)} sequence
 * @param {boolean} isCDS
 * @param {string} frgs
 * @customfunction
 */
function biobrick(sequence,isCDS,frgs) {
  const varDict = {"sequence":["String","Polynucleotide"],"isCDS":["Boolean"],"frgs":["String"]}; 
  return verifyOutputs(JS_biobrick(...verifyInputs(varDict, false, [...arguments])));
}
```

It consists of a JSDoc-style function description and the actual wrapper function, both of which are automatically generated using information from the `js-gs-automation/Function-Definitions.json` file (the **Definitions** file). The JSDoc description utilizes Google Sheets' native capabilies to provide a tooltip with the names of each input, their acceptable types, and a description of the function. 

The wrapper itself follows the following algorithm:

1. The `verifyInputs` function takes, as arguments:

    - `varDict`, a dictionary of variable names and their acceptable types, 
    - A boolean `flatten` which determines if Arrays passed to the function should be flattened to the base level,
    - An array of all arguments passed to the wrapper.

    And completes the following steps:
    1. Checks if the arguments are an array, and formats them as an array if not,
    1. Flattens the array of arguments if `flatten` is true.
    1. For each argument-array pair in `varDict`, for each type listed in the array of acceptable types per argument, the algorithm:
        1. Checks if the input is, or can be coerced to be, the type.
        1. Returns the coerced/verified/"cleaned" input if it matches the type and moves on to the next argument if available, or continues on to the next type if not.
        1. If the algorithm has exhausted all the acceptable types for an argument, throw an error.
    1. The cleaned inputs are collected in the same order as they were provided to the wrapper and returned as an array.
1. The array of cleaned inputs is passed to the raw JavaScript function, denoted by the `JS_` prefix.
1. The output of the raw function is passed to `verifyOutputs` which checks the type of the output and does the following:
    - If the output is type `object`:
        - If the output is an Array:
            - If the output is an Array of Polynucleotide class Objects, convert all of them into JSON string representations.
            - Otherwise, Sheets can display it properly in a multiline format. Pass the output as-is.
        - If the output is a Polynucleotide class Object, convert it into a JSON string representation.
        - If the output describes a Construction File, convert it into a JSON string representation.
        - If the output is anything else, pass the output as-is even if Sheets cannot display it properly.
    - If the output is anything else, Sheets can display it properly, so pass the output as-is.
1. Return the output of `verifyOutputs` as the final output.

The specific checks and coercion done for each type are explained in [Function Wrapper Generation](#function-wrapper-generation).

## Workflow

The pipeline is completed with the following workflow:

1. The user runs `npm run build` in a terminal to generate (or regenerate) `dist/c6-sim.min.js` after edits are made to the source files in `./src`.
1. The user runs `npm run buildgs` in a terminal to run the `gs-automation.js` script.
    1. The script initializes some required variables and ensures that the following folders exist:
        1. `./dist_appscript`
        1. `./gs_verification`
    1. The `c6-sim.min.js` UMD module text is read into memory. 
        - This UMD module contains the functions in the source files in `./src` in a factory function that creates a JavaScript module intended to work in JS clients and servers, but is unusable for Google Apps Script.
    1. Several regex replacements are applied to the UMD module text. This reverses the modulization, reexposing the raw functions. This is done instead of sourcing the functions from `./src` directly to preserve the intended structure of the C6-Multiplatform module, including additions and deletions to the code.
        1. The module factory function header is deleted.
        1. The module factory function tail is deleted as well as a remnant of `src/index.js`.
        1. Function locks are deleted.
        1. The entire file is un-tabbed.
        1. The automatic feature database intialization is deleted.
    1. All function names are prepended with the `JS_` prefix to differentiate them from wrapped functions that will take their original names.
    1. The finished text file is saved to the following three locations as `C6-Multiplatform-Raw.js` (the **Raw** file). It contains all functions that the C6-Multiplatform Module would contain, except for any functions that run automatically as they would interfere with Apps Script functionality.
        - `./js-gs-automation` (Staging Folder)
        - `./dist_appscript` (CLASP Folder for official distribution)
        - `./gs_verification` (CLASP Folder for verification and R&D)
    1. `js-gs-automation/C6-Sheets-Helpers.js` (the **Helper** file) is copied to the CLASP folders. 
        - This file is written by the developers of C6-Sheets Automation and includes helper functions for function wrapper functionality, including type-checking functions and functions to verify and clean inputs and outputs.
    1. `js-gs-automation/Function-Definitions.json` (the **Definitions** file) is loaded in and parsed as a JSON object.
    1. The script reports the following information to the user through the terminal:

        - How many functions in the Raw file include the `JS_` prefix.
        - The following statistics from the Definitions file:
            - How many functions will be wrapped.
            - How many functions will include input and output verification and cleaning.
            - How many functions will intentionally not include input and output verification and cleaning (passthrough wrappers).

    1. The script then generates `C6-Wrapped-Functions.js`, a file including all wrapped functions, according to the Definitions file (the **Wrapper** file).
        - See [Function Wrapper Generation](#Function-Wrapper-Generation) for more details.
    1. The Wrapper file is saved to the Staging folder and CLASP folders.
1. The user verifies that any changes to the wrappers pass the tests written in the [C6-Sheets Verification Google Sheet](https://docs.google.com/spreadsheets/d/1Xp9TUpKCamB7soZmO-tdmZvVwFSFR6n40VdhAMCOL4E/edit?usp=sharing).
    1. The user enters the `./gs_verification` folder in their terminal.
    1. If the user hasn't logged in to CLASP yet, the user runs `clasp login` to log in.
    1. The user runs `clasp push` to push the contents of `./gs_verification` to the [Verification Apps Script Project](https://script.google.com/u/0/home/projects/1591i1OQCLkEVPmzA0KNEJhQ-IoRVz6sgo8UU_zV0vtsxSMY7PZxE6EuI)
    1. The user manually verifies that function outputs are as expected according to the tests written in the Verification Sheet.
1. The user is satisfied with the outcome and updates the offical C6-Sheets Apps Script Project.
    1. The user switches to the `./dist_appscript` folder in their terminal.
    1. The user runs `clasp push` to push the contents of `./dist_appscript` to the C6-Sheets Apps Script Project.

### Function Wrapper Generation

The automated generation of function wrappers uses a user-defined JSON **Definitions** file (`js-gs-automation/Function-Definitions.json`). The JSON is structured as a single object containing an entry for each function the user desires to define a wrapper for. The structure of an entry for a function in the JSON file is:

```
"Function Name" : {
    "title" : "String",
    "description" : "String",
    "clean" : Boolean,
    "flatten" : Boolean,
    "inputSchema" : {
        "input1" : ["type1", "type2"],
        "input2" : ["type3"]
    }
}
```

Here is an in-depth guide to each property in an entry:

- `Function Name`: *any*
    - This is the key in the key-object pair that defines how a wrapper will be generated for a function. 
    - Preferably, the key is name of the function and is the same as the string in `title`. 
    - This *technically* can be arbitrary, since the wrapper generator function does not check the name of the key.
- `title`: `"String"`
    - The name of the function being wrapped. 
    - This string will be directly exposed to the end user as the function they call.
    - Given a function in the Raw file named `JS_xyz`, the value for this key *must* be `xyz`.
    - *This is the only property that is actually required for a wrapper to be generated.*
- `description`: `"String"`
    - This description is included in the JSDoc-style function definition generated along with each function wrapper.
    - Google Sheets displays the description as a tooltip for C6-Sheets functions.
- `clean`: `Boolean`
    - This property determines the kind of wrapper generated for this function.
    - `true`: A full wrapper will be generated, including input/function argument type verification and output reformatting.
        - This is the suggested option for most functions.
    - `false`: A passthrough wrapper will be generated that directly passes function arguments to the equivalent function in the Raw file.
- `flatten`: `Boolean`
    - This property determines whether nested arrays will be flattened to a single array.
    - The input type verification sometimes interferes with a function recognizing arrays properly, so it may help to flatten nested arrays.
    - `true`: Flatten nested arrays. 
    - `false`: Preserve the original structure of any arrays.
        - This is the suggested option for most functions.
- `inputSchema`: `{Object}`
    - An Object containing key-array pairs that define the names of each function argument ("input") and the types for each input that the function will accept.
    - Order matters; the first function argument must be the first property in the inputSchema object.
    - For functions that have `clean` set to `true`, the input type verification function requires a dictionary listing each function argument and the types each argument can be. `inputSchema` defines that dictionary.
    - For all functions, the generation of JSDoc-style function definitions sources `inputSchema` to write the per-argument type hints Google Sheets displays to the end user.
    - Each function argument is represented as a key-array pair: `"input" : ["type1", "type2",...]`
        - `"input"` is the name of the argument.
        - The array of types can accept any number of types as Strings. As of 12/12/2025, the following types are accepted:
            - `String`: Any string, except for those that have JSON syntax and can be parsed as an object.
            - `ssPolynucleotide`: Same as `Polynucleotide`, but will only output a single stranded Polynucleotide class object.
            - `dsPolynucleotide`: Same as `Polynucleotide`, but will only output a double stranded Polynucleotide class object.
            - `Polynucleotide`: Accepts the following and returns as a double stranded Polynucleotide class object:
                - Polynucleotide class objects, which are returned as-is.
                - Strings that are JSON representations of a Polynuclotide class object, which are parsed and returned as an object.
                - Strings that `resolveToPoly` can resolve as an arbitrary Polynucleotide object. 
            - `JSON`: Strings that follow the JSON syntax and can be parsed into an object, but are intended to be strings for the functions they will be passed to.
            - `StringArray`: A 1D array whose elements are all `String` types.
            - `PolyArray`: A 1D array whose elements all pass the criteria checked for the `Polynucleotide` type.
            - `2DArray`: An array of arrays whose elements are any type.
            - `Array`: Any array.
            - `Number`: Any number or string that can be corced as a number.
            - `Boolean`: Any boolean or string that can be coerced as a boolean.
            - `FeatureDb`: Some functions require the loading of the Feature Database. 
                - This allows any input, and the end user is expected to pre-load the Feature Database for this argument.
            - `Pass`: Allows any input of any type.

When a user runs `npm run buildgs`, `gs-automation.js` builds the function wrappers with the following steps:

1. All properties listed above, except for `Function Name`, are read in as variables.
    - If they don't exist, they are read in as `undefined`.
1. The automation checks if `clean` is truthy or falsy.
    - If `true`:
        1. A JSDoc-style description is generated for the function. 
            - The structure is:
            ```
            /**
            * Description
            * 
            * @param {type} input1
            * @param {type} input2
            * @customfunction
            */
            ```
            - According to JSDoc best practices, the Description is cut into lines no more than 80 characters long, preserving words.
            - The generator function respects JSDoc syntax for handling multiple acceptable input types as well as defines the structures of Arrays and Objects.
        1. The description string is concatenated to the `wrapperFile` String.
        1. A function wrapper is generated for the function using a template and regex-replacements of placeholders with the information read in in Step 1.
            - The structure is:
            ```
            function <name>(<inputs>) {
                  const varDict = <varDict>; 
                  return verifyOutputs(JS_<name>(...verifyInputs(varDict, <flatten>, [...arguments])));
                  }
            ```
            - Only items in brackets are regex-replaced.
        1. The wrapper string is concatenated to the `wrapperFile` String.
    - If `false` or falsy:
        1. If there is no `inputSchema` defined, then an arbitrary placeholder is set allowing any input type.
        2. If `description` is not undefined, a JSDoc-style description is generated for the function (same algorithm as the `true` condition)
        1. The description string is concatenated to the `wrapperFile` String.
        3. A passthrough wrapper is generated for the function using a template and regex-replacements of placeholders with the information read in in Step 1.
            - The structure is:
            ```
            function <name>(...inputArray) {
                  return JS_<name>(...inputArray);
                  }
            ```
            - Only items in brackets are regex-replaced.
        1. The wrapper string is concatenated to the `wrapperFile` String.
1. The automation repeats the last 2 steps for each entry in the Description file.

Not every function entry requires all properties for a wrapper to successfully generate. An example of a simplified entry for functions that do not have a JSDoc description or any input/output type verification is:

```
"validateBox" : {
    "title" : "validateBox"
},
```

Which generates the following wrapper:

```
function validateBox(...inputArray) {
  return JS_validateBox(...inputArray);
}
```
## How to Use

1. Open a new terminal.
1. Navigate to the C6-Multiplatform folder in the terminal.
1. Run `npm run build` to build the C6 JavaScript module.
1. Run `npm run buildgs` to run the automation script.
1. Navigate to the `./gs_verification` folder in the terminal.
1. Run `clasp login` to log in to CLASP if you haven't already.
1. Run `clasp push` to push the contents of `gs_verification` to the [C6-Sheets Verification Apps Script Project](https://script.google.com/u/0/home/projects/1591i1OQCLkEVPmzA0KNEJhQ-IoRVz6sgo8UU_zV0vtsxSMY7PZxE6EuI).
1. Check the [C6-Sheets Verification Google Sheet](https://docs.google.com/spreadsheets/d/1Xp9TUpKCamB7soZmO-tdmZvVwFSFR6n40VdhAMCOL4E/edit?usp=sharing) for any unexpected errors or inconsistencies.
1. When ready, navigate to the `./dist_appsscript` folder in the terminal.
1. Run `clasp push` to push the contents of `dist_appsscript` to the C6-Sheets Official Release Apps Script Project.

## Credit

Richie Woo (richie.woo@berkeley.edu)

## License

MIT License © University of California, Berkeley