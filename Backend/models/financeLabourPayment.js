import mongoose from 'mongoose';

// An actual payout to a labourer, settling part of the balance the ledger
// computes — mirrors financeContractorPayment. Every labourer is paid
// individually now (not a lump sum through the supervisor), so this is
// scoped per labourer.
const financeLabourPaymentSchema = new mongoose.Schema({
    labourerId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeLabourer', required: true },
    projectId:  { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', default: null },
    workId:     { type: mongoose.Schema.Types.ObjectId, ref: 'financeWork', default: null }, // optional — which Work this payment is for, used to auto-resolve a TDS Section from that Work's type

    amount: { type: Number, required: true },
    date:   { type: Date, required: true },

    paymentMode:     { type: String, default: '' },
    bankOrCashLabel: { type: String, default: '' }, // no bankAccountId means cash — see controller's cash-entry automation
    bankAccountId:   { type: mongoose.Schema.Types.ObjectId, ref: 'financeBankAccount', default: null },
    notes:           { type: String, default: '' },

    // Mirrors financeContractorPayment's identical fields — see that
    // model's comment. amount stays the gross figure (what reduces the
    // labourer's Balance Payable); tdsAmount is withheld from the actual
    // cash/bank outflow, not from amount itself.
    tdsSectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeSetting', default: null },
    tdsAmount:    { type: Number, default: null },

    // Retention/security holding — see financeContractorPayment.js's
    // identical field for the full reasoning (unlike TDS, doesn't discharge
    // what's owed; requires projectId, enforced in the controller).
    holdingPercent: { type: Number, default: null },
    holdingAmount:  { type: Number, default: null },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

financeLabourPaymentSchema.index({ labourerId: 1, projectId: 1 });

const FinanceLabourPayment = mongoose.models.financeLabourPayment || mongoose.model('financeLabourPayment', financeLabourPaymentSchema);
export default FinanceLabourPayment;
