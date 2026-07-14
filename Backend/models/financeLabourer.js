import mongoose from 'mongoose';

// A named casual labourer on one supervisor's roster — gives
// financeDailyLabour a real identity to attribute to (labourerId) instead
// of only a free-text labourerName, which stays required and unchanged for
// backward compatibility with every entry logged before this existed.
const financeLabourerSchema = new mongoose.Schema({
    name:         { type: String, required: true },
    supervisorId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeEmployee', required: true },
    defaultRate:  { type: Number, default: 0 }, // convenience prefill for batch grid entry, not enforced anywhere
    notes:        { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceLabourer = mongoose.models.financeLabourer || mongoose.model('financeLabourer', financeLabourerSchema);
export default FinanceLabourer;
