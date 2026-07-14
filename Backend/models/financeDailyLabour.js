import mongoose from 'mongoose';

// Casual/daily-wage labour, distinct from contractor teams (financeTeam) —
// no separate labourer master exists, so each entry is name-only. amount
// is computed and frozen at entry time from rate × the attendanceType
// multiplier (see controllers/financeDailyLabour.js), same "snapshot, not
// recompute later" rule used for Running Bill line items and Purchases.
const financeDailyLabourSchema = new mongoose.Schema({
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', required: true },
    date:      { type: Date, required: true },

    labourerName:   { type: String, required: true },
    attendanceType: { type: String, enum: ['half_day', 'full_day', 'extra_day'], required: true },
    rate:           { type: Number, required: true },
    amount:         { type: Number, required: true },

    supervisorId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeEmployee', default: null }, // who recorded this

    // Deprecated — payment used to happen per entry, but the real process is
    // one bulk settlement per supervisor covering many entries (see
    // financeSupervisorLabourPayment). Kept only for backward compatibility
    // with rows seeded before that model existed; no longer populated by
    // new entries and no longer drives any cash-entry automation.
    paymentMode:     { type: String, default: '' },
    bankAccountId:   { type: mongoose.Schema.Types.ObjectId, ref: 'financeBankAccount', default: null },
    bankOrCashLabel: { type: String, default: '' },

    // Set automatically when a financeSupervisorLabourPayment settlement
    // covers this entry — mirrors billedInRunningBillId on measurements.
    settledInPaymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeSupervisorLabourPayment', default: null },

    notes: { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceDailyLabour = mongoose.models.financeDailyLabour || mongoose.model('financeDailyLabour', financeDailyLabourSchema);
export default FinanceDailyLabour;
