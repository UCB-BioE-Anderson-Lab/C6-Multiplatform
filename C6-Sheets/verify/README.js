/**
 * C6-Tools Synthetic Biology Functions for Google Apps Script
 * by J. Christopher Anderson with ChatGPT
 *
 * Last modified: March 20, 2023
 *
 * Description: C6-Tools is a collection of pure functions for use in Google Sheets to automate the
 * design of synthetic biology experiments.
 *
 * It is organized into several script files:
 *
 *   C6-Utils: Basic utility functions and sequence operations. This handles the representation
 *    of DNA as names, strings, or polynucleotide objects. It also has sequence operations including
 *    reverse complement (revcomp) and the like. It also has functions for manipulating JSON objects
 *    and arrays expressed in worksheet cells.
 *
 *   C6-Oligos: Design of oligos for common DNA fabrication methods. Includes functions to design 
 *    oligos (or gene synthesis cassettes) for MoClo Golden Gate Assembly, BioBricks, BglBricks, 
 *    PCA, and LCA. It also has a lower level method, findanneal, for choosing annealing sequences
 *    during design of oligos for non-standardized experiments.
 *
 *   C6-Sim: Simulation of molecular biology reactions. Simulates the products of PCR, Golden Gate 
 *    Assembly, Gibson Isothermal Assembly/Yeast recombination. It can also parse and simulate 
 *    construction files.
 *
 *   C6-Gene: Design of coding sequences for gene synthesis. It can translate a DNA sequence to 
 *    protein. It can silently remove restriction sites from a CDS. It can also reverse translate 
 *    a protein sequence to DNA.
 *
 *   C6-Plate: A rudimentary inventory for managing samples, plates, and boxes. Allows sample names
 *    to be inserted into tables representing plates and boxes, and then have them queried for the 
 *    locations of samples.
 *
 *   C6-Align: Sequence alignment algorithms.
 *
 *   C6-NCBI: Wrapper of the NCBI API for sequence retrieval.
 *
 * Dependencies: None. This is a JavaScript project with no dependencies.
 *
 * Usage: To use these functions, the easiest method is to make a copy of a Google Sheet containing
 * the scripts:
 * 
 * - Primary Sheet for development of C6-Tools (latest and maybe greatest?): 
 * https://docs.google.com/spreadsheets/d/1605KkBLxiZrzo4QioxzNEKK7c8F3knHX_wJ4YDzcvB4/
 * 
 * - Most recent static distribution (most stable and citable): 
 * https://docs.google.com/spreadsheets/d/1F_lftLWSiIwiHzzvkQ3DcZLlSQHsyEBneEH_940Uh1I/
 *
 * Alternatively, you could open a Google Sheet and navigate to the Tools menu. Select "Extensions > 
 * Apps Script" and paste in the scripts that you need. Save the scripts and return to your sheet. You 
 * can then call the functions from within any cell.
 *
 * The code has not been tested in the script engine of a browser nor NodeJS, but it should work there too.
 *
 * The distributions contain example Sheets showing how to use the functions for various tasks. Additional
 * Sheets are used for testing and more nuanced usage illustration of some functions. You do not need to
 * retain these examples for the tools to function properly; the Sheets can be deleted. The header comments
 * for each function also include more technical information about their respective APIs.
 * 
 * Limitations: Due to limitations in the Google Apps Script environment, these functions may be slower 
 * than equivalent functions running natively on a local computer. The degree of testing is uneven
 * across this project, so beware that there may be bugs and major errors.
 *
 * Contact: For questions or feedback, contact J. Christopher Anderson at jcanderson@berkeley.edu
 *
 * Acknowledgments: C6 is an homage to the Clotho effort pioneered with Douglas Densmore at UC Berkeley 
 * https://clothocad.sourceforge.net/wiki/index.php/ClothoClassicHistory. There are 3 distinct releases 
 * of this Java-based synthetic biology platform. Projects C4, C5, and C6 represent ongoing explorations 
 * of how to interface with synthetic biology tools, refine the scope of use, and iterate on algorithm 
 * improvement. C6 is the first in the series written in JavaScript. It was inspired by the recognition 
 * that a Google Sheet could be easily distributed and would be readily recognizable to new users. 
 * Additionally, the spreadsheet interface is useful for visualizing experiments involving many samples 
 * and is commonly used in research. C6 was also motivated by the release of ChatGPT which greatly 
 * facilitated the translation of extensive legacy code to the JavaScript required for Google Sheets 
 * Apps Script. The project also borrows many ideas from the ConstructionFileSimulator effort, for which 
 * many students have contributed. The C6-Gene algorithms are inspired by the GeneDesign tool and follows 
 * a similar logic.
 *
 * Copyright 2023 University of California, Berkeley
 *
 * @license See the LICENSE file included in the repository
 */

