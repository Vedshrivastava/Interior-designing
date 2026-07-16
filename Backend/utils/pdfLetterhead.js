import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Shared header/footer/table primitives for every generated PDF (CA Monthly
// Package, Client Bill Statement) — pulls real branding from the
// financeCompanySettings singleton (Settings build) instead of a hardcoded
// placeholder. `company` is that singleton document; callers fetch it once
// and pass it in, so a PDF never makes its own separate DB round trip for
// branding.
const DEFAULT_COMPANY = {
    companyName: 'Shrivastavas Elevate',
    address: 'Satna, India',
    gstin: '',
    logoUrl: '',
    accentColor: '#2c3e50',
    letterheadFooterText: '',
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
const fetchImageBuffer = (url) => new Promise((resolve) => {
    if (!url) return resolve(null);
    try {
        https.get(url, (response) => {
            if (response.statusCode !== 200) { resolve(null); return; }
            const chunks = [];
            response.on('data', (c) => chunks.push(c));
            response.on('end', () => resolve(Buffer.concat(chunks)));
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

// documentTitle renders in a coloured band under the company block;
// rightLabel is an optional line (e.g. "Bill #12  •  12 Jul 2026") shown
// right-aligned in that same band.
const writeLetterhead = async (doc, documentTitle, company, rightLabel) => {
    const c = { ...DEFAULT_COMPANY, ...(company || {}) };
    const { left, right, width } = contentBox(doc);
    const topY = doc.y;

    const logoBuffer = await getLogoBuffer(c);
    const logoH = 44;
    let textX = left;
    if (logoBuffer) {
        try {
            const logoW = logoH * DEFAULT_LOGO_ASPECT;
            doc.image(logoBuffer, left, topY, { height: logoH });
            textX = left + logoW + 16;
        } catch { /* corrupt/unsupported image — skip silently */ }
    }

    const textWidth = right - textX;
    doc.fontSize(18).font('Helvetica-Bold').fillColor(c.accentColor).text(c.companyName, textX, topY, { width: textWidth });
    doc.fontSize(9).font('Helvetica').fillColor('#666666');
    if (c.address) doc.text(c.address, textX, doc.y, { width: textWidth });
    if (c.gstin) doc.text(`GSTIN: ${c.gstin}`, textX, doc.y, { width: textWidth });
    doc.fillColor('#000000');

    doc.y = Math.max(doc.y, topY + logoH);
    doc.moveDown(0.5);

    doc.rect(left, doc.y, width, 2).fill(c.accentColor);
    doc.moveDown(0.6);

    const bandY = doc.y;
    const bandH = 27;
    doc.rect(left, bandY, width, bandH).fill(c.accentColor);
    const rightLabelWidth = rightLabel ? 190 : 0;
    doc.fillColor('#ffffff').fontSize(13).font('Helvetica-Bold')
        .text(documentTitle, left + 10, bandY + 8, { width: width - 20 - rightLabelWidth });
    if (rightLabel) {
        doc.fontSize(9.5).font('Helvetica-Bold')
            .text(rightLabel, right - rightLabelWidth - 10, bandY + 9, { width: rightLabelWidth, align: 'right' });
    }
    doc.fillColor('#000000');
    doc.y = bandY + bandH;
    doc.moveDown(0.9);
    doc.font('Helvetica').fontSize(10);
};

const writeSectionHeading = (doc, text, company) => {
    const accentColor = company?.accentColor || DEFAULT_COMPANY.accentColor;
    const { left } = contentBox(doc);
    doc.moveDown(0.8);
    const y = doc.y;
    doc.rect(left, y + 2, 4, 12).fill(accentColor);
    doc.fontSize(12).font('Helvetica-Bold').fillColor(accentColor).text(text, left + 10, y);
    doc.fillColor('#000000').font('Helvetica').fontSize(10);
    doc.moveDown(0.3);
};

// A small "Label" (accent, small-caps-ish) followed by stacked lines —
// used to lay out Bill To / Bill Details side by side. Returns the y
// position immediately below the box's content, so the caller can align
// a sibling box drawn at the same starting y.
const drawInfoBox = (doc, x, width, title, lines, company) => {
    const accentColor = company?.accentColor || DEFAULT_COMPANY.accentColor;
    const startY = doc.y;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(accentColor).text(title.toUpperCase(), x, startY, { width, characterSpacing: 0.5 });
    doc.fillColor('#000000').font('Helvetica').fontSize(10);
    let y = doc.y + 2;
    lines.filter(Boolean).forEach((line) => {
        doc.text(line, x, y, { width });
        y = doc.y;
    });
    return y;
};

// Bordered, page-break-aware table. `columns`: [{ label, width, align }],
// widths should sum to the page's content width. `rows`: array of arrays
// of cell strings, positionally matched to columns.
const drawTable = (doc, { columns, rows, company }) => {
    const accentColor = company?.accentColor || DEFAULT_COMPANY.accentColor;
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
    drawRow(columns.map((c) => c.label), { bold: true, fill: accentColor, textColor: '#ffffff', height: headerH });

    rows.forEach((r, idx) => {
        ensureSpace(rowH);
        drawRow(r, { fill: idx % 2 === 1 ? '#f7f7f7' : '#ffffff' });
    });

    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor('#dddddd').lineWidth(1).stroke();
    doc.moveDown(0.4);
};

// Called right before doc.end(). Prints the owner's custom footer text (if
// set in Settings > PDF Templates) plus a generated-on timestamp so every
// copy of a statement is traceable to when it was produced.
const writeFooter = (doc, company) => {
    const { left, right } = contentBox(doc);
    doc.moveDown(1.2);
    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor('#eeeeee').lineWidth(1).stroke();
    doc.moveDown(0.3);
    doc.fontSize(7.5).fillColor('#999999');
    if (company?.letterheadFooterText) doc.text(company.letterheadFooterText, { align: 'center' });
    doc.text(`Generated on ${new Date().toLocaleString('en-IN')}`, { align: 'center' });
    doc.fillColor('#000000');
};

export { DEFAULT_COMPANY, formatCurrency, formatDate, contentBox, writeLetterhead, writeSectionHeading, drawInfoBox, drawTable, writeFooter };
