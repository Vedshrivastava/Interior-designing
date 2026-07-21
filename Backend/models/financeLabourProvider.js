import mongoose from 'mongoose';

// A middleman who supplies/connects labourers, earning a fixed ₹/sqft cut
// on each connected labourer's own reviewed sqft — split out of
// financeVendor entirely (was vendorType 'labour_provider') since a
// labour provider isn't someone the studio purchases anything from; it
// just happened to share the same "pay this person/entity" shape as an
// actual vendor. See financeLabourer.labourProviderId/
// labourProviderRatePerSqft and controllers/financeLabourProviderLedger.js.
const financeLabourProviderSchema = new mongoose.Schema({
    name:      { type: String, required: true },
    phone:     { type: String, default: '' },
    email:     { type: String, default: '' },
    address:   { type: String, default: '' },
    gstNumber: { type: String, default: '' },

    accountName:   { type: String, required: true },
    bankName:      { type: String, required: true },
    accountNumber: { type: String, required: true },
    ifscCode:      { type: String, required: true },

    notes: { type: String, default: '' },

    documents: [{
        url:  { type: String, required: true },
        note: { type: String, default: '' },
    }],

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceLabourProvider = mongoose.models.financeLabourProvider || mongoose.model('financeLabourProvider', financeLabourProviderSchema);
export default FinanceLabourProvider;
