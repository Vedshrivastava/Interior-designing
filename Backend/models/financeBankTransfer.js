import mongoose from 'mongoose';

// A transfer between two of our own bank accounts — a debit on
// fromAccountId's statement, a credit on toAccountId's.
const financeBankTransferSchema = new mongoose.Schema({
    fromAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeBankAccount', required: true },
    toAccountId:   { type: mongoose.Schema.Types.ObjectId, ref: 'financeBankAccount', required: true },

    amount: { type: Number, required: true },
    date:   { type: Date, required: true },
    notes:  { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceBankTransfer = mongoose.models.financeBankTransfer || mongoose.model('financeBankTransfer', financeBankTransferSchema);
export default FinanceBankTransfer;
