import mongoose from 'mongoose';

// An actual payout to a labour contractor, settling part of the balance
// the ledger computes.
const financeContractorPaymentSchema = new mongoose.Schema({
    vendorId:  { type: mongoose.Schema.Types.ObjectId, ref: 'financeVendor', required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', default: null },

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

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceContractorPayment = mongoose.models.financeContractorPayment || mongoose.model('financeContractorPayment', financeContractorPaymentSchema);
export default FinanceContractorPayment;
