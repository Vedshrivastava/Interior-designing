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

    amount:      { type: Number, required: true },
    receiptDate: { type: Date, required: true },
    paymentMode: { type: String, default: '' }, // reuses financeSetting's payment_mode values

    // Plain text for now — no real Bank-account model exists yet. Upgrade
    // to a proper ref once Bank (Site Inventory's sibling placeholder) is
    // built for real.
    bankOrCashLabel: { type: String, default: '' },
    utrNumber:       { type: String, default: '' },
    notes:           { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceReceipt = mongoose.models.financeReceipt || mongoose.model('financeReceipt', financeReceiptSchema);
export default FinanceReceipt;
