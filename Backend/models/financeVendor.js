import mongoose from 'mongoose';

const financeVendorSchema = new mongoose.Schema({
    name:       { type: String, required: true },
    // Referral and Labour Provider used to be vendorType values here —
    // split into their own financeReferral/financeLabourProvider
    // collections entirely, since neither is someone the studio actually
    // purchases anything from (the one thing "vendor" means everywhere
    // else in this schema — bank details, documents, purchase/payment
    // history).
    vendorType: {
        type: String,
        enum: ['material_supplier', 'labour_contractor', 'other'],
        default: 'other',
    },
    phone:      { type: String, default: '' },
    email:      { type: String, default: '' },
    address:    { type: String, default: '' },
    gstNumber:  { type: String, default: '' },

    // Mandatory for every person/entity the studio might ever pay —
    // this is who actually gets paid when a payment is recorded against
    // this vendor (financeContractorPayment/financeVendorPayment).
    accountName:   { type: String, required: true },
    bankName:      { type: String, required: true },
    accountNumber: { type: String, required: true },
    ifscCode:      { type: String, required: true },

    notes:      { type: String, default: '' },

    // Agreement, GST cert, ID proof, etc. — attached when the vendor is
    // added, each carrying its own note saying what the document is.
    documents: [{
        url:  { type: String, required: true },
        note: { type: String, default: '' },
    }],

    deleted:    { type: Boolean, default: false },
    deletedAt:  { type: Date },
    deletedBy:  { type: String },
}, { timestamps: true });

const FinanceVendor = mongoose.models.financeVendor || mongoose.model('financeVendor', financeVendorSchema);
export default FinanceVendor;
