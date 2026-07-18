import mongoose from 'mongoose';

// A named labourer hired directly by the company — a plain, company-wide
// name (like a vendor), not owned by any one supervisor. Which supervisor
// oversees them is a fact about a specific Work assignment
// (financeWorkLabourAssignment.supervisorId), not the labourer themselves:
// the same person can be on one Work's team under Supervisor A and another
// Work's team under Supervisor B at the same time, and move to a different
// supervisor on a future project once the current one wraps up. Rate lives
// on financeLabourRate (per project + work type), not here either.
const financeLabourerSchema = new mongoose.Schema({
    name:  { type: String, required: true },

    // Mandatory — this is who actually gets paid when a labour payment is
    // recorded against this labourer (financeLabourPayment).
    accountName:   { type: String, required: true },
    bankName:      { type: String, required: true },
    accountNumber: { type: String, required: true },
    ifscCode:      { type: String, required: true },

    notes: { type: String, default: '' },

    // ID proof, agreement, etc. — attached when the labourer is added,
    // each carrying its own note saying what the document is.
    documents: [{
        url:  { type: String, required: true },
        note: { type: String, default: '' },
    }],

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceLabourer = mongoose.models.financeLabourer || mongoose.model('financeLabourer', financeLabourerSchema);
export default FinanceLabourer;
