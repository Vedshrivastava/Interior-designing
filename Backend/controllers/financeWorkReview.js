import FinanceWork from '../models/financeWork.js';
import FinanceWorkReview from '../models/financeWorkReview.js';
import FinanceMeasurement from '../models/financeMeasurement.js';
import FinanceLabourMeasurement from '../models/financeLabourMeasurement.js';
import FinanceContractorDeduction from '../models/financeContractorDeduction.js';
import FinanceLabourDeduction from '../models/financeLabourDeduction.js';
import FinanceSupervisorDeduction from '../models/financeSupervisorDeduction.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';
// Shared with financeContractorDeduction.js/financeLabourDeduction.js so a
// rejected-sqft distribution entered here (as part of the atomic review
// flow below) is priced by the exact same rate lookup those controllers'
// own standalone "+ Add Deduction" forms use — never a second, divergent
// pricing rule for the same kind of record.
import { resolveContractorDeductionAmount } from './financeContractorDeduction.js';
import { resolveLabourDeductionAmount } from './financeLabourDeduction.js';
// Prices the material a rejected allocation wasted — see this file's own
// reviewWork and financeReports.js's computePartyMaterialCostPerSqft.
import { computePartyMaterialCostPerSqft } from './financeReports.js';

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

// How much of a Work's CURRENT rejected pool has already been allocated to
// specific people — computed fresh from the actual deduction records,
// never stored (see financeWorkReview.js's model comment). Scoped to
// reviewCycle: a deduction from an earlier, already-superseded rejection
// on the same Work must never count toward attributing a brand new one
// just because the sqft happens to add up — see financeWorkReview.js's
// reviewCycle field comment for the bug this fixes.
const computeAttributedAreaSqft = async (workId, reviewCycle) => {
    const [contractorDeductions, labourDeductions] = await Promise.all([
        FinanceContractorDeduction.find({ workId, workReviewCycle: reviewCycle, deleted: { $ne: true } }, 'areaSqft'),
        FinanceLabourDeduction.find({ workId, workReviewCycle: reviewCycle, deleted: { $ne: true } }, 'areaSqft'),
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
            const attributedAreaSqft = rejectedAreaSqft > 0 ? await computeAttributedAreaSqft(w._id, review.reviewCycle) : 0;
            return {
                workId: w._id, workType: w.workType, unit: w.unit || 'sqft',
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
//
// ATOMIC WITH DISTRIBUTION: a Work with any rejected sqft must have all of
// it distributed to specific contractors/labourers (`allocations`) in this
// SAME request — the review is rejected outright (nothing saved at all) if
// they don't sum to exactly the rejected amount. This used to be two
// separate steps (review here, then a later visit to Payables' own
// allocation screen) — in practice that gap meant a review could be saved
// with a real rejected pool that nobody ever actually distributed, and
// worse, a stale deduction left over from an EARLIER rejection on the same
// Work could silently satisfy a brand new one just because the sqft
// happened to add up (see financeWorkReview.js's reviewCycle field). Both
// are closed by requiring full attribution up front, tagged to this
// specific review cycle.
//
// Supervisor deductions (`supervisorAllocations`) stay optional — they're
// a flat ₹ amount, not sqft, and were never part of the sqft attribution
// gate to begin with (see financeContractorDeduction.js's identical
// reasoning).
const reviewWork = async (req, res) => {
    try {
        const { workId, approvedAreaSqft, date, reason, allocations, supervisorAllocations } = req.body;
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

        const rejectedAreaSqft = round2(loggedSqft - approved);
        const cleanAllocations = Array.isArray(allocations)
            ? allocations.filter(a => a && ['contractor', 'labour'].includes(a.partyType) && a.partyId && Number(a.areaSqft) > 0)
            : [];
        if (rejectedAreaSqft > 0) {
            if (!reason || !reason.trim()) {
                return res.status(400).json({ success: false, message: 'A reason is required whenever sqft is rejected' });
            }
            const allocatedTotal = round2(cleanAllocations.reduce((s, a) => s + Number(a.areaSqft), 0));
            if (Math.abs(allocatedTotal - rejectedAreaSqft) > 0.01) {
                return res.status(400).json({
                    success: false,
                    message: `${rejectedAreaSqft} sqft is rejected — distribute all of it across contractors/labourers before saving (currently ${allocatedTotal} sqft allocated)`,
                });
            }
        }

        // Resolve every allocation's ₹ amount (and confirm a rate actually
        // exists) BEFORE writing anything — a missing rate config fails the
        // whole request instead of leaving a half-saved review with only
        // some of its distribution recorded. Also prices the material that
        // party's own rejected sqft wasted (see reviewWork's header
        // comment) — priced even when it comes out to 0 (no material
        // logged on this Work at all), never blocking the review over it.
        const resolvedAllocations = await Promise.all(cleanAllocations.map(async (a) => {
            const areaSqft = round2(Number(a.areaSqft));
            const [resolved, materialCostPerSqft] = await Promise.all([
                a.partyType === 'contractor'
                    ? resolveContractorDeductionAmount(workId, a.partyId, areaSqft)
                    : resolveLabourDeductionAmount(workId, a.partyId, areaSqft),
                computePartyMaterialCostPerSqft(a.partyType, a.partyId, workId),
            ]);
            return {
                partyType: a.partyType, partyId: a.partyId, areaSqft, amount: resolved.amount, projectId: resolved.projectId,
                materialWasteAmount: round2(areaSqft * materialCostPerSqft),
            };
        }));
        const cleanSupervisorAllocations = Array.isArray(supervisorAllocations)
            ? supervisorAllocations.filter(s => s && s.employeeId && Number(s.amount) > 0)
            : [];

        let review = await FinanceWorkReview.findOne({ workId });
        if (!review) review = new FinanceWorkReview({ workId, reviewCycle: 0 });
        review.approvedAreaSqft = round2(approved);
        review.rejectedAreaSqft = rejectedAreaSqft;
        review.lastReviewedAt = date ? new Date(date) : new Date();
        review.lastReviewedBy = req.userName || 'Admin';
        review.reviewCycle = (review.reviewCycle || 0) + 1;
        await review.save();

        const trimmedReason = reason ? reason.trim() : '';
        await Promise.all([
            ...resolvedAllocations.map(async (a) => {
                if (a.partyType === 'contractor') {
                    await new FinanceContractorDeduction({
                        vendorId: a.partyId, projectId: a.projectId, workId, areaSqft: a.areaSqft, amount: a.amount,
                        materialWasteAmount: a.materialWasteAmount,
                        reason: trimmedReason, date: review.lastReviewedAt, workReviewCycle: review.reviewCycle,
                    }).save();
                    broadcast({ type: 'financeContractorLedgerChanged', vendorId: a.partyId });
                } else {
                    await new FinanceLabourDeduction({
                        labourerId: a.partyId, projectId: a.projectId, workId, areaSqft: a.areaSqft, amount: a.amount,
                        materialWasteAmount: a.materialWasteAmount,
                        reason: trimmedReason, date: review.lastReviewedAt, source: 'engineer_review', workReviewCycle: review.reviewCycle,
                    }).save();
                    broadcast({ type: 'financeLabourLedgerChanged', labourerId: a.partyId });
                }
            }),
            ...cleanSupervisorAllocations.map(async (s) => {
                await new FinanceSupervisorDeduction({
                    employeeId: s.employeeId, projectId: work.projectId, workId, amount: round2(Number(s.amount)),
                    reason: trimmedReason || 'Reviewed and rejected', date: review.lastReviewedAt,
                }).save();
                broadcast({ type: 'financeSupervisorDeductionsChanged', employeeId: s.employeeId });
            }),
        ]);

        broadcast({ type: 'financeWorkReviewChanged', projectId: work.projectId, workId });

        await logActivity({
            eventType: 'work_reviewed',
            entityType: 'financeWorkReview',
            entityId: review._id,
            projectId: work.projectId,
            summary: `${work.workType} reviewed — ${review.approvedAreaSqft} sqft approved${review.rejectedAreaSqft > 0 ? `, ${review.rejectedAreaSqft} sqft rejected and fully distributed` : ''}`,
            req,
        });

        res.json({ success: true, message: 'Review saved', data: review });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error saving review' });
    }
};

export { listReviewsForProject, reviewWork, computeWorkLoggedSqft, computeAttributedAreaSqft };
