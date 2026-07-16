import mongoose from 'mongoose';

// An actual payout to a labourer, settling part of the balance the ledger
// computes — mirrors financeContractorPayment. Every labourer is paid
// individually now (not a lump sum through the supervisor), so this is
// scoped per labourer.
const financeLabourPaymentSchema = new mongoose.Schema({
    labourerId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeLabourer', required: true },
    projectId:  { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', default: null },

    amount: { type: Number, required: true },
    date:   { type: Date, required: true },

    paymentMode:     { type: String, default: '' },
    bankOrCashLabel: { type: String, default: '' }, // no bankAccountId means cash — see controller's cash-entry automation
    bankAccountId:   { type: mongoose.Schema.Types.ObjectId, ref: 'financeBankAccount', default: null },
    notes:           { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceLabourPayment = mongoose.models.financeLabourPayment || mongoose.model('financeLabourPayment', financeLabourPaymentSchema);
export default FinanceLabourPayment;
