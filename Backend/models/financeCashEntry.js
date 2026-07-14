import mongoose from 'mongoose';

// The Cash Book. Entries with one of the relatedXId fields set were
// created automatically by a cash-mode receipt/contractor payment/vendor
// payment/salary payment/commission payment/expense/supervisor incentive/
// supervisor labour settlement (see those controllers) — not manually
// re-editable through the Cash Book UI; edit the originating record
// instead. Manual entries (nothing set) are for cash with no originating
// record — petty cash, owner draws. Daily labour entries themselves no
// longer create a per-entry cash entry — see financeSupervisorLabourPayment.
const financeCashEntrySchema = new mongoose.Schema({
    date:   { type: Date, required: true },
    type:   { type: String, enum: ['in', 'out'], required: true },
    amount: { type: Number, required: true },

    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', default: null },
    reason:    { type: String, required: true },

    relatedReceiptId:             { type: mongoose.Schema.Types.ObjectId, ref: 'financeReceipt', default: null },
    relatedContractorPaymentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'financeContractorPayment', default: null },
    relatedVendorPaymentId:       { type: mongoose.Schema.Types.ObjectId, ref: 'financeVendorPayment', default: null },
    relatedSalaryPaymentId:       { type: mongoose.Schema.Types.ObjectId, ref: 'financeSalaryPayment', default: null },
    relatedCommissionPaymentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'financeCommissionPayment', default: null },
    relatedExpenseId:             { type: mongoose.Schema.Types.ObjectId, ref: 'financeExpense', default: null },
    relatedDailyLabourId:         { type: mongoose.Schema.Types.ObjectId, ref: 'financeDailyLabour', default: null }, // legacy — daily labour no longer creates its own cash entry
    relatedSupervisorIncentiveId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeSupervisorIncentive', default: null },
    relatedSupervisorLabourPaymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeSupervisorLabourPayment', default: null },

    notes: { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceCashEntry = mongoose.models.financeCashEntry || mongoose.model('financeCashEntry', financeCashEntrySchema);
export default FinanceCashEntry;
