import mongoose from 'mongoose';

// One collection for every admin-editable enum list that used to be a
// Settings & Lists dropdown in Excel — work types, expense categories,
// payment modes, TDS sections — scoped by `settingType` instead of one
// near-empty collection each.
const financeSettingSchema = new mongoose.Schema({
    settingType: {
        type: String,
        enum: ['work_type', 'expense_category', 'payment_mode', 'tds_section'],
        required: true,
    },
    name:      { type: String, required: true },
    code:      { type: String, default: '' },  // e.g. TDS section code "194C-IND"
    rate:      { type: Number, default: null }, // e.g. TDS rate percent
    order:     { type: Number, default: 999 },
    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

financeSettingSchema.index({ settingType: 1, name: 1 }, { unique: true });

const FinanceSetting = mongoose.models.financeSetting || mongoose.model('financeSetting', financeSettingSchema);
export default FinanceSetting;
