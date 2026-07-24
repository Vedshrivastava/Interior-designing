import mongoose from 'mongoose';

const financeEmployeeSchema = new mongoose.Schema({
    name:        { type: String, required: true },
    designation: { type: String, default: '' },
    // Structured, unlike designation (free text) — the only thing every
    // supervisor-assignment picker (New Project, Works, Employees page)
    // actually filters on. designation stays purely descriptive (Data
    // Entry, Social Media, Site Supervisor, whatever) and never gates
    // anything.
    role: { type: String, enum: ['supervisor', 'staff'], default: 'staff' },
    phone:       { type: String, default: '' },
    email:       { type: String, default: '' },
    salary:      { type: Number, default: 0 },
    joiningDate: { type: Date },

    // Mandatory — this is who actually gets paid when salary is recorded
    // against this employee (financeSalaryPayment); also covers
    // Supervisors, who are just financeEmployee rows with no separate model.
    accountName:   { type: String, required: true },
    bankName:      { type: String, required: true },
    accountNumber: { type: String, required: true },
    ifscCode:      { type: String, required: true },

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
