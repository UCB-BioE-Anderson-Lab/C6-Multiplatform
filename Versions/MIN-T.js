function cleanup(sequence) {
    if (typeof sequence !== 'string') {
        try {
            sequence = sequence.toString();
        } catch (err) {
            throw new Error('Input must be a string. It\'s a ' + typeof sequence);
        }
    }
    sequence = sequence.replace(/[\s\d\r]/g, '');
    var validBiopolymer = /^[ACGTRYSWKMBDHVNUacgtryswkmbdhvnu*]+$/;
    if (!validBiopolymer.test(sequence)) {
        throw new Error('Input must only contain valid biopolymer letters (DNA: A, C, G, T, or degeneracy codes, RNA: A, C, G, U, or degeneracy codes, Protein: 20 standard amino acids and their degeneracy codes)');
    }
    sequence = sequence.toUpperCase();
    return sequence;
}
const _regexDNA = /^[ACTGactgMRWSYKVHDBNXmrwsykvhdbnx-]+$/;
function resolveToSeq(seq) {
    if (seq instanceof Polynucleotide) {
        return seq.sequence;
    }
    seq = seq.toString();
    if (_regexDNA.test(seq)) {
        return seq.toUpperCase();
    }
    throw new Error('Unrecognizable as sequence: ' + seq);
}
class Polynucleotide {
    constructor(sequence, ext5 = null, ext3 = null, isDoubleStranded, isRNA, isCircular, mod_ext5, mod_ext3) {
        this.sequence = sequence ? sequence.toUpperCase() : sequence;
        this.ext5 = ext5 ? ext5.toUpperCase() : ext5;
        this.ext3 = ext3 ? ext3.toUpperCase() : ext3;
        this.isDoubleStranded = isDoubleStranded;
        this.isRNA = isRNA;
        this.isCircular = isCircular;
        this.mod_ext3 = mod_ext3 || '';
        this.mod_ext5 = mod_ext5 || '';
    }
}
function comparePolynucleotides(polyA, polyB) {
    if (polyA.constructor.name !== 'Polynucleotide') {
        throw new Error('polyA inputs must be Polynucleotide objects');
    }
    if (polyB.constructor.name !== 'Polynucleotide') {
        throw new Error('polyB inputs must be Polynucleotide objects');
    }
    if (polyA.isCircular != polyB.isCircular) {
        return false;
    }
    if (polyA.isRNA != polyB.isRNA) {
        return false;
    }
    if (polyA.isDoubleStranded != polyB.isDoubleStranded) {
        return false;
    }
    if (polyA.isCircular) {
        const polyAseq = polyA.sequence.toLowerCase();
        let polyBseq = polyB.sequence.toLowerCase();
        const doubleAseq = polyAseq + polyAseq;
        if (doubleAseq.indexOf(polyBseq) === -1) {
            polyB = polyrevcomp(polyB);
            polyBseq = polyB.sequence.toLowerCase();
            if (doubleAseq.indexOf(polyBseq) === -1) {
                return false;
            }
        }
        return true;
    }
    const polyAseq = polyA.sequence.toLowerCase();
    let polyBseq = polyB.sequence.toLowerCase();
    if (polyAseq !== polyBseq) {
        polyB = polyrevcomp(polyB);
        polyBseq = polyB.sequence.toLowerCase();
        if (polyAseq !== polyBseq) {
            return false;
        }
    }
    if (polyA.ext5 !== polyB.ext5) {
        return false;
    }
    if (polyA.ext3 !== polyB.ext3) {
        return false;
    }
    if (polyA.mod_ext5 !== polyB.mod_ext5) {
        return false;
    }
    if (polyA.mod_ext3 !== polyB.mod_ext3) {
        return false;
    }
    return true;
}
function polyrevcomp(frag) {
    const revseq = revcomp(frag.sequence);
    const revExt = ext => {
        if (!ext)
            return '';
        if (ext.startsWith('-')) {
            return '-' + revcomp(ext.slice(1));
        } else {
            return revcomp(ext);
        }
    };
    const new5 = revExt(frag.ext3);
    const new3 = revExt(frag.ext5);
    return new Polynucleotide(revseq, new5, new3, frag.isDoubleStranded, frag.isRNA, frag.isCircular, frag.mod_ext3, frag.mod_ext5);
}
function polynucleotide(sequence, ext5, ext3, isDoubleStranded, isRNA, isCircular, mod_ext5, mod_ext3) {
    var out = new Polynucleotide(sequence, ext5, ext3, isDoubleStranded, isRNA, isCircular, mod_ext5, mod_ext3);
    return out;
}
function dsDNA(sequence) {
    return new Polynucleotide(sequence, '', '', true, false, false, 'hydroxyl', 'hydroxyl');
}
function oligo(sequence) {
    return new Polynucleotide(sequence, null, null, false, false, false, 'hydroxyl', null);
}
function plasmid(sequence) {
    return new Polynucleotide(sequence, '', '', true, false, true, null, null);
}
function resolveToPoly(seqOrJSON, type) {
    try {
        var json = JSON.parse(seqOrJSON);
        return json;
    } catch (err) {
    }
    if (!_regexDNA.test(seqOrJSON)) {
        throw Error('Cannot resolve ' + seqOrJSON);
    }
    switch (type) {
    case 'oligo':
        return oligo(seqOrJSON);
    case 'dsDNA':
        return dsDNA(seqOrJSON);
    case 'plasmid':
        return plasmid(seqOrJSON);
    case 'ssPoly':
        return new Polynucleotide(seqOrJSON, '', '', false, false, false, 'hydroxyl', 'hydroxyl');
    case 'dsPoly':
        return new Polynucleotide(seqOrJSON, '', '', true, false, false, 'hydroxyl', 'hydroxyl');
    default:
        return new Polynucleotide(seqOrJSON, '', '', true, false, false, 'hydroxyl', 'hydroxyl');
    }
}
function isPalindromic(seq) {
    const complements = {
        'A': 'T',
        'T': 'A',
        'C': 'G',
        'G': 'C'
    };
    for (const nucleotide of seq) {
        if (!complements.hasOwnProperty(nucleotide)) {
            throw new Error(`Error: Invalid character '${ nucleotide }' found in sequence '${ seq }'. Sequence must contain only A, T, C, or G.`);
        }
    }
    const reverseComplement = seq.split('').reverse().map(nucleotide => complements[nucleotide]).join('');
    return seq === reverseComplement;
}
function revcomp(inseq) {
    if (!inseq.length) {
        return 'error on ' + inseq;
    }
    var output = '';
    for (let i = inseq.length - 1; i >= 0; i--) {
        switch (inseq[i]) {
        case 'A': {
                output += 'T';
                continue;
            }
        case 'T': {
                output += 'A';
                continue;
            }
        case 'C': {
                output += 'G';
                continue;
            }
        case 'G': {
                output += 'C';
                continue;
            }
        case 'a': {
                output += 't';
                continue;
            }
        case 't': {
                output += 'a';
                continue;
            }
        case 'c': {
                output += 'g';
                continue;
            }
        case 'g': {
                output += 'c';
                continue;
            }
        case 'B': {
                output += 'V';
                continue;
            }
        case 'D': {
                output += 'H';
                continue;
            }
        case 'H': {
                output += 'D';
                continue;
            }
        case 'K': {
                output += 'M';
                continue;
            }
        case 'N': {
                output += 'N';
                continue;
            }
        case 'R': {
                output += 'Y';
                continue;
            }
        case 'S': {
                output += 'S';
                continue;
            }
        case 'M': {
                output += 'K';
                continue;
            }
        case 'V': {
                output += 'B';
                continue;
            }
        case 'W': {
                output += 'W';
                continue;
            }
        case 'Y': {
                output += 'R';
                continue;
            }
        case 'b': {
                output += 'v';
                continue;
            }
        case 'd': {
                output += 'h';
                continue;
            }
        case 'h': {
                output += 'd';
                continue;
            }
        case 'k': {
                output += 'm';
                continue;
            }
        case 'n': {
                output += 'n';
                continue;
            }
        case 'r': {
                output += 'y';
                continue;
            }
        case 's': {
                output += 's';
                continue;
            }
        case 'm': {
                output += 'k';
                continue;
            }
        case 'v': {
                output += 'b';
                continue;
            }
        case 'w': {
                output += 'w';
                continue;
            }
        case 'y': {
                output += 'r';
                continue;
            }
        default:
            throw new Error('Character \'' + inseq[i] + '\' is not a valid DNA character');
        }
    }
    return output;
}
function gccontent(inseq) {
    inseq = inseq.toUpperCase();
    let gcCount = 0;
    for (let i = 0; i < inseq.length; i++) {
        if (inseq[i] == 'G' || inseq[i] == 'C') {
            gcCount++;
        }
    }
    return gcCount / inseq.length;
}
function basebalance(inseq) {
    inseq = inseq.toUpperCase();
    let baseCounts = {
        A: 0,
        C: 0,
        G: 0,
        T: 0
    };
    for (let i = 0; i < inseq.length; i++) {
        baseCounts[inseq[i]]++;
    }
    let score = 1;
    for (const base in baseCounts) {
        if (baseCounts[base] == 0) {
            score = 0;
            break;
        }
        score *= baseCounts[base] / inseq.length;
    }
    return 4 * Math.pow(score, 1 / 4);
}
function maxrepeat(inseq) {
    inseq = inseq.toUpperCase();
    let lastBase = '';
    let streak = 0;
    let maxStreak = 0;
    for (let i = 0; i < inseq.length; i++) {
        if (inseq[i] == lastBase) {
            streak++;
            maxStreak = Math.max(maxStreak, streak);
        } else {
            lastBase = inseq[i];
            streak = 1;
        }
    }
    return maxStreak;
}
function translate(dna) {
    if (typeof dna !== 'string')
        throw new Error('Translate: ' + dna + ' is not a string.');
    dna = cleanup(dna);
    if (!/^[ACGT]+$/.test(dna))
        throw new Error('Input must only contain valid DNA letters (A, C, G, T).');
    const geneticCode = {
        'ATA': 'I',
        'ATC': 'I',
        'ATT': 'I',
        'ATG': 'M',
        'ACA': 'T',
        'ACC': 'T',
        'ACG': 'T',
        'ACT': 'T',
        'AAC': 'N',
        'AAT': 'N',
        'AAA': 'K',
        'AAG': 'K',
        'AGC': 'S',
        'AGT': 'S',
        'AGA': 'R',
        'AGG': 'R',
        'CTA': 'L',
        'CTC': 'L',
        'CTG': 'L',
        'CTT': 'L',
        'CCA': 'P',
        'CCC': 'P',
        'CCG': 'P',
        'CCT': 'P',
        'CAC': 'H',
        'CAT': 'H',
        'CAA': 'Q',
        'CAG': 'Q',
        'CGA': 'R',
        'CGC': 'R',
        'CGG': 'R',
        'CGT': 'R',
        'GTA': 'V',
        'GTC': 'V',
        'GTG': 'V',
        'GTT': 'V',
        'GCA': 'A',
        'GCC': 'A',
        'GCG': 'A',
        'GCT': 'A',
        'GAC': 'D',
        'GAT': 'D',
        'GAA': 'E',
        'GAG': 'E',
        'GGA': 'G',
        'GGC': 'G',
        'GGG': 'G',
        'GGT': 'G',
        'TCA': 'S',
        'TCC': 'S',
        'TCG': 'S',
        'TCT': 'S',
        'TTC': 'F',
        'TTT': 'F',
        'TTA': 'L',
        'TTG': 'L',
        'TAC': 'Y',
        'TAT': 'Y',
        'TAA': '*',
        'TAG': '*',
        'TGC': 'C',
        'TGT': 'C',
        'TGA': '*',
        'TGG': 'W'
    };
    let aaSequence = '';
    for (let i = 0; i < dna.length; i += 3) {
        const codon = dna.substring(i, i + 3);
        const aa = geneticCode[codon];
        if (!aa)
            throw new Error('Invalid codon: ' + codon);
        if (aa !== '*')
            aaSequence += aa;
    }
    return aaSequence;
}
var Seq = Object.freeze({
    __proto__: null,
    Polynucleotide: Polynucleotide,
    basebalance: basebalance,
    cleanup: cleanup,
    comparePolynucleotides: comparePolynucleotides,
    dsDNA: dsDNA,
    gccontent: gccontent,
    isPalindromic: isPalindromic,
    maxrepeat: maxrepeat,
    oligo: oligo,
    plasmid: plasmid,
    polynucleotide: polynucleotide,
    polyrevcomp: polyrevcomp,
    resolveToPoly: resolveToPoly,
    resolveToSeq: resolveToSeq,
    revcomp: revcomp,
    translate: translate
});
const dnaFeatures = new Set([
    'promoter',
    'operator',
    'enhancer',
    'silencer',
    'recombination_site',
    'insulator',
    'terminator'
]);
const rnaFeatures = new Set([
    'rbs',
    'kozak',
    'riboswitch',
    'intron',
    'exon',
    'utr',
    'polyA_signal'
]);
const cdsFeatures = new Set(['cds']);
function annotateSequence(sequence, featureDb = null) {
    sequence = cleanup(sequence);
    const detectedFeatures = [];
    const db = featureDb || featureDbGlobal;
    if (!db)
        throw new Error('No feature database loaded yet.');
    const seqVariants = [
        sequence,
        revcomp(sequence)
    ];
    seqVariants.forEach((seq, strandIndex) => {
        db.forEach(feature => {
            const pattern = cleanup(feature.Sequence || '');
            if (pattern.length < 10)
                return;
            let pos = seq.indexOf(pattern);
            while (pos !== -1) {
                detectedFeatures.push({
                    start: pos,
                    end: pos + pattern.length,
                    strand: strandIndex === 0 ? 1 : -1,
                    label: feature.Name,
                    type: feature.Type,
                    color: feature.Color
                });
                pos = seq.indexOf(pattern, pos + 1);
            }
        });
    });
    return detectedFeatures.sort((a, b) => a.start - b.start);
}
function inferTranscriptionalUnits(features) {
    const tus = [];
    const featureList = features.slice().sort((a, b) => a.start - b.start);
    const openTUs = [];
    const allowedTypes = new Set([
        ...dnaFeatures,
        ...rnaFeatures,
        ...cdsFeatures
    ]);
    for (const feature of featureList) {
        const type = feature.type.toLowerCase();
        if (!allowedTypes.has(type))
            continue;
        if (type === 'promoter') {
            openTUs.push({
                promoter: feature,
                start: feature.end,
                features: [],
                terminator: null,
                end: null
            });
        }
        openTUs.forEach(tu => {
            if (feature.start >= tu.start && !dnaFeatures.has(type)) {
                tu.features.push(feature);
            }
        });
        if (type === 'terminator') {
            openTUs.forEach(tu => {
                tu.terminator = feature;
                tu.end = feature.start;
                tus.push(tu);
            });
            openTUs.length = 0;
        }
    }
    return tus;
}
function inferExpressedProteins(tus) {
    const proteins = [];
    tus.forEach((tu, index) => {
        tu.features.forEach(feature => {
            if (feature.type.toLowerCase() === 'cds') {
                proteins.push({
                    tuIndex: index + 1,
                    label: feature.label
                });
            }
        });
    });
    return proteins;
}
function findNonExpressedCDS(allFeatures, expressedProteins) {
    const expressedLabels = new Set(expressedProteins.map(p => p.label));
    const nonExpressed = [];
    allFeatures.forEach(feature => {
        if (feature.type.toLowerCase() === 'cds' && !expressedLabels.has(feature.label)) {
            nonExpressed.push({ label: feature.label });
        }
    });
    return nonExpressed;
}
let featureDbGlobal = [];
var Annotator = Object.freeze({
    __proto__: null,
    annotateSequence: annotateSequence,
    get featureDbGlobal() {
        return featureDbGlobal;
    },
    findNonExpressedCDS: findNonExpressedCDS,
    inferExpressedProteins: inferExpressedProteins,
    inferTranscriptionalUnits: inferTranscriptionalUnits
});
const codonUsageData = {
    F: [
        'TTT',
        'TTC'
    ],
    S: [
        'TCT',
        'TCC',
        'TCA',
        'TCG',
        'AGT',
        'AGC'
    ],
    Y: [
        'TAT',
        'TAC'
    ],
    C: [
        'TGT',
        'TGC'
    ],
    L: [
        'TTA',
        'TTG',
        'CTT',
        'CTC',
        'CTA',
        'CTG'
    ],
    P: [
        'CCT',
        'CCC',
        'CCA',
        'CCG'
    ],
    H: [
        'CAT',
        'CAC'
    ],
    R: [
        'CGT',
        'CGC',
        'CGA',
        'CGG',
        'AGA',
        'AGG'
    ],
    Q: [
        'CAA',
        'CAG'
    ],
    I: [
        'ATT',
        'ATC'
    ],
    T: [
        'ACT',
        'ACC',
        'ACA',
        'ACG'
    ],
    N: [
        'AAT',
        'AAC'
    ],
    K: [
        'AAA',
        'AAG'
    ],
    M: ['ATG'],
    W: ['TGG'],
    A: [
        'GCT',
        'GCC',
        'GCA',
        'GCG'
    ],
    V: [
        'GTT',
        'GTC',
        'GTA',
        'GTG'
    ],
    D: [
        'GAT',
        'GAC'
    ],
    E: [
        'GAA',
        'GAG'
    ],
    G: [
        'GGT',
        'GGC',
        'GGA',
        'GGG'
    ]
};
const geneRestrictionEnzymes = {
    BsaI: {
        recognitionSequence: 'GGTCTC',
        recognitionRC: 'GAGACC'
    },
    BsmBI: {
        recognitionSequence: 'CGTCTC',
        recognitionRC: 'GAGACG'
    }
};
function removeSites(orf) {
    if (typeof orf !== 'string')
        throw new Error('Invalid input: ORF must be a string.');
    orf = cleanup(orf);
    if (orf.length % 3 !== 0)
        throw new Error('Invalid input sequence. Must be a multiple of 3.');
    orf = orf.toUpperCase();
    if (!/^[ATGC]*$/.test(orf))
        throw new Error('Invalid input sequence. Must be composed of only DNA characters.');
    let stopCodon = orf.slice(-3);
    if (![
            'TAA',
            'TGA',
            'TAG'
        ].includes(stopCodon)) {
        stopCodon = 'TAA';
    } else {
        orf = orf.slice(0, -3);
    }
    const codonArray = orf.match(/.{1,3}/g);
    const proteinSequence = translate(orf);
    const forbiddenSequences = [];
    for (const enzymeName in geneRestrictionEnzymes) {
        const {recognitionSequence, recognitionRC} = geneRestrictionEnzymes[enzymeName];
        forbiddenSequences.push(recognitionSequence);
        if (recognitionSequence !== recognitionRC)
            forbiddenSequences.push(recognitionRC);
    }
    outer:
        while (true) {
            let changeMade = false;
            for (const site of forbiddenSequences) {
                let searchStart = 0;
                while (true) {
                    const siteIndex = orf.indexOf(site, searchStart);
                    if (siteIndex === -1)
                        break;
                    const overlapping = [];
                    for (let i = 0; i < Math.floor(site.length / 3); i++) {
                        overlapping.push(i + Math.floor(siteIndex / 3));
                    }
                    const idx = overlapping[Math.floor(Math.random() * overlapping.length)];
                    const aa = proteinSequence[idx];
                    const options = codonUsageData[aa];
                    let newCodon = options[Math.floor(Math.random() * options.length)];
                    while (newCodon === codonArray[idx]) {
                        newCodon = options[Math.floor(Math.random() * options.length)];
                    }
                    codonArray[idx] = newCodon;
                    orf = codonArray.join('');
                    searchStart = siteIndex + 1;
                    changeMade = true;
                    continue outer;
                }
            }
            if (!changeMade)
                break;
        }
    return codonArray.join('') + stopCodon;
}
function oneAAoneCodon(peptide) {
    if (!/^[A-Z\*]+$/.test(peptide))
        throw new Error('Input must be amino acid letters and asterisks.');
    return peptide.split('').map(aa => aa === '*' ? 'TAA' : codonUsageData[aa][0]).join('');
}
var Gene = Object.freeze({
    __proto__: null,
    oneAAoneCodon: oneAAoneCodon,
    removeSites: removeSites
});
function scoreanneal(inseq) {
    let anneal = resolveToSeq(inseq);
    let score = 0;
    const maxPossibleScore = 5;
    if (anneal[0] == 'G' || anneal[0] == 'C') {
        score++;
    }
    if (anneal[anneal.length - 1] == 'G' || anneal[anneal.length - 1] == 'C') {
        score++;
    }
    const gcContent = gccontent(anneal);
    if (gcContent >= 0.5 && gcContent <= 0.65) {
        score++;
    }
    const baseBalance = basebalance(anneal);
    if (baseBalance > 0.75) {
        score++;
    }
    const maxRepeat = maxrepeat(anneal);
    if (maxRepeat <= 3) {
        score++;
    }
    const lengthDiff = Math.abs(anneal.length - 20);
    score -= lengthDiff / 2;
    return Math.max(0, score / maxPossibleScore);
}
function findanneal(inseq, lock5, lock3) {
    inseq = resolveToSeq(inseq);
    const minLength = 18;
    const maxLength = 25;
    let bestAnneal = 'N/A';
    let bestScore = -1;
    if (lock5 && !lock3) {
        let startIndex = 0;
        for (let endIndex = minLength; endIndex <= maxLength; endIndex++) {
            let anneal = inseq.substring(startIndex, endIndex);
            let score = scoreanneal(anneal);
            if (score > bestScore) {
                bestAnneal = anneal;
                bestScore = score;
            }
        }
        return bestAnneal;
    }
    if (!lock5 && lock3) {
        let endIndex = inseq.length;
        for (let startIndex = endIndex - maxLength; startIndex < endIndex - minLength; startIndex++) {
            let anneal = inseq.substring(startIndex, endIndex);
            let score = scoreanneal(anneal);
            if (score > bestScore) {
                bestAnneal = anneal;
                bestScore = score;
            }
        }
        return bestAnneal;
    }
    if (!lock5 && !lock3) {
        let annealStart = 0;
        let annealEnd = inseq.length;
        for (; annealStart < annealEnd - minLength; annealStart++) {
            for (let i = annealStart + minLength; i < annealEnd; i++) {
                const anneal = inseq.substring(annealStart, i);
                const score = scoreanneal(anneal);
                if (score > bestScore) {
                    bestAnneal = anneal;
                    bestScore = score;
                }
            }
        }
        return bestAnneal;
    }
    throw new Error(`Cannot lock both ends of the template`);
}
function pca(synthon) {
    synthon = resolveToSeq(synthon);
    let chunks = Math.round(synthon.length / 25);
    if (chunks % 2 != 0) {
        chunks++;
    }
    const chunksize = Math.round(synthon.length / chunks);
    const annealingIndices = [];
    for (let i = chunksize; i < synthon.length - chunksize; i += chunksize) {
        const seq = synthon.substr(i - 12, 24);
        const anneal = findanneal(seq, false, false);
        const startIndex = synthon.indexOf(anneal);
        const endIndex = startIndex + anneal.length;
        annealingIndices.push([
            startIndex,
            endIndex
        ]);
    }
    const oligos = [];
    for (let i = 0; i < annealingIndices.length; i++) {
        if (i == 0) {
            oligos.push(synthon.substring(0, annealingIndices[1][1]));
            continue;
        }
        if (i == annealingIndices.length - 1) {
            let lastoligo = synthon.substring(annealingIndices[i][0]);
            oligos.push(revcomp(lastoligo));
            continue;
        }
        if (i % 2 == 0) {
            oligos.push(synthon.substring(annealingIndices[i][0], annealingIndices[i + 1][1]));
            continue;
        }
        let rcoligo = synthon.substring(annealingIndices[i][0], annealingIndices[i + 1][1]);
        oligos.push(revcomp(rcoligo));
    }
    return oligos;
}
function lca(synthon) {
    synthon = resolveToSeq(synthon);
    let seqLen = synthon.length;
    let oligos = [];
    let mod = (seqLen - 25) % 50;
    let n = (seqLen - mod) / 50;
    if (mod > 25) {
        n++;
    } else if (mod < -25) {
        n--;
    }
    let chunkSize = Math.floor(seqLen / n);
    function generateOligos(s) {
        for (let i = 0; i < n; i++) {
            let oligo = s.substring(i * chunkSize, i * chunkSize + chunkSize);
            oligos.push(oligo);
        }
    }
    let synthonRevcomp = revcomp(synthon);
    generateOligos(synthon);
    generateOligos(synthonRevcomp);
    return oligos;
}
function bglbrick(sequence, frgs) {
    let rORf = frgs[0].toUpperCase();
    sequence = resolveToSeq(sequence);
    if (rORf === 'F') {
        return 'ccata' + 'AGATCT' + findanneal(sequence, true, false);
    } else if (rORf === 'R') {
        return 'catca' + 'CTCGAGttaGGATCC' + revcomp(findanneal(sequence, false, true));
    } else if (rORf === 'S') {
        return 'GAATTCatgAGATCT' + sequence + 'GGATCCtaaCTCGAG';
    } else if (rORf === 'G') {
        return 'ccataGAATTCatgAGATCT' + sequence + 'GGATCCtaaCTCGAGtaacg';
    } else {
        throw new Error('Invalid value for \'frgs\'. Please enter either \'F\' or \'R\' or \'Gblock\' or \'Synthon\'.');
    }
}
function biobrick(sequence, isCDS, frgs) {
    let rORf = frgs[0].toUpperCase();
    sequence = resolveToSeq(sequence);
    if (rORf === 'F') {
        if (isCDS) {
            return 'gacttGAATTCgcggccgctTCTAG' + findanneal(sequence, true, false);
        } else {
            return 'gacttGAATTCgcggccgctTCTAGAg' + findanneal(sequence, true, false);
        }
    } else if (rORf === 'R') {
        return 'catca' + 'ACTAGTa' + revcomp(findanneal(sequence, false, true));
    } else if (rORf === 'G') {
        if (isCDS) {
            return 'ccataGAATTCgcggccgctTCTAG' + sequence + 'tACTAGTagcggccgCTGCAGcatcg';
        } else {
            return 'ccataGAATTCgcggccgctTCTAG' + sequence + 'tACTAGTagcggccgCTGCAGcatcg';
        }
    } else if (rORf === 'S') {
        if (isCDS) {
            return 'GAATTCgcggccgctTCTAG' + sequence + 'tACTAGTagcggccgCTGCAG';
        } else {
            return 'GAATTCgcggccgctTCTAGAg' + sequence + 'tACTAGTagcggccgCTGCAG';
        }
    } else {
        throw new Error('Invalid value for \'frgs\'. Please enter either \'F\' or \'R\' or \'Gblock\' or \'Synthon\'.');
    }
}
const stickyEnds = {
    UC: [
        'TACT',
        'AAGC'
    ],
    TP: [
        'GCTT',
        'AGTA'
    ],
    SP: [
        'AATG',
        'ACCT'
    ],
    U: [
        'TACT',
        'CATT'
    ],
    C: [
        'AGGT',
        'AAGC'
    ],
    T: [
        'GCTT',
        'AGCG'
    ],
    P: [
        'GGAG',
        'AGTA'
    ]
};
function moclo(sequence, partType, frgs) {
    let rORf = frgs[0].toUpperCase();
    sequence = resolveToSeq(sequence);
    if (rORf === 'F') {
        let sticky = stickyEnds[partType][0];
        return 'ccata' + 'GGTCTCa' + sticky + findanneal(sequence, true, false);
    } else if (rORf === 'R') {
        let sticky = stickyEnds[partType][1];
        return 'catca' + 'GGTCTCt' + sticky + revcomp(findanneal(sequence, false, true));
    } else if (rORf === 'S') {
        let sticky5 = stickyEnds[partType][0];
        let sticky3 = stickyEnds[partType][1];
        return 'GGTCTCt' + sticky5 + sequence + revcomp(sticky3) + 'aGAGACC';
    } else if (rORf === 'G') {
        let sticky5 = stickyEnds[partType][0];
        let sticky3 = stickyEnds[partType][1];
        return 'ccataGGTCTCt' + sticky5 + sequence + revcomp(sticky3) + 'aGAGACCtaacg';
    } else {
        throw new Error('Invalid value for \'frgs\'. Please enter either \'F\' or \'R\' or \'Gblock\' or \'Synthon\'.');
    }
}
function genejoin(fivePrimeSeq, threePrimeSeq, ForR) {
    fivePrimeSeq = resolveToSeq(fivePrimeSeq);
    threePrimeSeq = resolveToSeq(threePrimeSeq);
    let anneal5 = findanneal(fivePrimeSeq, false, true);
    let anneal3 = findanneal(threePrimeSeq, true, false);
    let rORf = ForR[0].toUpperCase();
    let forOligo = anneal5 + anneal3;
    if (rORf === 'F') {
        return forOligo;
    } else if (rORf === 'R') {
        return revcomp(forOligo);
    }
    throw new Error('Invalid value for \'ForR\'. Please enter either \'Forward\' or \'Reverse\'.  You put in: ' + ForR);
}
function rbslib(orf, utr, frg) {
    orf = resolveToSeq(orf);
    utr = resolveToSeq(utr);
    if (orf.length % 3 !== 0) {
        throw new Error('Length of orf must be a multiple of 3');
    }
    if (![
            'TAA',
            'TGA',
            'TAG'
        ].includes(orf.substring(orf.length - 3))) {
        orf += 'TAA';
    }
    if (![
            'ATG',
            'GTG',
            'CTG',
            'TTG'
        ].includes(orf.substring(0, 3))) {
        throw new Error('Start of CDS not a start codon');
    }
    if (!orf.startsWith('ATG')) {
        orf = 'A' + orf.substring(1);
    }
    let rORf = frg[0].toUpperCase();
    if (rORf === 'R') {
        return 'catca' + 'GGTCTCt' + 'AAGC' + revcomp(findanneal(orf, false, true));
    }
    let rbs = utr.substring(utr.length - 7);
    rbs = 'NVWGGRD' + rbs;
    rbs = utr.substring(utr.length - 17, utr.length - 14) + rbs;
    if (rORf === 'F') {
        return 'ccata' + 'GGTCTCa' + 'TACT' + rbs.toLowerCase() + findanneal(orf, true, false);
    }
    if (rORf === 'G') {
        return 'ccataGGTCTCt' + 'TACT' + rbs.toLowerCase() + orf + 'GCTT' + 'aGAGACCtgatg';
    }
    if (rORf === 'S') {
        return 'GGTCTCt' + 'TACT' + rbs.toLowerCase() + orf + 'GCTT' + 'aGAGACC';
    }
}
var Oligos = Object.freeze({
    __proto__: null,
    bglbrick: bglbrick,
    biobrick: biobrick,
    findanneal: findanneal,
    genejoin: genejoin,
    lca: lca,
    moclo: moclo,
    pca: pca,
    rbslib: rbslib,
    scoreanneal: scoreanneal
});
function displaySeq(seq) {
    if (!seq)
        return seq;
    if (seq.length <= 50)
        return seq;
    return seq.slice(0, 20) + '[...]' + seq.slice(-20);
}
function parseCF(...blobs) {
    const normalizeOperation = {
        'pcr': 'PCR',
        'digest': 'Digest',
        'ligate': 'Ligate',
        'gibson': 'Gibson',
        'goldengate': 'GoldenGate',
        'transform': 'Transform'
    };
    const sequenceDataRegex = /^[ACGTRYSWKMBDHVNUacgtryswkmbdhvnu*]+$/;
    const knownTypes = [
        'oligo',
        'plasmid',
        'dsdna'
    ];
    function preprocessData(data) {
        if (Array.isArray(data)) {
            if (data.every(item => Array.isArray(item))) {
                return data.map(row => row.map(cell => cell.toString()).join('\t')).join('\n');
            } else if (data.every(item => typeof item === 'string' || typeof item === 'number')) {
                return data.map(cell => cell.toString()).join('\t');
            } else {
                throw new Error('Unsupported input type for preprocessData function');
            }
        } else {
            return data.toString();
        }
    }
    function tokenize(text) {
        text = text.replace(/#.*$/g, '').replace(/\/\/.*$/g, '').replace(/\/\*.*?\*\//g, '');
        let tokens = text.trim().split(/\s+/);
        return tokens.filter(token => ![
            'on',
            'with',
            ''
        ].includes(token.toLowerCase()));
    }
    let singleblob = '';
    for (const blob of blobs) {
        singleblob += preprocessData(blob) + '\n';
    }
    const preprocessedData = singleblob.trim().split('\n').map(line => tokenize(line));
    const steps = [];
    const sequences = {};
    for (let i = 0; i < preprocessedData.length; i++) {
        const tokens = preprocessedData[i];
        if (tokens.length === 0)
            continue;
        try {
            const keywordRaw = tokens[0];
            const keyword = keywordRaw.toLowerCase();
            const normalizedOp = normalizeOperation[keyword];
            if (normalizedOp) {
                let step = { operation: normalizedOp };
                switch (normalizedOp) {
                case 'PCR':
                    if (tokens.length < 5) {
                        throw new Error('PCR step requires 5 fields: PCR ForwardPrimer ReversePrimer Template Output');
                    }
                    step.output = tokens[4];
                    step.forward_oligo = tokens[1];
                    step.reverse_oligo = tokens[2];
                    step.template = tokens[3];
                    break;
                case 'Gibson':
                    if (tokens.length < 3) {
                        throw new Error('Gibson step requires at least 3 fields: Gibson Fragment1 [Fragment2 ...] Output');
                    }
                    step.output = tokens[tokens.length - 1];
                    step.dnas = tokens.slice(1, tokens.length - 1);
                    break;
                case 'GoldenGate':
                    if (tokens.length < 4) {
                        throw new Error('GoldenGate step requires at least 4 fields: GoldenGate Fragment1 [Fragment2 ...] Enzyme Output');
                    }
                    step.output = tokens[tokens.length - 1];
                    step.dnas = tokens.slice(1, tokens.length - 2);
                    step.enzyme = tokens[tokens.length - 2];
                    break;
                case 'Ligate':
                    if (tokens.length < 3) {
                        throw new Error('Ligate step requires at least 3 fields: Ligate Fragment1 [Fragment2 ...] Output');
                    }
                    step.output = tokens[tokens.length - 1];
                    step.dnas = tokens.slice(1, tokens.length - 1);
                    break;
                case 'Digest':
                    if (tokens.length < 5) {
                        throw new Error('Digest step requires 5 fields: Digest DNA Enzymes FragSelect Output');
                    }
                    step.dna = tokens[1];
                    step.enzymes = tokens[2].split(',');
                    step.fragselect = parseInt(tokens[3], 10);
                    if (Number.isNaN(step.fragselect)) {
                        throw new Error('Digest step: FragSelect must be an integer (0-based)');
                    }
                    step.output = tokens[tokens.length - 1];
                    break;
                case 'Transform':
                    step.dna = tokens[1];
                    step.output = tokens[tokens.length - 1];
                    const remaining = tokens.slice(2, tokens.length - 1);
                    const knownAntibiotics = {
                        'kan': 'kan',
                        'kanamycin': 'kan',
                        'cam': 'cam',
                        'chloramphenicol': 'cam',
                        'amp': 'amp',
                        'ampicillin': 'amp',
                        'spec': 'spec',
                        'spectinomycin': 'spec',
                        'gen': 'gen',
                        'gentamicin': 'gen'
                    };
                    for (const token of remaining) {
                        const lower = token.toLowerCase();
                        if (!step.strain && /^[\w\-\.]+$/.test(token)) {
                            step.strain = token;
                        } else if (!step.antibiotics && knownAntibiotics[lower]) {
                            step.antibiotics = knownAntibiotics[lower];
                        } else if (!step.temperature && !isNaN(parseFloat(token))) {
                            step.temperature = parseFloat(token);
                        }
                    }
                    break;
                }
                steps.push(step);
            } else {
                let name, sequence;
                if (knownTypes.includes(keyword)) {
                    name = tokens[1];
                    sequence = tokens.slice(2).join('');
                } else {
                    name = tokens[0];
                    sequence = tokens.slice(1).join('');
                }
                if (sequenceDataRegex.test(sequence)) {
                    switch (keyword) {
                    case 'plasmid':
                        sequences[name] = plasmid(sequence.toUpperCase());
                        break;
                    case 'oligo':
                        sequences[name] = oligo(sequence.toUpperCase());
                        break;
                    case 'dsdna':
                        sequences[name] = dsDNA(sequence.toUpperCase());
                        break;
                    default:
                        sequences[name] = oligo(sequence.toUpperCase());
                        break;
                    }
                } else {
                    throw new Error(`Invalid sequence format: "${ sequence }"`);
                }
            }
        } catch (err) {
            throw new Error(`Error parsing line ${ i + 1 }: "${ preprocessedData[i].join(' ') }"\nReason: ${ err.message }`);
        }
    }
    console.log('parseCF returning CF');
    return {
        steps,
        sequences
    };
}
function PCR(forwardOligo, reverseOligo, template) {
    if (forwardOligo.isDoubleStranded) {
        throw new Error('Forward oligo must be single-stranded');
    }
    if (reverseOligo.isDoubleStranded) {
        throw new Error('Reverse oligo must be single-stranded');
    }
    const forwardSeq = forwardOligo.sequence;
    const reverseSeq = reverseOligo.sequence;
    let templateSeq = template.sequence;
    var foranneal = forwardSeq.slice(-18);
    var forwardMatchIndex = templateSeq.indexOf(foranneal);
    if (forwardMatchIndex === -1) {
        const rcTemplate = revcomp(templateSeq);
        forwardMatchIndex = rcTemplate.indexOf(foranneal);
        if (forwardMatchIndex === -1) {
            throw new Error('Forward oligo does not exactly anneal to the template.\nForward oligo (3\' 18bp): ' + displaySeq(foranneal) + '\nTemplate: ' + displaySeq(templateSeq));
        }
        templateSeq = rcTemplate;
    }
    var rotatedTemplate = templateSeq.slice(forwardMatchIndex) + templateSeq.slice(0, forwardMatchIndex);
    var reverseComp = revcomp(reverseSeq);
    var revanneal = reverseComp.slice(0, 18);
    var reverseMatchIndex = rotatedTemplate.indexOf(revanneal);
    if (reverseMatchIndex === -1) {
        throw new Error('Reverse oligo does not exactly anneal to the template.\nReverse oligo (3\' 18bp): ' + displaySeq(revanneal) + '\nRotated template: ' + displaySeq(rotatedTemplate));
    }
    var finalProduct = forwardSeq + rotatedTemplate.slice(18, reverseMatchIndex) + reverseComp;
    console.log('PCR returning product');
    return dsDNA(finalProduct);
}
const simRestrictionEnzymes = {
    AarI: {
        recognitionSequence: 'CACCTGC',
        cut5: 4,
        cut3: 8
    },
    BbsI: {
        recognitionSequence: 'GAAGAC',
        cut5: 2,
        cut3: 6
    },
    BsaI: {
        recognitionSequence: 'GGTCTC',
        cut5: 1,
        cut3: 5
    },
    BsmBI: {
        recognitionSequence: 'CGTCTC',
        cut5: 1,
        cut3: 5
    },
    SapI: {
        recognitionSequence: 'GCTCTTC',
        cut5: 1,
        cut3: 4
    },
    BseRI: {
        recognitionSequence: 'GAGGAG',
        cut5: 10,
        cut3: 8
    },
    BamHI: {
        recognitionSequence: 'GGATCC',
        cut5: -5,
        cut3: -1
    },
    BglII: {
        recognitionSequence: 'AGATCT',
        cut5: -5,
        cut3: -1
    },
    EcoRI: {
        recognitionSequence: 'GAATTC',
        cut5: -5,
        cut3: -1
    },
    XhoI: {
        recognitionSequence: 'CTCGAG',
        cut5: -5,
        cut3: -1
    },
    SpeI: {
        recognitionSequence: 'ACTAGT',
        cut5: -5,
        cut3: -1
    },
    XbaI: {
        recognitionSequence: 'TCTAGA',
        cut5: -5,
        cut3: -1
    },
    PstI: {
        recognitionSequence: 'CTGCAG',
        cut5: -1,
        cut3: -5
    },
    NcoI: {
        recognitionSequence: 'CCATGG',
        cut5: -5,
        cut3: -1
    }
};
function sortAndValidateGoldenGateFragments(digestionFragments) {
    digestionFragments.sort((a, b) => {
        if (a.stickyEnd5 === b.stickyEnd3) {
            return 0;
        } else if (a.stickyEnd5 < b.stickyEnd3) {
            return -1;
        } else {
            return 1;
        }
    });
    digestionFragments.forEach(fragment => {
        if (isPalindromic(fragment.stickyEnd5) || isPalindromic(fragment.stickyEnd3)) {
            throw new Error(`Palindromic sticky ends found in fragment ${ fragment.fragment }`);
        }
    });
    if (digestionFragments.length > 1) {
        const stickyEndCounts = {};
        digestionFragments.forEach(fragment => {
            if (!stickyEndCounts.hasOwnProperty(fragment.stickyEnd5)) {
                stickyEndCounts[fragment.stickyEnd5] = {
                    count5: 0,
                    count3: 0
                };
            }
            if (!stickyEndCounts.hasOwnProperty(fragment.stickyEnd3)) {
                stickyEndCounts[fragment.stickyEnd3] = {
                    count5: 0,
                    count3: 0
                };
            }
            stickyEndCounts[fragment.stickyEnd5].count5++;
            stickyEndCounts[fragment.stickyEnd3].count3++;
        });
        for (const stickyEnd in stickyEndCounts) {
            if (stickyEndCounts[stickyEnd].count5 > 1 || stickyEndCounts[stickyEnd].count3 > 1) {
                throw new Error('Some fragments have the same sticky ends, which can lead to incorrect assemblies');
            }
        }
    }
    for (var i = 0; i < digestionFragments.length - 1; i++) {
        if (digestionFragments[i].stickyEnd3 !== digestionFragments[i + 1].stickyEnd5) {
            throw new Error(`Error: Sticky ends do not match between fragments 
        ${ digestionFragments[i].fragment } and ${ digestionFragments[i + 1].fragment }`);
        }
    }
    if (digestionFragments[0].stickyEnd5 !== digestionFragments[digestionFragments.length - 1].stickyEnd3) {
        throw new Error(`Error: Sticky ends do not match between first and last fragments 
      ${ digestionFragments[0].fragment } and ${ digestionFragments[digestionFragments.length - 1].fragment }`);
    }
}
function ligate(dnaPolys) {
    console.log(dnaPolys);
    if (dnaPolys.length === 1) {
        const poly = dnaPolys[0];
        const circularized = ligateEnds(poly);
        if (!circularized) {
            throw new Error('Single fragment does not circularize');
        }
        return circularized;
    }
    const fiveToPoly = {};
    for (const poly of dnaPolys) {
        fiveToPoly[poly.ext5] = poly;
        const rcPoly = new Polynucleotide(poly.sequence, poly.ext3, poly.ext5, poly.isDoubleStranded, poly.isRNA, poly.isCircular, poly.mod_ext3, poly.mod_ext5);
        fiveToPoly[rcPoly.ext5] = rcPoly;
    }
    let lefty = null;
    for (const poly of dnaPolys) {
        const righty = fiveToPoly[poly.ext3];
        if (righty && join(poly, righty)) {
            lefty = poly;
            break;
        }
    }
    if (!lefty) {
        throw new Error('No valid ligation junctions found');
    }
    while (true) {
        const circularized = ligateEnds(lefty);
        if (circularized) {
            lefty = circularized;
            break;
        }
        const righty = fiveToPoly[lefty.ext3];
        if (!righty) {
            break;
        }
        const product = join(lefty, righty);
        if (!product) {
            break;
        }
        lefty = product;
        delete fiveToPoly[righty.ext5];
    }
    for (const poly of dnaPolys) {
        if (!lefty.sequence.includes(poly.sequence)) {
            throw new Error('Not all input fragments incorporated into ligation product');
        }
    }
    return lefty;
}
function join(lefty, righty) {
    const hasPhosphate = lefty.mod_ext3 === 'phos5' || righty.mod_ext5 === 'phos5';
    if (!hasPhosphate)
        return null;
    const validMods = [
        'phos5',
        'hydroxyl'
    ];
    if (!validMods.includes(lefty.mod_ext3) || !validMods.includes(righty.mod_ext5))
        return null;
    const newseq = lefty.sequence + lefty.ext3.replace('-', '') + righty.sequence;
    return new Polynucleotide(newseq, lefty.ext5, righty.ext3, true, false, false, lefty.mod_ext5, righty.mod_ext3);
}
function ligateEnds(poly) {
    const hasPhosphate = poly.mod_ext3 === 'phos5' || poly.mod_ext5 === 'phos5';
    if (!hasPhosphate)
        return null;
    const validMods = [
        'phos5',
        'hydroxyl'
    ];
    if (!validMods.includes(poly.mod_ext5) || !validMods.includes(poly.mod_ext3))
        return null;
    if (poly.ext5.toUpperCase().replace('-', '') !== poly.ext3.toUpperCase().replace('-', ''))
        return null;
    let sticky = poly.ext5.replace('-', '');
    return new Polynucleotide(sticky + poly.sequence, '', '', true, false, true, 'circular', 'circular');
}
function goldengate(polynucleotides, enzyme) {
    if (!simRestrictionEnzymes.hasOwnProperty(enzyme)) {
        throw new Error(`Enzyme ${ enzyme } not found for Golden Gate assembly`);
    }
    if (!Array.isArray(polynucleotides)) {
        throw new Error('Input to goldengate must be an array of Polynucleotide objects');
    }
    polynucleotides.forEach((poly, idx) => {
        if (poly.constructor.name !== 'Polynucleotide') {
            throw new Error(`Input at index ${ idx } is not a Polynucleotide`);
        }
        if (!poly.isDoubleStranded) {
            throw new Error(`Polynucleotide at index ${ idx } is not double-stranded`);
        }
    });
    const enzymeDetails = simRestrictionEnzymes[enzyme];
    const restrictionSequence = enzymeDetails.recognitionSequence;
    const revRestrictionSequence = enzymeDetails.recognitionRC;
    const cut5 = enzymeDetails.cut5;
    const cut3 = enzymeDetails.cut3;
    const digestionFragments = [];
    polynucleotides.forEach((poly, idx) => {
        const sequence = poly.sequence;
        const enzymeSites = sequence.split(restrictionSequence).length - 1;
        const revEnzymeSites = sequence.split(revRestrictionSequence).length - 1;
        const enzymeSite = sequence.indexOf(restrictionSequence);
        const revEnzymeSite = sequence.indexOf(revRestrictionSequence);
        if (enzymeSites === 0) {
            throw new Error(`Error: Enzyme site ${ restrictionSequence } not found in sequence at index ${ idx }: ${ displaySeq(sequence) }`);
        }
        if (revEnzymeSites === 0) {
            throw new Error(`Error: Reverse Enzyme site ${ revRestrictionSequence } not found in sequence at index ${ idx }: ${ displaySeq(sequence) }`);
        }
        if (enzymeSites > 1) {
            throw new Error(`Error: More than one forward enzyme site ${ restrictionSequence } found in sequence at index ${ idx }: ${ displaySeq(sequence) }`);
        }
        if (revEnzymeSites > 1) {
            throw new Error(`Error: More than one reverse enzyme site ${ revRestrictionSequence } found in sequence at index ${ idx }: ${ displaySeq(sequence) }`);
        }
        if (revEnzymeSite < enzymeSite) {
            throw new Error(`Error: Reverse enzyme site found before forward enzyme site in sequence at index ${ idx }: ${ displaySeq(sequence) }`);
        }
        const cutFragment = sequence.substring(enzymeSite + restrictionSequence.length + cut3, revEnzymeSite - cut3);
        const stickyEnd5 = sequence.substring(enzymeSite + restrictionSequence.length + cut5, enzymeSite + restrictionSequence.length + cut3);
        const stickyEnd3 = sequence.substring(revEnzymeSite - cut3, revEnzymeSite - cut5);
        digestionFragments.push({
            fragment: cutFragment,
            stickyEnd5: stickyEnd5,
            stickyEnd3: stickyEnd3,
            ext5: poly.ext5,
            ext3: poly.ext3,
            mod_ext5: poly.mod_ext5,
            mod_ext3: poly.mod_ext3
        });
    });
    sortAndValidateGoldenGateFragments(digestionFragments);
    let finalSeq = '';
    for (let i = 0; i < digestionFragments.length; i++) {
        finalSeq += digestionFragments[i].stickyEnd5;
        finalSeq += digestionFragments[i].fragment;
    }
    const ext5 = digestionFragments[0].ext5;
    const ext3 = digestionFragments[digestionFragments.length - 1].ext3;
    const mod_ext5 = digestionFragments[0].mod_ext5;
    const mod_ext3 = digestionFragments[digestionFragments.length - 1].mod_ext3;
    const isCircular = digestionFragments.length > 1 && digestionFragments[0].stickyEnd5 === digestionFragments[digestionFragments.length - 1].stickyEnd3;
    return polynucleotide(finalSeq, ext5, ext3, true, false, isCircular, mod_ext5, mod_ext3);
}
function gibson(polynucleotides, check_circular = true) {
    if (!Array.isArray(polynucleotides)) {
        polynucleotides = [polynucleotides];
    }
    if (polynucleotides.length === 0) {
        throw new Error('Expected non-empty array of Polynucleotide objects');
    }
    for (const poly of polynucleotides) {
        if (poly.constructor.name !== 'Polynucleotide') {
            throw new Error('All inputs must be Polynucleotide objects');
        }
        if (!poly.isDoubleStranded) {
            throw new Error('All Polynucleotides must be double-stranded');
        }
        if (poly.isCircular) {
            throw new Error('All Polynucleotides must be linear for Gibson assembly');
        }
    }
    const HOMOLOGY_LENGTH = 20;
    let assemblyFragments = [...polynucleotides];
    while (assemblyFragments.length > 1) {
        const currFrag = assemblyFragments.shift();
        const currSeq = currFrag.sequence;
        const currLen = currSeq.length;
        const homologyRegion = currSeq.slice(currLen - HOMOLOGY_LENGTH);
        let matchedFrag = null;
        let matchedHomologousRegionEndIndex = 0;
        for (let i = 0; i < assemblyFragments.length; i++) {
            const tempFrag = assemblyFragments[i];
            const tempSeq = tempFrag.sequence;
            if (tempSeq.includes(homologyRegion)) {
                matchedFrag = tempFrag;
                matchedHomologousRegionEndIndex = tempSeq.indexOf(homologyRegion) + HOMOLOGY_LENGTH;
                assemblyFragments.splice(i, 1);
                break;
            } else if (revcomp(tempSeq).includes(homologyRegion)) {
                const revTemp = revcomp(tempSeq);
                matchedFrag = new Polynucleotide(revTemp, null, null, true, false, false);
                matchedHomologousRegionEndIndex = revTemp.indexOf(homologyRegion) + HOMOLOGY_LENGTH;
                assemblyFragments.splice(i, 1);
                break;
            }
        }
        if (!matchedFrag) {
            throw new Error('The provided assembly fragments cannot be joined together because there are not enough homologous regions between them');
        }
        if (!/^[ATCG]+$/i.test(homologyRegion)) {
            throw new Error('The provided assembly contains degenerate base pairs, assembly failed.');
        }
        const currHomologousRegionStartIndex = currSeq.length - matchedHomologousRegionEndIndex;
        const currHomologousRegion = currSeq.slice(currHomologousRegionStartIndex);
        const matchedHomologousRegion = matchedFrag.sequence.slice(0, matchedHomologousRegionEndIndex);
        if (currHomologousRegion !== matchedHomologousRegion) {
            throw new Error('In a Gibson assembly step, the fragment ends do not match');
        }
        const currFragRegion = currSeq.slice(0, currHomologousRegionStartIndex);
        const matchedFragRegion = matchedFrag.sequence;
        const assembledProduct = new Polynucleotide(currFragRegion + matchedFragRegion, null, null, true, false, false);
        assemblyFragments.push(assembledProduct);
    }
    const linearProduct = assemblyFragments[0];
    const forwardStrand = linearProduct.sequence;
    const lastHomology = forwardStrand.slice(-20);
    const firstIndex = forwardStrand.indexOf(lastHomology);
    if (firstIndex === forwardStrand.length - HOMOLOGY_LENGTH || firstIndex < 0) {
        if (check_circular) {
            throw new Error('Assembly product cannot be re-circularized');
        } else {
            return dsDNA(forwardStrand);
        }
    }
    console.log('Gibson returning product');
    const circularSeq = forwardStrand.slice(firstIndex, forwardStrand.length - HOMOLOGY_LENGTH);
    return plasmid(circularSeq);
}
function cutOnce(polyjson, enz) {
    let output;
    const poly = polyjson;
    const seq = poly.sequence;
    const enzData = simRestrictionEnzymes[enz];
    const recognitionSeq = enzData.recognitionSequence;
    const recognitionSeqRC = enzData.recognitionRC;
    const cut5 = enzData.cut5;
    const cut3 = enzData.cut3;
    const index = seq.indexOf(recognitionSeq);
    const indexRC = seq.indexOf(recognitionSeqRC);
    if (index === -1 && indexRC === -1) {
        return null;
    }
    const foundOnCodingStrand = index !== -1;
    const isFivePrime = enzData.isFivePrime;
    let ssRegionStart;
    let ssRegionEnd;
    if (foundOnCodingStrand) {
        if (isFivePrime) {
            ssRegionStart = index + recognitionSeq.length + cut5;
            ssRegionEnd = index + recognitionSeq.length + cut3;
        } else {
            ssRegionStart = index + recognitionSeq.length + cut3;
            ssRegionEnd = index + recognitionSeq.length + cut5;
        }
    } else {
        if (isFivePrime) {
            ssRegionStart = indexRC - cut3;
            ssRegionEnd = indexRC - cut5;
        } else {
            ssRegionStart = indexRC - cut5;
            ssRegionEnd = indexRC - cut3;
        }
    }
    let stickyEnd = '';
    if (!isFivePrime) {
        stickyEnd += '-';
    }
    stickyEnd += seq.substring(ssRegionStart, ssRegionEnd);
    if (poly.isCircular) {
        const linearSeq = seq.substring(ssRegionEnd) + seq.substring(0, ssRegionStart);
        const linearPoly = new Polynucleotide(linearSeq, stickyEnd, stickyEnd, poly.isDoubleStranded, poly.isRNA, false, 'phos5', 'phos5');
        output = [linearPoly];
    } else {
        const leftPoly = new Polynucleotide(seq.substring(0, ssRegionStart), poly.ext5, stickyEnd, poly.isDoubleStranded, poly.isRNA, false, poly.mod_ext5, 'phos5');
        const rightPoly = new Polynucleotide(seq.substring(ssRegionEnd), stickyEnd, poly.ext3, poly.isDoubleStranded, poly.isRNA, false, 'phos5', poly.mod_ext3);
        output = [
            leftPoly,
            rightPoly
        ];
    }
    return output;
}
function digest(seq, enzymes, fragselect) {
    if (typeof seq !== 'object' || typeof seq.sequence !== 'string') {
        throw new Error('Input to digest must be a Polynucleotide object');
    }
    const enzList = enzymes;
    for (let i = 0; i < enzList.length; i++) {
        const enzymeData = simRestrictionEnzymes[enzList[i]];
        if (!enzymeData) {
            throw new Error(`Enzyme "${ enzList[i] }" not found.`);
        }
    }
    let fragsOut = [seq];
    outer:
        while (true) {
            const worklist = [...fragsOut];
            fragsOut = [];
            for (let i = 0; i < worklist.length; i++) {
                let poly = worklist[i];
                let foundCut = false;
                for (let enz of enzList) {
                    const frags = cutOnce(poly, enz);
                    if (frags) {
                        fragsOut = [
                            ...fragsOut,
                            ...frags
                        ];
                        foundCut = true;
                        continue outer;
                    }
                }
                if (!foundCut) {
                    fragsOut.push(poly);
                }
            }
            break;
        }
    if (typeof fragselect === 'number' && fragselect >= 0 && fragselect < fragsOut.length) {
        if (seq.isCircular) {
            const firstEnz = enzList[0];
            const originSeq = seq.sequence;
            function computeCutStartIndex(seqStr, enzName) {
                const e = simRestrictionEnzymes[enzName];
                const fwd = e.recognitionSequence;
                const rev = e.recognitionRC;
                const cut5 = e.cut5;
                const cut3 = e.cut3;
                const isFivePrime = e.isFivePrime;
                const idxF = seqStr.indexOf(fwd);
                const idxR = seqStr.indexOf(rev);
                if (idxF === -1 && idxR === -1) {
                    throw new Error(`Enzyme "${ enzName }" site not found in original circular sequence when establishing fragment order.`);
                }
                if (idxF !== -1) {
                    return isFivePrime ? idxF + fwd.length + cut3 : idxF + fwd.length + cut5;
                } else {
                    return isFivePrime ? idxR - cut3 : idxR - cut5;
                }
            }
            const firstCutStart = computeCutStartIndex(originSeq, firstEnz);
            fragsOut.sort((a, b) => originSeq.indexOf(a.sequence) - originSeq.indexOf(b.sequence));
            let rotateIdx = fragsOut.findIndex(f => originSeq.indexOf(f.sequence) === firstCutStart);
            if (rotateIdx === -1) {
                rotateIdx = 0;
            }
            fragsOut = [
                ...fragsOut.slice(rotateIdx),
                ...fragsOut.slice(0, rotateIdx)
            ];
            return fragsOut[fragselect];
        } else {
            const newSeq = fragsOut[fragselect];
            return newSeq;
        }
    } else {
        throw new Error('Invalid fragselect provided for sequence: ' + displaySeq(seq.sequence));
    }
}
function simCF(cfData) {
    const steps = cfData.steps;
    const sequences = cfData.sequences;
    const products = [];
    if (!sequences || Object.keys(sequences).length === 0) {
        return 'Error: Sequence data is missing. Please include sequence data in the input JSON.';
    }
    function lookupSequence(key) {
        const foundProduct = products.find(product => product.name === key);
        if (foundProduct) {
            return foundProduct.sequence;
        }
        const foundSequence = sequences[key];
        if (foundSequence) {
            return foundSequence;
        }
        throw new Error(`Missing sequence for key: ${ key }`);
    }
    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        switch (step.operation) {
        case 'PCR': {
                const forwardOligoSeq = lookupSequence(step.forward_oligo);
                const reverseOligoSeq = lookupSequence(step.reverse_oligo);
                const templateSeq = lookupSequence(step.template);
                const productPoly = PCR(forwardOligoSeq, reverseOligoSeq, templateSeq);
                products.push({
                    name: step.output,
                    sequence: productPoly
                });
            }
            break;
        case 'GoldenGate': {
                const dnaSequences = step.dnas.map(dnaKey => lookupSequence(dnaKey));
                const productPoly = goldengate(dnaSequences, step.enzyme);
                products.push({
                    name: step.output,
                    sequence: productPoly
                });
            }
            break;
        case 'Gibson': {
                const dnaSequences = step.dnas.map(dnaKey => lookupSequence(dnaKey));
                const productPoly = gibson(dnaSequences);
                products.push({
                    name: step.output,
                    sequence: productPoly
                });
            }
            break;
        case 'Digest': {
                const dnaSeq = lookupSequence(step.dna);
                const polyObj = digest(dnaSeq, step.enzymes, step.fragselect);
                products.push({
                    name: step.output,
                    sequence: polyObj
                });
            }
            break;
        case 'Ligate': {
                const dnaPolys = step.dnas.map(dnaKey => lookupSequence(dnaKey));
                const ligatedPoly = ligate(dnaPolys);
                products.push({
                    name: step.output,
                    sequence: ligatedPoly
                });
            }
            break;
        case 'Transform': {
                const dnaSeq = lookupSequence(step.dna);
                products.push({
                    name: step.output,
                    sequence: dnaSeq
                });
            }
            break;
        }
    }
    const outputTable = products.map(product => [
        product.name,
        product.sequence
    ]);
    return outputTable;
}
var Sim = Object.freeze({
    __proto__: null,
    PCR: PCR,
    cutOnce: cutOnce,
    digest: digest,
    gibson: gibson,
    goldengate: goldengate,
    ligate: ligate,
    parseCF: parseCF,
    simCF: simCF
});
function merge(...args) {
    if (args.length < 2) {
        throw new Error('At least two arguments are required');
    }
    const delimiter = args.pop();
    if (typeof delimiter !== 'string') {
        throw new Error('The last argument must be a delimiter string');
    }
    return args.flat().join(delimiter);
}
function field(objJSON, fieldName) {
    try {
        const obj = JSON.parse(objJSON);
        const value = obj[fieldName];
        return typeof value === 'object' ? JSON.stringify(value) : value;
    } catch (error) {
        throw new Error('Invalid JSON format or field not found.');
    }
}
function makeJSON(inputArray) {
    const obj = {};
    inputArray.forEach(([key, value]) => {
        if (typeof key === 'string' && key.trim()) {
            obj[key.trim()] = value === 'null' ? null : value === 'undefined' ? undefined : value;
        }
    });
    return JSON.stringify(obj);
}
var Utils = Object.freeze({
    __proto__: null,
    field: field,
    makeJSON: makeJSON,
    merge: merge
});
function locKey(loc) {
    return `${ loc.boxname }:${ loc.row }:${ loc.col }`;
}
function _emptyIndices() {
    return {
        construct_to_locations: {},
        loc_to_conc: {},
        loc_to_clone: {},
        loc_to_culture: {}
    };
}
function _indexAdd(next, key, sample) {
    const constructKey = (sample.construct || '').toLowerCase();
    if (constructKey) {
        if (!next.construct_to_locations[constructKey])
            next.construct_to_locations[constructKey] = new Set();
        next.construct_to_locations[constructKey].add(key);
    }
    if (sample.concentration)
        next.loc_to_conc[key] = sample.concentration;
    if (sample.clone)
        next.loc_to_clone[key] = sample.clone;
    if (sample.culture)
        next.loc_to_culture[key] = sample.culture;
}
function _indexRemove(next, key, sample) {
    const constructKey = (sample.construct || '').toLowerCase();
    if (constructKey && next.construct_to_locations[constructKey]) {
        next.construct_to_locations[constructKey].delete(key);
        if (next.construct_to_locations[constructKey].size === 0)
            delete next.construct_to_locations[constructKey];
    }
    delete next.loc_to_conc[key];
    delete next.loc_to_clone[key];
    delete next.loc_to_culture[key];
}
function cloneInventory(inv) {
    const out = {
        boxes: { ...inv.boxes },
        samples: { ...inv.samples },
        construct_to_locations: {},
        loc_to_conc: { ...inv.loc_to_conc },
        loc_to_clone: { ...inv.loc_to_clone },
        loc_to_culture: { ...inv.loc_to_culture }
    };
    for (const k in inv.construct_to_locations) {
        out.construct_to_locations[k] = new Set(inv.construct_to_locations[k]);
    }
    return out;
}
function createInventory() {
    return {
        boxes: {},
        samples: {},
        ..._emptyIndices()
    };
}
function addBox(inv, box) {
    const next = cloneInventory(inv);
    next.boxes[box.name] = { ...box };
    return next;
}
function removeBox(inv, boxname) {
    const next = cloneInventory(inv);
    for (const key of Object.keys(next.samples)) {
        if (key.startsWith(`${ boxname }:`)) {
            _removeSampleByKey(next, key);
        }
    }
    delete next.boxes[boxname];
    return next;
}
function upsertSample(inv, sample) {
    const key = locKey(sample.location);
    const next = cloneInventory(inv);
    if (next.samples[key]) {
        _removeSampleByKey(next, key);
    }
    next.samples[key] = {
        ...sample,
        location: { ...sample.location }
    };
    _indexAdd(next, key, next.samples[key]);
    return next;
}
function removeSample(inv, location) {
    const key = locKey(location);
    const next = cloneInventory(inv);
    _removeSampleByKey(next, key);
    return next;
}
function _removeSampleByKey(next, key) {
    const s = next.samples[key];
    if (!s)
        return;
    _indexRemove(next, key, s);
    delete next.samples[key];
}
function moveSample(inv, oldLoc, newLoc) {
    const keyOld = locKey(oldLoc);
    const s = inv.samples[keyOld];
    if (!s)
        return inv;
    const next = cloneInventory(inv);
    _removeSampleByKey(next, keyOld);
    const moved = {
        ...s,
        location: { ...newLoc }
    };
    return upsertSample(next, moved);
}
function mapSamples(inv, fn) {
    let out = {
        boxes: { ...inv.boxes },
        samples: {},
        ..._emptyIndices()
    };
    for (const key of Object.keys(inv.samples)) {
        const s = inv.samples[key];
        const t = fn(s);
        if (t && t.location) {
            out = upsertSample(out, t);
        }
    }
    return out;
}
function filterSamples(inv, predicate) {
    let out = {
        boxes: { ...inv.boxes },
        samples: {},
        ..._emptyIndices()
    };
    for (const key of Object.keys(inv.samples)) {
        const s = inv.samples[key];
        if (predicate(s)) {
            out = upsertSample(out, s);
        }
    }
    return out;
}
function inBounds(inv, loc) {
    const box = inv.boxes[loc.boxname];
    if (!box)
        return false;
    return loc.row >= 0 && loc.col >= 0 && loc.row < box.rows && loc.col < box.cols;
}
function isOccupied(inv, loc) {
    return Boolean(inv.samples[locKey(loc)]);
}
var Inventory = Object.freeze({
    __proto__: null,
    addBox: addBox,
    cloneInventory: cloneInventory,
    createInventory: createInventory,
    filterSamples: filterSamples,
    inBounds: inBounds,
    isOccupied: isOccupied,
    locKey: locKey,
    mapSamples: mapSamples,
    moveSample: moveSample,
    removeBox: removeBox,
    removeSample: removeSample,
    upsertSample: upsertSample
});
function wellName(row, col) {
    return `${ String.fromCharCode(65 + row) }${ col + 1 }`;
}
function fromWellName(well) {
    const m = String(well).trim().match(/^([A-Za-z])(\d+)$/);
    if (!m)
        throw new Error(`Invalid well: ${ well }`);
    const row = m[1].toUpperCase().charCodeAt(0) - 65;
    const col = Number(m[2]) - 1;
    return {
        row,
        col
    };
}
function makeLabel(hint = 'SAMPLE', row, col) {
    return `${ hint }-${ row }${ col }`;
}
function applyLabelPolicy(sampleFields = {}, loc, opts = {}) {
    const hint = opts.label || sampleFields.label || 'SAMPLE';
    return {
        ...sampleFields,
        label: makeLabel(hint, loc.row, loc.col)
    };
}
function validateBox(inv, boxname) {
    const box = inv.boxes[boxname];
    if (!box)
        return {
            ok: false,
            reason: 'unknown box'
        };
    if (!(Number.isInteger(box.rows) && Number.isInteger(box.cols) && box.rows > 0 && box.cols > 0)) {
        return {
            ok: false,
            reason: 'invalid box geometry'
        };
    }
    return { ok: true };
}
function validatePosition(inv, locationOrArray) {
    const checkOne = loc => {
        if (!inv.boxes[loc.boxname])
            return {
                ok: false,
                reason: 'unknown box'
            };
        if (!inBounds(inv, loc))
            return {
                ok: false,
                reason: 'out of bounds'
            };
        if (isOccupied(inv, loc))
            return {
                ok: false,
                reason: 'occupied'
            };
        return { ok: true };
    };
    if (Array.isArray(locationOrArray)) {
        for (let i = 0; i < locationOrArray.length; i++) {
            const res = checkOne(locationOrArray[i]);
            if (!res.ok)
                return {
                    ...res,
                    index: i
                };
        }
        return { ok: true };
    }
    return checkOne(locationOrArray);
}
function assignNext(inv, boxname, sampleFields = {}, opts = {}) {
    const box = inv.boxes[boxname];
    if (!box)
        throw new Error(`Box not found: ${ boxname }`);
    const {startAt = {
            row: 0,
            col: 0
        }, pattern = 'row-major', skip} = opts;
    const startR = Math.max(0, Math.min(box.rows - 1, startAt.row || 0));
    const startC = Math.max(0, Math.min(box.cols - 1, startAt.col || 0));
    const order = [];
    const pushIf = (r, c) => {
        const loc = {
            boxname,
            row: r,
            col: c,
            label: '',
            sidelabel: sampleFields.sidelabel || ''
        };
        if (skip && skip(loc))
            return;
        if (!isOccupied(inv, loc) && inBounds(inv, loc))
            order.push(loc);
    };
    if (pattern === 'col-major') {
        for (let c = startC; c < box.cols; c++)
            for (let r = startR; r < box.rows; r++)
                pushIf(r, c);
        for (let c = 0; c < startC; c++)
            for (let r = 0; r < box.rows; r++)
                pushIf(r, c);
    } else if (pattern === 'snake') {
        for (let r = startR; r < box.rows; r++) {
            if (r % 2 === 0) {
                for (let c = startC; c < box.cols; c++)
                    pushIf(r, c);
            } else {
                for (let c = box.cols - 1; c >= 0; c--)
                    pushIf(r, c);
            }
        }
        for (let r = 0; r < startR; r++) {
            if (r % 2 === 0) {
                for (let c = 0; c < box.cols; c++)
                    pushIf(r, c);
            } else {
                for (let c = box.cols - 1; c >= 0; c--)
                    pushIf(r, c);
            }
        }
    } else {
        for (let r = startR; r < box.rows; r++)
            for (let c = startC; c < box.cols; c++)
                pushIf(r, c);
        for (let r = 0; r < startR; r++)
            for (let c = 0; c < box.cols; c++)
                pushIf(r, c);
    }
    const loc = order[0];
    if (!loc)
        throw new Error(`No free positions in ${ boxname }`);
    const fieldsWithLabel = applyLabelPolicy(sampleFields, loc, opts);
    const finalLoc = {
        ...loc,
        label: fieldsWithLabel.label || makeLabel('SAMPLE', loc.row, loc.col)
    };
    const nextSample = {
        ...fieldsWithLabel,
        location: finalLoc
    };
    const updated = upsertSample(cloneInventory(inv), nextSample);
    return {
        location: finalLoc,
        inventory: updated
    };
}
function placeNext(inv, boxname, sampleFields, hintLabelOrOpts, maybeOpts) {
    const opts = typeof hintLabelOrOpts === 'string' ? {
        ...maybeOpts,
        label: hintLabelOrOpts
    } : hintLabelOrOpts || {};
    const {location, inventory} = assignNext(inv, boxname, sampleFields, opts);
    return {
        inventory,
        location
    };
}
function assignBatch(inv, boxname, samplesArray, opts = {}) {
    let curInv = inv;
    const locations = [];
    for (const sampleFields of samplesArray) {
        const {inventory, location} = assignNext(curInv, boxname, sampleFields, opts);
        curInv = inventory;
        locations.push(location);
    }
    return {
        inventory: curInv,
        locations
    };
}
const placeBatch = assignBatch;
var Manage = Object.freeze({
    __proto__: null,
    applyLabelPolicy: applyLabelPolicy,
    assignBatch: assignBatch,
    assignNext: assignNext,
    fromWellName: fromWellName,
    makeLabel: makeLabel,
    placeBatch: placeBatch,
    placeNext: placeNext,
    validateBox: validateBox,
    validatePosition: validatePosition,
    wellName: wellName
});
function getSample(inv, location) {
    return inv.samples[locKey(location)] || null;
}
function findByConstruct(inv, construct) {
    const key = (construct || '').toLowerCase();
    const set = inv.construct_to_locations[key];
    if (!set)
        return [];
    return Array.from(set).map(k => inv.samples[k]);
}
function findByConcentration(inv, conc) {
    const out = [];
    for (const [k, v] of Object.entries(inv.loc_to_conc)) {
        if (v === conc)
            out.push(inv.samples[k]);
    }
    return out;
}
function findByClone(inv, clone) {
    const out = [];
    for (const [k, v] of Object.entries(inv.loc_to_clone)) {
        if ((v || '').toLowerCase() === String(clone).toLowerCase())
            out.push(inv.samples[k]);
    }
    return out;
}
function findByCulture(inv, culture) {
    const out = [];
    for (const [k, v] of Object.entries(inv.loc_to_culture)) {
        if ((v || '').toLowerCase() === String(culture).toLowerCase())
            out.push(inv.samples[k]);
    }
    return out;
}
function isOligo(sample) {
    return String(sample?.type || sample?.metadata?.type || '').toLowerCase() === 'oligo';
}
function isPlasmid(sample) {
    return String(sample?.type || sample?.metadata?.type || '').toLowerCase() === 'plasmid';
}
function _parseOligoUM(concStr) {
    if (!concStr && concStr !== 0)
        return null;
    const t = String(concStr).trim().toLowerCase().replace('µ', 'u');
    let m = t.match(/([0-9]*\.?[0-9]+)\s*u\s*m/);
    if (m)
        return { uM: parseFloat(m[1]) };
    m = t.match(/u\s*m\s*([0-9]*\.?[0-9]+)/);
    if (m)
        return { uM: parseFloat(m[1]) };
    m = t.match(/([0-9]*\.?[0-9]+)\s*n\s*m/);
    if (m)
        return { uM: parseFloat(m[1]) / 1000 };
    return null;
}
function rankOligoSamples(samples, opts = {}) {
    const min_uM = opts.min_uM ?? 10;
    const preferUM = Array.isArray(opts.preferUM) ? opts.preferUM : [
        10,
        100,
        2.66
    ];
    const ranked = (samples || []).map(s => {
        const parsed = _parseOligoUM(s.concentration);
        const uM = parsed ? parsed.uM : NaN;
        const eligible = Number.isFinite(uM) && uM >= min_uM;
        let prefIndex = -1;
        for (let i = 0; i < preferUM.length; i++) {
            if (Number.isFinite(uM) && Math.abs(uM - preferUM[i]) < 0.25) {
                prefIndex = i;
                break;
            }
        }
        if (prefIndex === -1)
            prefIndex = preferUM.length;
        const penalty = eligible ? 0 : 1000;
        const score = penalty + prefIndex * 10 + (Number.isFinite(uM) ? Math.abs(uM - min_uM) : 999);
        const reason = eligible ? prefIndex < preferUM.length ? `working stock ~${ preferUM[prefIndex] } uM` : `>= ${ min_uM } uM` : `below minimum ${ min_uM } uM or unparseable`;
        return {
            sample: s,
            uM,
            eligible,
            score,
            reason
        };
    }).sort((a, b) => a.score - b.score);
    const best = ranked.find(r => r.eligible) || null;
    return {
        ranked,
        best
    };
}
function chooseOligoForPCR(inv, oligoName, opts = {}) {
    const all = findByConstruct(inv, oligoName).filter(s => !s.type || isOligo(s));
    const {ranked, best} = rankOligoSamples(all, opts);
    return {
        best,
        ranked,
        all
    };
}
const DEFAULT_CULTURE_ORDER = [
    'tertiary',
    'secondary',
    'primary'
];
function rankMinipreps(samples, opts = {}) {
    const order = (opts.preferCulture || DEFAULT_CULTURE_ORDER).map(s => String(s).toLowerCase());
    const rankMap = new Map(order.map((c, i) => [
        c,
        order.length - i
    ]));
    const ranked = (samples || []).map(s => {
        const culture = String(s.culture || s.metadata?.culture || '').toLowerCase();
        const rank = rankMap.get(culture) || 0;
        const score = -rank;
        const reason = rank > 0 ? `prefer ${ culture }` : 'unranked culture';
        return {
            sample: s,
            culture,
            rank,
            score,
            reason
        };
    }).sort((a, b) => a.score - b.score);
    const best = ranked.length ? ranked[0] : null;
    return {
        ranked,
        best
    };
}
function chooseTemplateForPCR(inv, templateName, opts = {}) {
    const all = findByConstruct(inv, templateName).filter(s => !s.type || isPlasmid(s));
    const {ranked, best} = rankMinipreps(all, opts);
    return {
        best,
        ranked,
        all
    };
}
function choosePCRInputs(inv, {forwardName, reverseName, templateName}, opts = {}) {
    const oligoOpts = {
        min_uM: opts.min_uM ?? 10,
        preferUM: opts.preferUM || [
            10,
            100,
            2.66
        ]
    };
    const tmplOpts = { preferCulture: opts.preferCulture || DEFAULT_CULTURE_ORDER };
    const fwd = chooseOligoForPCR(inv, forwardName, oligoOpts);
    const rev = chooseOligoForPCR(inv, reverseName, oligoOpts);
    const tmpl = chooseTemplateForPCR(inv, templateName, tmplOpts);
    const problems = [];
    if (!fwd.best)
        problems.push(`No eligible forward oligo ≥ ${ oligoOpts.min_uM } uM`);
    if (!rev.best)
        problems.push(`No eligible reverse oligo ≥ ${ oligoOpts.min_uM } uM`);
    if (!tmpl.best)
        problems.push('No preferred plasmid template found');
    return {
        forward: fwd,
        reverse: rev,
        template: tmpl,
        problems
    };
}
var Query = Object.freeze({
    __proto__: null,
    chooseOligoForPCR: chooseOligoForPCR,
    choosePCRInputs: choosePCRInputs,
    chooseTemplateForPCR: chooseTemplateForPCR,
    findByClone: findByClone,
    findByConcentration: findByConcentration,
    findByConstruct: findByConstruct,
    findByCulture: findByCulture,
    getSample: getSample,
    rankMinipreps: rankMinipreps,
    rankOligoSamples: rankOligoSamples
});
function normalizeHeaders(line) {
    const trimmed = line.trim();
    const parts = trimmed.indexOf('\t') >= 0 ? trimmed.split('\t') : trimmed.split(',');
    return parts.map(t => t.trim());
}
function parseBlocks(text) {
    const rawBlocks = text.split('>>').map(b => b.trim()).filter(b => b.length > 0);
    if (rawBlocks.length === 0)
        return null;
    const boxWide = rawBlocks[0].split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const dataBlocks = rawBlocks.slice(1);
    return {
        boxWide,
        dataBlocks
    };
}
function parseBoxWideFields(lines) {
    const fields = {};
    for (const line of lines) {
        if (!line.startsWith('>'))
            continue;
        const parts = line.slice(1).split(':');
        if (parts.length >= 2) {
            const key = parts[0].trim().toLowerCase();
            const value = parts.slice(1).join(':').trim();
            fields[key] = value;
        }
    }
    return fields;
}
function parsePlate(dataBlocks) {
    if (!Array.isArray(dataBlocks) || dataBlocks.length === 0) {
        return null;
    }
    const firstLines = String(dataBlocks[0] || '').split(/\r?\n/).map(l => l.trim()).filter(l => l !== '');
    if (firstLines.length < 2)
        return null;
    const headerTokens0 = normalizeHeaders(firstLines[0] || '');
    if (!Array.isArray(headerTokens0) || headerTokens0.length < 2) {
        throw new Error('Malformed grid: header row must include a field name and at least one column index.');
    }
    let numCols = headerTokens0.length - 1;
    const rowLabels = [];
    const wellArray = [];
    for (let r = 1; r < firstLines.length; r++) {
        const tokens = normalizeHeaders(firstLines[r] || '');
        const rowLabel = tokens && typeof tokens[0] !== 'undefined' && tokens[0] !== '' ? tokens[0] : letterForRow(r - 1);
        rowLabels.push(rowLabel);
        wellArray.push(Array.from({ length: numCols }, () => ({})));
    }
    for (const block of dataBlocks) {
        const lines = String(block || '').split(/\r?\n/).map(l => l.trim()).filter(l => l !== '');
        if (lines.length < 2)
            continue;
        const headerTokens = normalizeHeaders(lines[0] || '');
        if (!Array.isArray(headerTokens) || headerTokens.length < 2) {
            continue;
        }
        const thisNumCols = Math.max(0, headerTokens.length - 1);
        if (thisNumCols > numCols) {
            for (let rr = 0; rr < wellArray.length; rr++) {
                while (wellArray[rr].length < thisNumCols)
                    wellArray[rr].push({});
            }
            numCols = thisNumCols;
        }
        let fieldName = String(headerTokens[0] || '').toLowerCase();
        if (fieldName === 'field') {
            const canonical = [
                'construct',
                'label',
                'side-label',
                'concentration',
                'clone',
                'culture',
                'type'
            ];
            const idx = dataBlocks.indexOf(block);
            if (idx >= 0 && idx < canonical.length) {
                fieldName = canonical[idx];
            }
        }
        for (let r = 1; r < lines.length; r++) {
            const tokens = normalizeHeaders(lines[r] || '');
            if (!wellArray[r - 1]) {
                const newLabel = tokens && typeof tokens[0] !== 'undefined' && tokens[0] !== '' ? tokens[0] : letterForRow(r - 1);
                rowLabels[r - 1] = newLabel;
                wellArray[r - 1] = Array.from({ length: numCols }, () => ({}));
            } else if (!rowLabels[r - 1]) {
                rowLabels[r - 1] = tokens && typeof tokens[0] !== 'undefined' && tokens[0] !== '' ? tokens[0] : letterForRow(r - 1);
            }
            for (let c = 0; c < numCols; c++) {
                const val = Array.isArray(tokens) && typeof tokens[c + 1] !== 'undefined' ? tokens[c + 1] : '';
                if (!wellArray[r - 1][c])
                    wellArray[r - 1][c] = {};
                wellArray[r - 1][c][fieldName] = val;
            }
        }
    }
    const headers = [headerTokens0[0]].concat(Array.from({ length: numCols }, (_, i) => String(i + 1)));
    return {
        headers,
        rowLabels,
        wellArray
    };
}
function letterForRow(r) {
    return String.fromCharCode(65 + r);
}
function serializePlate(boxname, box, samples) {
    const rows = box.rows;
    const cols = box.cols;
    const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({})));
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const key = `${ boxname }:${ r }:${ c }`;
            const s = samples[key];
            if (s) {
                grid[r][c] = {
                    construct: s.construct || '',
                    label: s.location?.label || '',
                    'side-label': s.location?.sidelabel || '',
                    concentration: s.concentration || '',
                    clone: s.clone || '',
                    culture: s.culture || '',
                    type: s.type || ''
                };
            } else {
                grid[r][c] = {
                    construct: '',
                    label: '',
                    'side-label': '',
                    concentration: '',
                    clone: '',
                    culture: '',
                    type: ''
                };
            }
        }
    }
    const fields = [
        'construct',
        'label',
        'side-label',
        'concentration',
        'clone',
        'culture',
        'type'
    ];
    const blocks = [];
    for (const field of fields) {
        const colHeader = [field].concat(Array.from({ length: cols }, (_, i) => String(i + 1))).join('\t');
        const lines = [colHeader];
        for (let r = 0; r < rows; r++) {
            const rowLabel = letterForRow(r);
            const cells = [rowLabel];
            for (let c = 0; c < cols; c++) {
                cells.push(String(grid[r][c][field] ?? ''));
            }
            lines.push(cells.join('\t'));
        }
        blocks.push(lines.join('\n'));
    }
    const boxWide = [
        `>box:${ boxname }`,
        `>rows:${ rows }`,
        `>cols:${ cols }`
    ].join('\n');
    return boxWide + '\n>>' + blocks.join('\n>>');
}
function parseGridFile(filename, fileText, boxRows = 8, boxCols = 12) {
    const parsed = parseBlocks(fileText);
    if (!parsed)
        return createInventory();
    const {boxWide, dataBlocks} = parsed;
    if (!Array.isArray(dataBlocks) || dataBlocks.length === 0) {
        throw new Error('No grid blocks found (missing ">>" sections). Expected at least one block beginning with a header like "field\\t1\\t2...".');
    }
    const boxHints = parseBoxWideFields(boxWide);
    const plate = parsePlate(dataBlocks);
    if (!plate) {
        throw new Error('Malformed grid: header row and at least one data row are required in each block.');
    }
    const baseName = (filename || 'BOX').split('.')[0];
    const {headers, rowLabels, wellArray} = plate;
    const numCols = headers.length - 1;
    const derivedRows = rowLabels.length;
    const derivedCols = numCols;
    const rows = Number.isFinite(Number(boxHints.rows)) ? Number(boxHints.rows) : derivedRows;
    const cols = Number.isFinite(Number(boxHints.cols)) ? Number(boxHints.cols) : derivedCols;
    let inv = addBox(createInventory(), {
        name: baseName,
        rows,
        cols
    });
    for (let r = 0; r < rowLabels.length; r++) {
        for (let c = 0; c < numCols; c++) {
            const sample = wellArray[r][c];
            const hasData = Object.values(sample).some(v => (v || '').trim() !== '');
            if (!hasData)
                continue;
            const construct = (sample.construct || '').trim();
            const rowLabel = rowLabels[r];
            const colLabel = headers[c + 1];
            const well = `${ rowLabel }${ colLabel }`;
            const location = {
                boxname: baseName,
                row: r,
                col: c,
                label: sample.label || well,
                sidelabel: sample['side-label'] || ''
            };
            inv = upsertSample(inv, {
                location,
                construct,
                concentration: (sample.concentration || '').trim() || undefined,
                clone: (sample.clone || '').trim() || undefined,
                culture: (sample.culture || '').trim() || undefined,
                type: (sample.type || '').trim() || undefined,
                metadata: sample
            });
        }
    }
    return inv;
}
function parseTabular(text) {
    const lines = String(text || '').split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length === 0)
        return createInventory();
    const headers = normalizeHeaders(lines[0]);
    const idx = name => headers.findIndex(h => h.toLowerCase() === name);
    const iBox = Math.max(idx('box'), idx('boxname'));
    const iWell = idx('well');
    const iRow = idx('row');
    const iCol = idx('col');
    const iConstruct = idx('construct');
    const iLabel = idx('label');
    const iSide = Math.max(idx('side-label'), idx('sidelabel'));
    const iType = idx('type');
    const iConc = Math.max(idx('concentration'), idx('conc'), idx('um'));
    const iClone = idx('clone');
    const iCulture = idx('culture');
    const dims = new Map();
    for (let li = 1; li < lines.length; li++) {
        const cols = normalizeHeaders(lines[li]);
        const boxname = (iBox >= 0 ? cols[iBox] : 'BOX') || 'BOX';
        let r = null, c = null;
        if (iWell >= 0) {
            const m = String(cols[iWell] || '').trim().match(/^([A-Za-z])(\d{1,2})$/);
            if (m) {
                r = m[1].toUpperCase().charCodeAt(0) - 65;
                c = parseInt(m[2], 10) - 1;
            }
        }
        if (r == null && iRow >= 0) {
            const tok = cols[iRow];
            if (/^[A-Za-z]$/.test(tok || ''))
                r = tok.toUpperCase().charCodeAt(0) - 65;
            else if (Number.isFinite(Number(tok)))
                r = Math.max(0, Number(tok));
        }
        if (c == null && iCol >= 0) {
            const tok = cols[iCol];
            if (Number.isFinite(Number(tok)))
                c = Math.max(0, Number(tok));
        }
        if (r == null || c == null)
            continue;
        const d = dims.get(boxname) || {
            rows: 0,
            cols: 0
        };
        d.rows = Math.max(d.rows, r + 1);
        d.cols = Math.max(d.cols, c + 1);
        dims.set(boxname, d);
    }
    let inv = createInventory();
    if (dims.size === 0) {
        inv = addBox(inv, {
            name: 'BOX',
            rows: 8,
            cols: 12
        });
    } else {
        for (const [name, d] of dims.entries()) {
            inv = addBox(inv, {
                name,
                rows: Math.max(8, d.rows),
                cols: Math.max(12, d.cols)
            });
        }
    }
    for (let li = 1; li < lines.length; li++) {
        const cols = normalizeHeaders(lines[li]);
        const boxname = (iBox >= 0 ? cols[iBox] : 'BOX') || 'BOX';
        let row = null, col = null;
        if (iWell >= 0) {
            const m = String(cols[iWell] || '').trim().match(/^([A-Za-z])(\d{1,2})$/);
            if (m) {
                row = m[1].toUpperCase().charCodeAt(0) - 65;
                col = parseInt(m[2], 10) - 1;
            }
        }
        if (row == null && iRow >= 0) {
            const tok = cols[iRow];
            if (/^[A-Za-z]$/.test(tok || ''))
                row = tok.toUpperCase().charCodeAt(0) - 65;
            else if (Number.isFinite(Number(tok)))
                row = Math.max(0, Number(tok));
        }
        if (col == null && iCol >= 0) {
            const tok = cols[iCol];
            if (Number.isFinite(Number(tok)))
                col = Math.max(0, Number(tok));
        }
        if (row == null || col == null)
            continue;
        const construct = (iConstruct >= 0 ? cols[iConstruct] : '') || '';
        const label = (iLabel >= 0 ? cols[iLabel] : construct) || '';
        const sidelabel = (iSide >= 0 ? cols[iSide] : '') || '';
        const type = (iType >= 0 ? cols[iType] : '') || '';
        const concentration = (iConc >= 0 ? cols[iConc] : '') || '';
        const clone = (iClone >= 0 ? cols[iClone] : '') || '';
        const culture = (iCulture >= 0 ? cols[iCulture] : '') || '';
        inv = upsertSample(inv, {
            construct: construct || undefined,
            type: type || undefined,
            concentration: concentration || undefined,
            clone: clone || undefined,
            culture: culture || undefined,
            location: {
                boxname,
                row,
                col,
                label,
                sidelabel
            }
        });
    }
    return inv;
}
function toRows(inv) {
    const rows = [];
    for (const [key, s] of Object.entries(inv.samples)) {
        const well = `${ String.fromCharCode(65 + s.location.row) }${ s.location.col + 1 }`;
        rows.push({
            box: s.location.boxname,
            row: s.location.row,
            col: s.location.col,
            well,
            construct: s.construct,
            label: s.location.label,
            'side-label': s.location.sidelabel,
            concentration: s.concentration || '',
            clone: s.clone || '',
            culture: s.culture || '',
            type: s.type || ''
        });
    }
    return rows;
}
function toTabular(inv) {
    const cols = [
        'box',
        'row',
        'col',
        'well',
        'construct',
        'label',
        'side-label',
        'concentration',
        'clone',
        'culture',
        'type'
    ];
    const rows = [cols.join('\t')];
    for (const s of Object.values(inv.samples || {})) {
        const well = `${ String.fromCharCode(65 + s.location.row) }${ s.location.col + 1 }`;
        rows.push([
            s.location.boxname,
            s.location.row,
            s.location.col,
            well,
            s.construct || '',
            s.location.label || '',
            s.location.sidelabel || '',
            s.concentration || '',
            s.clone || '',
            s.culture || '',
            s.type || ''
        ].join('\t'));
    }
    return rows.join('\n');
}
function serializeGrid(inv, boxname) {
    const names = boxname ? [boxname] : Object.keys(inv.boxes || {});
    if (names.length === 0)
        return '';
    const out = names.map(name => serializePlate(name, inv.boxes[name], inv.samples));
    return out.join('\n\n');
}
function parse(text) {
    const txt = String(text || '').trim();
    if (txt === '')
        return createInventory();
    if (txt.startsWith('{') || txt.startsWith('['))
        return fromJSON(txt);
    if (txt.startsWith('>') || txt.includes('\n>>'))
        return parseGridFile('BOX.tsv', txt);
    return parseTabular(txt);
}
function inventoryFrom(input, format) {
    if (typeof input !== 'string')
        return ensureInventory(input);
    const fmt = (format || '').toLowerCase();
    if (fmt === 'json')
        return fromJSON(input.trim());
    if (fmt === 'grid')
        return parseGridFile('BOX.tsv', input.trim());
    if (fmt === 'tabular')
        return parseTabular(input.trim());
    return parse(input);
}
function ensureInventory(input, filenameHint) {
    if (!input)
        return createInventory();
    if (typeof input === 'string') {
        return parse(input);
    }
    if (typeof input === 'object' && input.boxes && input.samples) {
        return cloneInventory(input);
    }
    throw new Error('Unsupported inventory input type');
}
function mergeInventories(invA, invB) {
    let out = invA;
    for (const [k, sample] of Object.entries(invB.samples || {})) {
        out = upsertSample(out, sample);
    }
    for (const [name, box] of Object.entries(invB.boxes || {})) {
        if (!out.boxes[name])
            out = addBox(out, box);
    }
    return out;
}
function toJSON(inv) {
    const constructIdx = {};
    for (const [k, set] of Object.entries(inv.construct_to_locations)) {
        constructIdx[k] = Array.from(set);
    }
    return JSON.stringify({
        boxes: inv.boxes,
        samples: inv.samples,
        construct_to_locations: constructIdx,
        loc_to_conc: inv.loc_to_conc,
        loc_to_clone: inv.loc_to_clone,
        loc_to_culture: inv.loc_to_culture
    }, null, 2);
}
function fromJSON(jsonStr) {
    const raw = JSON.parse(jsonStr);
    const inv = {
        boxes: raw.boxes || {},
        samples: raw.samples || {},
        construct_to_locations: {},
        loc_to_conc: raw.loc_to_conc || {},
        loc_to_clone: raw.loc_to_clone || {},
        loc_to_culture: raw.loc_to_culture || {}
    };
    for (const k in raw.construct_to_locations || {}) {
        inv.construct_to_locations[k] = new Set(raw.construct_to_locations[k]);
    }
    return inv;
}
function inventoryTo(inv, format = 'object') {
    switch ((format || 'object').toLowerCase()) {
    case 'object':
        return inv;
    case 'json':
        return toJSON(inv);
    case 'rows':
        return toRows(inv);
    case 'tabular':
        return toTabular(inv);
    case 'tsv':
        return serializeGrid(inv);
    default:
        throw new Error(`Unknown output format: ${ format }`);
    }
}
function fromTSV(filenameOrText, maybeText) {
    try {
        if (typeof maybeText === 'undefined') {
            return parseGridFile('BOX.tsv', filenameOrText);
        }
        return parseGridFile(filenameOrText, maybeText);
    } catch (err) {
        const msg = err?.message || String(err);
        throw new Error(`TSV parse error: ${ msg }`);
    }
}
var IO = Object.freeze({
    __proto__: null,
    ensureInventory: ensureInventory,
    fromJSON: fromJSON,
    fromTSV: fromTSV,
    inventoryFrom: inventoryFrom,
    inventoryTo: inventoryTo,
    mergeInventories: mergeInventories,
    parse: parse,
    parseGridFile: parseGridFile,
    parseTabular: parseTabular,
    serializeGrid: serializeGrid,
    toJSON: toJSON,
    toRows: toRows,
    toTabular: toTabular
});
const C6 = {
    ...Annotator,
    ...Gene,
    ...Oligos,
    ...Seq,
    ...Sim,
    ...Utils,
    ...Inventory,
    ...Manage,
    ...Query,
    ...IO
};