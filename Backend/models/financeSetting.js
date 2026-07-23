import mongoose from 'mongoose';

// One collection for every admin-editable enum list that used to be a
// Settings & Lists dropdown in Excel — work types, expense categories,
// payment modes, TDS sections, units, cities, commission types, direct
// payment categories — scoped by `settingType` instead of one near-empty
// collection each. unit/city back a UI-level dropdown-with-escape-hatch on
// financeMaterial.unit / financeProject.siteLocation (both stay plain
// Strings — see those controllers); commission_type backs
// financeReferral.commissionTypeLabel, which is descriptive/reporting only
// and never affects commission math.
const financeSettingSchema = new mongoose.Schema({
    settingType: {
        type: String,
        enum: ['work_type', 'expense_category', 'payment_mode', 'tds_section', 'unit', 'city', 'commission_type', 'direct_payment_category'],
        required: true,
    },
    name:      { type: String, required: true },
    code:      { type: String, default: '' },  // e.g. TDS section code "194C-IND"
    rate:      { type: Number, default: null }, // e.g. TDS rate percent
    // direct_payment_category only — whether a financeClientDirectPayment
    // tagged with this category reduces the client's outstanding balance
    // (getClientBillCreditTotal) and/or the contractor/labourer's own
    // balance payable (getWorkerPayoutDeductionTotal). See
    // financeClientDirectPayment.js for the actual math.
    deductFromClientBill:   { type: Boolean, default: true },
    deductFromWorkerPayout: { type: Boolean, default: false },
    order:     { type: Number, default: 999 },
    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

financeSettingSchema.index({ settingType: 1, name: 1 }, { unique: true });

const FinanceSetting = mongoose.models.financeSetting || mongoose.model('financeSetting', financeSettingSchema);
export default FinanceSetting;
