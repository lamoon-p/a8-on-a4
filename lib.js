// Pure geometry for tiling A4 pages 4x4 onto an A4 sheet.
// No PDF library here on purpose: this is the part worth testing in node.

const MM = 72 / 25.4;                     // PDF points per millimetre
const A4 = { w: 210 * MM, h: 297 * MM };  // 595.276 x 841.890 pt
const MARGIN = 5 * MM;                    // printer safe area, all four sides
const COLS = 4;
const ROWS = 4;
const PER_SHEET = COLS * ROWS;

const cellW = () => (A4.w - 2 * MARGIN) / COLS;
const cellH = () => (A4.h - 2 * MARGIN) / ROWS;

// i = 0..15, row-major from the top-left. PDF origin is bottom-left.
function cellBox(i) {
  const w = cellW(), h = cellH();
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  return { x: MARGIN + col * w, y: A4.h - MARGIN - (row + 1) * h, w, h };
}

// Fit a page of pw x ph into a cell, aspect preserved, centred.
// A4 input is width-bound and lands at 23.8095%; anything else just fits.
function place(pw, ph, cell) {
  const scale = Math.min(cell.w / pw, cell.h / ph);
  return {
    x: cell.x + (cell.w - pw * scale) / 2,
    y: cell.y + (cell.h - ph * scale) / 2,
    scale,
  };
}

const sheetCount = (n) => Math.ceil(n / PER_SHEET);

// Full 4x4 grid including the outer rectangle, so every cut has a line.
function gridLines() {
  const w = cellW(), h = cellH();
  const left = MARGIN, right = A4.w - MARGIN;
  const bottom = MARGIN, top = A4.h - MARGIN;
  const lines = [];
  for (let c = 0; c <= COLS; c++) {
    const x = left + c * w;
    lines.push({ x1: x, y1: bottom, x2: x, y2: top });
  }
  for (let r = 0; r <= ROWS; r++) {
    const y = bottom + r * h;
    lines.push({ x1: left, y1: y, x2: right, y2: y });
  }
  return lines;
}

// 1pt tolerance: jsPDF writes 595.2799999 for A4, which is 0.004pt off nominal.
const isA4Portrait = (pw, ph, tol = 1) =>
  Math.abs(pw - A4.w) <= tol && Math.abs(ph - A4.h) <= tol;

const A8 = { MM, A4, MARGIN, COLS, ROWS, PER_SHEET, cellBox, place, sheetCount, gridLines, isA4Portrait };
if (typeof module !== 'undefined') module.exports = A8;
