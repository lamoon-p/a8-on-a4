// node test.js [real.pdf ...]   — no framework, no fixtures committed.
const assert = require('assert');
const zlib = require('zlib');
const fs = require('fs');
const A8 = require('./lib.js');
const { PDFDocument, rgb } = require('./vendor/pdf-lib.min.js');

const mm = (pt) => pt / A8.MM;
const near = (a, b, tol, what) =>
  assert.ok(Math.abs(a - b) <= tol, `${what}: got ${a}, expected ${b} (±${tol})`);
let n = 0;
const test = (name, fn) => { n++; return Promise.resolve(fn()).then(() => console.log(`  ok  ${name}`)); };

(async () => {

await test('cell is 50 x 71.75 mm and there are 16 of them', () => {
  assert.strictEqual(A8.PER_SHEET, 16);
  const c = A8.cellBox(0);
  near(mm(c.w), 50, 0.001, 'cell width mm');
  near(mm(c.h), 71.75, 0.001, 'cell height mm');
});

await test('cells fill the safe area row-major, no gaps, no overlap', () => {
  const boxes = Array.from({ length: 16 }, (_, i) => A8.cellBox(i));
  // row-major: cell 0 top-left, cell 3 top-right, cell 12 bottom-left
  assert.ok(boxes[0].x < boxes[3].x, 'cell 3 is right of cell 0');
  near(boxes[0].y, boxes[3].y, 1e-9, 'cells 0 and 3 share a row');
  assert.ok(boxes[12].y < boxes[0].y, 'cell 12 is below cell 0');
  near(boxes[0].x, boxes[12].x, 1e-9, 'cells 0 and 12 share a column');
  // union must be exactly the inset rectangle
  const left = Math.min(...boxes.map(b => b.x));
  const right = Math.max(...boxes.map(b => b.x + b.w));
  const bottom = Math.min(...boxes.map(b => b.y));
  const top = Math.max(...boxes.map(b => b.y + b.h));
  near(mm(left), 5, 1e-9, 'left margin mm');
  near(mm(A8.A4.w - right), 5, 1e-9, 'right margin mm');
  near(mm(bottom), 5, 1e-9, 'bottom margin mm');
  near(mm(A8.A4.h - top), 5, 1e-9, 'top margin mm');
  // pairwise: no two cells overlap
  for (let i = 0; i < 16; i++) for (let j = i + 1; j < 16; j++) {
    const a = boxes[i], b = boxes[j];
    const over = a.x < b.x + b.w - 1e-9 && b.x < a.x + a.w - 1e-9 &&
                 a.y < b.y + b.h - 1e-9 && b.y < a.y + a.h - 1e-9;
    assert.ok(!over, `cells ${i} and ${j} overlap`);
  }
});

await test('an A4 page lands at 23.8095% and stays inside its cell', () => {
  const c = A8.cellBox(5);
  const p = A8.place(A8.A4.w, A8.A4.h, c);
  near(p.scale, 0.238095, 1e-6, 'A4 scale');
  near(mm(A8.A4.w * p.scale), 50, 0.001, 'placed width mm');
  near(mm(A8.A4.h * p.scale), 70.714, 0.01, 'placed height mm');
  assert.ok(p.x >= c.x - 1e-9 && p.x + A8.A4.w * p.scale <= c.x + c.w + 1e-9, 'fits horizontally');
  assert.ok(p.y >= c.y - 1e-9 && p.y + A8.A4.h * p.scale <= c.y + c.h + 1e-9, 'fits vertically');
  near(p.x - c.x, c.x + c.w - (p.x + A8.A4.w * p.scale), 1e-9, 'centred horizontally');
  near(p.y - c.y, c.y + c.h - (p.y + A8.A4.h * p.scale), 1e-9, 'centred vertically');
});

await test('the sample QR ends up 44.2 mm with a 1.52 mm module', () => {
  // measured from the real input: QR 185.7 mm wide, 29 modules, on a 210 mm page
  const s = A8.place(A8.A4.w, A8.A4.h, A8.cellBox(0)).scale;
  near(185.7 * s, 44.2, 0.1, 'QR mm');
  near((185.7 / 29) * s, 1.524, 0.01, 'module mm');
  assert.ok((185.7 / 29) * s > 0.33, 'module is above the ISO minimum');
});

await test('an odd page size is fitted and centred, not stretched', () => {
  const c = A8.cellBox(0);
  const land = A8.place(A8.A4.h, A8.A4.w, c);           // A4 landscape
  near(land.scale, c.w / A8.A4.h, 1e-9, 'landscape is width-bound: the long edge sets it');
  assert.ok(A8.A4.h * land.scale <= c.w + 1e-9, 'landscape fits the cell width');
  assert.ok(A8.A4.w * land.scale < c.h, 'landscape leaves the cell short, so it is centred vertically');
  assert.ok(land.y > c.y + 1e-6, 'landscape is centred, not sitting on the cell floor');
  const sq = A8.place(300, 300, c);                     // square
  near(sq.scale, c.w / 300, 1e-9, 'square is width-bound');
  near(sq.x, c.x, 1e-9, 'square touches both side edges');
  // A4 and anything wider is width-bound, so horizontal centring only bites on a page
  // taller than 1.435:1 — US Legal, receipts. Without this the centring maths is untested.
  const legal = A8.place(612, 1008, c);
  near(legal.scale, c.h / 1008, 1e-9, 'a tall page is height-bound');
  const gap = c.w - 612 * legal.scale;
  assert.ok(gap > 1, `tall page leaves a real horizontal gap (${gap.toFixed(2)}pt)`);
  near(legal.x - c.x, gap / 2, 1e-9, 'tall page is centred horizontally, not flush');
});

await test('sheet count rounds up', () => {
  const cases = [[0, 0], [1, 1], [14, 1], [16, 1], [17, 2], [30, 2], [32, 2], [33, 3]];
  for (const [codes, sheets] of cases) assert.strictEqual(A8.sheetCount(codes), sheets, `${codes} codes`);
});

await test('the grid is 10 lines spanning the safe area', () => {
  const g = A8.gridLines();
  assert.strictEqual(g.length, 10, '5 vertical + 5 horizontal');
  const v = g.filter(l => l.x1 === l.x2), h = g.filter(l => l.y1 === l.y2);
  assert.strictEqual(v.length, 5); assert.strictEqual(h.length, 5);
  for (const l of v) { near(mm(l.y1), 5, 1e-9, 'v line bottom'); near(mm(A8.A4.h - l.y2), 5, 1e-9, 'v line top'); }
  for (const l of h) { near(mm(l.x1), 5, 1e-9, 'h line left'); near(mm(A8.A4.w - l.x2), 5, 1e-9, 'h line right'); }
});

await test("jsPDF's A4 is recognised, other sizes are not", () => {
  assert.ok(A8.isA4Portrait(595.2799999999999727, 841.8899999999999864), 'jsPDF A4');
  assert.ok(A8.isA4Portrait(595.276, 841.890), 'nominal A4');
  assert.ok(!A8.isA4Portrait(841.890, 595.276), 'A4 landscape is not portrait');
  assert.ok(!A8.isA4Portrait(419.528, 595.276), 'A5 is not A4');
  assert.ok(!A8.isA4Portrait(612, 792), 'US Letter is not A4');
});

// ---- round trip through pdf-lib ------------------------------------------------

async function makeSource(label) {                       // stand-in for a real QR page
  const d = await PDFDocument.create();
  const p = d.addPage([A8.A4.w, A8.A4.h]);
  p.drawRectangle({ x: 34.6, y: 218, width: 526, height: 526, color: rgb(0, 0, 0) });
  p.drawText(label, { x: 60, y: 150, size: 24 });
  return d;
}

// Rebuild of app.js's build(), sharing the same lib.
async function tile(sources) {
  const out = await PDFDocument.create();
  const embedded = [];
  for (const s of sources) embedded.push(...await out.embedPdf(s, s.getPageIndices()));
  for (let sh = 0; sh < A8.sheetCount(embedded.length); sh++) {
    const sheet = out.addPage([A8.A4.w, A8.A4.h]);
    for (const g of A8.gridLines()) {
      sheet.drawLine({ start: { x: g.x1, y: g.y1 }, end: { x: g.x2, y: g.y2 }, thickness: 0.25, color: rgb(0.72, 0.72, 0.72) });
    }
    for (let i = 0; i < A8.PER_SHEET; i++) {
      const ep = embedded[sh * A8.PER_SHEET + i];
      if (!ep) break;
      const box = A8.cellBox(i);
      const pos = A8.place(ep.width, ep.height, box);
      sheet.drawPage(ep, { x: pos.x, y: pos.y, xScale: pos.scale, yScale: pos.scale });
    }
  }
  return { bytes: await out.save(), count: embedded.length };
}

// pdf-lib emits drawPage as `q / translate cm / scale cm / ... / Do / Q`, so the
// placement is spread over several matrices and has to be folded back together.
function placements(bytes) {
  const buf = Buffer.from(bytes);
  const whole = buf.toString('latin1');
  const found = [];
  const re = /stream\r?\n/g;
  let m;
  while ((m = re.exec(whole)) !== null) {
    const start = m.index + m[0].length;
    const end = buf.indexOf('endstream', start, 'latin1');
    if (end < 0) continue;
    let text;
    try { text = zlib.inflateSync(buf.subarray(start, end)).toString('latin1'); }
    catch { text = buf.subarray(start, end).toString('latin1'); }
    for (const block of text.split(/\bq\b/)) {
      // Only our placements. Real inputs carry their own `/I0 Do` inside the embedded
      // form stream, which is why matching any XObject name overcounts.
      if (!/\/EmbeddedPdfPage\S* Do\b/.test(block)) continue;
      // fold [a 0 0 d e f] matrices in written order: outer o then inner i
      let a = 1, d = 1, e = 0, f = 0;
      const cm = /(-?[\d.]+) 0 0 (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) cm/g;
      let c;
      while ((c = cm.exec(block)) !== null) {
        e = a * (+c[3]) + e;
        f = d * (+c[4]) + f;
        a = a * (+c[1]);
        d = d * (+c[2]);
      }
      found.push({ scale: a, yscale: d, x: e, y: f });
    }
  }
  return found;
}

await test('30 pages become 2 A4 sheets with 16 then 14 placements', async () => {
  const srcs = [];
  for (let i = 0; i < 30; i++) srcs.push(await makeSource(`code ${i + 1}`));
  const { bytes, count } = await tile(srcs);
  assert.strictEqual(count, 30, 'embedded page count');

  const back = await PDFDocument.load(bytes);
  assert.strictEqual(back.getPageCount(), 2, 'sheet count');
  for (const p of back.getPages()) {
    const s = p.getSize();
    near(s.width, A8.A4.w, 0.01, 'sheet width');
    near(s.height, A8.A4.h, 0.01, 'sheet height');
  }

  const place = placements(bytes);
  assert.strictEqual(place.length, 30, 'total placements in the content streams');
  for (const p of place) {
    near(p.scale, 0.238095, 1e-4, 'placement scale');
    near(p.yscale, 0.238095, 1e-4, 'placement scale is uniform');
  }
  // first sheet's 16 placements must match the 16 cell origins exactly
  const expected = Array.from({ length: 16 }, (_, i) => A8.place(A8.A4.w, A8.A4.h, A8.cellBox(i)));
  for (let i = 0; i < 16; i++) {
    near(place[i].x, expected[i].x, 1e-3, `cell ${i} x`);
    near(place[i].y, expected[i].y, 1e-3, `cell ${i} y`);
  }
  // second sheet restarts at cell 0 and stops after 14
  near(place[16].x, expected[0].x, 1e-3, 'sheet 2 restarts top-left');
  near(place[16].y, expected[0].y, 1e-3, 'sheet 2 restarts top-left');
  near(place[29].x, expected[13].x, 1e-3, 'last code sits in cell 13');
});

await test('a multi-page source contributes one cell per page', async () => {
  const multi = await PDFDocument.create();
  for (let i = 0; i < 3; i++) multi.addPage([A8.A4.w, A8.A4.h]).drawText(`p${i}`, { x: 50, y: 50, size: 20 });
  const { count, bytes } = await tile([multi, await makeSource('x')]);
  assert.strictEqual(count, 4, '3 pages + 1 page = 4 cells');
  assert.strictEqual(placements(bytes).length, 4);
});

await test('a 14-page run leaves 2 blank cells and still draws the full grid', async () => {
  const srcs = [];
  for (let i = 0; i < 14; i++) srcs.push(await makeSource(`c${i}`));
  const { bytes } = await tile(srcs);
  assert.strictEqual((await PDFDocument.load(bytes)).getPageCount(), 1);
  assert.strictEqual(placements(bytes).length, 14, '14 placements, 2 cells left empty');
});

// ---- optional: real files on the command line, never committed -----------------

const real = process.argv.slice(2).filter(f => /\.pdf$/i.test(f));
if (real.length) {
  await test(`${real.length} real PDF(s) from the command line`, async () => {
    const srcs = [];
    for (const f of real) srcs.push(await PDFDocument.load(fs.readFileSync(f), { ignoreEncryption: true }));
    for (const s of srcs) for (const p of s.getPages()) {
      const sz = p.getSize();
      assert.ok(A8.isA4Portrait(sz.width, sz.height), `real input is A4: ${mm(sz.width).toFixed(1)}x${mm(sz.height).toFixed(1)}mm`);
    }
    const { bytes, count } = await tile(srcs);
    const out = '/tmp/a8-on-a4-real.pdf';
    fs.writeFileSync(out, bytes);
    assert.strictEqual(placements(bytes).length, count);
    console.log(`      ${count} real pages tiled → ${out} (${(bytes.length / 1024).toFixed(0)} KB)`);
  });
}

console.log(`\n${n} tests passed.`);
})().catch((e) => { console.error('\nFAILED:', e.message); process.exit(1); });
