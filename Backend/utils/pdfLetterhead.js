// Shared header for every generated PDF (CA Monthly Package, Client Bill
// Statement) — no financeSettings > Company profile model exists yet
// (still an unbuilt placeholder, see financeNav.js), so this uses the
// same business details already hardcoded in CLAUDE.md rather than
// inventing a new model just for a PDF header.
const COMPANY = {
    name: 'Shrivastavas Elevate',
    tagline: 'Interior Design & Contracting Studio',
    location: 'Satna, India',
    whatsapp: '+91 89620 53372',
};

const formatCurrency = (amount) => `Rs. ${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const formatDate = (date) => (date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const writeLetterhead = (doc, documentTitle) => {
    doc.fontSize(20).font('Helvetica-Bold').text(COMPANY.name, { align: 'left' });
    doc.fontSize(10).font('Helvetica').fillColor('#555555')
        .text(`${COMPANY.tagline} — ${COMPANY.location}`)
        .text(`WhatsApp: ${COMPANY.whatsapp}`);
    doc.fillColor('#000000');
    doc.moveDown(0.5);
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor('#cccccc').stroke();
    doc.moveDown(1);
    doc.fontSize(15).font('Helvetica-Bold').text(documentTitle);
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(10);
};

const writeSectionHeading = (doc, text) => {
    doc.moveDown(0.8);
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#2c3e50').text(text);
    doc.fillColor('#000000').font('Helvetica').fontSize(10);
    doc.moveDown(0.3);
};

export { COMPANY, formatCurrency, formatDate, writeLetterhead, writeSectionHeading };
