import mongoose from 'mongoose';

// Additional contact persons at a client (site engineer, accounts contact,
// etc.) beyond the client's own primary phone/email on financeClient.
const financeClientContactSchema = new mongoose.Schema({
    clientId:    { type: mongoose.Schema.Types.ObjectId, ref: 'financeClient', required: true },
    name:        { type: String, required: true },
    designation: { type: String, default: '' },
    phone:       { type: String, default: '' },
    email:       { type: String, default: '' },
    notes:       { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceClientContact = mongoose.models.financeClientContact || mongoose.model('financeClientContact', financeClientContactSchema);
export default FinanceClientContact;
