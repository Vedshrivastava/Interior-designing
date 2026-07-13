import mongoose from 'mongoose';

// A real bank account — receipts, contractor/vendor payments, and
// transfers can all point at one via bankAccountId. Current balance is
// never stored: always openingBalance + computed activity, see
// controllers/financeBankAccount.js.
const financeBankAccountSchema = new mongoose.Schema({
    accountName: { type: String, required: true },
    bankName:    { type: String, required: true },
    accountNumber: { type: String, default: '' },
    ifscCode:      { type: String, default: '' },
    accountType:   { type: String, default: '' },

    openingBalance:     { type: Number, required: true },
    openingBalanceDate: { type: Date, required: true },
    notes:              { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceBankAccount = mongoose.models.financeBankAccount || mongoose.model('financeBankAccount', financeBankAccountSchema);
export default FinanceBankAccount;
