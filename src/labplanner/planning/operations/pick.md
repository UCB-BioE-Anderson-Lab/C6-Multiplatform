# Picking colonies

Two decisions, and **both are conversations**. — JCA, 2026-09-10

## 1. Selection criteria

*"Criteria for selection should be discussed with user and included."*

What counts as a colony worth picking is experiment-specific — colour, size, which plate, whether
satellites are a risk — and it has to be **written on the sheet**, not held by whoever poured the
plates. Ask, then put the answer in the sheet in the words that will make sense at the bench.

## 2. How many

*"Number of colonies needs to be decided. I usually say 4, but for libraries this gets more
complicated. Another thing to discuss with user."*

**4 is the default for a clone.** A library is a different question entirely — the number depends
on what coverage the library needs, and no default is safe. SynThera's SLIP4-6 makes six
degenerate libraries at once; that is exactly the case where guessing 4 would be quietly wrong.

## The format follows the count

| samples | vessel |
|---|---|
| fewer than 4 | 15 mL conicals |
| 4 or more | a 24-well block |

*"I think I'm starting to repeat things already in the protocol docs"* — and that is the right
instinct. Where `protocols/modules/` already says how to do this, the labsheet should transclude
it rather than restate it, and this file should only carry what is decided per experiment.

## There is always a checkpoint

*"There will always be checkpoints about plate picks from this."* `checkpoint.plate` — a photo of
each plate and the colony counts. Not conditional.


## A control plate is not picked from

JCA, 2026-09-11, looking at a 24-well layout with four wells of "untransformed": *"there is no
reason to pick untransformed colonies. makes no sense."*

**Picking means selecting AMONG candidates.** On a transformation plate the colonies differ —
some carry the construct, some are satellites, some are wrong — and choosing between them is the
whole operation. A control plate offers nothing to choose between: every colony on it is the
same thing. Four picked wells of it are four copies of one measurement wearing the costume of
four.

**So the controls are plated at the retransformation, and inoculated at the culture — picked
from at neither.** One well each, from the restreak, at the Culture step. That is also where the
medium differs: the untransformed control grows without selection, because it cannot survive
with it, and a control plated on the same antibiotic as the samples is not a control, it is an
empty well.

**What this changes on the sheet:** the pick table has rows for the construct's clones only. The
control wells belong to the Culture layout, which is where somebody deciding a 24-well block
needs to see them.
