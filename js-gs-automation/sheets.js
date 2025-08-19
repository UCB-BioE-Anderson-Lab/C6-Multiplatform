((global, factory) => {
    "object" == typeof exports && "undefined" != typeof module ? module.exports = factory() : "function" == typeof define && define.amd ? define(factory) : (global = "undefined" != typeof globalThis ? globalThis : global || self).C6 = factory();
})(this, function() {
    function cleanup(sequence) {
        if ("string" != typeof sequence) try {
            sequence = sequence.toString();
        } catch (err) {
            throw new Error("Input must be a string. It's a " + typeof sequence);
        }
        sequence = sequence.replace(/[\s\d\r]/g, "");
        if (/^[ACGTRYSWKMBDHVNUacgtryswkmbdhvnu*]+$/.test(sequence)) return sequence = sequence.toUpperCase();
        throw new Error("Input must only contain valid biopolymer letters (DNA: A, C, G, T, or degeneracy codes, RNA: A, C, G, U, or degeneracy codes, Protein: 20 standard amino acids and their degeneracy codes)");
    }
    let _regexDNA = /^[ACTGactgMRWSYKVHDBNXmrwsykvhdbnx-]+$/;
    function resolveToSeq(seq) {
        if (seq instanceof Polynucleotide) return seq.sequence;
        if (seq = seq.toString(), _regexDNA.test(seq)) return seq.toUpperCase();
        throw new Error("Unrecognizable as sequence: " + seq);
    }
    class Polynucleotide {
        constructor(sequence, ext5 = null, ext3 = null, isDoubleStranded, isRNA, isCircular, mod_ext5, mod_ext3) {
            this.sequence = sequence && sequence.toUpperCase(), this.ext5 = ext5 && ext5.toUpperCase(), 
            this.ext3 = ext3 && ext3.toUpperCase(), this.isDoubleStranded = isDoubleStranded, 
            this.isRNA = isRNA, this.isCircular = isCircular, this.mod_ext3 = mod_ext3 || "", 
            this.mod_ext5 = mod_ext5 || "";
        }
    }
    function polyrevcomp(frag) {
        var revseq = revcomp(frag.sequence), revExt = ext => ext ? ext.startsWith("-") ? "-" + revcomp(ext.slice(1)) : revcomp(ext) : "", new5 = revExt(frag.ext3), revExt = revExt(frag.ext5);
        return new Polynucleotide(revseq, new5, revExt, frag.isDoubleStranded, frag.isRNA, frag.isCircular, frag.mod_ext3, frag.mod_ext5);
    }
    function polynucleotide(sequence, ext5, ext3, isDoubleStranded, isRNA, isCircular, mod_ext5, mod_ext3) {
        return new Polynucleotide(sequence, ext5, ext3, isDoubleStranded, isRNA, isCircular, mod_ext5, mod_ext3);
    }
    function dsDNA(sequence) {
        return new Polynucleotide(sequence, "", "", !0, !1, !1, "hydroxyl", "hydroxyl");
    }
    function oligo(sequence) {
        return new Polynucleotide(sequence, null, null, !1, !1, !1, "hydroxyl", null);
    }
    function plasmid(sequence) {
        return new Polynucleotide(sequence, "", "", !0, !1, !0, null, null);
    }
    function isPalindromic(seq) {
        let complements = {
            A: "T",
            T: "A",
            C: "G",
            G: "C"
        };
        for (var nucleotide of seq) if (!complements.hasOwnProperty(nucleotide)) throw new Error(`Error: Invalid character '${nucleotide}' found in sequence '${seq}'. Sequence must contain only A, T, C, or G.`);
        var reverseComplement = seq.split("").reverse().map(nucleotide => complements[nucleotide]).join("");
        return seq === reverseComplement;
    }
    function revcomp(inseq) {
        if (!inseq.length) return "error on " + inseq;
        var output = "";
        for (let i = inseq.length - 1; 0 <= i; i--) switch (inseq[i]) {
          case "A":
            output += "T";
            continue;

          case "T":
            output += "A";
            continue;

          case "C":
            output += "G";
            continue;

          case "G":
            output += "C";
            continue;

          case "a":
            output += "t";
            continue;

          case "t":
            output += "a";
            continue;

          case "c":
            output += "g";
            continue;

          case "g":
            output += "c";
            continue;

          case "B":
            output += "V";
            continue;

          case "D":
            output += "H";
            continue;

          case "H":
            output += "D";
            continue;

          case "K":
            output += "M";
            continue;

          case "N":
            output += "N";
            continue;

          case "R":
            output += "Y";
            continue;

          case "S":
            output += "S";
            continue;

          case "M":
            output += "K";
            continue;

          case "V":
            output += "B";
            continue;

          case "W":
            output += "W";
            continue;

          case "Y":
            output += "R";
            continue;

          case "b":
            output += "v";
            continue;

          case "d":
            output += "h";
            continue;

          case "h":
            output += "d";
            continue;

          case "k":
            output += "m";
            continue;

          case "n":
            output += "n";
            continue;

          case "r":
            output += "y";
            continue;

          case "s":
            output += "s";
            continue;

          case "m":
            output += "k";
            continue;

          case "v":
            output += "b";
            continue;

          case "w":
            output += "w";
            continue;

          case "y":
            output += "r";
            continue;

          default:
            throw new Error("Character '" + inseq[i] + "' is not a valid DNA character");
        }
        return output;
    }
    function gccontent(inseq) {
        inseq = inseq.toUpperCase();
        let gcCount = 0;
        for (let i = 0; i < inseq.length; i++) "G" != inseq[i] && "C" != inseq[i] || gcCount++;
        return gcCount / inseq.length;
    }
    function basebalance(inseq) {
        inseq = inseq.toUpperCase();
        var base, baseCounts = {
            A: 0,
            C: 0,
            G: 0,
            T: 0
        };
        for (let i = 0; i < inseq.length; i++) baseCounts[inseq[i]]++;
        let score = 1;
        for (base in baseCounts) {
            if (0 == baseCounts[base]) {
                score = 0;
                break;
            }
            score *= baseCounts[base] / inseq.length;
        }
        return 4 * Math.pow(score, .25);
    }
    function maxrepeat(inseq) {
        inseq = inseq.toUpperCase();
        let lastBase = "", streak = 0, maxStreak = 0;
        for (let i = 0; i < inseq.length; i++) inseq[i] == lastBase ? (streak++, 
        maxStreak = Math.max(maxStreak, streak)) : (lastBase = inseq[i], streak = 1);
        return maxStreak;
    }
    function translate(dna) {
        if ("string" != typeof dna) throw new Error("Translate: " + dna + " is not a string.");
        if (dna = cleanup(dna), !/^[ACGT]+$/.test(dna)) throw new Error("Input must only contain valid DNA letters (A, C, G, T).");
        var geneticCode = {
            ATA: "I",
            ATC: "I",
            ATT: "I",
            ATG: "M",
            ACA: "T",
            ACC: "T",
            ACG: "T",
            ACT: "T",
            AAC: "N",
            AAT: "N",
            AAA: "K",
            AAG: "K",
            AGC: "S",
            AGT: "S",
            AGA: "R",
            AGG: "R",
            CTA: "L",
            CTC: "L",
            CTG: "L",
            CTT: "L",
            CCA: "P",
            CCC: "P",
            CCG: "P",
            CCT: "P",
            CAC: "H",
            CAT: "H",
            CAA: "Q",
            CAG: "Q",
            CGA: "R",
            CGC: "R",
            CGG: "R",
            CGT: "R",
            GTA: "V",
            GTC: "V",
            GTG: "V",
            GTT: "V",
            GCA: "A",
            GCC: "A",
            GCG: "A",
            GCT: "A",
            GAC: "D",
            GAT: "D",
            GAA: "E",
            GAG: "E",
            GGA: "G",
            GGC: "G",
            GGG: "G",
            GGT: "G",
            TCA: "S",
            TCC: "S",
            TCG: "S",
            TCT: "S",
            TTC: "F",
            TTT: "F",
            TTA: "L",
            TTG: "L",
            TAC: "Y",
            TAT: "Y",
            TAA: "*",
            TAG: "*",
            TGC: "C",
            TGT: "C",
            TGA: "*",
            TGG: "W"
        };
        let aaSequence = "";
        for (let i = 0; i < dna.length; i += 3) {
            var codon = dna.substring(i, i + 3), aa = geneticCode[codon];
            if (!aa) throw new Error("Invalid codon: " + codon);
            "*" !== aa && (aaSequence += aa);
        }
        return aaSequence;
    }
    let Seq = Object.freeze({
        __proto__: null,
        Polynucleotide: Polynucleotide,
        basebalance: basebalance,
        cleanup: cleanup,
        comparePolynucleotides: function(polyA, polyB) {
            if ("Polynucleotide" !== polyA.constructor.name) throw new Error("polyA inputs must be Polynucleotide objects");
            if ("Polynucleotide" !== polyB.constructor.name) throw new Error("polyB inputs must be Polynucleotide objects");
            if (polyA.isCircular != polyB.isCircular) return !1;
            if (polyA.isRNA != polyB.isRNA) return !1;
            if (polyA.isDoubleStranded != polyB.isDoubleStranded) return !1;
            if (polyA.isCircular) {
                let polyAseq = polyA.sequence.toLowerCase(), polyBseq = polyB.sequence.toLowerCase();
                var doubleAseq = polyAseq + polyAseq;
                return -1 === doubleAseq.indexOf(polyBseq) && (polyBseq = (polyB = polyrevcomp(polyB)).sequence.toLowerCase(), 
                -1 === doubleAseq.indexOf(polyBseq)) ? !1 : !0;
            }
            let polyAseq = polyA.sequence.toLowerCase();
            return doubleAseq = polyB.sequence.toLowerCase(), (polyAseq === doubleAseq || (doubleAseq = (polyB = polyrevcomp(polyB)).sequence.toLowerCase(), 
            polyAseq === doubleAseq)) && polyA.ext5 === polyB.ext5 && polyA.ext3 === polyB.ext3 && polyA.mod_ext5 === polyB.mod_ext5 && polyA.mod_ext3 === polyB.mod_ext3;
        },
        dsDNA: dsDNA,
        gccontent: gccontent,
        isPalindromic: isPalindromic,
        maxrepeat: maxrepeat,
        oligo: oligo,
        plasmid: plasmid,
        polynucleotide: polynucleotide,
        polyrevcomp: polyrevcomp,
        resolveToPoly: function(seqOrJSON) {
            try {
                return JSON.parse(seqOrJSON);
            } catch (err) {}
            if (_regexDNA.test(seqOrJSON)) return new Polynucleotide(seqOrJSON, "", "", !0, !1, !1, "hydroxyl", "hydroxyl");
            throw Error("Cannot resolve " + seqOrJSON);
        },
        resolveToSeq: resolveToSeq,
        revcomp: revcomp,
        translate: translate
    }), dnaFeatures = new Set([ "promoter", "operator", "enhancer", "silencer", "recombination_site", "insulator", "terminator" ]), rnaFeatures = new Set([ "rbs", "kozak", "riboswitch", "intron", "exon", "utr", "polyA_signal" ]), cdsFeatures = new Set([ "cds" ]);
    let featureDbGlobal = [], Annotator = (fetch("https://raw.githubusercontent.com/UCB-BioE-Anderson-Lab/cloning-tutorials/main/sequences/Default_Features.txt").then(response => response.text()).then(text => {
        text = text.split("\n").filter(line => 0 < line.trim().length);
        featureDbGlobal = text.map(line => {
            var [ line, Sequence, Type, Color, , , ,  ] = line.split(/\s+/);
            return {
                Name: line,
                Sequence: Sequence,
                Type: Type,
                Color: Color
            };
        });
    }).catch(err => {
        console.error("❌ Failed to load default features:", err);
    }), Object.freeze({
        __proto__: null,
        annotateSequence: function(sequence, featureDb = null) {
            sequence = cleanup(sequence);
            let detectedFeatures = [], db = featureDb || featureDbGlobal;
            if (db) return [ sequence, revcomp(sequence) ].forEach((seq, strandIndex) => {
                db.forEach(feature => {
                    var pattern = cleanup(feature.Sequence || "");
                    if (!(pattern.length < 10)) {
                        let pos = seq.indexOf(pattern);
                        for (;-1 !== pos; ) detectedFeatures.push({
                            start: pos,
                            end: pos + pattern.length,
                            strand: 0 === strandIndex ? 1 : -1,
                            label: feature.Name,
                            type: feature.Type,
                            color: feature.Color
                        }), pos = seq.indexOf(pattern, pos + 1);
                    }
                });
            }), detectedFeatures.sort((a, b) => a.start - b.start);
            throw new Error("No feature database loaded yet.");
        },
        get featureDbGlobal() {
            return featureDbGlobal;
        },
        findNonExpressedCDS: function(allFeatures, expressedProteins) {
            let expressedLabels = new Set(expressedProteins.map(p => p.label)), nonExpressed = [];
            return allFeatures.forEach(feature => {
                "cds" !== feature.type.toLowerCase() || expressedLabels.has(feature.label) || nonExpressed.push({
                    label: feature.label
                });
            }), nonExpressed;
        },
        inferExpressedProteins: function(tus) {
            let proteins = [];
            return tus.forEach((tu, index) => {
                tu.features.forEach(feature => {
                    "cds" === feature.type.toLowerCase() && proteins.push({
                        tuIndex: index + 1,
                        label: feature.label
                    });
                });
            }), proteins;
        },
        inferTranscriptionalUnits: function(features) {
            let tus = [];
            var features = features.slice().sort((a, b) => a.start - b.start), openTUs = [], allowedTypes = new Set([ ...dnaFeatures, ...rnaFeatures, ...cdsFeatures ]);
            for (let feature of features) {
                let type = feature.type.toLowerCase();
                allowedTypes.has(type) && ("promoter" === type && openTUs.push({
                    promoter: feature,
                    start: feature.end,
                    features: [],
                    terminator: null,
                    end: null
                }), openTUs.forEach(tu => {
                    feature.start >= tu.start && !dnaFeatures.has(type) && tu.features.push(feature);
                }), "terminator" === type) && (openTUs.forEach(tu => {
                    tu.terminator = feature, tu.end = feature.start, tus.push(tu);
                }), openTUs.length = 0);
            }
            return tus;
        }
    })), codonUsageData = {
        F: [ "TTT", "TTC" ],
        S: [ "TCT", "TCC", "TCA", "TCG", "AGT", "AGC" ],
        Y: [ "TAT", "TAC" ],
        C: [ "TGT", "TGC" ],
        L: [ "TTA", "TTG", "CTT", "CTC", "CTA", "CTG" ],
        P: [ "CCT", "CCC", "CCA", "CCG" ],
        H: [ "CAT", "CAC" ],
        R: [ "CGT", "CGC", "CGA", "CGG", "AGA", "AGG" ],
        Q: [ "CAA", "CAG" ],
        I: [ "ATT", "ATC" ],
        T: [ "ACT", "ACC", "ACA", "ACG" ],
        N: [ "AAT", "AAC" ],
        K: [ "AAA", "AAG" ],
        M: [ "ATG" ],
        W: [ "TGG" ],
        A: [ "GCT", "GCC", "GCA", "GCG" ],
        V: [ "GTT", "GTC", "GTA", "GTG" ],
        D: [ "GAT", "GAC" ],
        E: [ "GAA", "GAG" ],
        G: [ "GGT", "GGC", "GGA", "GGG" ]
    }, geneRestrictionEnzymes = {
        BsaI: {
            recognitionSequence: "GGTCTC",
            recognitionRC: "GAGACC"
        },
        BsmBI: {
            recognitionSequence: "CGTCTC",
            recognitionRC: "GAGACG"
        }
    };
    var Gene = Object.freeze({
        __proto__: null,
        oneAAoneCodon: function(peptide) {
            if (/^[A-Z\*]+$/.test(peptide)) return peptide.split("").map(aa => "*" === aa ? "TAA" : codonUsageData[aa][0]).join("");
            throw new Error("Input must be amino acid letters and asterisks.");
        },
        removeSites: function(orf) {
            if ("string" != typeof orf) throw new Error("Invalid input: ORF must be a string.");
            if ((orf = cleanup(orf)).length % 3 != 0) throw new Error("Invalid input sequence. Must be a multiple of 3.");
            if (orf = orf.toUpperCase(), !/^[ATGC]*$/.test(orf)) throw new Error("Invalid input sequence. Must be composed of only DNA characters.");
            let stopCodon = orf.slice(-3);
            [ "TAA", "TGA", "TAG" ].includes(stopCodon) ? orf = orf.slice(0, -3) : stopCodon = "TAA";
            var enzymeName, codonArray = orf.match(/.{1,3}/g), proteinSequence = translate(orf), forbiddenSequences = [];
            for (enzymeName in geneRestrictionEnzymes) {
                var {
                    recognitionSequence,
                    recognitionRC
                } = geneRestrictionEnzymes[enzymeName];
                forbiddenSequences.push(recognitionSequence), recognitionSequence !== recognitionRC && forbiddenSequences.push(recognitionRC);
            }
            outer: for (;;) {
                let changeMade = !1;
                for (var site of forbiddenSequences) {
                    let searchStart = 0;
                    for (;;) {
                        var siteIndex = orf.indexOf(site, searchStart);
                        if (-1 === siteIndex) break;
                        var overlapping = [];
                        for (let i = 0; i < Math.floor(site.length / 3); i++) overlapping.push(i + Math.floor(siteIndex / 3));
                        var idx = overlapping[Math.floor(Math.random() * overlapping.length)], aa = proteinSequence[idx], options = codonUsageData[aa];
                        let newCodon = options[Math.floor(Math.random() * options.length)];
                        for (;newCodon === codonArray[idx]; ) newCodon = options[Math.floor(Math.random() * options.length)];
                        codonArray[idx] = newCodon, orf = codonArray.join(""), searchStart = siteIndex + 1, 
                        changeMade = !0;
                        continue outer;
                    }
                }
                if (!changeMade) break;
            }
            return codonArray.join("") + stopCodon;
        }
    });
    function scoreanneal(inseq) {
        inseq = resolveToSeq(inseq);
        let score = 0;
        "G" != inseq[0] && "C" != inseq[0] || score++, "G" != inseq[inseq.length - 1] && "C" != inseq[inseq.length - 1] || score++;
        var gcContent = gccontent(inseq), gcContent = (.5 <= gcContent && gcContent <= .65 && score++, 
        basebalance(inseq)), gcContent = (.75 < gcContent && score++, maxrepeat(inseq)), gcContent = (gcContent <= 3 && score++, 
        Math.abs(inseq.length - 20));
        return score -= gcContent / 2, Math.max(0, score / 5);
    }
    function findanneal(inseq, lock5, lock3) {
        inseq = resolveToSeq(inseq);
        let bestAnneal = "N/A", bestScore = -1;
        if (lock5 && !lock3) {
            for (let endIndex = 18; endIndex <= 25; endIndex++) {
                var anneal = inseq.substring(0, endIndex), score = scoreanneal(anneal);
                score > bestScore && (bestAnneal = anneal, bestScore = score);
            }
            return bestAnneal;
        }
        if (!lock5 && lock3) {
            var endIndex = inseq.length;
            for (let startIndex = endIndex - 25; startIndex < endIndex - 18; startIndex++) {
                let anneal = inseq.substring(startIndex, endIndex), score = scoreanneal(anneal);
                score > bestScore && (bestAnneal = anneal, bestScore = score);
            }
            return bestAnneal;
        }
        if (lock5 || lock3) throw new Error("Cannot lock both ends of the template");
        {
            let annealStart = 0;
            for (var annealEnd = inseq.length; annealStart < annealEnd - 18; annealStart++) for (let i = annealStart + 18; i < annealEnd; i++) {
                let anneal = inseq.substring(annealStart, i), score = scoreanneal(anneal);
                score > bestScore && (bestAnneal = anneal, bestScore = score);
            }
            return bestAnneal;
        }
    }
    let stickyEnds = {
        UC: [ "TACT", "AAGC" ],
        TP: [ "GCTT", "AGTA" ],
        SP: [ "AATG", "ACCT" ],
        U: [ "TACT", "CATT" ],
        C: [ "AGGT", "AAGC" ],
        T: [ "GCTT", "AGCG" ],
        P: [ "GGAG", "AGTA" ]
    };
    var enzName, Oligos = Object.freeze({
        __proto__: null,
        bglbrick: function(sequence, frgs) {
            if (frgs = frgs[0].toUpperCase(), sequence = resolveToSeq(sequence), 
            "F" === frgs) return "ccataAGATCT" + findanneal(sequence, !0, !1);
            if ("R" === frgs) return "catcaCTCGAGttaGGATCC" + revcomp(findanneal(sequence, !1, !0));
            if ("S" === frgs) return "GAATTCatgAGATCT" + sequence + "GGATCCtaaCTCGAG";
            if ("G" === frgs) return "ccataGAATTCatgAGATCT" + sequence + "GGATCCtaaCTCGAGtaacg";
            throw new Error("Invalid value for 'frgs'. Please enter either 'F' or 'R' or 'Gblock' or 'Synthon'.");
        },
        biobrick: function(sequence, isCDS, frgs) {
            if (frgs = frgs[0].toUpperCase(), sequence = resolveToSeq(sequence), 
            "F" === frgs) return isCDS ? "gacttGAATTCgcggccgctTCTAG" + findanneal(sequence, !0, !1) : "gacttGAATTCgcggccgctTCTAGAg" + findanneal(sequence, !0, !1);
            if ("R" === frgs) return "catcaACTAGTa" + revcomp(findanneal(sequence, !1, !0));
            if ("G" === frgs) return "ccataGAATTCgcggccgctTCTAG" + sequence + "tACTAGTagcggccgCTGCAGcatcg";
            if ("S" === frgs) return isCDS ? "GAATTCgcggccgctTCTAG" + sequence + "tACTAGTagcggccgCTGCAG" : "GAATTCgcggccgctTCTAGAg" + sequence + "tACTAGTagcggccgCTGCAG";
            throw new Error("Invalid value for 'frgs'. Please enter either 'F' or 'R' or 'Gblock' or 'Synthon'.");
        },
        findanneal: findanneal,
        genejoin: function(fivePrimeSeq, threePrimeSeq, ForR) {
            fivePrimeSeq = resolveToSeq(fivePrimeSeq), threePrimeSeq = resolveToSeq(threePrimeSeq);
            var fivePrimeSeq = findanneal(fivePrimeSeq, !1, !0), threePrimeSeq = findanneal(threePrimeSeq, !0, !1), rORf = ForR[0].toUpperCase(), fivePrimeSeq = fivePrimeSeq + threePrimeSeq;
            if ("F" === rORf) return fivePrimeSeq;
            if ("R" === rORf) return revcomp(fivePrimeSeq);
            throw new Error("Invalid value for 'ForR'. Please enter either 'Forward' or 'Reverse'.  You put in: " + ForR);
        },
        lca: function(synthon) {
            var seqLen = (synthon = resolveToSeq(synthon)).length;
            let oligos = [];
            var mod = (seqLen - 25) % 50;
            let n = (seqLen - mod) / 50, chunkSize = (25 < mod ? n++ : mod < -25 && n--, 
            Math.floor(seqLen / n));
            function generateOligos(s) {
                for (let i = 0; i < n; i++) {
                    var oligo = s.substring(i * chunkSize, i * chunkSize + chunkSize);
                    oligos.push(oligo);
                }
            }
            return mod = revcomp(synthon), generateOligos(synthon), generateOligos(mod), 
            oligos;
        },
        moclo: function(sequence, partType, frgs) {
            if (frgs = frgs[0].toUpperCase(), sequence = resolveToSeq(sequence), 
            "F" === frgs) return "ccataGGTCTCa" + stickyEnds[partType][0] + findanneal(sequence, !0, !1);
            if ("R" === frgs) {
                let sticky = stickyEnds[partType][1];
                return "catcaGGTCTCt" + sticky + revcomp(findanneal(sequence, !1, !0));
            }
            if ("S" === frgs) return "GGTCTCt" + stickyEnds[partType][0] + sequence + revcomp(stickyEnds[partType][1]) + "aGAGACC";
            if ("G" !== frgs) throw new Error("Invalid value for 'frgs'. Please enter either 'F' or 'R' or 'Gblock' or 'Synthon'.");
            {
                let sticky5 = stickyEnds[partType][0], sticky3 = stickyEnds[partType][1];
                return "ccataGGTCTCt" + sticky5 + sequence + revcomp(sticky3) + "aGAGACCtaacg";
            }
        },
        pca: function(synthon) {
            synthon = resolveToSeq(synthon);
            let chunks = Math.round(synthon.length / 25);
            chunks % 2 != 0 && chunks++;
            var chunksize = Math.round(synthon.length / chunks), annealingIndices = [];
            for (let i = chunksize; i < synthon.length - chunksize; i += chunksize) {
                var anneal = findanneal(synthon.substr(i - 12, 24), !1, !1), startIndex = synthon.indexOf(anneal), anneal = startIndex + anneal.length;
                annealingIndices.push([ startIndex, anneal ]);
            }
            var lastoligo, oligos = [];
            for (let i = 0; i < annealingIndices.length; i++) 0 == i ? oligos.push(synthon.substring(0, annealingIndices[1][1])) : i == annealingIndices.length - 1 ? (lastoligo = synthon.substring(annealingIndices[i][0]), 
            oligos.push(revcomp(lastoligo))) : i % 2 == 0 ? oligos.push(synthon.substring(annealingIndices[i][0], annealingIndices[i + 1][1])) : (lastoligo = synthon.substring(annealingIndices[i][0], annealingIndices[i + 1][1]), 
            oligos.push(revcomp(lastoligo)));
            return oligos;
        },
        rbslib: function(orf, utr, frg) {
            if (orf = resolveToSeq(orf), utr = resolveToSeq(utr), orf.length % 3 != 0) throw new Error("Length of orf must be a multiple of 3");
            var rbs;
            if ([ "TAA", "TGA", "TAG" ].includes(orf.substring(orf.length - 3)) || (orf += "TAA"), 
            [ "ATG", "GTG", "CTG", "TTG" ].includes(orf.substring(0, 3))) return orf.startsWith("ATG") || (orf = "A" + orf.substring(1)), 
            "R" === (frg = frg[0].toUpperCase()) ? "catcaGGTCTCtAAGC" + revcomp(findanneal(orf, !1, !0)) : (rbs = "NVWGGRD" + (rbs = utr.substring(utr.length - 7)), 
            rbs = utr.substring(utr.length - 17, utr.length - 14) + rbs, "F" === frg ? "ccataGGTCTCaTACT" + rbs.toLowerCase() + findanneal(orf, !0, !1) : "G" === frg ? "ccataGGTCTCtTACT" + rbs.toLowerCase() + orf + "GCTTaGAGACCtgatg" : "S" === frg ? "GGTCTCtTACT" + rbs.toLowerCase() + orf + "GCTTaGAGACC" : void 0);
            throw new Error("Start of CDS not a start codon");
        },
        scoreanneal: scoreanneal
    });
    function displaySeq(seq) {
        return seq && (seq.length <= 50 ? seq : seq.slice(0, 20) + "[...]" + seq.slice(-20));
    }
    function PCR(forwardOligo, reverseOligo, template) {
        if (forwardOligo.isDoubleStranded) throw new Error("Forward oligo must be single-stranded");
        if (reverseOligo.isDoubleStranded) throw new Error("Reverse oligo must be single-stranded");
        forwardOligo = forwardOligo.sequence, reverseOligo = reverseOligo.sequence;
        let templateSeq = template.sequence, foranneal = forwardOligo.slice(-18);
        if (-1 === (template = templateSeq.indexOf(foranneal))) {
            var rcTemplate = revcomp(templateSeq);
            if (-1 === (template = rcTemplate.indexOf(foranneal))) throw new Error("Forward oligo does not exactly anneal to the template.\nForward oligo (3' 18bp): " + displaySeq(foranneal) + "\nTemplate: " + displaySeq(templateSeq));
            templateSeq = rcTemplate;
        }
        var rcTemplate = templateSeq.slice(template) + templateSeq.slice(0, template), template = revcomp(reverseOligo), reverseOligo = template.slice(0, 18), reverseMatchIndex = rcTemplate.indexOf(reverseOligo);
        if (-1 === reverseMatchIndex) throw new Error("Reverse oligo does not exactly anneal to the template.\nReverse oligo (3' 18bp): " + displaySeq(reverseOligo) + "\nRotated template: " + displaySeq(rcTemplate));
        reverseOligo = forwardOligo + rcTemplate.slice(18, reverseMatchIndex) + template;
        return console.log("PCR returning product"), dsDNA(reverseOligo);
    }
    let simRestrictionEnzymes = {
        AarI: {
            recognitionSequence: "CACCTGC",
            cut5: 4,
            cut3: 8
        },
        BbsI: {
            recognitionSequence: "GAAGAC",
            cut5: 2,
            cut3: 6
        },
        BsaI: {
            recognitionSequence: "GGTCTC",
            cut5: 1,
            cut3: 5
        },
        BsmBI: {
            recognitionSequence: "CGTCTC",
            cut5: 1,
            cut3: 5
        },
        SapI: {
            recognitionSequence: "GCTCTTC",
            cut5: 1,
            cut3: 4
        },
        BseRI: {
            recognitionSequence: "GAGGAG",
            cut5: 10,
            cut3: 8
        },
        BamHI: {
            recognitionSequence: "GGATCC",
            cut5: -5,
            cut3: -1
        },
        BglII: {
            recognitionSequence: "AGATCT",
            cut5: -5,
            cut3: -1
        },
        EcoRI: {
            recognitionSequence: "GAATTC",
            cut5: -5,
            cut3: -1
        },
        XhoI: {
            recognitionSequence: "CTCGAG",
            cut5: -5,
            cut3: -1
        },
        SpeI: {
            recognitionSequence: "ACTAGT",
            cut5: -5,
            cut3: -1
        },
        XbaI: {
            recognitionSequence: "TCTAGA",
            cut5: -5,
            cut3: -1
        },
        PstI: {
            recognitionSequence: "CTGCAG",
            cut5: -1,
            cut3: -5
        },
        NcoI: {
            recognitionSequence: "CCATGG",
            cut5: -5,
            cut3: -1
        }
    };
    for (enzName in simRestrictionEnzymes) {
        var enzyme = simRestrictionEnzymes[enzName];
        enzyme.recognitionRC = revcomp(enzyme.recognitionSequence), enzyme.isFivePrime = enzyme.cut5 < enzyme.cut3;
    }
    function ligate(dnaPolys) {
        if (console.log(dnaPolys), 1 === dnaPolys.length) {
            var circularized = ligateEnds(dnaPolys[0]);
            if (circularized) return circularized;
            throw new Error("Single fragment does not circularize");
        }
        var fiveToPoly = {};
        for (let poly of dnaPolys) {
            fiveToPoly[poly.ext5] = poly;
            var rcPoly = new Polynucleotide(poly.sequence, poly.ext3, poly.ext5, poly.isDoubleStranded, poly.isRNA, poly.isCircular, poly.mod_ext3, poly.mod_ext5);
            fiveToPoly[rcPoly.ext5] = rcPoly;
        }
        let lefty = null;
        for (let poly of dnaPolys) {
            var righty = fiveToPoly[poly.ext3];
            if (righty && join(poly, righty)) {
                lefty = poly;
                break;
            }
        }
        if (!lefty) throw new Error("No valid ligation junctions found");
        for (;;) {
            let circularized = ligateEnds(lefty);
            if (circularized) {
                lefty = circularized;
                break;
            }
            let righty = fiveToPoly[lefty.ext3];
            if (!righty) break;
            var product = join(lefty, righty);
            if (!product) break;
            lefty = product, delete fiveToPoly[righty.ext5];
        }
        for (let poly of dnaPolys) if (!lefty.sequence.includes(poly.sequence)) throw new Error("Not all input fragments incorporated into ligation product");
        return lefty;
    }
    function join(lefty, righty) {
        var validMods;
        return ("phos5" === lefty.mod_ext3 || "phos5" === righty.mod_ext5) && (validMods = [ "phos5", "hydroxyl" ]).includes(lefty.mod_ext3) && validMods.includes(righty.mod_ext5) ? (validMods = lefty.sequence + lefty.ext3.replace("-", "") + righty.sequence, 
        new Polynucleotide(validMods, lefty.ext5, righty.ext3, !0, !1, !1, lefty.mod_ext5, righty.mod_ext3)) : null;
    }
    function ligateEnds(poly) {
        var validMods;
        return "phos5" !== poly.mod_ext3 && "phos5" !== poly.mod_ext5 || !(validMods = [ "phos5", "hydroxyl" ]).includes(poly.mod_ext5) || !validMods.includes(poly.mod_ext3) || poly.ext5.toUpperCase().replace("-", "") !== poly.ext3.toUpperCase().replace("-", "") ? null : (validMods = poly.ext5.replace("-", ""), 
        new Polynucleotide(validMods + poly.sequence, "", "", !0, !1, !0, "circular", "circular"));
    }
    function goldengate(polynucleotides, enzyme) {
        if (!simRestrictionEnzymes.hasOwnProperty(enzyme)) throw new Error(`Enzyme ${enzyme} not found for Golden Gate assembly`);
        if (!Array.isArray(polynucleotides)) throw new Error("Input to goldengate must be an array of Polynucleotide objects");
        polynucleotides.forEach((poly, idx) => {
            if ("Polynucleotide" !== poly.constructor.name) throw new Error(`Input at index ${idx} is not a Polynucleotide`);
            if (!poly.isDoubleStranded) throw new Error(`Polynucleotide at index ${idx} is not double-stranded`);
        });
        enzyme = simRestrictionEnzymes[enzyme];
        let restrictionSequence = enzyme.recognitionSequence, revRestrictionSequence = enzyme.recognitionRC, cut5 = enzyme.cut5, cut3 = enzyme.cut3, digestionFragments = [], finalSeq = (polynucleotides.forEach((poly, idx) => {
            var sequence = poly.sequence, enzymeSites = sequence.split(restrictionSequence).length - 1, revEnzymeSites = sequence.split(revRestrictionSequence).length - 1, enzymeSite = sequence.indexOf(restrictionSequence), revEnzymeSite = sequence.indexOf(revRestrictionSequence);
            if (0 == enzymeSites) throw new Error(`Error: Enzyme site ${restrictionSequence} not found in sequence at index ${idx}: ` + displaySeq(sequence));
            if (0 == revEnzymeSites) throw new Error(`Error: Reverse Enzyme site ${revRestrictionSequence} not found in sequence at index ${idx}: ` + displaySeq(sequence));
            if (1 < enzymeSites) throw new Error(`Error: More than one forward enzyme site ${restrictionSequence} found in sequence at index ${idx}: ` + displaySeq(sequence));
            if (1 < revEnzymeSites) throw new Error(`Error: More than one reverse enzyme site ${revRestrictionSequence} found in sequence at index ${idx}: ` + displaySeq(sequence));
            if (revEnzymeSite < enzymeSite) throw new Error(`Error: Reverse enzyme site found before forward enzyme site in sequence at index ${idx}: ` + displaySeq(sequence));
            enzymeSites = sequence.substring(enzymeSite + restrictionSequence.length + cut3, revEnzymeSite - cut3), 
            revEnzymeSites = sequence.substring(enzymeSite + restrictionSequence.length + cut5, enzymeSite + restrictionSequence.length + cut3), 
            idx = sequence.substring(revEnzymeSite - cut3, revEnzymeSite - cut5);
            digestionFragments.push({
                fragment: enzymeSites,
                stickyEnd5: revEnzymeSites,
                stickyEnd3: idx,
                ext5: poly.ext5,
                ext3: poly.ext3,
                mod_ext5: poly.mod_ext5,
                mod_ext3: poly.mod_ext3
            });
        }), (digestionFragments => {
            if (digestionFragments.sort((a, b) => a.stickyEnd5 === b.stickyEnd3 ? 0 : a.stickyEnd5 < b.stickyEnd3 ? -1 : 1), 
            digestionFragments.forEach(fragment => {
                if (isPalindromic(fragment.stickyEnd5) || isPalindromic(fragment.stickyEnd3)) throw new Error("Palindromic sticky ends found in fragment " + fragment.fragment);
            }), 1 < digestionFragments.length) {
                let stickyEndCounts = {};
                for (var stickyEnd in digestionFragments.forEach(fragment => {
                    stickyEndCounts.hasOwnProperty(fragment.stickyEnd5) || (stickyEndCounts[fragment.stickyEnd5] = {
                        count5: 0,
                        count3: 0
                    }), stickyEndCounts.hasOwnProperty(fragment.stickyEnd3) || (stickyEndCounts[fragment.stickyEnd3] = {
                        count5: 0,
                        count3: 0
                    }), stickyEndCounts[fragment.stickyEnd5].count5++, stickyEndCounts[fragment.stickyEnd3].count3++;
                }), stickyEndCounts) if (1 < stickyEndCounts[stickyEnd].count5 || 1 < stickyEndCounts[stickyEnd].count3) throw new Error("Some fragments have the same sticky ends, which can lead to incorrect assemblies");
            }
            for (var i = 0; i < digestionFragments.length - 1; i++) if (digestionFragments[i].stickyEnd3 !== digestionFragments[i + 1].stickyEnd5) throw new Error(`Error: Sticky ends do not match between fragments 
        ${digestionFragments[i].fragment} and ` + digestionFragments[i + 1].fragment);
            if (digestionFragments[0].stickyEnd5 !== digestionFragments[digestionFragments.length - 1].stickyEnd3) throw new Error(`Error: Sticky ends do not match between first and last fragments 
      ${digestionFragments[0].fragment} and ` + digestionFragments[digestionFragments.length - 1].fragment);
        })(digestionFragments), "");
        for (let i = 0; i < digestionFragments.length; i++) finalSeq = (finalSeq += digestionFragments[i].stickyEnd5) + digestionFragments[i].fragment;
        var enzyme = digestionFragments[0].ext5, polynucleotides = digestionFragments[digestionFragments.length - 1].ext3, mod_ext5 = digestionFragments[0].mod_ext5, mod_ext3 = digestionFragments[digestionFragments.length - 1].mod_ext3, isCircular = 1 < digestionFragments.length && digestionFragments[0].stickyEnd5 === digestionFragments[digestionFragments.length - 1].stickyEnd3;
        return polynucleotide(finalSeq, enzyme, polynucleotides, !0, !1, isCircular, mod_ext5, mod_ext3);
    }
    function gibson(polynucleotides, check_circular = !0) {
        if (0 === (polynucleotides = Array.isArray(polynucleotides) ? polynucleotides : [ polynucleotides ]).length) throw new Error("Expected non-empty array of Polynucleotide objects");
        for (var poly of polynucleotides) {
            if ("Polynucleotide" !== poly.constructor.name) throw new Error("All inputs must be Polynucleotide objects");
            if (!poly.isDoubleStranded) throw new Error("All Polynucleotides must be double-stranded");
            if (poly.isCircular) throw new Error("All Polynucleotides must be linear for Gibson assembly");
        }
        for (var assemblyFragments = [ ...polynucleotides ]; 1 < assemblyFragments.length; ) {
            var currSeq = assemblyFragments.shift().sequence, currLen = currSeq.length, homologyRegion = currSeq.slice(currLen - 20);
            let matchedFrag = null, matchedHomologousRegionEndIndex = 0;
            for (let i = 0; i < assemblyFragments.length; i++) {
                var tempFrag = assemblyFragments[i], tempSeq = tempFrag.sequence;
                if (tempSeq.includes(homologyRegion)) {
                    matchedFrag = tempFrag, matchedHomologousRegionEndIndex = tempSeq.indexOf(homologyRegion) + 20, 
                    assemblyFragments.splice(i, 1);
                    break;
                }
                if (revcomp(tempSeq).includes(homologyRegion)) {
                    tempFrag = revcomp(tempSeq);
                    matchedFrag = new Polynucleotide(tempFrag, null, null, !0, !1, !1), 
                    matchedHomologousRegionEndIndex = tempFrag.indexOf(homologyRegion) + 20, 
                    assemblyFragments.splice(i, 1);
                    break;
                }
            }
            if (!matchedFrag) throw new Error("The provided assembly fragments cannot be joined together because there are not enough homologous regions between them");
            if (!/^[ATCG]+$/i.test(homologyRegion)) throw new Error("The provided assembly contains degenerate base pairs, assembly failed.");
            currLen = currSeq.length - matchedHomologousRegionEndIndex;
            if (currSeq.slice(currLen) !== matchedFrag.sequence.slice(0, matchedHomologousRegionEndIndex)) throw new Error("In a Gibson assembly step, the fragment ends do not match");
            currSeq = currSeq.slice(0, currLen), currLen = matchedFrag.sequence, 
            currSeq = new Polynucleotide(currSeq + currLen, null, null, !0, !1, !1);
            assemblyFragments.push(currSeq);
        }
        var polynucleotides = assemblyFragments[0].sequence, lastHomology = polynucleotides.slice(-20), lastHomology = polynucleotides.indexOf(lastHomology);
        if (lastHomology === polynucleotides.length - 20 || lastHomology < 0) {
            if (check_circular) throw new Error("Assembly product cannot be re-circularized");
            return dsDNA(polynucleotides);
        }
        return console.log("Gibson returning product"), plasmid(polynucleotides.slice(lastHomology, polynucleotides.length - 20));
    }
    function cutOnce(polyjson, enz) {
        let output;
        var seq = polyjson.sequence, enz = simRestrictionEnzymes[enz], recognitionSeq = enz.recognitionSequence, recognitionSeqRC = enz.recognitionRC, cut5 = enz.cut5, cut3 = enz.cut3, index = seq.indexOf(recognitionSeq), recognitionSeqRC = seq.indexOf(recognitionSeqRC);
        if (-1 === index && -1 === recognitionSeqRC) return null;
        enz = enz.isFivePrime;
        let ssRegionStart, ssRegionEnd, stickyEnd = (ssRegionEnd = -1 !== index ? enz ? (ssRegionStart = index + recognitionSeq.length + cut5, 
        index + recognitionSeq.length + cut3) : (ssRegionStart = index + recognitionSeq.length + cut3, 
        index + recognitionSeq.length + cut5) : enz ? (ssRegionStart = recognitionSeqRC - cut3, 
        recognitionSeqRC - cut5) : (ssRegionStart = recognitionSeqRC - cut5, recognitionSeqRC - cut3), 
        "");
        return enz || (stickyEnd += "-"), stickyEnd += seq.substring(ssRegionStart, ssRegionEnd), 
        output = polyjson.isCircular ? (index = seq.substring(ssRegionEnd) + seq.substring(0, ssRegionStart), 
        [ new Polynucleotide(index, stickyEnd, stickyEnd, polyjson.isDoubleStranded, polyjson.isRNA, !1, "phos5", "phos5") ]) : [ new Polynucleotide(seq.substring(0, ssRegionStart), polyjson.ext5, stickyEnd, polyjson.isDoubleStranded, polyjson.isRNA, !1, polyjson.mod_ext5, "phos5"), new Polynucleotide(seq.substring(ssRegionEnd), stickyEnd, polyjson.ext3, polyjson.isDoubleStranded, polyjson.isRNA, !1, "phos5", polyjson.mod_ext3) ];
    }
    function digest(seq, enzymes, fragselect) {
        if ("object" != typeof seq || "string" != typeof seq.sequence) throw new Error("Input to digest must be a Polynucleotide object");
        var enzList = enzymes;
        for (let i = 0; i < enzList.length; i++) if (!simRestrictionEnzymes[enzList[i]]) throw new Error(`Enzyme "${enzList[i]}" not found.`);
        let fragsOut = [ seq ];
        outer: for (;;) {
            var worklist = [ ...fragsOut ];
            fragsOut = [];
            for (let i = 0; i < worklist.length; i++) {
                var enz, poly = worklist[i];
                let foundCut = !1;
                for (enz of enzList) {
                    var frags = cutOnce(poly, enz);
                    if (frags) {
                        fragsOut = [ ...fragsOut, ...frags ], foundCut = !0;
                        continue outer;
                    }
                }
                foundCut || fragsOut.push(poly);
            }
            break;
        }
        if ("number" == typeof fragselect && 0 <= fragselect && fragselect < fragsOut.length) {
            if (seq.isCircular) {
                let targetIndex = fragselect;
                fragsOut.sort((a, b) => seq.sequence.indexOf(a.sequence) - seq.sequence.indexOf(b.sequence)), 
                0 !== seq.sequence.indexOf(fragsOut[0].sequence) && (enzymes = fragsOut.shift(), 
                fragsOut.push(enzymes), targetIndex = 0 === fragselect ? fragsOut.length - 1 : fragselect - 1);
                enzymes = fragsOut[targetIndex];
                return enzymes;
            }
            {
                let newSeq = fragsOut[fragselect];
                return newSeq;
            }
        }
        throw new Error("Invalid fragselect provided for sequence: " + displaySeq(seq.sequence));
    }
    var Sim = Object.freeze({
        __proto__: null,
        PCR: PCR,
        cutOnce: cutOnce,
        digest: digest,
        gibson: gibson,
        goldengate: goldengate,
        ligate: ligate,
        parseCF: function(...blobs) {
            var blob, normalizeOperation = {
                pcr: "PCR",
                digest: "Digest",
                ligate: "Ligate",
                gibson: "Gibson",
                goldengate: "GoldenGate",
                transform: "Transform"
            }, sequenceDataRegex = /^[ACGTRYSWKMBDHVNUacgtryswkmbdhvnu*]+$/, knownTypes = [ "oligo", "plasmid", "dsdna" ];
            let singleblob = "";
            for (blob of blobs) singleblob += (data => {
                if (Array.isArray(data)) {
                    if (data.every(item => Array.isArray(item))) return data.map(row => row.map(cell => cell.toString()).join("\t")).join("\n");
                    if (data.every(item => "string" == typeof item || "number" == typeof item)) return data.map(cell => cell.toString()).join("\t");
                    throw new Error("Unsupported input type for preprocessData function");
                }
                return data.toString();
            })(blob) + "\n";
            var preprocessedData = singleblob.trim().split("\n").map(line => line.replace(/#.*$/g, "").replace(/\/\/.*$/g, "").replace(/\/\*.*?\*\//g, "").trim().split(/\s+/).filter(token => ![ "on", "with", "" ].includes(token.toLowerCase()))), steps = [], sequences = {};
            for (let i = 0; i < preprocessedData.length; i++) {
                var tokens = preprocessedData[i];
                if (0 !== tokens.length) try {
                    var keyword = tokens[0].toLowerCase(), normalizedOp = normalizeOperation[keyword];
                    if (normalizedOp) {
                        var step = {
                            operation: normalizedOp
                        };
                        switch (normalizedOp) {
                          case "PCR":
                            if (tokens.length < 5) throw new Error("PCR step requires 5 fields: PCR ForwardPrimer ReversePrimer Template Output");
                            step.output = tokens[4], step.forward_oligo = tokens[1], 
                            step.reverse_oligo = tokens[2], step.template = tokens[3];
                            break;

                          case "Gibson":
                            if (tokens.length < 3) throw new Error("Gibson step requires at least 3 fields: Gibson Fragment1 [Fragment2 ...] Output");
                            step.output = tokens[tokens.length - 1], step.dnas = tokens.slice(1, tokens.length - 1);
                            break;

                          case "GoldenGate":
                            if (tokens.length < 4) throw new Error("GoldenGate step requires at least 4 fields: GoldenGate Fragment1 [Fragment2 ...] Enzyme Output");
                            step.output = tokens[tokens.length - 1], step.dnas = tokens.slice(1, tokens.length - 2), 
                            step.enzyme = tokens[tokens.length - 2];
                            break;

                          case "Ligate":
                            if (tokens.length < 3) throw new Error("Ligate step requires at least 3 fields: Ligate Fragment1 [Fragment2 ...] Output");
                            step.output = tokens[tokens.length - 1], step.dnas = tokens.slice(1, tokens.length - 1);
                            break;

                          case "Digest":
                            if (tokens.length < 4) throw new Error("Digest step requires at least 4 fields: Digest DNA Enzymes FragSelect Output");
                            step.dna = tokens[1], step.enzymes = tokens[2].split(","), 
                            step.fragselect = tokens[3] ? parseInt(tokens[3], 10) : 1, 
                            step.output = tokens[tokens.length - 1];
                            break;

                          case "Transform":
                            step.dna = tokens[1], step.output = tokens[tokens.length - 1];
                            var token, remaining = tokens.slice(2, tokens.length - 1), knownAntibiotics = {
                                kan: "kan",
                                kanamycin: "kan",
                                cam: "cam",
                                chloramphenicol: "cam",
                                amp: "amp",
                                ampicillin: "amp",
                                spec: "spec",
                                spectinomycin: "spec",
                                gen: "gen",
                                gentamicin: "gen"
                            };
                            for (token of remaining) {
                                var lower = token.toLowerCase();
                                !step.strain && /^[\w\-\.]+$/.test(token) ? step.strain = token : !step.antibiotics && knownAntibiotics[lower] ? step.antibiotics = knownAntibiotics[lower] : step.temperature || isNaN(parseFloat(token)) || (step.temperature = parseFloat(token));
                            }
                        }
                        steps.push(step);
                    } else {
                        let name, sequence;
                        if (sequence = (knownTypes.includes(keyword) ? (name = tokens[1], 
                        tokens.slice(2)) : (name = tokens[0], tokens.slice(1))).join(""), 
                        !sequenceDataRegex.test(sequence)) throw new Error(`Invalid sequence format: "${sequence}"`);
                        switch (keyword) {
                          case "plasmid":
                            sequences[name] = plasmid(sequence.toUpperCase());
                            break;

                          case "oligo":
                            sequences[name] = oligo(sequence.toUpperCase());
                            break;

                          case "dsdna":
                            sequences[name] = dsDNA(sequence.toUpperCase());
                            break;

                          default:
                            sequences[name] = oligo(sequence.toUpperCase());
                        }
                    }
                } catch (err) {
                    throw new Error(`Error parsing line ${i + 1}: "${preprocessedData[i].join(" ")}"
Reason: ` + err.message);
                }
            }
            return console.log("parseCF returning CF"), {
                steps: steps,
                sequences: sequences
            };
        },
        simCF: function(cfData) {
            var steps = cfData.steps;
            let sequences = cfData.sequences, products = [];
            if (!sequences || 0 === Object.keys(sequences).length) return "Error: Sequence data is missing. Please include sequence data in the input JSON.";
            function lookupSequence(key) {
                var foundProduct = products.find(product => product.name === key);
                if (foundProduct) return foundProduct.sequence;
                foundProduct = sequences[key];
                if (foundProduct) return foundProduct;
                throw new Error("Missing sequence for key: " + key);
            }
            for (let i = 0; i < steps.length; i++) {
                var step = steps[i];
                switch (step.operation) {
                  case "PCR":
                    var productPoly = PCR(lookupSequence(step.forward_oligo), lookupSequence(step.reverse_oligo), lookupSequence(step.template));
                    products.push({
                        name: step.output,
                        sequence: productPoly
                    });
                    break;

                  case "GoldenGate":
                    {
                        let productPoly = goldengate(step.dnas.map(dnaKey => lookupSequence(dnaKey)), step.enzyme);
                        products.push({
                            name: step.output,
                            sequence: productPoly
                        });
                    }
                    break;

                  case "Gibson":
                    {
                        let dnaSequences = step.dnas.map(dnaKey => lookupSequence(dnaKey)), productPoly = gibson(dnaSequences);
                        products.push({
                            name: step.output,
                            sequence: productPoly
                        });
                    }
                    break;

                  case "Digest":
                    productPoly = digest(lookupSequence(step.dna), step.enzymes, step.fragselect);
                    products.push({
                        name: step.output,
                        sequence: productPoly
                    });
                    break;

                  case "Ligate":
                    var ligatedPoly = ligate(step.dnas.map(dnaKey => lookupSequence(dnaKey)));
                    products.push({
                        name: step.output,
                        sequence: ligatedPoly
                    });
                    break;

                  case "Transform":
                    {
                        let dnaSeq = lookupSequence(step.dna);
                        products.push({
                            name: step.output,
                            sequence: dnaSeq
                        });
                    }
                }
            }
            return products.map(product => [ product.name, product.sequence ]);
        }
    });
    var Utils = Object.freeze({
        __proto__: null,
        field: function(objJSON, fieldName) {
            try {
                var value = JSON.parse(objJSON)[fieldName];
                return "object" == typeof value ? JSON.stringify(value) : value;
            } catch (error) {
                throw new Error("Invalid JSON format or field not found.");
            }
        },
        makeJSON: function(inputArray) {
            let obj = {};
            return inputArray.forEach(([ key, value ]) => {
                "string" == typeof key && key.trim() && (obj[key.trim()] = "null" === value ? null : "undefined" === value ? void 0 : value);
            }), JSON.stringify(obj);
        },
        merge: function(...args) {
            if (args.length < 2) throw new Error("At least two arguments are required");
            var delimiter = args.pop();
            if ("string" != typeof delimiter) throw new Error("The last argument must be a delimiter string");
            return args.flat().join(delimiter);
        }
    }), Gene = {
        ...Annotator,
        ...Gene,
        ...Oligos,
        ...Seq,
        ...Sim,
        ...Utils
    };
    return Gene.VERSION = "1.0.11", Gene;
});