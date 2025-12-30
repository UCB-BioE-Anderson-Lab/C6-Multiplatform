/**
 * @file Sheets-Helpers.js
 * @author Richie Woo
 * @copyright 2025 University of California, Berkeley
 * @license See the LICENSE file included in the repository
 * @version 1.0.0
 * @description
 * These scripts provide functionality for automatically generated Apps Script wrappers for C6-Multiplatform.
 */



/**
 * Function to parse a JSON string into a multidimensional Array.
 * 
 * @param {string} objJSON
 * @param {string} fieldName
 * @customfunction
 */
function parseJSON(inputString) {
  var jsonData = JSON.parse(inputString);
  var outputArray = [];

  function flattenObject(obj, prefix) {
    prefix = prefix || '';
    Object.keys(obj).forEach(function(key) {
      var fullKey = prefix + key;
      if (typeof obj[key] === 'object' && !Array.isArray(obj[key]) && obj[key] !== null) {
        outputArray.push([fullKey + ':']);
        flattenObject(obj[key], fullKey + '.');
      } else if (Array.isArray(obj[key])) {
        outputArray.push([fullKey + ':']);
        var keys = Object.keys(obj[key][0] || {});
        outputArray.push(['', ...keys.map(function(k) { return k + ':'; })]);
        for (var i = 0; i < obj[key].length; i++) {
          var values = Object.values(obj[key][i] || {}).map(function(v) { return v === null || v === undefined ? v + '' : v; });
          outputArray.push(['', ...values]);
        }
      } else {
        var value = obj[key] === null || obj[key] === undefined ? obj[key] + '' : obj[key];
        outputArray.push([fullKey + ':', value]);
      }
    });
  }
  
  if (typeof jsonData === 'object' && jsonData !== null) {
    flattenObject(jsonData);
  } else {
    throw new Error('Invalid input: Not a JSON object.');
  }
  
  return outputArray;
}

//initalizeFeatureDatabase is written by J. Christopher Anderson.
// Internal feature database
let featureDbGlobal = [];

/**
 * Initialize the Feature Database from a predetermined source.
 * Outputs a JSON representation of the Feature Database.
 * 
 * @customfunction
 */
function initializeFeatureDatabase() {
    const defaultFeatureUrl = "https://raw.githubusercontent.com/UCB-BioE-Anderson-Lab/cloning-tutorials/main/sequences/Default_Features.txt";

    try {
        const text = UrlFetchApp.fetch(defaultFeatureUrl).getContentText(); 

        const lines = text.split("\n").filter(line => line.trim().length > 0);

        featureDbGlobal = lines.map(line => {
            const [Name, Sequence, Type, Color, LabelColor, Forward, Reverse] = line.split(/\s+/);
            return { Name, Sequence, Type, Color };
        });
        return featureDbGlobal;
    } catch (e) {
        throw new Error(e)
    }
};

/**
 * Attempts to convert a JSON String into a JavaScript/Apps Script Object.
 * @param {string} inputString 
 * @customfunction
 */
function JSONtoObject(inputString) {
    return JSON.parse(JSONtoObject)
}

// ---------------------------
// The below functions exist for internal wrapper use only and should not be called from Sheets
// ---------------------------

function reformatInputs(varDict, inputArray) {
    var cleanedInputArray = [];
    var arrayPartitions = [];
    for (const [key, valueArray] of Object.entries(varDict)) {
        switch (valueArray.some(x => x.includes("Array"))) {
            case true:
                arrayPartitions.push(Infinity)
                break;
            default:
                arrayPartitions.push(1);
                break;
        }
    }

    var arrayIndex = arrayPartitions.indexOf(Infinity); //There should only be one
    if (arrayIndex == -1) {
        return inputArray;
    }
    var trailingArgs = (arrayPartitions.length - 1) - arrayIndex;
    var leadingArgsArray = inputArray.splice(0, arrayIndex);
    var trailingArgsArray = (trailingArgs != 0) ? inputArray.splice(-(trailingArgs), Infinity) : [];
    cleanedInputArray = cleanedInputArray.concat(leadingArgsArray);
    cleanedInputArray.push(inputArray);
    cleanedInputArray = cleanedInputArray.concat(trailingArgsArray);
    return cleanedInputArray;
}

