import mongoose from 'mongoose';

// A payment the CLIENT made directly to a contractor/labourer on-site,
// bypassing the company entirely. Recorded here so it can still reduce (a)
// the client's outstanding balance for the project (they already paid this
// much toward the work) and, depending on categoryId's flags, (b) that same
// contractor/labourer's own balance payable from the company (see
// getWorkerPayoutDeductionTotal/getClientBillCreditTotal in
// financeClientDirectPayment.js — the controller, not this model). No cash/
// bank ledger entry is ever created for this — the money never touched the
// company's own accounts.
const financeClientDirectPaymentSchema = new mongoose.Schema({
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', required: true },
    workId:    { type: mongoose.Schema.Types.ObjectId, ref: 'financeWork', required: true },

    partyType: { type: String, enum: ['contractor', 'labour'], required: true },
    // refPath-style on partyType — ref financeVendor when 'contractor', ref financeLabourer when 'labour'.
    partyId:   { type: mongoose.Schema.Types.ObjectId, required: true },

    // ref financeSetting where settingType: 'direct_payment_category' —
    // its deductFromClientBill/deductFromWorkerPayout flags decide this
    // entry's actual financial effect.
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeSetting', required: true },

    amount: { type: Number, required: true },
    date:   { type: Date, required: true },
    notes:  { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceClientDirectPayment = mongoose.models.financeClientDirectPayment
    || mongoose.model('financeClientDirectPayment', financeClientDirectPaymentSchema);
export default FinanceClientDirectPayment;
