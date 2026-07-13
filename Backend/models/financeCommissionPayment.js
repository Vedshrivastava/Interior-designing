import mongoose from 'mongoose';

// A commission payout to a referral vendor (financeVendor with vendorType
// 'referral'), settling part of the balance the commission ledger computes.
const financeCommissionPaymentSchema = new mongoose.Schema({
    vendorId:  { type: mongoose.Schema.Types.ObjectId, ref: 'financeVendor', required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', default: null },

    amount: { type: Number, required: true },
    date:   { type: Date, required: true },

    paymentMode:     { type: String, default: '' },
    bankAccountId:   { type: mongoose.Schema.Types.ObjectId, ref: 'financeBankAccount', default: null }, // no bankAccountId means cash — see controllers/financeCommissionPayment.js's cash-entry automation
    bankOrCashLabel: { type: String, default: '' },
    utrNumber:       { type: String, default: '' },
    notes:           { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceCommissionPayment = mongoose.models.financeCommissionPayment || mongoose.model('financeCommissionPayment', financeCommissionPaymentSchema);
export default FinanceCommissionPayment;