function verifyInputs(varDict, flatten, inputArray) {
    var cleanedInputArray = [];
    var inputIndex = 0;

    // Handle case if function argument is a single value, which is not given as an array.
    // A range of cells will give an array in Apps Script.
    if (!Array.isArray(inputArray)) {
        inputArray = [inputArray];
    }

    if (flatten) {
        inputArray = inputArray.flat(Infinity);
        inputArray = reformatInputs(varDict, inputArray);
    }

    for (const [key, value] of Object.entries(varDict)) {
        var input = inputArray[inputIndex];
        var loopSuccess = false;

        valueCheckLoop:
        for (const valueType of value) {

            switch (valueType) {
                case "String":
                    var itemToCheck = checkIfString(input);
                    // Empty string "" is falsy.
                    if (!(itemToCheck === false)) {
                        cleanedInputArray.push(input);
                        loopSuccess = true;
                        break valueCheckLoop;
                    } else {
                        break;
                    }
                case "ssPolynucleotide":
                    var itemToCheck = checkIfPoly(input, "ssPoly");
                    if (itemToCheck) {
                        cleanedInputArray.push(itemToCheck);
                        loopSuccess = true;
                        break valueCheckLoop;
                    } else {
                        break;
                    }
                case "dsPolynucleotide":
                    var itemToCheck = checkIfPoly(input, "dsPoly");
                    if (itemToCheck) {
                        cleanedInputArray.push(itemToCheck);
                        loopSuccess = true;
                        break valueCheckLoop;
                    } else {
                        break;
                    }
                case "Polynucleotide":
                    var itemToCheck = checkIfPoly(input, null);
                    if (itemToCheck) {
                        cleanedInputArray.push(itemToCheck);
                        loopSuccess = true;
                        break valueCheckLoop;
                    } else {
                        break;
                    }
                case "JSON":
                    // Specifically returns back a string representation of the JSON.
                    var itemToCheck = checkIfJSON(input, "String");
                    if (itemToCheck) {
                        cleanedInputArray.push(itemToCheck);
                        loopSuccess = true;
                        break valueCheckLoop;
                    } else {
                        break;
                    }
                case "StringArray":
                    // Specifically a 1D array whose elements are all string types.
                    var itemToCheck = checkIfArray(input, "String");
                    if (itemToCheck) {
                        cleanedInputArray.push(itemToCheck);
                        loopSuccess = true;
                        break valueCheckLoop;
                    } else {
                        break;
                    }
                case "PolyArray":
                    // Specifically a 1D array whose elements are all Polynucleotide objects or
                    // Polynucleotide objects as JSON.
                    var itemToCheck = checkIfArray(input, "Poly");
                    if (itemToCheck) {
                        cleanedInputArray.push(itemToCheck);
                        loopSuccess = true;
                        break valueCheckLoop;
                    } else {
                        break;
                    }
                case "2DArray":
                    // Example: makeJSON function which converts a 2D array generated by selecting a 2D 
                    // range in sheets into a JSON.
                    var itemToCheck = checkIfArray(input, "2D");
                    if (itemToCheck) {
                        cleanedInputArray.push(itemToCheck);
                        loopSuccess = true;
                        break valueCheckLoop;
                    } else {
                        break;
                    }
                case "Array":
                    // Any array. Does not check if it matches the above three types, unlike the behavior
                    // of the cases for "String", "Polynucleotide", and "JSON".
                    var itemToCheck = checkIfArray(input, null);
                    if (itemToCheck) {
                        cleanedInputArray.push(itemToCheck);
                        loopSuccess = true;
                        break valueCheckLoop;
                    } else {
                        break;
                    }
                case "Number":
                    var itemToCheck = checkIfNumber(input);
                    // 0 may resolve to falsy.
                    if (!(itemToCheck === false)) {
                        cleanedInputArray.push(itemToCheck);
                        loopSuccess = true;
                        break valueCheckLoop;
                    } else {
                        break;
                    }
                case "Boolean":
                    // Obviously cannot use booleans like the other cases since this is the bool case.
                    // So we use the string "Not A Bool"
                    var itemToCheck = checkIfBool(input);
                    if (!(itemToCheck === "Not A Bool")) {
                        cleanedInputArray.push(itemToCheck);
                        loopSuccess = true;
                        break valueCheckLoop;
                    } else {
                        break;
                    }
                case "Object":
                    // JSON string representations of any object.
                    var itemToCheck = checkIfJSON(input, "Object");
                    if (itemToCheck) {
                        cleanedInputArray.push(itemToCheck);
                        loopSuccess = true;
                        break valueCheckLoop;
                    } else {
                        break;
                    }
                case "ConstructionFile":
                    var itemToCheck = tryParseCF(input);
                    if (itemToCheck) {
                        cleanedInputArray.push(itemToCheck);
                        loopSuccess = true;
                        break valueCheckLoop;
                    } else {
                        break;
                    }
                case "FeatureDb":
                    // Just pass this one
                    cleanedInputArray.push(input);
                    loopSuccess = true;
                    break valueCheckLoop;
                case "Pass":
                    // Any input is ok
                    cleanedInputArray.push(input);
                    loopSuccess = true;
                    break valueCheckLoop;
                default:
                    throw new Error("JS to GS automation did not provide a valid dictionary.");
            }
        }

        if (!loopSuccess) {
            throw new Error("Input " + JSON.stringify(input) + " (argument #" + String(inputIndex) + ") is invalid for this function");
        }

        inputIndex += 1;
    }

    return cleanedInputArray;
}

