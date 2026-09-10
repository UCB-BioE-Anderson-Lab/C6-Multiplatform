// src/labplanner/render/labsheetHtml.js
//
// Render a LabPacket as print-ready HTML — the thing a student carries into the lab.
//
// WHY HTML AND NOT A PDF LIBRARY. JCA: *"You will have to make the code that formats the pdf
// from the labsheet instance."* The output here is a page; turning a page into a PDF is one
// Chrome invocation:
//
//     "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
//        --headless --disable-gpu --no-pdf-header-footer \
//        --print-to-pdf=out.pdf file:///abs/path/labsheet.html
//
// Adding puppeteer or a PDF toolkit would put ~300 MB of browser into a synthetic-biology
// library that every other consumer would then carry. C6 has three devDependencies and should
// keep having three. HTML is also what the tutorials site already renders, so one renderer
// serves both the screen and the page.
//
// WHAT THIS IS FITTED TO. `docs/LABSHEET-TRANSLATION.md`, from a labsheet that worked:
// iGEM-Synthera-Spr26-SLIP4_7. A labsheet is three grammars, not one —
//   A  operation tabs: source / samples / Reaction / Notes
//   B  decision tabs:  a conditional walk with lookup tables (Dilutions)
//   C  protocol tabs:  numbered steps, a plate layout, and a table the student fills in
// All three are rendered. Kinds B and C carry `blocks[]`, which is deliberately a faithful
// sequence of what was on the tab rather than a model of what it means — see § NOT MODELLED.
//
// NOT MODELLED, AND SAID SO RATHER THAN FAKED: the branch in a kind-B tab is text here, not a
// decision the software understands. Rendering it correctly is not the same as knowing what it
// says. Anything that later wants to REASON about "do I need to make dilutions" needs a real
// representation, and this is not it.

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------------------------------------------------------------------------
// PROTOCOL TRANSCLUSION
//
// JCA, 2026-09-10: *"many protocols will be verbatim the same as ones used in C6-Tools. Like,
// if it is sufficient to just point to one of those and then transclude it during rendering to
// explain what needs to be done, you do that. Otherwise, if it is something bespoke, you should
// be able to have a custom protocol in a lab sheet. You can also make inclusion of protocols on
// the rendered labsheet optional."*
//
// So a sheet says WHICH protocol, not WHAT it is:
//   metadata.module + metadata.values   -> a shared module in ../protocols/modules/
//   sheet.protocol                      -> bespoke markdown, for the one-off case
// and `renderLabPacketHtml(packet, {protocols: false})` leaves them all out — the short form a
// student who has done this ten times wants, off the same instance as the long one.
//
// The parameters line up with what the labsheets already record: Zymo's `elution_volume` column
// is the module's `elution_uL`. That is not a coincidence to be proud of, it is evidence the
// modules were written from these labsheets in the first place.

// Minimal markdown: bold, italic, bullets, numbered lists, paragraphs. Deliberately small —
// the protocol templates use exactly these, and a general markdown dependency for six features
// would be the same mistake as pulling in a PDF toolkit.
function md(text) {
  const inline = (t) => esc(t)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<i>$2</i>');
  const out = [];
  let list = null;                       // 'ul' | 'ol' | null
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) { close(); continue; }
    const ul = line.match(/^(\s*)-\s+(.*)$/);
    const ol = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (ul) {
      if (list !== 'ul') { close(); out.push('<ul>'); list = 'ul'; }
      out.push(`<li>${inline(ul[2])}</li>`);
    } else if (ol) {
      if (list !== 'ol') { close(); out.push('<ol>'); list = 'ol'; }
      out.push(`<li>${inline(ol[3])}</li>`);
    } else if (list) {
      // a continuation line inside a list item, which these templates use heavily
      out[out.length - 1] = out[out.length - 1].replace(/<\/li>$/, ' ' + inline(line.trim()) + '</li>');
    } else {
      out.push(`<p>${inline(line.trim())}</p>`);
    }
  }
  close();
  return out.join('\n');
}

/**
 * The protocol body for one sheet, or ''. -> {name, description, body} | null
 *
 * `modules` is a map of id -> module namespace, supplied by the caller. It is NOT imported
 * here: this file must render a packet without a filesystem, so the tutorials site and a CLI
 * can both use it. A named module that is not supplied is REPORTED on the page rather than
 * skipped — a labsheet silently missing its protocol is a student standing at a bench with
 * half an instruction.
 */
function protocolFor(sheet, modules) {
  if (sheet.protocol) {
    return { name: sheet.protocol.name || 'Protocol', description: sheet.protocol.description || '',
             body: md(sheet.protocol.markdown || sheet.protocol.text || '') };
  }
  const id = (sheet.metadata || {}).module;
  if (!id) return null;
  const mod = modules && modules[id];
  if (!mod || typeof mod.factory !== 'function') {
    return { name: id, description: '',
             body: `<p class="missing">This sheet names the protocol <b>${esc(id)}</b>, which was `
                 + `not available when this page was rendered. Do not proceed from memory — `
                 + `fetch it before starting.</p>` };
  }
  const built = mod.factory((sheet.metadata || {}).values || {});
  return { name: built.name || id, description: built.description || '', body: md(built.template) };
}

