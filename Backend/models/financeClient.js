import mongoose from 'mongoose';

const financeClientSchema = new mongoose.Schema({
    name:       { type: String, required: true },
    phone:      { type: String, default: '' },
    email:      { type: String, default: '' },
    address:    { type: String, default: '' },
    gstNumber:  { type: String, default: '' },
    notes:      { type: String, default: '' },
    deleted:    { type: Boolean, default: false },
    deletedAt:  { type: Date },
    deletedBy:  { type: String },
}, { timestamps: true });

const FinanceClient = mongoose.models.financeClient || mongoose.model('financeClient', financeClientSchema);
export default FinanceClient;
