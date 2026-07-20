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
// round trip for branding. The color palette is a separate concern (see
// COLOR_THEME/MONO_THEME below) — not read from `company` at all.
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

// Two selectable palettes for every generated PDF. COLOR_THEME is the brand
// identity (deep green / gold / ivory); MONO_THEME is the identical layout
// in grayscale, for clients who print statements — same structure, same
// weight, same accents, just no color, so a black-and-white office printer
// isn't asked to render colored fills it'll just turn to muddy gray anyway.
// Neither is admin-configurable (a Settings > PDF Templates color picker
// used to exist; removed so every document keeps one of exactly two
// consistent identities). Every draw function below defaults its `theme`
// param to COLOR_THEME, so callers that haven't been migrated to pass a
// theme through (Contractor/Labour Statements, Advance Receipt, CA Monthly
// Package) keep rendering in color, unchanged.
const COLOR_THEME = {
    primary: '#102525',      // headers, table header fill, totals box fill, title text
    accent: '#c9a87c',       // labels, hairlines, accent bars, totals box text
    accentBorder: '#e6d4b8', // box borders, table rule, footer rule (lighter tint)
    pageBg: '#f8f4ee',       // page background
    onPrimary: '#faf6ee',    // text drawn on top of `primary` fills
    rowStripe: '#f8f2e6',    // alternating table row fill
    bannerBg: '#f7ecd9',     // Payment Due / Fully Settled banner fill
    bannerLabel: '#8a6d3b',  // banner label text ("Payment Due")
};

const MONO_THEME = {
    primary: '#1a1a1a',
    accent: '#8c8c8c',
    accentBorder: '#d9d9d9',
    pageBg: '#ffffff',
    onPrimary: '#ffffff',
    rowStripe: '#f2f2f2',
    bannerBg: '#f0f0f0',
    bannerLabel: '#5a5a5a',
};

// mode: 'color' (default) or 'bw'. Callers read this from a query param
// (?mode=bw on a download route) and pass the returned object as `theme`
// to every draw call for that document.
const getTheme = (mode) => (mode === 'bw' ? MONO_THEME : COLOR_THEME);

// Plain-value aliases for callers that draw with these colors directly
// (Contractor/Labour Statement, Advance Receipt totals dividers) rather
// than going through a `theme`-aware draw function above — kept so those
// files don't need touching just because this one gained a B&W mode. They
// always render in the color theme; only Client Bill Statement (the one
// place a B&W download was actually asked for) threads `theme` through.
const BRAND_GREEN = COLOR_THEME.primary;
const GOLD = COLOR_THEME.accent;
const GOLD_BORDER = COLOR_THEME.accentBorder;
const IVORY_BG = COLOR_THEME.pageBg;

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

// Fills the current page edge-to-edge with the theme's page background.
// Call once right after `doc.pipe(res)` for the first page, and again from
// a `doc.on('pageAdded', ...)` listener so pages added later (manual
// doc.addPage() calls, or drawTable's automatic page breaks) match.
const paintPageBackground = (doc, theme = COLOR_THEME) => {
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(theme.pageBg);
};

// documentTitle renders as a pull-quote (accent rule + primary-colored
// text) under the company block; rightLabel is an optional line (e.g.
// "Bill #12 • 12 Jul 2026") shown right-aligned in the accent color,
// vertically centered against the title.
const writeLetterhead = async (doc, documentTitle, company, rightLabel, theme = COLOR_THEME) => {
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
    // Address / GSTIN / PAN render as one compact line, not three stacked
    // lines — keeps the letterhead from growing taller than the logo when
    // all three fields are filled in.
    const metaLine = [c.address, c.gstin && `GSTIN: ${c.gstin}`, c.pan && `PAN: ${c.pan}`].filter(Boolean).join('   •   ');

    doc.font('Times-Bold').fontSize(22);
    const nameH = doc.heightOfString(c.companyName, { width: textWidth });
    doc.font('Helvetica').fontSize(8.5);
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

    doc.font('Times-Bold').fontSize(22).fillColor(theme.primary).text(c.companyName, textX, textTopY, { width: textWidth });
    doc.fontSize(8.5).font('Helvetica').fillColor('#777777');
    if (metaLine) doc.text(metaLine, textX, doc.y, { width: textWidth });
    if (contactLine) doc.text(contactLine, textX, doc.y, { width: textWidth });
    doc.fillColor('#000000');

    doc.y = Math.max(doc.y, topY + logoH, textTopY + textBlockH);
    doc.moveDown(0.7);

    // A single accent hairline closes the letterhead block — a heavy
    // solid-color bar reads calmer as one thin rule plus whitespace.
    doc.moveTo(left, doc.y).lineTo(right, doc.y).lineWidth(1).strokeColor(theme.accent).stroke();
    doc.moveDown(0.7);

    const titleFontSize = 15;
    doc.font('Helvetica-Bold').fontSize(titleFontSize);
    const rightLabelWidth = rightLabel ? 200 : 0;
    const titleWidth = width - 16 - rightLabelWidth;
    const titleH = doc.heightOfString(documentTitle, { width: titleWidth });
    const blockH = Math.max(titleH, 16);
    const blockY = doc.y;

    doc.rect(left, blockY, 4, blockH).fill(theme.accent);
    doc.fillColor(theme.primary).font('Helvetica-Bold').fontSize(titleFontSize)
        .text(documentTitle, left + 16, blockY, { width: titleWidth });
    if (rightLabel) {
        doc.fillColor(theme.accent).font('Helvetica-Bold').fontSize(9.5)
            .text(rightLabel, right - rightLabelWidth, blockY + (blockH - 11) / 2, { width: rightLabelWidth, align: 'right' });
    }
    doc.fillColor('#000000');
    doc.y = blockY + blockH;
    doc.moveDown(0.9);
    doc.font('Helvetica').fontSize(10);
};

