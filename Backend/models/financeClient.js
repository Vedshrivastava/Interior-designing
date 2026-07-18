import mongoose from 'mongoose';

const financeClientSchema = new mongoose.Schema({
    name:       { type: String, required: true },
    phone:      { type: String, default: '' },
    email:      { type: String, default: '' },
    address:    { type: String, default: '' },
    gstNumber:  { type: String, default: '' },

    // Mandatory for every person/entity the studio might ever pay or
    // refund — bank details, not payment history (see financeReceipt/
    // financeContractorPayment/etc. for that).
    accountName:   { type: String, required: true },
    bankName:      { type: String, required: true },
    accountNumber: { type: String, required: true },
    ifscCode:      { type: String, required: true },

    notes:      { type: String, default: '' },
    deleted:    { type: Boolean, default: false },
    deletedAt:  { type: Date },
    deletedBy:  { type: String },
}, { timestamps: true });

const FinanceClient = mongoose.models.financeClient || mongoose.model('financeClient', financeClientSchema);
export default FinanceClient;
