# Stateless Inventory (JS, first draft)

This version keeps **C6-multiplatform** stateless and functional:
- No persistence, no localStorage, no globals.
- All functions take an `inventory` object and **return a cloned, updated inventory**.
- The `inventory` encodes both **data** and **index maps** for fast queries.

## Files
- `inventory.js` — **model + pure updates** (create, clone, add/remove/move/upsert).
- `manage.js` — **placement & validation policies** (find next well, assign positions).
- `query.js` — **read-only lookups & ranking** (choose samples under constraints).
- `io.js` — **parsing/serialization** (JSON, TSV, multi-block grids).

## Inventory shape
```ts
type Location = { boxname:string, row:number, col:number, label:string, sidelabel:string };
type Box = { name:string, rows:number, cols:number };

type Inventory = {
  // --- Core data ---
  boxes: Record<string, Box>,
  // Samples keyed by Location key "box:r:c"
  samples: Record<string, {
    location: Location,
    construct: string,
    concentration?: string,   // e.g., 'uM10','uM100','zymo','miniprep','dil20x'
    clone?: string,
    strain?: string,          // the host cells — an identifier, resolved elsewhere
    culture?: string,         // e.g., 'primary','secondary','tertiary','library'
    type?: string,            // oligo, plasmid, gBlock, amplicon, buffer, etc.
    metadata?: Record<string, any>
  }>,
  // --- Indices (derived for fast queries) ---
  construct_to_locations: Record<string, Set<string>>, // lowercased construct -> Set(locKey)
  loc_to_conc: Record<string, string>,                 // locKey -> concentration
  loc_to_clone: Record<string, string>,                // locKey -> clone
  loc_to_culture: Record<string, string>               // locKey -> culture
}
```
All indices are **derived** and updated by pure helpers.

## Notes
- All updates are immutable: functions take an `Inventory` and return a **new cloned Inventory**.
- Concentration/culture fields are left as strings for flexibility; your app can freeze constants or add validation if desired.
- **`strain` is a name, not a record.** It holds an identifier for the host cells and nothing else;
  resolving it is somebody else's job, and what it resolves to may be markdown, a URL or a JSON
  genotype. There is deliberately no Strain schema here — a Keio entry, a lab-made knockout and a
  competent-cell stock have no description in common that is worth committing to. This follows
  Clotho b, where `StrainSample` carried a pointer rather than a type.
- **`strain` is not `culture`.** `culture` is the serial culture *stage* and is read by
  `labplanner/rules/cultureStage.rules.js` to rank minipreps. Putting a strain name in it does not
  corrupt the ranking — a non-stage scores 0, the same as blank — but it does mean the strain is
  recorded in a field nothing will look for it in.
- `io.js` parser supports the `>>` multi-block grid format you use in cloning-tutorials.
- Spreadsheet export emits a tidy array-of-rows with `box,row,col,well,construct,label,side-label,...`.

Inventories provide the bridge between CF operations (PCR, Gibson, etc.) and physical sample management.
