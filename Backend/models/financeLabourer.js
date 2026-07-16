import mongoose from 'mongoose';

// A named labourer hired directly by the company, on one supervisor's
// roster. Rate lives on financeLabourRate (per project + work type), not
// here — a labourer can earn differently across projects and work types.
const financeLabourerSchema = new mongoose.Schema({
    name:         { type: String, required: true },
    supervisorId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeEmployee', required: true },
    notes:        { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceLabourer = mongoose.models.financeLabourer || mongoose.model('financeLabourer', financeLabourerSchema);
export default FinanceLabourer;
