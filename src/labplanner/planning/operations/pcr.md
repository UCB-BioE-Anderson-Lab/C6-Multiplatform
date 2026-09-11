# PCR

*"You will receive a list of PCR steps from multiple CF's, and you are making the singular
labsheet with all those."* — JCA, 2026-09-10

Stage one already decided which PCRs share this sheet. Four things are left.

## 1. Mastermix or single reactions

**Four or more samples: mastermix. Fewer: single reactions.** `MASTERMIX_THRESHOLD = 4`, tested
with `>=`.

JCA ruled on this 2026-09-10 after two statements of it disagreed at exactly 4 — *"When there are
>=4 samples, that's when you consider doing a mastermix"* against *"If it is more than 4, you do
mastermix"*. **`>=4` is right.** Recorded because 4 is a common batch size and the next person to
read the looser phrasing will reach for `>`.

## 2. What goes into the mastermix

*"if the samples differ only by the template, then everything but the template goes into the
mastermix. This step can be done with code precisely."*

The general rule, of which that is the common case: **a component belongs in the mastermix iff
every sample in this bin takes the same value for it.** Anything that varies stays out and is
added per tube. Six samples sharing one primer pair and differing by template → mastermix holds
water, buffer, dNTPs, both primers and enzyme. Samples differing by primer *and* template →
mastermix holds water, buffer, dNTPs and enzyme only.

Set arithmetic over the jobs in the bin. `makeMastermixPlan.js`. Scale by count × excess.

## 3. How to array it — **an LLM decides this**

*"for <8 samples, do single pcr tubes. For multiples of 8, do PCR strips. For more samples,
maybe a 96-well plate. Nothing larger, but all 3 are valid options. This decision should be made
by an LLM. The layout of the samples in a plate it matters a lot the context."*

Three formats, and **nothing larger than a 96-well plate**.

**Why this is judgement and not a size lookup:** *"For example, if all your templates are in a
96-well plate, you want to preserve that footprint. It generally helps too to make the rows and
columns meaningful in the experiment."* A layout that matches where the templates already sit
turns eight pipetting decisions into one multichannel movement, and a layout whose rows mean
something makes a mis-set tube visible. Neither is recoverable from the sample count.

How the sample is identified depends on the format, and the labsheet must give the right one:

| format | what identifies a sample |
|---|---|
| single tubes | a label to write on the cap — **under 3 characters, and specific to this experiment.** Not just "A" |
| strips | one character per tube, letters in order |
| 96-well plate | the well address *is* the information |

## 4. The thermocycler program

*"simulate the cf, look at the pcr product, get its size. Divide by 1000 and round up. That
number is x. Insert that number into 'PGxK55' is typically what you want, where 55 is the
annealing temperature."*

    x = ceil(product length in bp / 1000)          from the C6 simulation, not from a guess
    program = PG<x>K<anneal>

**PG is PrimeSTAR.** The bare numeric programs — `45`, `55` — are the Taq ones.

Two departures from the default, both forced by the chemistry:

- **Degenerate oligos → anneal at 45, not 55.** *"When doing degenerate oligos (not all bases in
  the oligos are in [ATCG]), I will typically use a 45 degree anneal instead, so PGxK45."*
  Detectable exactly: any base outside `ACGT` in either primer.
- **Short products → Taq, not PrimeSTAR.** *"For really short sequences, like <250 bp, I would
  recommend a Taq reaction instead of primestar."* **This changes the recipe, not just the
  program** — *"different enzyme and buffer, same dntps."* A labsheet that switches the program
  and keeps the PrimeSTAR reaction is wrong in a way that looks right.

`pcrProductSize.js` and `choosePCRProgram.js`. All of this is exact; none of it is judgement.

**A size that could not be computed stays `null` and the program stays blank.** `simCF` rejects
any primer whose 3'-most 18 bases do not match exactly, which excludes site-removal mutagenic
primers — pGhost17 is in the freezer and cannot be simulated. A default of 1 kb there would set
an extension time wrong by 8 kb on a real experiment, so the tool says what it does not know.

## Built, and not built

| | |
|---|---|
| product size | `pcrProductSize.js` — simulates the file once, measures every product |
| program and chemistry | `choosePCRProgram.js` |
| mastermix composition | `makeMastermixPlan.js` |
| **the array — tubes, strips or plate** | **nothing. § 3 above is the whole specification** |
| **the Taq recipe** | **nothing.** `protocols/modules/` has `primestar_pcr.js` and no Taq module, so a sheet can say to use Taq and cannot yet say with what. That module is the missing piece, and inventing its volumes here would be worse than the gap |
