import mongoose from 'mongoose';

const financeEmployeeSchema = new mongoose.Schema({
    name:        { type: String, required: true },
    designation: { type: String, default: '' },
    phone:       { type: String, default: '' },
    email:       { type: String, default: '' },
    salary:      { type: Number, default: 0 },
    joiningDate: { type: Date },
    notes:       { type: String, default: '' },
    deleted:     { type: Boolean, default: false },
    deletedAt:   { type: Date },
    deletedBy:   { type: String },
}, { timestamps: true });

const FinanceEmployee = mongoose.models.financeEmployee || mongoose.model('financeEmployee', financeEmployeeSchema);
export default FinanceEmployee;
