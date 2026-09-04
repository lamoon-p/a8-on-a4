/* Browser glue. All geometry lives in lib.js; all PDF work is pdf-lib in this tab. */
const { PDFDocument, rgb } = PDFLib;

const items = [];               // { name, doc, pages: [{w,h}] } in the order the browser gave us
const $ = (id) => document.getElementById(id);

const drop = $('drop');
const fileInput = $('file');
const listEl = $('list');
const warnEl = $('warn');
const countEl = $('count');
const goBtn = $('go');
const statusEl = $('status');

drop.addEventListener('click', () => fileInput.click());
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => {
  e.preventDefault();
  drop.classList.remove('over');
  addFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', () => { addFiles(fileInput.files); fileInput.value = ''; });
$('clear').addEventListener('click', () => { items.length = 0; render(); });
goBtn.addEventListener('click', build);

async function addFiles(fileList) {
  status('Reading…');
  // Snapshot first. fileInput.files is live, and the change handler clears it the moment
  // this function hits its first await — iterating the live list drops every file but one.
  for (const f of Array.from(fileList)) {           // no sorting: browser order, by design
    if (!/\.pdf$/i.test(f.name)) { items.push({ name: f.name, error: 'not a PDF' }); continue; }
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pages = doc.getPages().map((p) => p.getSize());
      if (!pages.length) { items.push({ name: f.name, error: 'no pages' }); continue; }
      items.push({ name: f.name, doc, pages });
    } catch (err) {
      items.push({ name: f.name, error: (err && err.message) || 'could not be read' });
    }
  }
  status('');
  render();
}

const totalCells = () => items.reduce((n, it) => n + (it.pages ? it.pages.length : 0), 0);

function render() {
  const n = totalCells();
  const sheets = A8.sheetCount(n);
  const blanks = sheets * A8.PER_SHEET - n;

  listEl.innerHTML = '';
  let cell = 0;
  for (const it of items) {
    const li = document.createElement('li');
    if (it.error) {
      li.className = 'bad';
      li.textContent = `— ${it.name} — skipped: ${it.error}`;
    } else {
      const first = cell + 1, last = cell + it.pages.length;
      cell = last;
      li.textContent = `${first === last ? first : `${first}–${last}`}. ${it.name}`;
    }
    listEl.appendChild(li);
  }

  const odd = [];
  for (const it of items) {
    if (!it.pages) continue;
    it.pages.forEach((p, i) => {
      if (!A8.isA4Portrait(p.width, p.height)) {
        odd.push(`${it.name}${it.pages.length > 1 ? ` p.${i + 1}` : ''} — ${mm(p.width)}×${mm(p.height)} mm`);
      }
    });
  }
  warnEl.innerHTML = odd.length
    ? `<strong>Not A4 portrait — fitted and centred instead:</strong><br>${odd.join('<br>')}`
    : '';
  warnEl.hidden = !odd.length;

  countEl.textContent = n
    ? `${n} code${n === 1 ? '' : 's'} → ${sheets} sheet${sheets === 1 ? '' : 's'}` +
      (blanks ? `, ${blanks} blank spot${blanks === 1 ? '' : 's'} on the last one` : ', exactly full')
    : 'Nothing loaded yet.';
  goBtn.disabled = n === 0;
}

const mm = (pt) => (pt / A8.MM).toFixed(0);
const status = (s) => { statusEl.textContent = s; };

async function build() {
  goBtn.disabled = true;
  status('Building…');
  try {
    const out = await PDFDocument.create();
    const grid = A8.gridLines();
    const line = rgb(0.72, 0.72, 0.72);

    // Embed every page of every source, in order.
    const embedded = [];
    for (const it of items) {
      if (!it.doc) continue;
      const pages = await out.embedPdf(it.doc, it.doc.getPageIndices());
      embedded.push(...pages);
    }

    const sheets = A8.sheetCount(embedded.length);
    for (let s = 0; s < sheets; s++) {
      const sheet = out.addPage([A8.A4.w, A8.A4.h]);
      for (const g of grid) {
        sheet.drawLine({ start: { x: g.x1, y: g.y1 }, end: { x: g.x2, y: g.y2 }, thickness: 0.25, color: line });
      }
      for (let i = 0; i < A8.PER_SHEET; i++) {
        const ep = embedded[s * A8.PER_SHEET + i];
        if (!ep) break;
        const box = A8.cellBox(i);
        const pos = A8.place(ep.width, ep.height, box);
        sheet.drawPage(ep, { x: pos.x, y: pos.y, xScale: pos.scale, yScale: pos.scale });
      }
    }

    const bytes = await out.save();
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `a8-on-a4-${embedded.length}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    status(`Done — ${embedded.length} codes on ${sheets} sheet${sheets === 1 ? '' : 's'}.`);
  } catch (err) {
    status(`Failed: ${(err && err.message) || err}`);
  }
  goBtn.disabled = totalCells() === 0;
}

render();
