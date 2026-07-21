import mongoose from 'mongoose';

// A payout to a labourer's labour provider (financeVendor with vendorType
// 'labour_provider'), settling part of the balance the labour provider
// ledger computes. Mirrors financeCommissionPayment exactly — same shape,
// different vendor type on the other end.
const financeLabourProviderPaymentSchema = new mongoose.Schema({
    vendorId:  { type: mongoose.Schema.Types.ObjectId, ref: 'financeVendor', required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', default: null },

    amount: { type: Number, required: true },
    date:   { type: Date, required: true },

    paymentMode:     { type: String, default: '' },
    bankAccountId:   { type: mongoose.Schema.Types.ObjectId, ref: 'financeBankAccount', default: null }, // no bankAccountId means cash — see controllers/financeLabourProviderPayment.js's cash-entry automation
    bankOrCashLabel: { type: String, default: '' },
    utrNumber:       { type: String, default: '' },
    notes:           { type: String, default: '' },

    tdsSectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeSetting', default: null },
    tdsAmount:    { type: Number, default: null },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceLabourProviderPayment = mongoose.models.financeLabourProviderPayment || mongoose.model('financeLabourProviderPayment', financeLabourProviderPaymentSchema);
export default FinanceLabourProviderPayment;
