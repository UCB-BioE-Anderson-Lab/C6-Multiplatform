# Culture

**Growing picked colonies to the density an assay needs.** The step between picking and
measuring, and the one most often left implicit — which is how an assay comes to be run on
cultures that never saturated.

## What has to be on the sheet

**The vessel and the volume**, because they decide everything downstream: a 24-well block at
4 mL is not a culture tube at 5 mL, and the assay's transfer volume assumes one of them.

**The medium, with selection.** A culture grown without the antibiotic has lost the thing being
measured, and nothing later in the experiment can tell.

**The temperature**, which is not always the cloning temperature — *L. lactis* grows at 30 °C,
and a block left at 37 °C overnight is a failed session nobody notices until the assay.

**Which wells are the controls**, laid out explicitly, and **in which medium** — they are not
all the same. The untransformed host grows WITHOUT selection, because it cannot survive with it;
a control plated on the same antibiotic as the samples is not a control, it is an empty well.
The parent-plasmid positive does carry selection, like the samples.

They are **inoculated here, not picked** (§ `pick.md` — a control plate offers nothing to select
between). One well each, from the restreak. And they must be grown in the same block at the same
time as the samples they will be compared against.

## The check worth writing down

**Did they saturate?** `plate_reader_fluorescence` opens by saying so: *"Check the cultures grew
and are fluorescent before you do anything else. A well that did not grow is not a weak promoter,
it is a failed culture, and the two look identical once the numbers are in a spreadsheet."*

That belongs on the Culture sheet as well as the Assay sheet, because by the time somebody is
reading the plate it is too late to fix.
