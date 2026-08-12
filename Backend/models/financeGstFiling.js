import mongoose from 'mongoose';

// One record per calendar month — what the CA actually filed (GSTR-3B)
// once it's known, entered by hand once the CA communicates the real
// figures. Once a month has a filing here, it overrides that month's own
// computed estimate everywhere: computeGstItcPosition (CA Monthly Package,
// Dashboard's GST Claimable card) uses gstPayable/gstClaimable directly
// instead of deriving them from purchases/sales/expenses, and next
// month's own opening ITC brought-forward carries from gstClaimable here
// too — the system's own estimate has no way to know about blocked
// credit, reversals, or rounding a real filing applies.
//
// taxPaid is a separate concept (Income/Advance Tax paid to the IT
// department, not GST) — tracked here since it's told to the owner on the
// same CA-updates-us-once-a-month cadence, but it never feeds GST math;
// it's a running log only, no "payable" computed for it anywhere (that
// would need real income-tax-slab rules this system doesn't model).
const financeGstFilingSchema = new mongoose.Schema({
    month: { type: String, required: true, unique: true }, // 'YYYY-MM'
    gstPayable:   { type: Number, default: 0 },
    gstClaimable: { type: Number, default: 0 }, // ITC carried forward, as filed
    taxPaid:      { type: Number, default: 0 },
    filedDate: { type: Date, default: null },
    notes:     { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceGstFiling = mongoose.models.financeGstFiling || mongoose.model('financeGstFiling', financeGstFilingSchema);
export default FinanceGstFiling;
