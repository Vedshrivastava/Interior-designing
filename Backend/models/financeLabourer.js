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

    // Optional — a middleman who supplied/connected this labourer, distinct
    // from the supervisor who runs their day-to-day crew. Both fields are
    // set together, once, when the provider is connected (or left null for
    // a labourer hired directly with no provider involved). The rate here
    // is fixed to this one labourer regardless of which project/work they
    // end up on — unlike financeLabourRate (per project + work type),
    // there's deliberately no per-project variation for this.
    //
    // The provider's cut is a separate, additional cost the company pays
    // OUT to them (financeLabourProviderPayment) — it is never subtracted
    // from this labourer's own earnings/rate. Computed purely as
    // (this labourer's own reviewed sqft on a Work) × labourProviderRatePerSqft,
    // same "Approved = reviewed" gate as the labourer's own pay
    // (see controllers/financeLabourProviderLedger.js). References
    // financeLabourProvider, not financeVendor — a labour provider isn't
    // someone the studio purchases anything from.
    labourProviderId:          { type: mongoose.Schema.Types.ObjectId, ref: 'financeLabourProvider', default: null },
    labourProviderRatePerSqft: { type: Number, default: null },

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