const writeSectionHeading = (doc, text, theme = COLOR_THEME) => {
    const { left } = contentBox(doc);
    doc.moveDown(0.8);
    const y = doc.y;
    doc.rect(left, y + 2, 4, 12).fill(theme.accent);
    doc.fontSize(12).font('Helvetica-Bold').fillColor(theme.primary).text(text, left + 12, y);
    doc.fillColor('#000000').font('Helvetica').fontSize(10);
    doc.moveDown(0.3);
};

// Measures an info box's natural height without drawing anything — lets a
// caller size two side-by-side boxes (Bill To / Bill Details) to the taller
// of the two before either is drawn.
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

// A bordered box with a small accent-colored, letterspaced label followed
// by stacked lines — used to lay out Bill To / Bill Details (or Contractor/
// Project, Received From/Project, Pay To, …) side by side. `forcedHeight`,
// if given, is used instead of the box's own natural height (as long as
// it's tall enough) — pass the taller of two sibling boxes'
// measureInfoBoxHeight() results so they draw at matching heights.
const drawInfoBox = (doc, x, width, title, lines, company, forcedHeight, theme = COLOR_THEME) => {
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

    doc.roundedRect(x, startY, width, boxH, 3).lineWidth(0.5).strokeColor(theme.accentBorder).stroke();

    let y = startY + pad;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(theme.accent).text(title.toUpperCase(), x + pad, y, { width: innerWidth, characterSpacing: 1 });
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
const drawTable = (doc, { columns, rows, theme = COLOR_THEME }) => {
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
    drawRow(columns.map((c) => c.label), { bold: true, fill: theme.primary, textColor: theme.onPrimary, height: headerH });

    // No vertical grid — alternating stripe fill reads the row boundaries
    // without the heavier look of drawn borders.
    rows.forEach((r, idx) => {
        ensureSpace(rowH);
        drawRow(r, { fill: idx % 2 === 1 ? theme.rowStripe : '#ffffff' });
    });

    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor(theme.accentBorder).lineWidth(1).stroke();
    doc.moveDown(0.4);
};

// "Pay To" block for outgoing Bills/Receipts — silent (renders nothing) if
// no primaryBankAccountId is set on Company Profile, same conditional
// convention as address/GSTIN in writeLetterhead. `company.primaryBankAccountId`
// must already be populated (accountName/bankName/accountNumber/ifscCode)
// by the caller — this never does its own DB lookup.
const writePaymentDetails = (doc, company, theme = COLOR_THEME) => {
    const account = company?.primaryBankAccountId;
    if (!account || !account.accountName) return;
    // An accent hairline separates this section from whatever precedes it
    // (Totals, the Outstanding Balance banner, …) before the same bordered
    // "Pay To" box style used elsewhere for RECEIVED FROM / PROJECT boxes.
    const { left, right, width } = contentBox(doc);
    doc.moveDown(0.8);
    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor(theme.accentBorder).lineWidth(1).stroke();
    doc.moveDown(0.6);
    drawInfoBox(doc, left, width, 'Pay To', [
        account.bankName,
        `Account Name: ${account.accountName}`,
        account.accountNumber && `Account No: ${account.accountNumber}`,
        account.ifscCode && `IFSC: ${account.ifscCode}`,
    ], company, null, theme);
};

// Signature block for outgoing Bills/Receipts — silent if no signatory name
// is set on Company Profile. Deliberately theme-agnostic (plain black/gray)
// — a signature reads as ink either way, not a brand accent.
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
const writeFooter = (doc, company, theme = COLOR_THEME) => {
    const { left, right } = contentBox(doc);
    doc.moveDown(1.2);
    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor(theme.accentBorder).lineWidth(1).stroke();
    doc.moveDown(0.3);
    doc.fontSize(7.5).fillColor('#999999');
    if (company?.letterheadFooterText) doc.text(company.letterheadFooterText, { align: 'center' });
    doc.text(`Generated on ${new Date().toLocaleString('en-IN')}`, { align: 'center' });
    doc.fillColor('#000000');
};

export {
    DEFAULT_COMPANY, COLOR_THEME, MONO_THEME, getTheme,
    BRAND_GREEN, GOLD, GOLD_BORDER, IVORY_BG,
    paintPageBackground, formatCurrency, formatDate, contentBox,
    writeLetterhead, writeSectionHeading, drawInfoBox, measureInfoBoxHeight, drawTable,
    writePaymentDetails, writeSignatureLine, writeFooter,
};
