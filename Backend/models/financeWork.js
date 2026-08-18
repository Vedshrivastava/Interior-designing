import mongoose from 'mongoose';

// A work item under a project — e.g. "ABC Mall → Putty". `workType` is the
// same free-text value already used in financeWorkTypeRate/financeContractorRate,
// so client/referral/contractor rates resolve by looking up (projectId, workType)
// / (projectId, contractorVendorId, workType) rather than duplicating rate
// fields here. Contractor assignment is one-to-many via
// financeWorkContractorAssignment, since a Work can have more than one
// contractor splitting its area.
const financeWorkSchema = new mongoose.Schema({
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', required: true },
    workType:  { type: String, required: true },

    workOrderNumber:    { type: String, default: '' },
    startDate:          { type: Date },
    // Named *AreaSqft for historical reasons (every existing Work is
    // sqft-measured) — the number itself is unit-agnostic (quantity × rate
    // = amount regardless of unit), so a Nos/Rft-measured Work stores its
    // count/length in this same field rather than a parallel one. `unit`
    // below is what actually decides which word labels it everywhere it's
    // shown.
    estimatedAreaSqft:  { type: Number, required: true },

    // Running total — only ever updated by the measurement-save automation
    // (see controllers/financeMeasurement.js). Never accepted from the
    // update endpoint directly.
    completedAreaSqft:  { type: Number, default: 0 },

    // Snapshotted from the selected Work Type's own financeSetting.
    // measurementUnit at creation time (see that field's own comment) —
    // never re-resolved later, so editing a Work Type's unit afterward
    // can't silently relabel a Work that was already measured under the
    // old one. Defaults to 'sqft' — every Work created before this field
    // existed is, and always was, sqft-measured.
    unit: { type: String, enum: ['sqft', 'nos', 'rft'], default: 'sqft' },

    status: { type: String, enum: ['active', 'completed'], default: 'active' },
    notes:  { type: String, default: '' },

    // Set true only when this Work is created via the "quick add" flow
    // from Work Type Rates / Contractor Rates (see financeClientQuotation-
    // style side doors elsewhere) — skips workOrderNumber/startDate/notes
    // to unblock setting a rate right away. Surfaces as a "Details Missing"
    // badge in the Works list; cleared automatically the next time this
    // Work is saved through the normal full Edit Work form, since that
    // form exposes every field the quick-add path skipped.
    quickAdded: { type: Boolean, default: false },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceWork = mongoose.models.financeWork || mongoose.model('financeWork', financeWorkSchema);
export default FinanceWork;