function table(rows, opts = {}) {
  if (!rows || !rows.length) return '';
  const [head, ...body] = opts.headerless ? [null, ...rows] : rows;
  const cols = Math.max(...rows.map((r) => r.length));
  const cell = (v, tag) => `<${tag}>${esc(v)}</${tag}>`;
  const pad = (r) => Array.from({ length: cols }, (_, i) => r[i] ?? '');
  return '<table>'
    + (head ? `<thead><tr>${pad(head).map((c) => cell(c, 'th')).join('')}</tr></thead>` : '')
    + `<tbody>${body.map((r) => `<tr>${pad(r).map((c) => cell(c, 'td')).join('')}</tr>`).join('')}</tbody>`
    + '</table>';
}

// A capture table is one whose trailing columns are empty on every row — the student fills them
// in. Rendering those cells as visibly blank boxes is the whole point of printing the sheet, and
// getting it wrong (collapsing them, or dropping the columns) removes the place the data goes.
function isCaptureTable(rows) {
  if (!rows || rows.length < 2) return false;
  const cols = rows[0].length;
  const body = rows.slice(1);
  let blankTail = 0;
  for (let c = cols - 1; c >= 0; c--) {
    if (body.every((r) => !String(r[c] ?? '').trim())) blankTail++;
    else break;
  }
  return blankTail > 0 && blankTail < cols;
}

function renderBlock(b) {
  switch (b.kind) {
    case 'heading':   return `<h3>${esc(b.text)}</h3>`;
    case 'text':      return `<p>${esc(b.text)}</p>`;
    case 'step':      return `<li>${esc(b.text)}</li>`;
    case 'table':     return table(b.rows, {})
                             + (isCaptureTable(b.rows)
                                ? '<p class="capture-note">Blank cells are yours to fill in.</p>'
                                : '');
    case 'grid':      return `<div class="grid">${table(b.rows, {})}</div>`;
    default:          return '';
  }
}

function renderSteps(blocks) {
  // Numbered steps are consecutive `step` blocks; anything between them breaks the run, because
  // a table sitting inside a procedure belongs where it was, not collected at the end.
  const out = [];
  let run = [];
  const flush = () => { if (run.length) { out.push(`<ol>${run.join('')}</ol>`); run = []; } };
  for (const b of blocks) {
    if (b.kind === 'step') run.push(renderBlock(b));
    else { flush(); out.push(renderBlock(b)); }
  }
  flush();
  return out.join('\n');
}

function sheetHtml(sheet, opts) {
  const m = sheet.metadata || {};
  const parts = [`<section class="sheet"><h2>${esc(sheet.title)}</h2>`];
  const meta = [
    m.module ? `protocol: <b>${esc(m.module)}</b>` : '',
    m.program ? `program: <b>${esc(m.program)}</b>` : '',
    m.thermocycler ? `thermocycler: ______` : '',
  ].filter(Boolean);
  if (meta.length) parts.push(`<p class="meta">${meta.join(' &nbsp;·&nbsp; ')}</p>`);

  // A bare `source:` note — "Enzyme freezer pcr rack \"to Zymo\"" — is WHERE TO FETCH FROM, and
  // some tabs carry only that instead of a table. It was captured into metadata and not printed,
  // which loses the one instruction on the page a student needs before they can start.
  if (m.source_note || m.sources_note) {
    parts.push(`<h3>Source</h3><p>${esc(m.source_note || m.sources_note)}</p>`);
  }
  if (sheet.inputs && sheet.inputs.length) {
    parts.push('<h3>Source</h3>');
    parts.push(table([Object.keys(sheet.inputs[0]),
                      ...sheet.inputs.map((r) => Object.values(r))]));
  }
  if (sheet.samples && sheet.samples.length) {
    parts.push('<h3>Samples</h3>');
    parts.push(table([Object.keys(sheet.samples[0]),
                      ...sheet.samples.map((r) => Object.values(r))]));
  }
  if (sheet.recipe && sheet.recipe.components && sheet.recipe.components.length) {
    parts.push('<h3>Reaction</h3>');
    parts.push(table([['', 'component', ''],
      ...sheet.recipe.components.map((c) => [c.volume_uL ?? '', c.name ?? '', c.code ?? ''])]));
  }
  if (sheet.blocks && sheet.blocks.length) parts.push(renderSteps(sheet.blocks));
  // A preamble is a note that belongs to this sheet rather than a step of its own — JCA on
  // the Dilutions tab: "I'd call B a note within another labsheet." It prints before the work,
  // because it is what you check before starting.
  if (sheet.preamble && sheet.preamble.blocks && sheet.preamble.blocks.length) {
    parts.push(`<div class="preamble"><h3>${esc(sheet.preamble.title || 'Before you start')}</h3>`);
    parts.push(renderSteps(sheet.preamble.blocks));
    parts.push('</div>');
  }
  if (opts.protocols) {
    const proto = protocolFor(sheet, opts.modules);
    if (proto) {
      parts.push(`<h3>Protocol — ${esc(proto.name)}</h3>`);
      if (proto.description) parts.push(`<p class="meta">${esc(proto.description)}</p>`);
      parts.push(`<div class="protocol">${proto.body}</div>`);
    }
  }
  if (sheet.notes && sheet.notes.length) {
    parts.push('<h3>Notes</h3><ul>' + sheet.notes.map((n) => `<li>${esc(n)}</li>`).join('') + '</ul>');
  }
  // A checkpoint prints as an instruction the student can act on with a pen and an email
  // client. That is the whole delivery mechanism — it replaces "copy this table into <a Google
  // Sheets URL>", which is what the original does today.
  if (sheet.checkpoint) {
    parts.push(`<div class="checkpoint"><b>Checkpoint.</b> When this table is filled in, email it
      to <b>jca-cortex@berkeley.edu</b> and put this line in the message:<br>
      <code>cortex::${esc(sheet.checkpoint.code)}</code>
      ${sheet.checkpoint.expects ? `<br><span class="expects">Expected: ${esc(sheet.checkpoint.expects)}</span>` : ''}
      </div>`);
  }
  parts.push('</section>');
  return parts.join('\n');
}

