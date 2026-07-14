import mongoose from 'mongoose';

// One bulk settlement from a supervisor's accumulated financeDailyLabour
// entries — the real-world process is one payment covering many entries,
// not each entry paid individually. totalAmount is frozen at creation from
// the sum of coveredDailyLabourIds' own amounts, same reasoning as a
// Running Bill snapshotting its line items.
const financeSupervisorLabourPaymentSchema = new mongoose.Schema({
    supervisorId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeEmployee', required: true },
    coveredDailyLabourIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'financeDailyLabour', required: true }],

    totalAmount: { type: Number, required: true },
    date:        { type: Date, required: true },

    paymentMode:     { type: String, default: '' },
    bankAccountId:   { type: mongoose.Schema.Types.ObjectId, ref: 'financeBankAccount', default: null }, // the supervisor's account, not any labourer's
    bankOrCashLabel: { type: String, default: '' },
    utrNumber:       { type: String, default: '' },
    notes:           { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceSupervisorLabourPayment = mongoose.models.financeSupervisorLabourPayment
    || mongoose.model('financeSupervisorLabourPayment', financeSupervisorLabourPaymentSchema);
export default FinanceSupervisorLabourPayment;
