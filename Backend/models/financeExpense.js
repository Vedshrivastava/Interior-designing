import mongoose from 'mongoose';

// General company/site expense — not tied to a vendor, contractor, or
// employee. A straightforward paid-when-entered log, unlike the other
// payables here: no earned-vs-paid ledger, no computed balance.
const financeExpenseSchema = new mongoose.Schema({
    expenseCategory: { type: String, default: '' }, // reuses financeSetting's expense_category values
    projectId:       { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', default: null }, // some expenses are project-specific, some are general overhead
    workId:          { type: mongoose.Schema.Types.ObjectId, ref: 'financeWork', default: null }, // optional — scoped to one Work under projectId, not validated against it beyond the UI only offering that project's Works

    // Who/what this expense was actually for — optional, and deliberately
    // narrower than a full polymorphic "any collection" ref: financeEmployee
    // (staff/supervisors), financeLabourer (day-wage roster), financeVendor
    // (covers both Contractor and plain Vendor/Supplier in the UI,
    // distinguished there by vendorType, not by a separate stored type),
    // and financeCompanySettings (the company's own singleton — for a
    // company-level/overhead expense the owner wants explicitly tagged
    // rather than left with no Related To at all) are the only valid
    // targets. Same refPath pattern as financeActivityLog's
    // entityType/entityId.
    relatedToType: { type: String, enum: ['financeEmployee', 'financeVendor', 'financeLabourer', 'financeCompanySettings', null], default: null },
    relatedToId:   { type: mongoose.Schema.Types.ObjectId, refPath: 'relatedToType', default: null },

    amount: { type: Number, required: true },
    date:   { type: Date, required: true },

    paymentMode:     { type: String, default: '' },
    bankAccountId:   { type: mongoose.Schema.Types.ObjectId, ref: 'financeBankAccount', default: null }, // no bankAccountId means cash — see controllers/financeExpense.js's cash-entry automation
    bankOrCashLabel: { type: String, default: '' },
    notes:           { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceExpense = mongoose.models.financeExpense || mongoose.model('financeExpense', financeExpenseSchema);
export default FinanceExpense;
