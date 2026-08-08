import mongoose from 'mongoose';

// An actual payout to a labour contractor, settling part of the balance
// the ledger computes.
const financeContractorPaymentSchema = new mongoose.Schema({
    vendorId:  { type: mongoose.Schema.Types.ObjectId, ref: 'financeVendor', required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', default: null },
    workId:    { type: mongoose.Schema.Types.ObjectId, ref: 'financeWork', default: null }, // optional — which Work this payment is for, used to auto-resolve a TDS Section from that Work's type

    amount: { type: Number, required: true },
    date:   { type: Date, required: true },

    paymentMode:     { type: String, default: '' },
    // bankOrCashLabel is kept for backward compatibility with records
    // created before Bank existed — new records set bankAccountId instead
    // when paymentMode is bank-based. No bankAccountId means cash (see
    // controllers/financeContractorPayment.js's cash-entry automation).
    bankOrCashLabel: { type: String, default: '' },
    bankAccountId:   { type: mongoose.Schema.Types.ObjectId, ref: 'financeBankAccount', default: null },
    utrNumber:       { type: String, default: '' },
    attachmentUrl:   { type: String, default: '' }, // Cloudinary URL, same upload pattern as design/product images
    notes:           { type: String, default: '' },

    // Optional — TDS is deducted from the payment at entry time, so it's
    // captured manually here rather than derived; unset on every record
    // from before this field existed. tdsSectionId refs financeSetting
    // where settingType: 'tds_section'.
    tdsSectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeSetting', default: null },
    tdsAmount:    { type: Number, default: null },

    // Retention/security holding — unlike TDS, this money never leaves the
    // company at all; it's kept back until the project completes, so it
    // does NOT discharge what's owed the way TDS does. See
    // financeContractorLedger.js's balancePayable comment: `amount −
    // holdingAmount` (not the full gross amount) is what counts as
    // actually paid for this field. Requires projectId (enforced in the
    // controller, not the schema) since release is tied to one specific
    // project's completion.
    holdingPercent: { type: Number, default: null },
    holdingAmount:  { type: Number, default: null },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceContractorPayment = mongoose.models.financeContractorPayment || mongoose.model('financeContractorPayment', financeContractorPaymentSchema);
export default FinanceContractorPayment;
