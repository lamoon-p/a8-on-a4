# A8 on A4

Drop A4 PDFs, get one printable sheet with **16 of them per page**, ready to cut.

**Live: https://lamoon-p.github.io/a8-on-a4/**

Built for printing sheets of QR codes: each code is generated as its own A4 PDF,
and this tiles them 4×4 so one sheet of paper yields sixteen small tags.

## What it does

* One **page** becomes one cell. Drop fourteen single-page PDFs or one fourteen-page
  PDF — either way you get fourteen cells and two blanks.
* Each page is scaled to **23.81%** and placed left-to-right, top-to-bottom.
  Leftover cells are left blank at the end of the last sheet.
* Pages are placed **as pages**, not as pictures. Nothing is re-rendered, so a
  288 dpi source lands at an effective 1152 dpi and no quality is lost.
* A 0.25 pt grey hairline marks every cut.
* A page that is not A4 portrait is still placed — fitted and centred in its cell —
  and named in a warning before you build.
* Files are used in the order the browser hands them over, and that order is listed
  on screen before you press the button. It is not sorted, so a reprint of the same
  files may arrange them differently.

## Print settings

**Print at 100% / actual size.** "Fit to page" or "shrink to fit" will scale the
sheet down again and the cells will no longer be the size below.

The 4×4 grid is inset **5 mm** from the paper edge so an ordinary printer does not
clip the outer codes. That makes each cell **50 × 71.75 mm** — very slightly smaller
than a true A8 of 52 × 74 mm. If you need exact A8 pieces, this is not the tool.

## Measured, not estimated

Against a real jsPDF-generated A4 source whose QR is 185.7 mm wide with 29 modules:

| | on the A4 input | in the output |
|---|---|---|
| QR code | 185.7 mm, module 6.4 mm | **44.2 mm, module 1.52 mm** |
| title line | 8.8 mm | 2.0 mm |
| subtitle | 5.6 mm | 1.1 mm |

1.52 mm is about 4.6× the ISO/IEC 18004 minimum module size of 0.33 mm. A full sheet
rendered at 150, 200 and 300 dpi decoded in **16 cells out of 16** at every resolution.

**Small text does not survive.** A line under about 2.5 mm on the source page ends up
under 0.6 mm and will not be readable. Check one sheet before printing a hundred.

## Privacy

Everything happens in the tab. There is no upload, no analytics, no network request
after the page loads — the PDF library is committed to this repo rather than pulled
from a CDN, so opening the page contacts nobody but GitHub Pages.

## Development

No build step. Open `index.html`, or:

```sh
node test.js                     # geometry + a full round trip through pdf-lib
node test.js some/real.pdf ...   # also tiles real files, writes /tmp/a8-on-a4-real.pdf
```

Real PDFs are never committed. `lib.js` holds the geometry and is shared by the page
and the test; `app.js` is browser glue only.

## Licence

MIT for the code here. `vendor/pdf-lib.min.js` is pdf-lib 1.17.1, MIT — see `NOTICE`.
