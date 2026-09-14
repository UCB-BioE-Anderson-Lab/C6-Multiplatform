// Whether a transformation gets a verification chain, and how wide.
//
// A cloning transformation produces a plate of colonies that are not yet known to be anything.
// Pick, miniprep, sequence, read the traces: four steps that no construction file contains and
// every experiment needs. The decision is whether to add them — not how, which is
// `injectVerification.js`.
//
// Rules are tried in order and the first that applies wins. `c6-rules verification` prints this
// file.
import { apply, named } from './lib.js';

export const TITLE = 'Whether a transformation gets a verification chain';

/** The operations a verification chain follows. */
export const VERIFY_AFTER = ['transform'];

/** How many colonies to pick from a cloning transformation. */
export const CLONE_PICKS = 4;

/** The four steps that ARE a verification chain, when a characterization file writes them itself. */
export const CHAIN = ['pick', 'miniprep', 'sequencing', 'analysis'];


// ════ FACTS ═════════════════════════════════════════════════════════════════════════════════════

// name:  followsAVerifiableStep
// when:  this session is one of the operations a chain follows
// then:  true or false
// why:   Only a transformation leaves colonies whose identity is unknown. A gel or a cleanup
//        produces a tube you already know the contents of, so there is nothing to verify.
//
//        The list is overridable, because which steps leave an unverified product is a fact about
//        a lab's workflow rather than about cloning.
// source: inferred — a toolkit decision
export const followsAVerifiableStep = {
  of: ({ operation, verifyAfter }) => (verifyAfter || VERIFY_AFTER).includes(operation),
};

// name:  alreadyDeclared
// when:  a characterization file already writes a verification step on this transform's product
// then:  true or false
// why:   A characterization file may name these four steps itself, and where it does, injecting a
//        second set puts two picks and two minipreps on one plan.
//
//        The test is whether a DECLARED step consumes this transform's product — not whether a
//        `pick` exists anywhere, because a characterization file picks twice: once off the cloning
//        plate and once off the retransformation, and only the first is verification.
//
//        And only a declared step from the CHAIN counts. `Retransform pGOLD` also consumes the
//        transform's product and is not verification; reading any consumer as one made the whole
//        chain vanish from an experiment that declares a retransform and nothing else.
// source: stated 2026-09-12 — "Fold it into the characterization file." The chain-membership test
//         is a toolkit decision, from the retransform bug.
export const alreadyDeclared = {
  of: ({ jobs, declaredConsumers }) =>
    (jobs || []).length > 0 && (jobs || []).every((j) => declaredConsumers.has(j.output)),
};


// ════ RULES ═════════════════════════════════════════════════════════════════════════════════════

// name:  nothing to verify
// when:  this session is not a transformation
// then:  no chain
// why:   The step's product is already known. Only a plate of colonies is a question.
// source: inferred
// eg:    pcr
export const nothingToVerify = {
  alone: true,
  applies: ({ followsAVerifiableStep }) => !followsAVerifiableStep,
  decide: () => ({ inject: false }),
  says: () => null,
};

// name:  the file does it itself
// when:  a characterization file already picks, minipreps or sequences this transform's product
// then:  no chain — the declared one is the chain
// why:   Declared beats injected. Two picks and two minipreps on one plan is not a redundancy a
//        person notices at the bench; it is two sets of tubes with nearly identical labels.
// source: stated 2026-09-12 — "Fold it into the characterization file."
// eg:    transform, declared
export const fileDoesItItself = {
  alone: true,
  applies: ({ alreadyDeclared }) => alreadyDeclared,
  decide: () => ({ inject: false }),
  says: () => null,
};

// name:  inject the chain
// when:  a transformation whose product nothing downstream verifies
// then:  pick four colonies, miniprep them, sequence them, read the traces
// why:   Four is enough that a single bad clone does not cost the experiment a week, and few
//        enough to handle as individual tubes rather than a block.
//
//        The chain is INJECTED rather than offered because a plan that silently omitted it would
//        read as an experiment that does not need verification, and every experiment does.
// source: inferred — CLONE_PICKS is the toolkit's default; that the chain is injected rather than
//         offered follows from the construction-file grammar, which has no way to say it
// eg:    transform
export const injectTheChain = {
  applies: () => true,
  decide: ({ picks }) => ({ inject: true, picks: picks ?? CLONE_PICKS }),
  says: () => null,
};


export const FACTS = named({ followsAVerifiableStep, alreadyDeclared });

export const RULES = named({ nothingToVerify, fileDoesItItself, injectTheChain });

/** The first rule that applies, and what it decided. → `lib.js § apply` */
export const choose = (facts) => apply({ FACTS, RULES }, facts);

/** What a `// eg:` means here: an operation, optionally with a declared chain already on it. */
export const egFacts = (eg) => {
  const s = String(eg).trim();
  const declared = /declared/.test(s);
  return { operation: s.split(',')[0].trim(),
           jobs: [{ output: 'pX' }],
           declaredConsumers: new Set(declared ? ['pX'] : []) };
};