function verifyOutputs(output) {
    const outputType = typeof output;

    switch (outputType) {
        case "object":
            // Options: 2D Table (Array), Array of Polys, Array of Strings, Polynucleotide object, CF object, or something else.
            switch (true) {
                case (Array.isArray(output)):
                    // Options: 2D Table, Array of Polys, Array of Strings, or something else.
                    switch (output.every(function(x) {return (x instanceof Polynucleotide)})) {
                        case true:
                            // Output is an array of polynucleotide objects, each must be converted into a JSON string interpretation.
                            var fixedOutput = output.map(JSON.stringify);
                            return fixedOutput;
                            break;
                        default:
                            // We know it's an array. recursively modify the array until all objects are stringified.
                            function recursiveStringify(input) {
                            // Base case: If it's a value (not an object or array), return as is.
                            if (input === null || !(typeof input === 'object')) {
                                return input;
                            }

                            // Recursive case for arrays
                            if (Array.isArray(input)) {
                                return input.map(element => recursiveStringify(element));
                            }

                            // Recursive case for objects
                            if ((typeof input === 'object') && !(Array.isArray(input))) {
                                return JSON.stringify(input);
                            }

                            return JSON.stringify(input);
                            }

                            // Output is something else, like an Array of Strings or 2D Array. Return it as-is.
                            var fixedOutput = recursiveStringify(output);
                            return fixedOutput;
                            break;
                    }
                case (output instanceof Polynucleotide):
                    // Output is a Polynucleotide object and needs to be stringified.
                    return JSON.stringify(output);
                case (output.hasOwnProperty("steps") && output.hasOwnProperty("sequences") && Object.keys(output).length == 2):
                    // Object describes a construction file and should be stringified as a JSON.
                    return JSON.stringify(output);
                default:
                    // Object is... something. Provide as is to end user. They can JSON.stringify as needed.
                    return output;
            }
        default:
            // Originally there were going to be more cases, but only outputs as objects need to be cleaned up.
            // Everything else (JSONs, Strings, Numbers, Bools) will display properly on a sheet.
            return output;
    }

}

