import mongoose from 'mongoose';

// Singleton — only one document should ever exist. Always accessed via
// findOne (never a list), created lazily with defaults on first read/write
// if it doesn't exist yet. See controllers/financeCompanySettings.js.
const financeCompanySettingsSchema = new mongoose.Schema({
    companyName: { type: String, required: true, default: 'Shrivastavas Elevate' },
    address:     { type: String, default: '' },
    gstin:       { type: String, default: '' },
    pan:         { type: String, default: '' },
    logoUrl:     { type: String, default: '' },

    // PDF Templates tab — this pass is deliberately scoped to a footer
    // line + one accent color, not a full visual template editor.
    letterheadFooterText: { type: String, default: '' },
    accentColor:          { type: String, default: '#2c3e50' },

    // Prefills the GST rate field on Running Bill / Purchase forms — those
    // forms stay independently editable per document, this is a default only.
    defaultGstRate: { type: Number, default: null },

    // 1–12, April (4) is the conventional Indian financial-year start.
    fyStartMonth: { type: Number, min: 1, max: 12, default: 4 },

    notificationEmails: { type: [String], default: [] },
    lowStockAlertEnabled:          { type: Boolean, default: false },
    overdueReceivableAlertEnabled: { type: Boolean, default: false },
    overdueReceivableDays:         { type: Number, default: 30 }, // alerting threshold only — no due-date field exists anywhere else

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceCompanySettings = mongoose.models.financeCompanySettings || mongoose.model('financeCompanySettings', financeCompanySettingsSchema);
export default FinanceCompanySettings;
