import mongoose from 'mongoose';

const financeEmployeeSchema = new mongoose.Schema({
    name:        { type: String, required: true },
    designation: { type: String, default: '' },
    phone:       { type: String, default: '' },
    email:       { type: String, default: '' },
    salary:      { type: Number, default: 0 },
    joiningDate: { type: Date },
    notes:       { type: String, default: '' },

    // ID proof, appointment letter, etc. — each carries its own note
    // saying what the document is. Also covers Supervisors, who are just
    // financeEmployee rows with no separate model.
    documents: [{
        url:  { type: String, required: true },
        note: { type: String, default: '' },
    }],

    deleted:     { type: Boolean, default: false },
    deletedAt:   { type: Date },
    deletedBy:   { type: String },
}, { timestamps: true });

const FinanceEmployee = mongoose.models.financeEmployee || mongoose.model('financeEmployee', financeEmployeeSchema);
export default FinanceEmployee;
