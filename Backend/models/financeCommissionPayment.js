import mongoose from 'mongoose';

// A commission payout to a referral (its own financeReferral collection,
// not a financeVendor), settling part of the balance the commission
// ledger computes.
const financeCommissionPaymentSchema = new mongoose.Schema({
    referralId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeReferral', required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', default: null },

    amount: { type: Number, required: true },
    date:   { type: Date, required: true },

    paymentMode:     { type: String, default: '' },
    bankAccountId:   { type: mongoose.Schema.Types.ObjectId, ref: 'financeBankAccount', default: null }, // no bankAccountId means cash — see controllers/financeCommissionPayment.js's cash-entry automation
    bankOrCashLabel: { type: String, default: '' },
    utrNumber:       { type: String, default: '' },
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

const FinanceCommissionPayment = mongoose.models.financeCommissionPayment || mongoose.model('financeCommissionPayment', financeCommissionPaymentSchema);
export default FinanceCommissionPayment;
