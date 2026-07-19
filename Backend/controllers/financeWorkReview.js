import FinanceWork from '../models/financeWork.js';
import FinanceWorkReview from '../models/financeWorkReview.js';
import FinanceMeasurement from '../models/financeMeasurement.js';
import FinanceLabourMeasurement from '../models/financeLabourMeasurement.js';
import FinanceContractorDeduction from '../models/financeContractorDeduction.js';
import FinanceLabourDeduction from '../models/financeLabourDeduction.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Sum of everything logged on a Work — contractor and labour measurements
// combined, all-time, never date-filtered (same convention as the rest of
// Finance: Generate Bill's own Period From/To are descriptive labels, not
// a query filter). Review always acts on the true current total, not a
// period slice.
const computeWorkLoggedSqft = async (workId) => {
    const [contractorRows, labourRows] = await Promise.all([
        FinanceMeasurement.find({ workId, deleted: { $ne: true } }, 'areaCoveredSqft'),
        FinanceLabourMeasurement.find({ workId, deleted: { $ne: true } }, 'areaCoveredSqft'),
    ]);
    return round2(
        contractorRows.reduce((s, r) => s + r.areaCoveredSqft, 0)
        + labourRows.reduce((s, r) => s + r.areaCoveredSqft, 0)
    );
};

// How much of a Work's rejected pool has already been allocated to
// specific people in Payables — computed fresh from the actual deduction
// records, never stored (see financeWorkReview.js's model comment).
const computeAttributedAreaSqft = async (workId) => {
    const [contractorDeductions, labourDeductions] = await Promise.all([
        FinanceContractorDeduction.find({ workId, deleted: { $ne: true } }, 'areaSqft'),
        FinanceLabourDeduction.find({ workId, deleted: { $ne: true } }, 'areaSqft'),
    ]);
    return round2(
        contractorDeductions.reduce((s, d) => s + (d.areaSqft || 0), 0)
        + labourDeductions.reduce((s, d) => s + (d.areaSqft || 0), 0)
    );
};

// Every Work on a project, with its current logged/approved/rejected/
// pending sqft plus how much of any rejected pool is still unattributed —
// the data source for WorkReviewPanel (Receivables) and the Payables
// allocation modal. Nothing here is stored beyond the review row itself;
// everything else is computed fresh every call.
const listReviewsForProject = async (req, res) => {
    try {
        const { projectId } = req.params;
        if (!projectId) return res.status(400).json({ success: false, message: 'projectId is required' });

        const works = await FinanceWork.find({ projectId, deleted: { $ne: true } }).sort({ workType: 1 });
        if (!works.length) return res.json({ success: true, data: { rows: [] } });
        const workIds = works.map(w => w._id);

        const reviews = await FinanceWorkReview.find({ workId: { $in: workIds } });
        const reviewByWorkId = new Map(reviews.map(r => [r.workId.toString(), r]));

        const rows = await Promise.all(works.map(async (w) => {
            const workKey = w._id.toString();
            const loggedSqft = await computeWorkLoggedSqft(w._id);
            const review = reviewByWorkId.get(workKey);
            const approvedAreaSqft = review?.approvedAreaSqft || 0;
            const rejectedAreaSqft = review?.rejectedAreaSqft || 0;
            const pendingReviewSqft = round2(Math.max(0, loggedSqft - approvedAreaSqft - rejectedAreaSqft));
            const attributedAreaSqft = rejectedAreaSqft > 0 ? await computeAttributedAreaSqft(w._id) : 0;
            return {
                workId: w._id, workType: w.workType,
                loggedSqft, approvedAreaSqft, rejectedAreaSqft, pendingReviewSqft,
                attributedAreaSqft, unattributedAreaSqft: round2(Math.max(0, rejectedAreaSqft - attributedAreaSqft)),
                lastReviewedAt: review?.lastReviewedAt || null,
            };
        }));

        res.json({ success: true, data: { rows } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching work reviews' });
    }
};

// One action: set how much of a Work's current logged sqft is Approved.
// Whatever's left (logged − approved) becomes the Rejected pool — always
// recalculated fresh against the current total, not cumulative across
// reviews, so re-reviewing after new measurements come in naturally
// starts from the new true total.
const reviewWork = async (req, res) => {
    try {
        const { workId, approvedAreaSqft, date } = req.body;
        if (!workId) return res.status(400).json({ success: false, message: 'workId is required' });
        if (approvedAreaSqft === undefined || approvedAreaSqft === null || approvedAreaSqft === '') {
            return res.status(400).json({ success: false, message: 'Approved sqft is required' });
        }
        const approved = Number(approvedAreaSqft);
        if (Number.isNaN(approved) || approved < 0) return res.status(400).json({ success: false, message: 'Approved sqft must be zero or more' });

        const work = await FinanceWork.findById(workId);
        if (!work) return res.status(404).json({ success: false, message: 'Work not found' });

        const loggedSqft = await computeWorkLoggedSqft(workId);
        if (approved > loggedSqft) return res.status(400).json({ success: false, message: `Cannot approve more than the ${loggedSqft} sqft logged` });

        let review = await FinanceWorkReview.findOne({ workId });
        if (!review) review = new FinanceWorkReview({ workId });
        review.approvedAreaSqft = round2(approved);
        review.rejectedAreaSqft = round2(loggedSqft - approved);
        review.lastReviewedAt = date ? new Date(date) : new Date();
        review.lastReviewedBy = req.userName || 'Admin';
        await review.save();

        broadcast({ type: 'financeWorkReviewChanged', projectId: work.projectId, workId });

        await logActivity({
            eventType: 'work_reviewed',
            entityType: 'financeWorkReview',
            entityId: review._id,
            projectId: work.projectId,
            summary: `${work.workType} reviewed — ${review.approvedAreaSqft} sqft approved${review.rejectedAreaSqft > 0 ? `, ${review.rejectedAreaSqft} sqft rejected` : ''}`,
            req,
        });

        res.json({ success: true, message: 'Review saved', data: review });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error saving review' });
    }
};

export { listReviewsForProject, reviewWork, computeWorkLoggedSqft, computeAttributedAreaSqft };
