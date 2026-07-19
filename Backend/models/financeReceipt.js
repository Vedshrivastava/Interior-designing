import mongoose from 'mongoose';

// Money actually received from a client. Not tied to decrementing anything
// stored — the receivable balance is always computed on read (see
// controllers/financeReceipt.js's summary endpoint).
const financeReceiptSchema = new mongoose.Schema({
    clientId:  { type: mongoose.Schema.Types.ObjectId, ref: 'financeClient', required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', required: true },

    // Not every receipt is tied to one specific bill (e.g. a lump-sum
    // payment against the running balance).
    runningBillId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeRunningBill', default: null },

    // Sequential per project, assigned at creation — same pattern as
    // financeRunningBill's billNumber. Nullable so pre-existing receipts
    // (created before this field existed) don't need a backfill.
    receiptNumber: { type: String, default: null },

    amount:      { type: Number, required: true },
    receiptDate: { type: Date, required: true },
    paymentMode: { type: String, default: '' }, // reuses financeSetting's payment_mode values

    // bankOrCashLabel is kept for backward compatibility with records
    // created before Bank existed — new records set bankAccountId instead
    // when paymentMode is bank-based. No bankAccountId means cash (see
    // controllers/financeReceipt.js's cash-entry automation).
    bankOrCashLabel: { type: String, default: '' },
    bankAccountId:   { type: mongoose.Schema.Types.ObjectId, ref: 'financeBankAccount', default: null },
    utrNumber:       { type: String, default: '' },
    notes:           { type: String, default: '' },

    // Set only on the receipt created when an Advance-contract project's
    // advance is recorded (see recordAdvanceReceived). Starts with
    // runningBillId null (undrawn credit); generateRunningBill applies it
    // against that project's first bill(s) as they're generated, splitting
    // it across bills if the advance is bigger than one bill's total — see
    // that function's applyAdvanceCredit step. Statement PDFs use this
    // flag to label the payment "(Advance)" instead of a fresh receipt.
    isAdvance: { type: Boolean, default: false },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceReceipt = mongoose.models.financeReceipt || mongoose.model('financeReceipt', financeReceiptSchema);
export default FinanceReceipt;
