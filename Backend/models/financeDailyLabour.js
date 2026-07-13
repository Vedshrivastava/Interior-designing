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

    paymentMode:     { type: String, default: '' },
    bankAccountId:   { type: mongoose.Schema.Types.ObjectId, ref: 'financeBankAccount', default: null }, // no bankAccountId means cash — see controller's cash-entry automation
    bankOrCashLabel: { type: String, default: '' },
    notes:           { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceDailyLabour = mongoose.models.financeDailyLabour || mongoose.model('financeDailyLabour', financeDailyLabourSchema);
export default FinanceDailyLabour;
