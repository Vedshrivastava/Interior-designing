import mongoose from 'mongoose';

// A referral person/entity that earns a commission (area × a work type's
// referralRatePerSqft) for projects they brought in — split out of
// financeVendor entirely (was vendorType 'referral') since a referral
// isn't someone the studio purchases anything from; it just happened to
// share the same "pay this person/entity" shape as an actual vendor.
const financeReferralSchema = new mongoose.Schema({
    name:      { type: String, required: true },
    phone:     { type: String, default: '' },
    email:     { type: String, default: '' },
    address:   { type: String, default: '' },
    gstNumber: { type: String, default: '' },

    accountName:   { type: String, required: true },
    bankName:      { type: String, required: true },
    accountNumber: { type: String, required: true },
    ifscCode:      { type: String, required: true },

    // Descriptive/reporting only, populated from the Commission Types
    // master (financeSetting, settingType: 'commission_type'). Does NOT
    // affect commission math: the commission ledger
    // (controllers/financeCommissionLedger.js) only ever computes
    // completedAreaSqft × financeWorkTypeRate.referralRatePerSqft.
    commissionTypeLabel: { type: String, default: '' },

    notes: { type: String, default: '' },

    documents: [{
        url:  { type: String, required: true },
        note: { type: String, default: '' },
    }],

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceReferral = mongoose.models.financeReferral || mongoose.model('financeReferral', financeReferralSchema);
export default FinanceReferral;
