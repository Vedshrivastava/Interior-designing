import mongoose from 'mongoose';

const financeVendorSchema = new mongoose.Schema({
    name:       { type: String, required: true },
    vendorType: {
        type: String,
        enum: ['material_supplier', 'labour_contractor', 'referral', 'other'],
        default: 'other',
    },
    phone:      { type: String, default: '' },
    email:      { type: String, default: '' },
    address:    { type: String, default: '' },
    gstNumber:  { type: String, default: '' },

    // Descriptive/reporting only — shown for vendorType 'referral' vendors,
    // populated from the Commission Types master (financeSetting,
    // settingType: 'commission_type'). Does NOT affect commission math:
    // the commission ledger (controllers/financeCommissionLedger.js) only
    // ever computes completedAreaSqft × financeWorkTypeRate.referralRatePerSqft.
    // Selecting a different commission type here changes nothing about
    // the actual payout — don't wire it into that calculation later
    // without deliberately deciding to.
    commissionTypeLabel: { type: String, default: '' },

    notes:      { type: String, default: '' },
    deleted:    { type: Boolean, default: false },
    deletedAt:  { type: Date },
    deletedBy:  { type: String },
}, { timestamps: true });

const FinanceVendor = mongoose.models.financeVendor || mongoose.model('financeVendor', financeVendorSchema);
export default FinanceVendor;