const CSS = `
:root { --ink:#111; --rule:#bbb; }
* { box-sizing: border-box; }
body { font: 11pt/1.45 -apple-system, Helvetica, Arial, sans-serif; color: var(--ink);
       margin: 0; padding: 0; }
h1 { font-size: 17pt; margin: 0 0 2pt; }
h2 { font-size: 14pt; margin: 0 0 6pt; border-bottom: 2px solid var(--ink); padding-bottom: 3pt; }
h3 { font-size: 11pt; margin: 12pt 0 4pt; text-transform: uppercase; letter-spacing: .04em; }
p { margin: 4pt 0; }
.meta { color:#444; margin: 0 0 8pt; }
.packet-head { margin: 0 0 14pt; padding-bottom: 6pt; border-bottom: 1px solid var(--rule); }
.sheet { page-break-after: always; padding: 14mm 14mm 10mm; }
.sheet:last-child { page-break-after: auto; }
table { border-collapse: collapse; width: 100%; margin: 4pt 0 8pt; font-size: 10pt; }
th, td { border: 1px solid var(--rule); padding: 3pt 5pt; text-align: left; vertical-align: top; }
th { background: #f2f2f2; font-weight: 600; }
/* An empty cell must LOOK like somewhere to write, or a printed capture table is invisible. */
td:empty { height: 20pt; background: repeating-linear-gradient(
             transparent, transparent 19pt, #e8e8e8 19pt, #e8e8e8 20pt); }
ol { margin: 4pt 0 8pt 18pt; padding: 0; } li { margin: 2pt 0; }
ul { margin: 4pt 0 8pt 16pt; }
.grid table { width: auto; } .grid td, .grid th { text-align: center; min-width: 46pt; }
.capture-note { font-size: 9pt; color: #555; margin-top: -4pt; }
.checkpoint { border: 1.5pt solid var(--ink); padding: 7pt 9pt; margin: 10pt 0 0;
              page-break-inside: avoid; }
.checkpoint code { font-size: 11pt; font-weight: 700; }
.expects { color:#444; font-size: 9.5pt; }
.protocol { font-size: 10pt; }
.preamble { border-left: 3pt solid var(--rule); padding: 2pt 0 2pt 10pt; margin: 8pt 0; }
.protocol ol, .protocol ul { margin: 3pt 0 6pt 18pt; }
.protocol li { margin: 1.5pt 0; }
.missing { border: 1pt solid #a00; color: #a00; padding: 5pt 7pt; }
@page { size: letter; margin: 0; }
@media print { .sheet { padding: 12mm 14mm; } }
`;

/**
 * @param {Object} packet  a LabPacket: {id, metadata, sheets[]}
 * @returns {string} a complete HTML document, ready to print
 */
export function renderLabPacketHtml(packet, options = {}) {
  // Protocols are INCLUDED by default: a labsheet that silently omits how to do the thing is
  // the more dangerous default, and somebody choosing the short form is making a choice.
  const opts = { protocols: options.protocols !== false, modules: options.modules || {} };
  const m = packet.metadata || {};
  return `<!doctype html>
<html><head><meta charset="utf-8">
<title>${esc(m.title || packet.id)}</title>
<style>${CSS}</style></head>
<body>
<section class="sheet">
  <div class="packet-head">
    <h1>${esc(m.title || packet.id)}</h1>
    <p class="meta">${esc(m.experiment || '')}${m.source ? ` &nbsp;·&nbsp; from ${esc(m.source)}` : ''}</p>
  </div>
  ${(packet.sheets || []).map((s, i) => `<p>${i + 1}. ${esc(s.title)}</p>`).join('')}
</section>
${(packet.sheets || []).map((s) => sheetHtml(s, opts)).join('\n')}
</body></html>`;
}
