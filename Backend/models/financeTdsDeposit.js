import mongoose from 'mongoose';

// An actual deposit the company made to the tax department, settling part
// (or all) of the TDS Payable balance — the sum of every tdsAmount ever
// withheld across contractor/vendor/salary/labour/commission/labour-provider
// payments (computed fresh, see financeReports.js's computeTdsPayable),
// minus every deposit recorded here. Same shape as financeReceipt settling
// a financeRunningBill's balance.
const financeTdsDepositSchema = new mongoose.Schema({
    amount: { type: Number, required: true },
    date:   { type: Date, required: true },

    // Optional — a deposit is often one lump sum covering every section
    // withheld that period (a single challan), not always split by
    // section. When set, this deposit only reduces that one section's own
    // payable; when null, it reduces the unattributed/general pool first.
    tdsSectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeSetting', default: null },

    challanNumber: { type: String, default: '' },
    bankAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeBankAccount', default: null }, // no bankAccountId means cash
    notes:         { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceTdsDeposit = mongoose.models.financeTdsDeposit || mongoose.model('financeTdsDeposit', financeTdsDepositSchema);
export default FinanceTdsDeposit;
