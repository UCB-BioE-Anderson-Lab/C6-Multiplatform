function JS_someFunc(someSeq, someString, someBoolean){
    //someSeq may be Polynucleotide or String
    //someString is one of four that will be checked in-function
    //someBoolean is a bool used to turn certain functions on and off.
    return "arbitrary output"
}

function someFunc(...inputArray){
    // Initialize predefined variables
    varDict = {
        "someSeq":["String", "Polynucleotide"],
        "someString":["String"],
        "someBoolean":["Boolean"],
    };

    // Verify inputs using the given dictionary of acceptable inputs.
    // Then, call the base function with those inputs.
    // Last, verify the outputs so objects are returned as string forms.
    return verifyOutputs(JS_someFunc(...verifyInputs(varDict, inputArray)));
}