// Credit: https://stackoverflow.com/a/20392392
function tryParseJSONObject (jsonString){
    if (typeof jsonString == "object") {
        return jsonString;
    } else {
        try {
            var o = JSON.parse(jsonString);

            // Handle non-exception-throwing cases:
            // Neither JSON.parse(false) or JSON.parse(1234) throw errors, hence the type-checking,
            // but... JSON.parse(null) returns null, and typeof null === "object", 
            // so we must check for that, too. Thankfully, null is falsey, so this suffices:
            if (o && typeof o === "object") {
                return o;
            }
        }
        catch (e) { }

    return false;
    }
};

function checkIfString(input) {
    // Check if String
    if (typeof input != "string") {
        return false;
    }
    // Check if NOT JSON format (Polynucleotides or regular JSONs)
    // These must be processed seperately (conversion to Polynucleotide object or otherwise)
    if (!tryParseJSONObject(input)) {
        return true;
    } else {
        return false;
    }
}

function checkIfPoly(input, strand) {
    // Function will accept Polynucleotide objects for chained functions in the same cell
    // as well as polynucleotide objects in JSON format.

    switch (true) {
        case (typeof input == "string"):
            // If input is a string, continue onwards
            break;
        case (input instanceof Polynucleotide):
            // Input is already a Poly object. Return as is.
            return input;
        default:
            // Input is not a Poly or Poly-as-JSON String.
            return false;
    }

    // Use resolveToPoly to return either:
    // A. A Polynucleotide object
    // B. A JSON object
    // C. An Error
    try {
        // Case A or B: continue.
        var testResolve = internal_resolveToPoly(input, strand);
    } catch (error) {
        // Case C: this item is not a Polynucleotide, return false.
        return false;
    }

    // If testResolve is a Polynucleotide, then return it (Case A)
    if (testResolve instanceof Polynucleotide) {
        return testResolve;
    }

    // Case B: resolveToPoly returned a JSON object.
    try {
        // Check if the object has the properties of a Polynucleotide with testJSONisPoly.
        var isJSONPoly = testJSONisPoly(testResolve);
        return isJSONPoly;
    } catch (error) {
        // If not, return false.
        return false;
    }

    return false;

}

function testJSONisPoly (testObject) {
    var propertiesToTest = ["sequence", "ext5", "ext3", "isDoubleStranded", "isRNA", "isCircular", "mod_ext3", "mod_ext5"];
    if (typeof testObject == "string") {
        testObject = JSON.parse(testObject);
    }
    if ((propertiesToTest.every(function(x) {return x in testObject}) && (propertiesToTest.length == Object.getOwnPropertyNames(testObject).length))) {
        return Object.assign(new Polynucleotide(), testObject);
    } else {
        return false;
    }
}

function checkIfJSON(input, returnFormat) {
    // Check if input is a JSON
    // This only checks JSONs in string format.
    var JSONinput = tryParseJSONObject(input);

    if (!JSONinput) {
        // If input is NOT JSON, return false
        return false;
    } else {
        switch (returnFormat) {
            case "String" :
                return JSON.stringify(JSONinput);
                break;
            case "Object" :
                return JSONinput;
                break;
            default:
                return JSON.stringify(JSONinput);
                break;
        }
    }
    
}

function checkIfNumber(input) {
    // Needs to check if input is a number or is a string that can be coerced into a number,
    // but nothing else should be accepted even if it can be coerced into a number like true, false, null, undefined, etc.
    if (typeof input === "number") {
        return input;
    } else if (typeof input === "string") {
        input = Number(input);
        if (Number.isNaN(input)) {
            return false;
        } else {
            return input;
        }
    } else {
        return false;
    }
}

function checkIfBool(input) {
    // Needs to check if input is a bool or is a string that can be coerced into a bool,
    // but nothing else should be accepted even if it can be coerced into a bool like null, undefined, etc.
    // We can get really tangled with truthy and falsy values, so we are only accepting string inputs
    // that are explicitly "true" and "false" or uppercase permutations of them.
    if (typeof input === "boolean") {
        return input;
    } else if (typeof input === "string") {
        input = input.toLowerCase();
        switch (input) {
            case "true":
                return true;
            case "false":
                return false;
            default:
                return "Not A Bool";
        }
    } else {
        return "Not A Bool";
    }
}

