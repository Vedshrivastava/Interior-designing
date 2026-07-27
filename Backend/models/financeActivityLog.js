import mongoose from 'mongoose';

// Write-once system feed — populated by logActivity() calls alongside the
// broadcast() a write endpoint already fires, never edited/soft-deleted
// through normal use. entityType is a model name (e.g. 'financeMeasurement')
// used with refPath so entityId can point at any collection.
const financeActivityLogSchema = new mongoose.Schema({
    eventType:   { type: String, required: true },
    entityType:  { type: String, required: true },
    entityId:    { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'entityType' },
    projectId:   { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', default: null },
    summary:     { type: String, required: true },
    // The party name(s) already interpolated into `summary` (e.g. a
    // contractor/labourer/vendor's own .name) — kept as bare display
    // strings, not a link/route, so the Recent Activity feed can style
    // them distinctly from the rest of the sentence without needing to
    // resolve a real navigation target for every event type.
    entityNames: { type: [String], default: [] },
    amount:      { type: Number, default: null },
    performedBy: { type: String, default: '' },
    timestamp:   { type: Date, default: Date.now },
});

financeActivityLogSchema.index({ timestamp: -1 });
financeActivityLogSchema.index({ projectId: 1, timestamp: -1 });

const FinanceActivityLog = mongoose.models.financeActivityLog || mongoose.model('financeActivityLog', financeActivityLogSchema);
export default FinanceActivityLog;
