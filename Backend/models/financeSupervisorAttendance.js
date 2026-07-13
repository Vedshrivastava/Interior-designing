import mongoose from 'mongoose';

// One day's attendance status for one supervisor (a financeEmployee) — no
// separate Supervisor entity, same reasoning as financeSupervisorIncentive.
const financeSupervisorAttendanceSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeEmployee', required: true },
    date:       { type: Date, required: true },
    status:     { type: String, enum: ['present', 'absent', 'half_day', 'leave'], required: true },
    notes:      { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceSupervisorAttendance = mongoose.models.financeSupervisorAttendance || mongoose.model('financeSupervisorAttendance', financeSupervisorAttendanceSchema);
export default FinanceSupervisorAttendance;
