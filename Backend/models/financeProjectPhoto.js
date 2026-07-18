import mongoose from 'mongoose';

// Site photos for a project — a gallery, not a document. Distinct from
// financeProjectDocument (work orders, approvals, floor plans — a file
// list with no image preview); this is add-only, newest first, no
// reordering (unlike the public-site Design gallery, display order here
// doesn't matter — it's a record of the site over time, not a curated
// showcase).
const financeProjectPhotoSchema = new mongoose.Schema({
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', required: true },
    imageUrl:  { type: String, required: true },
    caption:   { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceProjectPhoto = mongoose.models.financeProjectPhoto || mongoose.model('financeProjectPhoto', financeProjectPhotoSchema);
export default FinanceProjectPhoto;
