/**
 * This example file describes a special notation for a comment prepending a function to allow a JS to GS
 * automation script to parse function input and output types and generate a GS wrapper for the function
 * that will properly accept the multitude of inputs Google Sheets provides to functions written in Apps
 * Script. It maintains any JSDoc documentation already present.
 * 
 * Rules:
 * 1. The comment will be a single line comment starting with "//*****<FuncName>" and ending in "*****".
 * . Types listed must conform to the following listed types, verbatim:
 *      - String
 *      - Polynucleotide
 *      - Boolean
 *      - JSON
 *      - Number
 * . Each argument/input will be in the form: 
 *      {argName:type1|type2|type3}
 * . Optional arguments are denoted with a dot prefix to the argument name.
 *      {.argName:type}
 * . The returns/outputs will be in the form: 
 *      (type1|type2|type3)
 * . Arguments are chained before returns: 
 *      {argName1:type}{argName2:type}(type|type)
 * . Arguments that are arrays of any length are to be written in the form: 
 *      {argName:[type1|type2]}
 * . If an array requires a specific format, like 2D arrays, then use rules 2 and 4 inside the array:
 *      {argName:[{arg1:type}{arg2:type}{arg3:[type]}]}
 * . Functions with rest parameter arguments may indicate them as an array like so:
 * 
 *      //*****<adder>{a:Number|String}{b:Number}{xyz:[Number]}(Number)*****
 *      function adder(a, b, ...xyz) {
 *          if (typeof a === "String") {
 *              return -1;
 *          }
 *          let total = a + b;
 *          for (const c of xyz){
 *              total += c;
 *          }
 *          return total;
 *      }; 
 * 
 *    Note that rest parameters in JavaScript are provided to the function as one array collecting all
 *    remaining arguments passed to the function, so the array formatting is appropriate.
 *   
 * 
 * 
 * 
 * 
 * */


// BEGIN Example 1: resolveToSeq
// ---------
// Code Block Before:

    /**
    * This function takes in a string value, `seq`, and first converts it to a string if it is not. It then 
    * matches the regular expression pattern defined by the constant _regexDNA.
    * If the input matches the pattern, the input is returned.  Otherwise it throws an error.
    * 
    * @param {String} seq - The input containing a DNA sequence string.
    * @return {String} - Returns the input sequence as a string
    * 
    * @example
    * var sequence = resolveToSeq("ATCG");
    * Logger.log(sequence); // outputs "ATCG"
    * var sequence = resolveToSeq("name1");
    * Logger.log(sequence); // outputs the column B value of the matching row
    * @customfunction
    */
    function resolveToSeq(seq) {
        const regexDNA = /^[ACTGactgMRWSYKVHDBNXmrwsykvhdbnx-]+$/;
        // If seq is already a Polynucleotide, extract the sequence
        if (seq instanceof Polynucleotide) {
        return seq.sequence;  // Return the sequence from the Polynucleotide object
        }
        
        seq = seq.toString();  // Ensure it's a string

        if (regexDNA.test(seq)) {
        return seq.toUpperCase();  // Return the sequence in uppercase if it's valid
        }
        
        throw new Error("Unrecognizable as sequence: " + seq);  // If not a valid DNA sequence
    }

// ----------
// Code Block After:

    /**
    * This function takes in a string value, `seq`, and first converts it to a string if it is not. It then 
    * matches the regular expression pattern defined by the constant _regexDNA.
    * If the input matches the pattern, the input is returned.  Otherwise it throws an error.
    * 
    * @param {String} seq - The input containing a DNA sequence string.
    * @return {String} - Returns the input sequence as a string
    * 
    * @example
    * var sequence = resolveToSeq("ATCG");
    * Logger.log(sequence); // outputs "ATCG"
    * var sequence = resolveToSeq("name1");
    * Logger.log(sequence); // outputs the column B value of the matching row
    * @customfunction
    */
    //*****<resolveToSeq>{seq:String|Polynucleotide}(String)*****
    function resolveToSeq(seq) {
        const regexDNA = /^[ACTGactgMRWSYKVHDBNXmrwsykvhdbnx-]+$/;
        // If seq is already a Polynucleotide, extract the sequence
        if (seq instanceof Polynucleotide) {
        return seq.sequence;  // Return the sequence from the Polynucleotide object
        }
        
        seq = seq.toString();  // Ensure it's a string

        if (regexDNA.test(seq)) {
        return seq.toUpperCase();  // Return the sequence in uppercase if it's valid
        }
        
        throw new Error("Unrecognizable as sequence: " + seq);  // If not a valid DNA sequence
    }

// END Example 1.