function flattenToTop(inputArray) {
    var foundBottom = false;
    while (foundBottom == false) {
        var firstItem = inputArray[0]
        if (!Array.isArray(firstItem)) {
            foundBottom = true;
        } else {
            inputArray = inputArray.flat(1);
        }
    }
    return inputArray;
}

function checkIfArray(input, internalType) {
    var inputObj = tryParseJSONObject(input);
    if (Array.isArray(inputObj)) {
        var typeVerifyBool = false;
        switch (internalType) {
            case null:
                typeVerifyBool = true;
                break;
            case "String":
                inputObj = flattenToTop(inputObj);
                typeVerifyBool = inputObj.every(checkIfString);
                break;
            case "Poly":
                inputObj = flattenToTop(inputObj);
                inputObj = inputObj.map(function(x) {return checkIfPoly(x, 2);});
                typeVerifyBool = inputObj.every(checkIfPoly);
                break;
            case "2D":
                typeVerifyBool = inputObj.every(Array.isArray);
                break;
            default:
                break;
        }

        switch (typeVerifyBool) {
            case true: return inputObj;
            case false: return false;
            default:
                throw new Error("checkIfArray internalType is not one of four valid options.")
        }

    } else {
        return false;
    }
}

function tryParseCF(...blobs) {
    blobs = blobs.flat(1);
    function preprocessData(data) {
        if (Array.isArray(data)) {
            if (data.every(item => Array.isArray(item))) {
                return data.map(row => row.map(cell => cell.toString()).join('\t')).join('\n');
            } else if (data.every(item => typeof item === "string" || typeof item === "number")) {
                return data.map(cell => cell.toString()).join('\t');
            } else {
                throw new Error("Unsupported input type for preprocessData function");
            }
        } else {
            return data.toString();
        }
    }

    function tokenize(text) {
        text = text.replace(/#.*$/g, '').replace(/\/\/.*$/g, '').replace(/\/\*.*?\*\//g, '');
        let tokens = text.trim().split(/\s+/);
        // let tokens = text.split(/[\s,/()]+/);
        tokens = tokens.map(token => token.replace(/[()]/g, ""));
        tokens = tokens.filter(token => !["on", "with", ""].includes(token.toLowerCase()));
        return tokens;
    }

    let singleblob = "";
    for (const blob of blobs) {
        singleblob += preprocessData(blob) + '\n';
    }

    const preprocessedData = singleblob.trim().split('\n').map(line => tokenize(line));

    return preprocessedData;
}

function internal_resolveToPoly(seqOrJSON, type) {
  //See if its a JSON already
  try{
      var json = JSON.parse(seqOrJSON);
      return json;
  }
  catch(err) {/*intentionally empty*/}

  //See if its a singular DNA sequence
  if (!_regexDNA.test(seqOrJSON)) {
    throw Error("Cannot resolve " + seqOrJSON);
  }
  
  switch (type) {
    case "oligo":
      return new Polynucleotide(seqOrJSON, null, null, false, false, false, "hydroxyl", null);
    case "dsDNA":
      return new Polynucleotide(seqOrJSON, "", "", true, false, false, "hydroxyl", "hydroxyl");
    case "plasmid":
      return new Polynucleotide(seqOrJSON, "", "", true, false, true, null, null);
    case "ssPoly":
      return new Polynucleotide(seqOrJSON, "", "", false, false, false, "hydroxyl", "hydroxyl");
    case "dsPoly":
      return new Polynucleotide(seqOrJSON, "", "", true, false, false, "hydroxyl", "hydroxyl");
    default:
      return new Polynucleotide(seqOrJSON, "", "", true, false, false, "hydroxyl", "hydroxyl");
  }
}