import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Shared header/footer/table primitives for every generated PDF (CA Monthly
// Package, Client Bill Statement, Contractor/Labour Statements, Advance
// Receipt) — pulls real branding (name, address, GSTIN, logo, bank
// details, signatory) from the financeCompanySettings singleton instead of
// a hardcoded placeholder. `company` is that singleton document; callers
// fetch it once and pass it in, so a PDF never makes its own separate DB
// round trip for branding. The color palette itself, however, is fixed in
// code (BRAND_GREEN / GOLD / IVORY_BG below) — not read from `company` —
// so every document keeps the same identity regardless of Settings.
const DEFAULT_COMPANY = {
    companyName: 'Shrivastavas Elevate',
    address: 'Satna, India',
    gstin: '',
    pan: '',
    phone: '',
    email: '',
    logoUrl: '',
    letterheadFooterText: '',
};

// Fixed brand palette used across every generated PDF — deliberately not
// admin-configurable (there used to be a Settings > PDF Templates accent
// color picker; removed so every document keeps one consistent identity).
const BRAND_GREEN = '#102525';
const GOLD = '#c9a87c';
const GOLD_BORDER = '#e6d4b8';
const IVORY_BG = '#f8f4ee';

// Fills the current page edge-to-edge with the ivory brand background.
// Call once right after `doc.pipe(res)` for the first page, and again from
// a `doc.on('pageAdded', ...)` listener so pages added later (manual
// doc.addPage() calls, or drawTable's automatic page breaks) match.
const paintPageBackground = (doc) => {
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(IVORY_BG);
};

// Bundled brand mark — used whenever the owner hasn't uploaded a logo in
// Settings yet (or the uploaded URL is briefly unreachable), so a Statement
// never goes out looking unbranded. Read once at module load; a missing
// file here just means no logo renders, never a crash.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_LOGO_PATH = path.join(__dirname, '..', 'assets', 'logo.png');
const DEFAULT_LOGO_ASPECT = 480 / 320; // bundled asset's own width/height
let defaultLogoBuffer = null;
try { defaultLogoBuffer = fs.readFileSync(DEFAULT_LOGO_PATH); } catch { defaultLogoBuffer = null; }

const formatCurrency = (amount) => `Rs. ${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const formatDate = (date) => (date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

// Best-effort — a PDF must still generate correctly even if the logo URL
// is unreachable (e.g. Cloudinary hiccup); this never throws.
//
// Every PDF download (Advance Receipt, Bill/Running Bill Statement, CA
// Monthly Package, …) calls writeLetterhead, which used to re-fetch this
// same logo over HTTPS on every single click — a real, user-visible delay
// on every one-click download for an image that essentially never changes.
// Cached in memory, keyed by URL: a logo change in Settings uploads to a
// new Cloudinary URL (new public_id), so the old cache entry simply stops
// being requested rather than needing an explicit invalidation.
const logoCache = new Map(); // url -> Buffer
const fetchImageBuffer = (url) => new Promise((resolve) => {
    if (!url) return resolve(null);
    if (logoCache.has(url)) return resolve(logoCache.get(url));
    try {
        https.get(url, (response) => {
            if (response.statusCode !== 200) { resolve(null); return; }
            const chunks = [];
            response.on('data', (c) => chunks.push(c));
            response.on('end', () => {
                const buffer = Buffer.concat(chunks);
                logoCache.set(url, buffer);
                resolve(buffer);
            });
            response.on('error', () => resolve(null));
        }).on('error', () => resolve(null));
    } catch {
        resolve(null);
    }
});

// Admin-uploaded logo wins when reachable; otherwise fall back to the
// bundled brand mark rather than leaving the letterhead blank.
const getLogoBuffer = async (company) => {
    if (company?.logoUrl) {
        const remote = await fetchImageBuffer(company.logoUrl);
        if (remote) return remote;
    }
    return defaultLogoBuffer;
};

const contentBox = (doc) => {
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    return { left, right, width: right - left };
};

// documentTitle renders as a pull-quote (gold rule + primary-colored text)
// under the company block; rightLabel is an optional line (e.g. "Bill #12
// • 12 Jul 2026") shown right-aligned in gold, vertically centered against
// the title.
const writeLetterhead = async (doc, documentTitle, company, rightLabel) => {
    const c = { ...DEFAULT_COMPANY, ...(company || {}) };
    const { left, right, width } = contentBox(doc);
    const topY = doc.y;

    const logoBuffer = await getLogoBuffer(c);
    const logoH = 56;
    const logoW = logoH * DEFAULT_LOGO_ASPECT;
    const textX = logoBuffer ? left + logoW + 18 : left;
    const textWidth = right - textX;

    // Measure the text block before drawing anything, so the company-name
    // block and the logo can be vertically centered against each other
    // instead of both just top-aligned to topY (which reads as misaligned
    // since the logo's own artwork has built-in padding).
    const contactLine = [c.phone && `Phone: ${c.phone}`, c.email && `Email: ${c.email}`].filter(Boolean).join('  |  ');

    doc.font('Times-Bold').fontSize(22);
    const nameH = doc.heightOfString(c.companyName, { width: textWidth });
    doc.font('Helvetica').fontSize(8.5);
    const metaLine = [c.address, c.gstin && `GSTIN: ${c.gstin}`, c.pan && `PAN: ${c.pan}`].filter(Boolean).join('   •   ');
    const metaH = metaLine ? doc.heightOfString(metaLine, { width: textWidth }) : 0;
    const contactH = contactLine ? doc.heightOfString(contactLine, { width: textWidth }) : 0;
    const textBlockH = nameH + metaH + contactH;

    const textTopY = topY + Math.max(0, (logoH - textBlockH) / 2);
    if (logoBuffer) {
        try {
            const logoTopY = topY + Math.max(0, (textBlockH - logoH) / 2);
            doc.image(logoBuffer, left, logoTopY, { height: logoH });
        } catch { /* corrupt/unsupported image — skip silently */ }
    }

    doc.font('Times-Bold').fontSize(22).fillColor(BRAND_GREEN).text(c.companyName, textX, textTopY, { width: textWidth });
    doc.fontSize(8.5).font('Helvetica').fillColor('#777777');
    if (metaLine) doc.text(metaLine, textX, doc.y, { width: textWidth });
    if (contactLine) doc.text(contactLine, textX, doc.y, { width: textWidth });
    doc.fillColor('#000000');

    doc.y = Math.max(doc.y, topY + logoH, textTopY + textBlockH);
    doc.moveDown(0.7);

    // A single gold hairline closes the letterhead block — replaces the
    // old heavy solid-color bar; one thin rule plus whitespace reads calmer
    // than a filled block.
    doc.moveTo(left, doc.y).lineTo(right, doc.y).lineWidth(1).strokeColor(GOLD).stroke();
    doc.moveDown(0.7);

    const titleFontSize = 15;
    doc.font('Helvetica-Bold').fontSize(titleFontSize);
    const rightLabelWidth = rightLabel ? 200 : 0;
    const titleWidth = width - 16 - rightLabelWidth;
    const titleH = doc.heightOfString(documentTitle, { width: titleWidth });
    const blockH = Math.max(titleH, 16);
    const blockY = doc.y;

    doc.rect(left, blockY, 4, blockH).fill(GOLD);
    doc.fillColor(BRAND_GREEN).font('Helvetica-Bold').fontSize(titleFontSize)
        .text(documentTitle, left + 16, blockY, { width: titleWidth });
    if (rightLabel) {
        doc.fillColor(GOLD).font('Helvetica-Bold').fontSize(9.5)
            .text(rightLabel, right - rightLabelWidth, blockY + (blockH - 11) / 2, { width: rightLabelWidth, align: 'right' });
    }
    doc.fillColor('#000000');
    doc.y = blockY + blockH;
    doc.moveDown(0.9);
    doc.font('Helvetica').fontSize(10);
};

const writeSectionHeading = (doc, text) => {
    const { left } = contentBox(doc);
    doc.moveDown(0.8);
    const y = doc.y;
    doc.rect(left, y + 2, 4, 12).fill(GOLD);
    doc.fontSize(12).font('Helvetica-Bold').fillColor(BRAND_GREEN).text(text, left + 12, y);
    doc.fillColor('#000000').font('Helvetica').fontSize(10);
    doc.moveDown(0.3);
};

// A bordered box with a small gold, letterspaced label followed by stacked
// lines — used to lay out Bill To / Bill Details (or Contractor/Project,
// Received From/Project, Pay To, …) side by side. Heights are measured
// up front so the border can be drawn before the text. Returns the y
// position immediately below the box, so the caller can align a sibling
// box drawn at the same starting y. Pass `forcedHeight` (from
// measureInfoBoxHeight below) to make two side-by-side boxes with
// different content share one uniform height instead of each hugging its
// own (shorter) content.
const measureInfoBoxHeight = (doc, width, title, lines) => {
    const pad = 10;
    const innerWidth = width - pad * 2;
    const filteredLines = lines.filter(Boolean);
    doc.font('Helvetica-Bold').fontSize(8.5);
    const titleH = doc.heightOfString(title.toUpperCase(), { width: innerWidth, characterSpacing: 1 });
    doc.font('Helvetica').fontSize(10);
    const linesH = filteredLines.reduce((sum, line) => sum + doc.heightOfString(line, { width: innerWidth }), 0);
    return pad + titleH + 5 + linesH + pad;
};

const drawInfoBox = (doc, x, width, title, lines, company, forcedHeight) => {
    const pad = 10;
    const innerWidth = width - pad * 2;
    const filteredLines = lines.filter(Boolean);
    const startY = doc.y;

    doc.font('Helvetica-Bold').fontSize(8.5);
    const titleH = doc.heightOfString(title.toUpperCase(), { width: innerWidth, characterSpacing: 1 });
    doc.font('Helvetica').fontSize(10);
    const lineHeights = filteredLines.map((line) => doc.heightOfString(line, { width: innerWidth }));
    const linesH = lineHeights.reduce((a, b) => a + b, 0);
    const naturalH = pad + titleH + 5 + linesH + pad;
    const boxH = forcedHeight ? Math.max(forcedHeight, naturalH) : naturalH;

    doc.roundedRect(x, startY, width, boxH, 3).lineWidth(0.5).strokeColor(GOLD_BORDER).stroke();

    let y = startY + pad;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(GOLD).text(title.toUpperCase(), x + pad, y, { width: innerWidth, characterSpacing: 1 });
    y += titleH + 5;
    doc.fillColor('#000000').font('Helvetica').fontSize(10);
    filteredLines.forEach((line, i) => {
        doc.text(line, x + pad, y, { width: innerWidth });
        y += lineHeights[i];
    });
    doc.fillColor('#000000');
    return startY + boxH;
};

// Bordered, page-break-aware table. `columns`: [{ label, width, align }],
// widths should sum to the page's content width. `rows`: array of arrays
// of cell strings, positionally matched to columns.
const drawTable = (doc, { columns, rows }) => {
    const { left, right, width: tableWidth } = contentBox(doc);
    const rowH = 20;
    const headerH = 22;

    const ensureSpace = (h) => {
        if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage();
    };

    const drawRow = (cells, { bold = false, fill = null, textColor = '#000000', height = rowH } = {}) => {
        const y = doc.y;
        if (fill) doc.rect(left, y, tableWidth, height).fill(fill);
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).fillColor(textColor);
        let x = left;
        columns.forEach((col, i) => {
            doc.text(String(cells[i] ?? ''), x + 6, y + (height - 10) / 2, { width: col.width - 12, align: col.align || 'left', lineBreak: false });
            x += col.width;
        });
        doc.fillColor('#000000').font('Helvetica').fontSize(10);
        doc.y = y + height;
    };

    ensureSpace(headerH);
    drawRow(columns.map((c) => c.label), { bold: true, fill: BRAND_GREEN, textColor: '#faf6ee', height: headerH });

    // No vertical grid — alternating warm-ivory fill reads the row
    // boundaries without the heavier look of drawn borders.
    rows.forEach((r, idx) => {
        ensureSpace(rowH);
        drawRow(r, { fill: idx % 2 === 1 ? '#f8f2e6' : '#ffffff' });
    });

    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor(GOLD_BORDER).lineWidth(1).stroke();
    doc.moveDown(0.4);
};

// "Pay To" block for outgoing Bills/Receipts — silent (renders nothing) if
// no primaryBankAccountId is set on Company Profile, same conditional
// convention as address/GSTIN in writeLetterhead. `company.primaryBankAccountId`
// must already be populated (accountName/bankName/accountNumber/ifscCode)
// by the caller — this never does its own DB lookup.
const writePaymentDetails = (doc, company) => {
    const account = company?.primaryBankAccountId;
    if (!account || !account.accountName) return;
    // A gold hairline separates this section from whatever precedes it
    // (Totals, the Outstanding Balance banner, …) before the same bordered
    // "Pay To" box style used elsewhere for RECEIVED FROM / PROJECT boxes.
    const { left, right, width } = contentBox(doc);
    doc.moveDown(0.8);
    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor(GOLD_BORDER).lineWidth(1).stroke();
    doc.moveDown(0.6);
    drawInfoBox(doc, left, width, 'Pay To', [
        account.bankName,
        `Account Name: ${account.accountName}`,
        account.accountNumber && `Account No: ${account.accountNumber}`,
        account.ifscCode && `IFSC: ${account.ifscCode}`,
    ], company);
};

// Signature block for outgoing Bills/Receipts — silent if no signatory name
// is set on Company Profile.
const writeSignatureLine = (doc, company) => {
    const name = company?.authorizedSignatoryName;
    if (!name) return;
    const { right } = contentBox(doc);
    const blockWidth = 220;
    const x = right - blockWidth;

    doc.moveDown(2);
    doc.fontSize(9.5).font('Helvetica-Bold').text(`For ${company?.companyName || DEFAULT_COMPANY.companyName}`, x, doc.y, { width: blockWidth, align: 'right' });
    doc.moveDown(2.2);
    doc.dash(1, { space: 2 });
    doc.moveTo(x + blockWidth - 160, doc.y).lineTo(x + blockWidth, doc.y).strokeColor('#999999').lineWidth(1).stroke();
    doc.undash();
    doc.moveDown(0.3);
    doc.fontSize(9.5).font('Helvetica-Bold').text(name, x, doc.y, { width: blockWidth, align: 'right' });
    doc.fontSize(7.5).font('Helvetica').fillColor('#888888')
        .text('AUTHORIZED SIGNATORY', x, doc.y, { width: blockWidth, align: 'right', characterSpacing: 1 });
    doc.fillColor('#000000');
};

// Called right before doc.end(). Prints the owner's custom footer text (if
// set in Settings > PDF Templates) plus a generated-on timestamp so every
// copy of a statement is traceable to when it was produced.
const writeFooter = (doc, company) => {
    const { left, right } = contentBox(doc);
    doc.moveDown(1.2);
    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor(GOLD_BORDER).lineWidth(1).stroke();
    doc.moveDown(0.3);
    doc.fontSize(7.5).fillColor('#999999');
    if (company?.letterheadFooterText) doc.text(company.letterheadFooterText, { align: 'center' });
    doc.text(`Generated on ${new Date().toLocaleString('en-IN')}`, { align: 'center' });
    doc.fillColor('#000000');
};

export { DEFAULT_COMPANY, BRAND_GREEN, GOLD, GOLD_BORDER, IVORY_BG, paintPageBackground, formatCurrency, formatDate, contentBox, writeLetterhead, writeSectionHeading, drawInfoBox, measureInfoBoxHeight, drawTable, writePaymentDetails, writeSignatureLine, writeFooter };
