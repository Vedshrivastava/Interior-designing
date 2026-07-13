import mongoose from 'mongoose';

// One salary payout for one employee, for one pay period (month).
const financeSalaryPaymentSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeEmployee', required: true },
    month:      { type: String, required: true }, // YYYY-MM — the pay period this payment is for
    amount:     { type: Number, required: true },
    date:       { type: Date, required: true }, // actual payment date

    paymentMode:     { type: String, default: '' },
    bankAccountId:   { type: mongoose.Schema.Types.ObjectId, ref: 'financeBankAccount', default: null }, // no bankAccountId means cash — see controllers/financeSalaryPayment.js's cash-entry automation
    bankOrCashLabel: { type: String, default: '' },
    utrNumber:       { type: String, default: '' },
    notes:           { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceSalaryPayment = mongoose.models.financeSalaryPayment || mongoose.model('financeSalaryPayment', financeSalaryPaymentSchema);
export default FinanceSalaryPayment;
