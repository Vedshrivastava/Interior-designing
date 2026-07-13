import https from 'https';

// Shared header/footer for every generated PDF (CA Monthly Package, Client
// Bill Statement) — pulls real branding from the financeCompanySettings
// singleton (Settings build) instead of the hardcoded placeholder this
// used before that model existed. `company` is that singleton document;
// callers fetch it once and pass it in, so a PDF never makes its own
// separate DB round trip for branding.
const DEFAULT_COMPANY = {
    companyName: 'Shrivastavas Elevate',
    address: 'Satna, India',
    gstin: '',
    logoUrl: '',
    accentColor: '#2c3e50',
    letterheadFooterText: '',
};

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

const writeLetterhead = async (doc, documentTitle, company) => {
    const c = { ...DEFAULT_COMPANY, ...(company || {}) };

    if (c.logoUrl) {
        const logoBuffer = await fetchImageBuffer(c.logoUrl);
        if (logoBuffer) {
            try { doc.image(logoBuffer, doc.page.margins.left, doc.y, { height: 40 }); doc.moveDown(0.2); } catch { /* corrupt/unsupported image — skip silently */ }
        }
    }

    doc.fontSize(20).font('Helvetica-Bold').fillColor(c.accentColor).text(c.companyName, { align: 'left' });
    doc.fillColor('#000000');
    doc.fontSize(10).font('Helvetica').fillColor('#555555');
    if (c.address) doc.text(c.address);
    if (c.gstin) doc.text(`GSTIN: ${c.gstin}`);
    doc.fillColor('#000000');
    doc.moveDown(0.5);
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor('#cccccc').stroke();
    doc.moveDown(1);
    doc.fontSize(15).font('Helvetica-Bold').fillColor(c.accentColor).text(documentTitle);
    doc.fillColor('#000000');
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(10);
};

const writeSectionHeading = (doc, text, company) => {
    const accentColor = company?.accentColor || DEFAULT_COMPANY.accentColor;
    doc.moveDown(0.8);
    doc.fontSize(12).font('Helvetica-Bold').fillColor(accentColor).text(text);
    doc.fillColor('#000000').font('Helvetica').fontSize(10);
    doc.moveDown(0.3);
};

// Called right before doc.end() — a small footer line, only if the owner
// set one in Settings > PDF Templates.
const writeFooter = (doc, company) => {
    if (!company?.letterheadFooterText) return;
    doc.moveDown(1.5);
    doc.fontSize(8).fillColor('#999999').text(company.letterheadFooterText, { align: 'center' });
    doc.fillColor('#000000');
};

export { DEFAULT_COMPANY, formatCurrency, formatDate, writeLetterhead, writeSectionHeading, writeFooter };
