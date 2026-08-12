import mongoose from 'mongoose';
import FinanceProject from '../models/financeProject.js';
import FinanceClient from '../models/financeClient.js';
import FinanceVendor from '../models/financeVendor.js';
import FinanceWork from '../models/financeWork.js';
import FinanceMeasurement from '../models/financeMeasurement.js';
import FinanceContractorRate from '../models/financeContractorRate.js';
import FinanceWorkContractorAssignment from '../models/financeWorkContractorAssignment.js';
import FinanceWorkTypeRate from '../models/financeWorkTypeRate.js';
import FinanceRunningBill from '../models/financeRunningBill.js';
import FinancePurchase from '../models/financePurchase.js';
import FinanceStockMovement from '../models/financeStockMovement.js';
import { computeCurrentStock } from './financeStockMovement.js';
import FinanceMaterial from '../models/financeMaterial.js';
import FinanceReceipt from '../models/financeReceipt.js';
import FinanceExpense from '../models/financeExpense.js';
import FinanceExpensePayment from '../models/financeExpensePayment.js';
import FinanceContractorAdvance from '../models/financeContractorAdvance.js';
import FinanceContractorDeduction from '../models/financeContractorDeduction.js';
import FinanceLabourDeduction from '../models/financeLabourDeduction.js';
import FinanceSupervisorDeduction from '../models/financeSupervisorDeduction.js';
import FinanceSupervisorIncentive from '../models/financeSupervisorIncentive.js';
import FinanceContractorPayment from '../models/financeContractorPayment.js';
import FinanceVendorPayment from '../models/financeVendorPayment.js';
import FinanceSalaryPayment from '../models/financeSalaryPayment.js';
import FinanceCommissionPayment from '../models/financeCommissionPayment.js';
import FinanceLabourProviderPayment from '../models/financeLabourProviderPayment.js';
import FinanceLabourMeasurement from '../models/financeLabourMeasurement.js';
import FinanceLabourRate from '../models/financeLabourRate.js';
import FinanceWorkLabourAssignment from '../models/financeWorkLabourAssignment.js';
import FinanceLabourAdvance from '../models/financeLabourAdvance.js';
import FinanceLabourPayment from '../models/financeLabourPayment.js';
import FinanceLabourer from '../models/financeLabourer.js';
import FinanceWorkReview from '../models/financeWorkReview.js';
import FinanceReferral from '../models/financeReferral.js';
import FinanceEmployee from '../models/financeEmployee.js';
import { summarizeProject } from './financeReceivable.js';
import { expectedSalaryForMonth } from './financeSalaryLedger.js';
import { getWorkerPayoutTotal, getWorkerPayoutTotalsBulk, getWorkerPayoutDeductionsForWork } from './financeClientDirectPayment.js';
import FinanceSetting from '../models/financeSetting.js';
import FinanceTdsDeposit from '../models/financeTdsDeposit.js';
import FinanceBankAccount from '../models/financeBankAccount.js';
import FinanceCashEntry from '../models/financeCashEntry.js';
import FinanceBankEntry from '../models/financeBankEntry.js';
import FinanceGstFiling from '../models/financeGstFiling.js';
import FinanceActivityLog from '../models/financeActivityLog.js';
import { getAccountActivity } from './financeBankAccount.js';
import PDFDocument from 'pdfkit';
import { writeLetterhead, writeSectionHeading, writeSubLabel, writeFooter, drawTable, drawStatBlock, formatCurrency, formatDate, paintPageBackground, contentBox } from '../utils/pdfLetterhead.js';
import FinanceCompanySettings from '../models/financeCompanySettings.js';

// totalArea − approvedArea on floats accumulated across many measurements
// produces artifacts like 21.300000000000001 — round for display/storage.
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// .lean() — spreading a hydrated Mongoose document ({ ...doc }) silently
// drops some schema fields (companyName among them), since document
// instances aren't plain objects. A lean query avoids that footgun.
const getCompanyForPdf = async () => (await FinanceCompanySettings.findOne({ deleted: { $ne: true } }).lean()) || null;

// Advance-contract projects bill via Running Bills too, once work starts.
const BILLABLE_CONTRACT_TYPES = ['with_material', 'without_material', 'advance'];

/*
 * Reports is a pure rollup layer — every endpoint here is read-only,
 * nothing is stored, nothing broadcasts over WebSocket (there's no data
 * to push; it's pulled on demand). Everything is computed fresh from the
 * same underlying collections every other module already writes to.
 *
 * COSTING METHOD: there's no FIFO/batch-level costing anywhere in this
 * system — purchases and consumption aren't linked batch-to-batch. Every
 * material cost figure below uses weighted-average costing:
 *
 *   Average Rate (per material, per project) =
 *     (SUM(purchase totalAmount) − SUM(return totalAmount))
 *     ÷ (SUM(purchase quantity) − SUM(return quantity))
 *
 *   Consumed Material Cost = SUM(consume-type stock movement quantity) × Average Rate
 *
 * This is an approximation, not an exact cost — the frontend labels every
 * figure derived from it accordingly.
 */

// Shared by Project Profit, Client Profit, Work Profit, and Material
// Analysis — average purchase rate per material within one project.
const computeMaterialAvgRates = async (projectId) => {
    const purchases = await FinancePurchase.find({ projectId, deleted: { $ne: true } });
    const byMaterial = new Map();
    for (const p of purchases) {
        const key = p.materialId.toString();
        if (!byMaterial.has(key)) byMaterial.set(key, { qty: 0, amt: 0 });
        const m = byMaterial.get(key);
        const sign = p.transactionType === 'return' ? -1 : 1;
        m.qty += sign * p.quantity;
        m.amt += sign * p.totalAmount;
    }
    const avgRate = new Map();
    for (const [materialId, m] of byMaterial) avgRate.set(materialId, m.qty > 0 ? m.amt / m.qty : 0);
    return avgRate;
};

// Same weighted-average-rate costing formula as a flat material-cost sum,
// but split by whether the measurement that consumed it belongs to
// reviewed (approved or rejected) work or work still awaiting review — a
// consume movement always traces back to the specific measurement that
// drew it (relatedMeasurementId/relatedLabourMeasurementId), and that
// measurement's own share of its Work's approved/rejected ceiling is
// exactly the same splitApprovedAreaByShare proportional-estimate
// convention computeProjectContractorCost/computeProjectLabourCost
// already apply per vendor/labourer — applied here per measurement
// instead. Without this, 100% of material cost landed in Profit the
// instant it was consumed regardless of review status, while contractor/
// labour/commission cost for the exact same still-unreviewed work sat in
// Unapproved — a project with a lot of pending-review work but little/no
// approved work yet could show a deeply negative "Approved" Profit driven
// entirely by real material spend that has nothing to do with approval.
//
// decidedCost (approved + rejected) feeds Profit exactly like the old flat
// total used to. A rejection is a final, already-reviewed decision, and
// its material cost already gets correctly reclassified into Material
// Waste Cost by computeProjectMaterialWaste's fromRejection, so it belongs in
// decidedCost, not pendingCost. pendingCost is new — material cost tied to
// work still awaiting review, previously silently folded into the
// "Approved" total even though nothing about it is actually approved yet.
const computeProjectMaterialCostSplit = async (projectId) => {
    const avgRate = await computeMaterialAvgRates(projectId);
    const works = await FinanceWork.find({ projectId, deleted: { $ne: true } }, '_id');
    const workIds = works.map(w => w._id);
    if (!workIds.length) return { decidedCost: 0, pendingCost: 0 };

    const [consumeMovements, contractorMeasurements, labourMeasurements, categoryApprovedByWorkId] = await Promise.all([
        FinanceStockMovement.find(
            { projectId: new mongoose.Types.ObjectId(projectId), movementType: 'consume', deleted: { $ne: true } },
            'materialId quantity relatedMeasurementId relatedLabourMeasurementId'
        ),
        FinanceMeasurement.find({ workId: { $in: workIds }, deleted: { $ne: true } }, 'workId areaCoveredSqft'),
        FinanceLabourMeasurement.find({ workId: { $in: workIds }, deleted: { $ne: true } }, 'workId areaCoveredSqft'),
        getCategoryApprovedAreaByWorkId(workIds),
    ]);
    if (!consumeMovements.length) return { decidedCost: 0, pendingCost: 0 };

    const contractorMeasurementById = new Map(contractorMeasurements.map(m => [m._id.toString(), m]));
    const labourMeasurementById = new Map(labourMeasurements.map(m => [m._id.toString(), m]));
    const contractorTotalByWorkId = new Map();
    for (const m of contractorMeasurements) {
        const k = m.workId.toString();
        contractorTotalByWorkId.set(k, (contractorTotalByWorkId.get(k) || 0) + m.areaCoveredSqft);
    }
    const labourTotalByWorkId = new Map();
    for (const m of labourMeasurements) {
        const k = m.workId.toString();
        labourTotalByWorkId.set(k, (labourTotalByWorkId.get(k) || 0) + m.areaCoveredSqft);
    }

    let decidedCost = 0, pendingCost = 0;
    for (const mv of consumeMovements) {
        const rate = avgRate.get(mv.materialId.toString()) || 0;
        const cost = mv.quantity * rate;
        if (!cost) continue;

        const isContractor = !!mv.relatedMeasurementId;
        const measurement = isContractor
            ? contractorMeasurementById.get(mv.relatedMeasurementId.toString())
            : mv.relatedLabourMeasurementId ? labourMeasurementById.get(mv.relatedLabourMeasurementId.toString()) : null;
        // No traceable source measurement (shouldn't happen for a real
        // 'consume' movement, but a manual/legacy one could lack the
        // link) — treated as pending rather than silently assumed
        // decided, same "don't force a guess" principle
        // computeWorkMaterialWasteCost's own comment applies to
        // untraceable waste rows.
        if (!measurement) { pendingCost += cost; continue; }

        const workKey = measurement.workId.toString();
        const categoryEntry = categoryApprovedByWorkId.get(workKey);
        const workApprovedArea = isContractor ? (categoryEntry?.contractorApprovedAreaSqft || 0) : (categoryEntry?.labourApprovedAreaSqft || 0);
        const workRejectedArea = isContractor ? (categoryEntry?.contractorRejectedAreaSqft || 0) : (categoryEntry?.labourRejectedAreaSqft || 0);
        const workTotalArea = (isContractor ? contractorTotalByWorkId : labourTotalByWorkId).get(workKey) || 0;

        const approvedShare = splitApprovedAreaByShare(workApprovedArea, measurement.areaCoveredSqft, workTotalArea);
        const rejectedShare = splitApprovedAreaByShare(workRejectedArea, measurement.areaCoveredSqft, workTotalArea);
        const decidedFraction = measurement.areaCoveredSqft > 0 ? Math.min(1, (approvedShare + rejectedShare) / measurement.areaCoveredSqft) : 0;

        decidedCost += cost * decidedFraction;
        pendingCost += cost * (1 - decidedFraction);
    }
    return { decidedCost: round2(decidedCost), pendingCost: round2(pendingCost) };
};

// THE canonical Material Waste computation — the two constituents that
// make it up, kept separate (not just their sum), so the Dashboard's
// "Material Wastage Loss" card can say what's actually driving it instead
// of one opaque number:
//   - fromStock: physical waste logged directly in Site Inventory (Stock
//     Movements, movementType: 'waste') — real material bought and lost,
//     at the same weighted-average rate it was purchased at.
//   - fromRejection: material cost reclassified out of plain Material
//     Cost when a Work Review rejects sqft (financeWorkReview.js's
//     reviewWork stamps materialWasteAmount on the Contractor/Labour
//     Deduction row it creates, priced via computePartyMaterialCostPerSqft)
//     — see computeProjectProfit's own comment on why this moves OUT of
//     Material Cost and into here, net zero effect from the move itself.
// Both are real losses at the rate the material was actually bought at, so
// both belong in Profit — kept as their own line (not folded into
// productive Material Cost) so "material used" and "material lost" stay
// distinguishable everywhere this is shown, not just netted into one
// blended number.
const computeProjectMaterialWaste = async (projectId) => {
    const [avgRate, wasted, works] = await Promise.all([
        computeMaterialAvgRates(projectId),
        FinanceStockMovement.aggregate([
            { $match: { projectId: new mongoose.Types.ObjectId(projectId), movementType: 'waste', deleted: { $ne: true } } },
            { $group: { _id: '$materialId', qty: { $sum: '$quantity' } } },
        ]),
        FinanceWork.find({ projectId, deleted: { $ne: true } }, '_id'),
    ]);
    let fromStock = 0;
    for (const row of wasted) fromStock += row.qty * (avgRate.get(row._id.toString()) || 0);

    const workIds = works.map(w => w._id);
    let fromRejection = 0;
    if (workIds.length) {
        const [contractorRows, labourRows] = await Promise.all([
            FinanceContractorDeduction.find({ workId: { $in: workIds }, deleted: { $ne: true }, materialWasteAmount: { $gt: 0 } }, 'materialWasteAmount'),
            FinanceLabourDeduction.find({ workId: { $in: workIds }, deleted: { $ne: true }, materialWasteAmount: { $gt: 0 } }, 'materialWasteAmount'),
        ]);
        fromRejection = [...contractorRows, ...labourRows].reduce((s, d) => s + (d.materialWasteAmount || 0), 0);
    }
    return { fromStock: round2(fromStock), fromRejection: round2(fromRejection), total: round2(fromStock + fromRejection) };
};

// A vendor's/labourer's own material-cost-per-sqft on one Work — the same
// figure the Contractor/Labour Ledger's own "Material Cost/Sqft" column
// shows (this party's own material-tagged measurements only, weighted-
// average purchase rate). Falls back to every measurement of that same
// party type on the Work (not just this one party's) when they never
// logged material usage themselves, so a rejection can still be priced
// even if the specific person didn't tag material on their own entries.
// Used to price the material a rejected allocation wasted — see
// financeWorkReview.js's reviewWork.
const computePartyMaterialCostPerSqft = async (partyType, partyId, workId) => {
    const work = await FinanceWork.findById(workId);
    if (!work) return 0;
    const avgRate = await computeMaterialAvgRates(work.projectId);
    const Model = partyType === 'contractor' ? FinanceMeasurement : FinanceLabourMeasurement;
    const partyFilter = partyType === 'contractor' ? { contractorVendorId: partyId } : { labourerId: partyId };
    const [partyMeasurements, allMeasurements] = await Promise.all([
        Model.find({ workId, ...partyFilter, deleted: { $ne: true } }),
        Model.find({ workId, deleted: { $ne: true } }),
    ]);
    const rateFrom = (rows) => {
        let cost = 0, area = 0;
        for (const m of rows) {
            if (m.materialUsed?.length) {
                cost += m.materialUsed.reduce((s, u) => s + u.quantity * (avgRate.get(u.materialId.toString()) || 0), 0);
                area += m.areaCoveredSqft;
            }
        }
        return area > 0 ? cost / area : 0;
    };
    const partyRate = rateFrom(partyMeasurements);
    return partyRate > 0 ? partyRate : rateFrom(allMeasurements);
};

// Work-level material cost scopes the same per-project average rate down
// to only this work's consumed quantity — consume movements don't carry
// workId directly, so this traces through relatedMeasurementId/
// relatedLabourMeasurementId → the measurement's own workId (see
// financeStockMovement.js's schema comment). Material used by a labourer's
// own measurements counts here too — consumption doesn't care whether a
// contractor or an individual labourer is who did the work.
const computeWorkMaterialCost = async (projectId, workId) => {
    const avgRate = await computeMaterialAvgRates(projectId);
    const [measurementIds, labourMeasurementIds] = await Promise.all([
        FinanceMeasurement.find({ workId, deleted: { $ne: true } }, '_id').then(rows => rows.map(m => m._id)),
        FinanceLabourMeasurement.find({ workId, deleted: { $ne: true } }, '_id').then(rows => rows.map(m => m._id)),
    ]);
    if (!measurementIds.length && !labourMeasurementIds.length) return 0;
    const consumed = await FinanceStockMovement.aggregate([
        {
            $match: {
                movementType: 'consume',
                deleted: { $ne: true },
                $or: [
                    { relatedMeasurementId: { $in: measurementIds } },
                    { relatedLabourMeasurementId: { $in: labourMeasurementIds } },
                ],
            },
        },
        { $group: { _id: '$materialId', qty: { $sum: '$quantity' } } },
    ]);
    let total = 0;
    for (const row of consumed) total += row.qty * (avgRate.get(row._id.toString()) || 0);
    return total;
};

// Waste, at Work granularity — unlike consume, a waste movement isn't tied
// to a measurement (nothing was actually done with it), it's tied directly
// to workId instead (manually pickable on the entry form — see
// financeStockMovement.js's schema comment). Rows entered before that field
// existed stay workId: null and simply aren't attributable to any one Work
// here (they still count at the project level via
// computeProjectMaterialWaste, same "don't hide it, don't force a
// guess" treatment computeWorkScopedReport already gives project-level waste).
const computeWorkMaterialWasteCost = async (projectId, workId) => {
    const avgRate = await computeMaterialAvgRates(projectId);
    const wasted = await FinanceStockMovement.aggregate([
        { $match: { workId: new mongoose.Types.ObjectId(workId), movementType: 'waste', deleted: { $ne: true } } },
        { $group: { _id: '$materialId', qty: { $sum: '$quantity' } } },
    ]);
    let total = 0;
    for (const row of wasted) total += row.qty * (avgRate.get(row._id.toString()) || 0);
    return total;
};

// Work-scoped analog of computeProjectMaterialWaste's fromRejection — same
// materialWasteAmount rows, just filtered to this one Work's workId instead
// of every work in the project. Needed so computeWorkProfit can net this
// out of Material Cost and into Material Waste Cost the same way
// computeProjectProfit already does at the project level (see that
// function's identical comment) — without this, a Work's own Material
// Cost/Material Waste Cost don't add up to the project-level figures for
// the exact same underlying data whenever a rejection happened on it.
const computeWorkMaterialWasteFromRejection = async (workId) => {
    const [contractorRows, labourRows] = await Promise.all([
        FinanceContractorDeduction.find({ workId, deleted: { $ne: true }, materialWasteAmount: { $gt: 0 } }, 'materialWasteAmount'),
        FinanceLabourDeduction.find({ workId, deleted: { $ne: true }, materialWasteAmount: { $gt: 0 } }, 'materialWasteAmount'),
    ]);
    return round2([...contractorRows, ...labourRows].reduce((s, d) => s + (d.materialWasteAmount || 0), 0));
};

// Measurement-level: each day's area attributes to whichever contractor
// vendor actually did it (a Work can have more than one contractor
// contributing). Contractor cost = only engineer-approved area —
// unapproved measurements aren't a confirmed payable liability yet, same
// gate financeRunningBill applies for client billing (see
// financeContractorLedger.js's header note).
// Cost = only sqft actually billed to the client (an issued running bill's
// lineItems), not everything logged — see computeWorkApprovedBilling's
// header comment for why this replaced the old engineerApproved filter.
// Attribution follows the same "whichever type is present on this work"
// rule as computeWorkExpectedPay; a work with genuinely both a contractor
// and labour presence counts in both this and computeProjectLabourCost
// (same accepted simplification as the rest of this module).
// Returns { approvedAmount, totalAmount } — approvedAmount is what actually
// feeds Profit (project-level cost); totalAmount is every logged sqft's
// worth, unconditional, so views can show both side by side (same pattern
// as everywhere else in this module).
const computeProjectContractorCost = async (projectId) => {
    const works = await FinanceWork.find({ projectId, deleted: { $ne: true } });
    if (!works.length) return { approvedAmount: 0, totalAmount: 0, rejectedAmount: 0, approvedAreaSqft: 0 };

    const [contractorMeasurements, contractorAssignments, categoryApprovedByWorkId] = await Promise.all([
        FinanceMeasurement.find({ workId: { $in: works.map(w => w._id) }, deleted: { $ne: true } }, 'workId contractorVendorId areaCoveredSqft'),
        FinanceWorkContractorAssignment.find({ workId: { $in: works.map(w => w._id) }, deleted: { $ne: true } }, 'workId contractorVendorId'),
        getCategoryApprovedAreaByWorkId(works.map(w => w._id)),
    ]);
    const vendorIdsByWork = new Map(); // workId -> Set(vendorId)
    const totalAreaByWorkVendor = new Map(); // `${workId}_${vendorId}` -> area
    for (const m of [...contractorMeasurements, ...contractorAssignments]) {
        if (!m.contractorVendorId) continue;
        const key = m.workId.toString();
        if (!vendorIdsByWork.has(key)) vendorIdsByWork.set(key, new Set());
        vendorIdsByWork.get(key).add(m.contractorVendorId.toString());
    }
    for (const m of contractorMeasurements) {
        if (!m.contractorVendorId) continue;
        const key = `${m.workId}_${m.contractorVendorId}`;
        totalAreaByWorkVendor.set(key, (totalAreaByWorkVendor.get(key) || 0) + m.areaCoveredSqft);
    }
    const contractorWorks = works.filter(w => vendorIdsByWork.has(w._id.toString()));
    if (!contractorWorks.length) return { approvedAmount: 0, totalAmount: 0, rejectedAmount: 0, approvedAreaSqft: 0 };

    const allVendorIds = [...new Set(contractorWorks.flatMap(w => [...(vendorIdsByWork.get(w._id.toString()) || [])]))];
    const rates = await FinanceContractorRate.find({ projectId, contractorVendorId: { $in: allVendorIds }, deleted: { $ne: true } });
    const rateByKey = new Map(rates.map(r => [`${r.contractorVendorId}_${r.workType}`, r.ratePerSqft]));

    let approvedAmount = 0;
    let totalAmount = 0;
    let rejectedAmount = 0;
    // Area-sqft sibling of approvedAmount — Project Overview/Profitability's
    // "Contractor Cost" card shows a ₹ headline but no sense of how much
    // sqft actually produced it, same gap the Dashboard's "Contractor
    // Teams - Approved" card had before it got a sqft sub-line.
    let approvedAreaSqft = 0;
    for (const work of contractorWorks) {
        // "Approved" = reviewed (financeWorkReview), same definition Work
        // Profit and the Contractor Ledger use — not whether it's made it
        // into an issued bill yet (see getApprovedBillingByWorkId's own
        // header comment for why those two stopped being the same thing).
        const categoryEntry = categoryApprovedByWorkId.get(work._id.toString());
        const workApprovedArea = categoryEntry?.contractorApprovedAreaSqft || 0;
        // A rejection is final, already-reviewed — tracked separately so
        // Unapproved (totalAmount − approvedAmount − rejectedAmount below,
        // computed by the caller) never counts it twice.
        const workRejectedArea = categoryEntry?.contractorRejectedAreaSqft || 0;
        const vendorIds = [...vendorIdsByWork.get(work._id.toString())];
        const workTotalArea = vendorIds.reduce((s, id) => s + (totalAreaByWorkVendor.get(`${work._id}_${id}`) || 0), 0);
        for (const vendorId of vendorIds) {
            const rate = rateByKey.get(`${vendorId}_${work.workType}`);
            if (!rate) continue;
            const totalArea = totalAreaByWorkVendor.get(`${work._id}_${vendorId}`) || 0;
            totalAmount += totalArea * rate;
            // Split this work's reviewed area proportionally to each
            // vendor's own share of the logged area — same reasoning as
            // splitApprovedAreaByShare, inlined here since rates are
            // looked up per (vendor, workType) not per work.
            const approvedArea = workTotalArea > 0 ? workApprovedArea * (totalArea / workTotalArea) : 0;
            approvedAmount += approvedArea * rate;
            approvedAreaSqft += approvedArea;
            const rejectedArea = workTotalArea > 0 ? workRejectedArea * (totalArea / workTotalArea) : 0;
            rejectedAmount += rejectedArea * rate;
        }
    }
    return { approvedAmount: round2(approvedAmount), totalAmount: round2(totalAmount), rejectedAmount: round2(rejectedAmount), approvedAreaSqft: round2(approvedAreaSqft) };
};

// Mirrors computeProjectContractorCost, at individual-labourer granularity.
// Labour never had an engineerApproved gate (every logged sqft counted
// immediately) — this is the one genuine behavior change: labour cost now
// also only counts reviewed sqft (financeWorkReview, via WorkReviewPanel),
// same as contractor — not whether it's made it into an issued bill yet.
const computeProjectLabourCost = async (projectId) => {
    const works = await FinanceWork.find({ projectId, deleted: { $ne: true } });
    if (!works.length) return { approvedAmount: 0, totalAmount: 0, rejectedAmount: 0, approvedAreaSqft: 0 };

    const [labourMeasurements, labourAssignments, categoryApprovedByWorkId] = await Promise.all([
        FinanceLabourMeasurement.find({ workId: { $in: works.map(w => w._id) }, deleted: { $ne: true } }, 'workId labourerId areaCoveredSqft'),
        FinanceWorkLabourAssignment.find({ workId: { $in: works.map(w => w._id) }, deleted: { $ne: true } }, 'workId labourerId'),
        getCategoryApprovedAreaByWorkId(works.map(w => w._id)),
    ]);
    const labourerIdsByWork = new Map();
    const totalAreaByWorkLabourer = new Map(); // `${workId}_${labourerId}` -> area
    for (const m of [...labourMeasurements, ...labourAssignments]) {
        const key = m.workId.toString();
        if (!labourerIdsByWork.has(key)) labourerIdsByWork.set(key, new Set());
        labourerIdsByWork.get(key).add(m.labourerId.toString());
    }
    for (const m of labourMeasurements) {
        const key = `${m.workId}_${m.labourerId}`;
        totalAreaByWorkLabourer.set(key, (totalAreaByWorkLabourer.get(key) || 0) + m.areaCoveredSqft);
    }
    const labourWorks = works.filter(w => labourerIdsByWork.has(w._id.toString()));
    if (!labourWorks.length) return { approvedAmount: 0, totalAmount: 0, rejectedAmount: 0, approvedAreaSqft: 0 };

    const allLabourerIds = [...new Set(labourWorks.flatMap(w => [...(labourerIdsByWork.get(w._id.toString()) || [])]))];
    const rates = await FinanceLabourRate.find({ projectId, labourerId: { $in: allLabourerIds }, deleted: { $ne: true } });
    const rateByKey = new Map(rates.map(r => [`${r.labourerId}_${r.workType}`, r.ratePerSqft]));

    let approvedAmount = 0;
    let totalAmount = 0;
    let rejectedAmount = 0;
    // Area-sqft sibling of approvedAmount — see computeProjectContractorCost's
    // identical comment.
    let approvedAreaSqft = 0;
    for (const work of labourWorks) {
        const categoryEntry = categoryApprovedByWorkId.get(work._id.toString());
        const workApprovedArea = categoryEntry?.labourApprovedAreaSqft || 0;
        const workRejectedArea = categoryEntry?.labourRejectedAreaSqft || 0;
        const labourerIds = [...labourerIdsByWork.get(work._id.toString())];
        const workTotalArea = labourerIds.reduce((s, id) => s + (totalAreaByWorkLabourer.get(`${work._id}_${id}`) || 0), 0);
        for (const labourerId of labourerIds) {
            const rate = rateByKey.get(`${labourerId}_${work.workType}`);
            if (!rate) continue;
            const totalArea = totalAreaByWorkLabourer.get(`${work._id}_${labourerId}`) || 0;
            totalAmount += totalArea * rate;
            const approvedArea = workTotalArea > 0 ? workApprovedArea * (totalArea / workTotalArea) : 0;
            approvedAmount += approvedArea * rate;
            approvedAreaSqft += approvedArea;
            const rejectedArea = workTotalArea > 0 ? workRejectedArea * (totalArea / workTotalArea) : 0;
            rejectedAmount += rejectedArea * rate;
        }
    }
    return { approvedAmount: round2(approvedAmount), totalAmount: round2(totalAmount), rejectedAmount: round2(rejectedAmount), approvedAreaSqft: round2(approvedAreaSqft) };
};

// Same approved-vs-total split as computeProjectContractorCost/
// computeProjectLabourCost, now that commission counts as a real cost only
// once the work it's earned on has actually been reviewed — a referral
// shouldn't be recognized as "owed" for sqft that's still pending review
// any more than a contractor or labourer is. Only one referral per
// project, so no proportional multi-party split is needed here (unlike
// contractor/labour, where more than one vendor/labourer can share a Work).
const computeProjectCommissionCost = async (project) => {
    if (!project.referralId) return { approvedAmount: 0, totalAmount: 0, rejectedAmount: 0 };
    // Advance projects have no per-sqft referral math at all — commission is
    // a flat, manually-typed amount (financeProject.referralCommissionAmount,
    // editable any time), read fresh here so Profit/Client Profit move
    // immediately whenever it's changed. Not sqft-based, so there's no
    // "reviewed vs pending" distinction to make — it's owed in full as soon
    // as it's entered, same as it always was.
    if (project.contractType === 'advance') {
        const flat = project.referralCommissionAmount || 0;
        return { approvedAmount: flat, totalAmount: flat, rejectedAmount: 0 };
    }
    const works = await FinanceWork.find({ projectId: project._id, deleted: { $ne: true } });
    if (!works.length) return { approvedAmount: 0, totalAmount: 0, rejectedAmount: 0 };
    const [rates, approvedBillingByWorkId] = await Promise.all([
        FinanceWorkTypeRate.find({ projectId: project._id, deleted: { $ne: true } }),
        getApprovedBillingByWorkId(works.map(w => w._id)),
    ]);
    const rateByWorkType = new Map(rates.map(r => [r.workType, r.referralRatePerSqft]));
    let approvedAmount = 0;
    let totalAmount = 0;
    let rejectedAmount = 0;
    for (const w of works) {
        const rate = rateByWorkType.get(w.workType) || 0;
        totalAmount += w.completedAreaSqft * rate;
        const billing = approvedBillingByWorkId.get(w._id.toString());
        const approvedArea = billing?.areaSqft || 0;
        approvedAmount += approvedArea * rate;
        // A rejection is final, already-reviewed — excluded from Unapproved
        // by the caller (totalAmount − approvedAmount − rejectedAmount).
        const rejectedArea = billing?.rejectedAreaSqft || 0;
        rejectedAmount += rejectedArea * rate;
    }
    return { approvedAmount, totalAmount, rejectedAmount };
};

// Company-wide referral-commission payable + unapproved, for the
// Dashboard's Payables/Unapproved sections — one row per referral, summed.
// "Payable" nets out commissionPayments the same way
// computeContractorAnalysisRows/computeLabourAnalysisRows net out
// contractor/labour payments against approved (reviewed) earnings;
// "unapproved" is the same totalAmount-minus-approvedAmount gap
// computeProjectCommissionCost already exposes per project, just summed
// across every project a referral is attached to.
const computeCompanyWideCommissionBreakdown = async () => {
    const referrals = await FinanceReferral.find({ deleted: { $ne: true } });
    if (!referrals.length) return { commissionPayable: 0, unapprovedCommissionTotal: 0, earningsTotal: 0, paymentsTotal: 0 };
    const perReferral = await Promise.all(referrals.map(async (referral) => {
        const projects = await FinanceProject.find({ referralId: referral._id, deleted: { $ne: true } });
        const costs = await Promise.all(projects.map(p => computeProjectCommissionCost(p)));
        const earningsTotal = costs.reduce((s, c) => s + c.approvedAmount, 0);
        const totalAmountTotal = costs.reduce((s, c) => s + c.totalAmount, 0);
        // A rejection is final, already-reviewed — excluded from Unapproved,
        // same as computeProjectProfit's identical subtraction.
        const rejectedTotal = costs.reduce((s, c) => s + (c.rejectedAmount || 0), 0);
        const payments = await FinanceCommissionPayment.find({ referralId: referral._id, deleted: { $ne: true } });
        const paymentsTotal = payments.reduce((s, p) => s + p.amount, 0);
        return { payable: earningsTotal - paymentsTotal, unapproved: Math.max(0, totalAmountTotal - earningsTotal - rejectedTotal), earningsTotal, paymentsTotal };
    }));
    return {
        // Dashboard's Commission Payables sub-line — "why" behind the
        // headline balance, same breakdown shape as Contractor/Labour Payables.
        earningsTotal: round2(perReferral.reduce((s, r) => s + r.earningsTotal, 0)),
        paymentsTotal: round2(perReferral.reduce((s, r) => s + r.paymentsTotal, 0)),
        commissionPayable: round2(perReferral.reduce((s, r) => s + r.payable, 0)),
        unapprovedCommissionTotal: round2(perReferral.reduce((s, r) => s + r.unapproved, 0)),
    };
};

// Company-wide salary PAYABLE for the Dashboard — a running backlog, same
// "always a balance, not scoped to one month" convention Contractor/Labour
// Payables already use (their own balancePayable is earnings-to-date minus
// payments-to-date, never just "this month"). For each employee: sum
// expectedSalaryForMonth across every month from their joining month
// through the current one, minus every payment they've ever received
// (any month) — not just the current/last-completed month. Employees with
// no joiningDate have no earlier bound to sum from, so only the current
// month is counted for them (expectedSalaryForMonth's own fallback).
//
// Also returns `overduePayable` — unlike `payable` (which includes the
// current, still-in-progress month's own accrual), this only counts months
// that have already CLOSED, i.e. genuinely late pay, not merely accrued.
// Found the same FIFO way as `oldestUnpaidMonth` below: a payment is
// assumed to settle the longest-standing dues first, so once every closed
// month's expected pay is netted against total-paid-to-date, whatever's
// still positive is real overdue backlog — never counting the current
// month, since nothing is late until its month actually ends. This is the
// number the dashboard's "Payment left" sub-line shows, and it's what the
// red/normal tone should key off too — they'd otherwise contradict each
// other (a card reading "not overdue" right above a positive "amount
// left" makes no sense).
const computeCompanyWideSalaryPayable = async (currentMonthKey) => {
    const employees = await FinanceEmployee.find({ deleted: { $ne: true } });
    if (!employees.length) return { payable: 0, overduePayable: 0, oldestUnpaidMonth: null };
    const payments = await FinanceSalaryPayment.find({ deleted: { $ne: true } });
    // Keyed by employeeId_month, not just employeeId — every
    // FinanceSalaryPayment always carries a required `month` tag (the pay
    // period it settles; see that model's own comment), and
    // financeSalaryLedger.js's getSalaryLedger already nets strictly
    // per-month against it. Pooling every payment regardless of month and
    // FIFO-guessing which months look covered (the old approach here) let
    // a payment tagged to a FUTURE month — a normal advance-payment
    // workflow, nothing stops it — silently offset a CLOSED month's real
    // backlog before that future month had even started, understating
    // overdue on the Dashboard while getSalaryLedger correctly showed the
    // advance sitting against its own future month, untouched.
    const paidByEmployeeMonth = new Map();
    for (const p of payments) {
        const key = `${p.employeeId}_${p.month}`;
        paidByEmployeeMonth.set(key, (paidByEmployeeMonth.get(key) || 0) + p.amount);
    }
    const [curY, curM] = currentMonthKey.split('-').map(Number);
    let payable = 0;
    let overduePayable = 0;
    let oldestUnpaidMonth = null;
    for (const e of employees) {
        let employeePayable = 0;
        let closedMonthsExpectedTotal = 0; // excludes currentMonthKey itself
        let closedMonthsPaidTotal = 0;
        let firstUnpaidMonth = null;
        const monthKeys = [];
        if (e.joiningDate) {
            const joined = new Date(e.joiningDate);
            let y = joined.getFullYear(), m = joined.getMonth() + 1;
            while (y < curY || (y === curY && m <= curM)) {
                monthKeys.push(`${y}-${String(m).padStart(2, '0')}`);
                m += 1;
                if (m > 12) { m = 1; y += 1; }
            }
        } else {
            monthKeys.push(currentMonthKey);
        }
        for (const monthKey of monthKeys) {
            const expected = expectedSalaryForMonth(e, monthKey);
            const paidForMonth = paidByEmployeeMonth.get(`${e._id}_${monthKey}`) || 0;
            employeePayable += expected - paidForMonth;
            if (monthKey < currentMonthKey) {
                closedMonthsExpectedTotal += expected;
                closedMonthsPaidTotal += paidForMonth;
            }
            if (firstUnpaidMonth === null && expected - paidForMonth > 0.5) firstUnpaidMonth = monthKey;
        }
        payable += employeePayable;
        // Each closed month's own expected/paid, summed then subtracted
        // once (so a genuine overpayment in one closed month still nets
        // against a shortfall in another closed month for the SAME
        // employee, same as before) — floored at 0 so one employee's
        // overpayment can never make a DIFFERENT employee's real overdue
        // amount look smaller once added together below.
        overduePayable += Math.max(0, closedMonthsExpectedTotal - closedMonthsPaidTotal);
        if (employeePayable > 0.5 && firstUnpaidMonth && (!oldestUnpaidMonth || firstUnpaidMonth < oldestUnpaidMonth)) {
            oldestUnpaidMonth = firstUnpaidMonth;
        }
    }
    return { payable: round2(payable), overduePayable: round2(overduePayable), oldestUnpaidMonth };
};

// Company-wide "Expense Payables" for the Dashboard — expenses recorded as
// pending (or only partially settled) at entry, same accrual concept as
// every other payable here, just for the one payable type that never had
// its own rollup: ExpensesManager already computes balance per row (see
// financeExpense.js's withBalances) across five different mount points
// (Payables > Expenses/Company Expenses/Other Expenses, Payments > Misc,
// and every project's own Expenses tab), but none of them roll up into one
// "how much is still owed across every expense, company-wide" figure —
// which made a pending expense easy to lose track of once it wasn't the
// one you happened to be looking at. Mirrors withBalances' own
// paid-at-entry-vs-accrual split rather than re-deriving it differently.
const computeCompanyWideExpensePayable = async () => {
    const expenses = await FinanceExpense.find({ deleted: { $ne: true } }, 'amount date paymentMode bankAccountId');
    if (!expenses.length) return { payable: 0, count: 0, oldestPendingDate: null };
    const accrualExpenses = expenses.filter(e => !e.paymentMode && !e.bankAccountId);
    const accrualIds = accrualExpenses.map(e => e._id);
    const paymentAgg = accrualIds.length ? await FinanceExpensePayment.aggregate([
        { $match: { expenseId: { $in: accrualIds }, deleted: { $ne: true } } },
        { $group: { _id: '$expenseId', total: { $sum: '$amount' } } },
    ]) : [];
    const paidByExpense = new Map(paymentAgg.map(r => [r._id.toString(), r.total]));

    let payable = 0, count = 0, oldestPendingDate = null;
    for (const e of accrualExpenses) {
        const paid = paidByExpense.get(e._id.toString()) || 0;
        const balance = e.amount - paid;
        if (balance <= 0.5) continue;
        payable += balance;
        count += 1;
        if (!oldestPendingDate || e.date < oldestPendingDate) oldestPendingDate = e.date;
    }
    return { payable: round2(payable), count, oldestPendingDate };
};

// Reimbursement Payables — the subset of computeCompanyWideExpensePayable's
// same accrual expenses that are also a reimbursement claim (relatedToType
// financeEmployee/financeLabourer), rolled up per person instead of one
// flat company-wide number, so the Dashboard KPI's breakdown line can show
// "owed vs paid" and PayablesPage/EmployeesPage/DailyLabourPage's own
// per-person "left to pay" figure (computed client-side from
// ExpensesManager's already-fetched relatedToId-scoped list) stays
// consistent with this company-wide total. Mirrors withBalances'
// paid-at-entry-vs-accrual split — an expense paid at entry was never
// something the person is still owed for.
const REIMBURSEMENT_RELATED_TYPES = ['financeEmployee', 'financeLabourer'];
const computeReimbursementRows = async () => {
    const expenses = await FinanceExpense.find(
        { deleted: { $ne: true }, relatedToType: { $in: REIMBURSEMENT_RELATED_TYPES }, relatedToId: { $ne: null } },
        'amount date paymentMode bankAccountId relatedToType relatedToId'
    );
    if (!expenses.length) return [];
    const accrualExpenses = expenses.filter(e => !e.paymentMode && !e.bankAccountId);
    const accrualIds = accrualExpenses.map(e => e._id);
    const paymentAgg = accrualIds.length ? await FinanceExpensePayment.aggregate([
        { $match: { expenseId: { $in: accrualIds }, deleted: { $ne: true } } },
        { $group: { _id: '$expenseId', total: { $sum: '$amount' } } },
    ]) : [];
    const paidByExpense = new Map(paymentAgg.map(r => [r._id.toString(), r.total]));

    const byPerson = new Map();
    for (const e of accrualExpenses) {
        const key = `${e.relatedToType}:${e.relatedToId}`;
        const paid = paidByExpense.get(e._id.toString()) || 0;
        const row = byPerson.get(key) || { relatedToType: e.relatedToType, relatedToId: e.relatedToId, owed: 0, paid: 0 };
        row.owed += e.amount;
        row.paid += paid;
        byPerson.set(key, row);
    }
    return [...byPerson.values()].map(r => ({ ...r, balancePayable: round2(r.owed - r.paid) }));
};

// All-time expense total for the Dashboard's "Total Expense" KPI — same
// FinanceExpense rows as thisMonthExpense/computeCompanyWideExpensePayable,
// just unbounded by date. Scoped to ongoing projects only (project.status
// !== 'completed') plus every expense not tied to any project at all
// (general/company overhead, projectId: null — see financeExpense.js's own
// comment on that field) — a completed project's historical spend is
// already reflected in its own Project Overview page and in This Month
// Expense when it was actually incurred; this KPI is meant to answer "how
// much is currently going out the door on work still in progress," not a
// permanent company-wide lifetime total.
const computeCompanyWideExpenseToDate = async () => {
    const completedProjectIds = await FinanceProject.distinct('_id', { status: 'completed', deleted: { $ne: true } });
    const agg = await FinanceExpense.aggregate([
        { $match: { deleted: { $ne: true }, projectId: { $nin: completedProjectIds } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    return round2(agg[0]?.total || 0);
};

// Cash actually disbursed, same "ongoing projects + untagged" scoping as
// computeCompanyWideExpenseToDate above (a null projectId — a general,
// not-tied-to-one-project record — isn't in completedProjectIds either
// way, so it's naturally still counted, same as an untagged FinanceExpense;
// financeSalaryPayment has no projectId field at all, so it's always
// counted in full, company-wide, same reasoning). Feeds the Dashboard's
// Total Expenses card, meant to be genuinely comprehensive — "literally
// every expense" — unlike Material (counted in full regardless of review —
// see computeProjectMaterialCostSplit's header comment), Contractor/Labour/
// Salary/Labour Provider/Commission/Supervisor Incentive count actual cash
// disbursed (advances + payments) instead of what's merely been earned,
// since that isn't a confirmed expense yet if it could still be rejected.
//
// Vendor Payments deliberately excludes:
//   - isRefund: true rows — that's cash coming IN (the vendor paying the
//     company back), not an expense.
//   - payments to a 'material_supplier' vendor — already counted via
//     Material Used (totalMaterialCost), which prices consumption at the
//     weighted-average PURCHASE rate; also counting the cash paid for that
//     same material would double it. Only 'other'-type vendors (equipment
//     rental, professional services, anything not material or labour_
//     contractor) are genuinely a separate, not-yet-counted expense here.
const computeCompanyWidePaidExpenses = async () => {
    const completedProjectIds = await FinanceProject.distinct('_id', { status: 'completed', deleted: { $ne: true } });
    const scopeFilter = { deleted: { $ne: true }, projectId: { $nin: completedProjectIds } };
    const sumAmount = async (Model, filter = scopeFilter, netOfHolding = false) => {
        const agg = await Model.aggregate([
            { $match: filter },
            // Holding stays with the company until the project completes —
            // not actually spent yet, so it's subtracted out the same way
            // Balance Payable nets against it (see financeContractorLedger.js's
            // header comment). Only Contractor/Labour Payment ever set this
            // param; the field is absent on every other model, so $ifNull
            // keeps this a no-op there.
            { $group: { _id: null, total: { $sum: netOfHolding ? { $subtract: ['$amount', { $ifNull: ['$holdingAmount', 0] }] } : '$amount' } } },
        ]);
        return round2(agg[0]?.total || 0);
    };
    const [
        contractorAdvances, contractorPayments, labourAdvances, labourPayments, commissionPayments,
        salaryPayments, labourProviderPayments, supervisorIncentives,
        nonRefundVendorPayments, otherVendorIds,
        manualCashOut, manualBankOut,
    ] = await Promise.all([
        sumAmount(FinanceContractorAdvance), sumAmount(FinanceContractorPayment, scopeFilter, true),
        sumAmount(FinanceLabourAdvance), sumAmount(FinanceLabourPayment, scopeFilter, true),
        sumAmount(FinanceCommissionPayment),
        sumAmount(FinanceSalaryPayment, { deleted: { $ne: true } }),
        sumAmount(FinanceLabourProviderPayment),
        sumAmount(FinanceSupervisorIncentive),
        FinanceVendorPayment.find({ ...scopeFilter, isRefund: { $ne: true } }, 'vendorId amount'),
        FinanceVendor.distinct('_id', { vendorType: { $ne: 'material_supplier' } }),
        sumAmount(FinanceCashEntry, { deleted: { $ne: true }, type: 'out' }),
        sumAmount(FinanceBankEntry, { deleted: { $ne: true }, type: 'out' }),
    ]);
    const otherVendorIdSet = new Set(otherVendorIds.map(id => id.toString()));
    const vendorPaidNonMaterial = round2(nonRefundVendorPayments
        .filter(p => otherVendorIdSet.has(p.vendorId?.toString()))
        .reduce((s, p) => s + p.amount, 0));

    return {
        contractorPaid: round2(contractorAdvances + contractorPayments),
        labourPaid: round2(labourAdvances + labourPayments),
        commissionPaid: commissionPayments,
        salaryPaid: salaryPayments,
        labourProviderPaid: labourProviderPayments,
        supervisorIncentivesPaid: supervisorIncentives,
        vendorPaidNonMaterial,
        // Manual entries with no other originating record (petty cash,
        // owner draws, bank corrections) — see financeCashEntry.js/
        // financeBankEntry.js's own comments. An owner draw is arguably an
        // equity distribution rather than a true business expense, but
        // included here for "literally every expense" completeness; revisit
        // if that framing ever needs to split out separately.
        manualOut: round2(manualCashOut + manualBankOut),
    };
};

// Cash-basis salary cost for This Month Profit — actual payments made this
// calendar month (by payment date, not which pay-period they're for), not
// accrual. Unlike material/expense (accrual — real cost incurred, whether
// or not paid yet), salary specifically only eats into profit once it's
// actually been paid out: explicit user decision, since unpaid salary is
// already visible (and growing) in the Salary Payables KPI above, same
// "unapproved/unpaid shouldn't count as profit-eaten cost yet" reasoning
// already applied to contractor/labour/commission — just cash-keyed here
// instead of review-keyed, since salary has no review gate of its own.
const computeSalaryPaidInRange = async (start, end) => {
    const agg = await FinanceSalaryPayment.aggregate([
        { $match: { date: { $gte: start, $lte: end }, deleted: { $ne: true } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    return agg[0]?.total || 0;
};

// This month's fresh salary accrual, net of whatever's already been paid
// for this month — the Salary Payables KPI card's headline figure, with
// the OLDER backlog (computeCompanyWideSalaryPayable, closed months only)
// shown as its "Payment left" sub-line instead, so the card reads "what's
// still owed for this month" up top and "how far behind overall"
// underneath.
//
// BUG FIX: this used to be the raw expected total with no netting against
// this month's own payments at all — paying an employee's full salary for
// the current month never moved this figure, so it silently kept reading
// as "still payable" even once nothing was left owed for the month. Now
// nets each employee's own expected-vs-paid for just this month, floored
// at 0 per employee (same convention as computeCompanyWideSalaryPayable's
// overduePayable) so one employee's advance/overpayment this month can't
// mask a different employee's real shortfall.
const computeCompanyWideSalaryExpectedThisMonth = async (monthKey) => {
    const employees = await FinanceEmployee.find({ deleted: { $ne: true } });
    const payments = await FinanceSalaryPayment.find({ month: monthKey, deleted: { $ne: true } });
    const paidByEmployee = new Map();
    for (const p of payments) {
        const key = p.employeeId.toString();
        paidByEmployee.set(key, (paidByEmployee.get(key) || 0) + p.amount);
    }
    return round2(employees.reduce((sum, e) => {
        const expected = expectedSalaryForMonth(e, monthKey);
        const paid = paidByEmployee.get(e._id.toString()) || 0;
        return sum + Math.max(0, expected - paid);
    }, 0));
};

// What the project's still-unreviewed sqft would bill the client once it
// clears review — client rate only (not net of referral commission; that's
// its own already-tracked unapprovedCommissionCost line), summed per Work
// using the same work-level reviewed ceiling (getApprovedBillingByWorkId)
// as computeProjectContractorCost/computeProjectLabourCost, so this project's
// Unapproved Revenue lines up with the same "unapproved" sqft those two use.
const computeProjectUnapprovedRevenue = async (projectId) => {
    const works = await FinanceWork.find({ projectId, deleted: { $ne: true } });
    if (!works.length) return { unapprovedRevenue: 0, unapprovedAreaSqft: 0 };
    const [rates, approvedBillingByWorkId] = await Promise.all([
        FinanceWorkTypeRate.find({ projectId, deleted: { $ne: true } }),
        getApprovedBillingByWorkId(works.map(w => w._id)),
    ]);
    const rateByWorkType = new Map(rates.map(r => [r.workType, r.clientRatePerSqft]));
    let unapprovedRevenue = 0;
    let unapprovedAreaSqft = 0;
    for (const w of works) {
        const billing = approvedBillingByWorkId.get(w._id.toString());
        const approvedArea = billing?.areaSqft || 0;
        // A rejection is final, already-reviewed — never "still pending
        // review," so it's excluded here too.
        const rejectedArea = billing?.rejectedAreaSqft || 0;
        const unapprovedArea = Math.max(0, w.completedAreaSqft - approvedArea - rejectedArea);
        unapprovedAreaSqft += unapprovedArea;
        unapprovedRevenue += unapprovedArea * (rateByWorkType.get(w.workType) || 0);
    }
    return { unapprovedRevenue: round2(unapprovedRevenue), unapprovedAreaSqft: round2(unapprovedAreaSqft) };
};

// Shared by getProjectProfit and getClientProfit/getClientDetail (which sum
// this across every project belonging to a client).
const computeProjectProfit = async (projectId) => {
    const project = await FinanceProject.findOne({ _id: projectId, deleted: { $ne: true } });
    if (!project) return null;

    const [revenueAgg, materialCostSplit, materialWaste, contractorCostInfo, commissionCostInfo, expenseAgg, labourCostInfo, unapprovedRevenueInfo, directPaymentContractorByVendor, directPaymentLabourByLabourer] = await Promise.all([
        FinanceRunningBill.aggregate([
            { $match: { projectId: project._id, status: 'issued', deleted: { $ne: true } } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]),
        computeProjectMaterialCostSplit(project._id),
        // A rejection's own wasted material was, until it was reviewed,
        // sitting inside materialWaste.fromStock's sibling (plain material
        // cost) like any other consumed material (consumption is logged
        // the moment a measurement's entered, long before anyone knows the
        // work will be rejected) — this moves it into Material Waste Cost
        // below instead, net zero effect on Profit from the move itself.
        // See computeProjectMaterialWaste's own comment.
        computeProjectMaterialWaste(project._id),
        computeProjectContractorCost(project._id),
        computeProjectCommissionCost(project),
        FinanceExpense.aggregate([
            { $match: { projectId: project._id, deleted: { $ne: true } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        computeProjectLabourCost(project._id),
        computeProjectUnapprovedRevenue(project._id),
        // Flat, informational only — see getWorkerPayoutTotal's comment: a
        // client direct payment (advance, not tied to specific sqft) no
        // longer nets against Unapproved/Approved cost at all, it's just
        // shown as its own total (Payables/Dashboard "Direct Payments").
        getWorkerPayoutTotalsBulk('contractor', project._id),
        getWorkerPayoutTotalsBulk('labour', project._id),
    ]);

    const revenue = revenueAgg[0]?.total || 0;
    const otherExpenses = expenseAgg[0]?.total || 0;
    const { unapprovedRevenue, unapprovedAreaSqft } = unapprovedRevenueInfo;
    // Clamped at 0 — materialWasteReclassified was priced at review time
    // using the material average rate as it stood then; a purchase/return
    // recorded since could have shifted that rate enough that it no longer
    // divides cleanly out of a freshly-recomputed decidedCost. Rare, but
    // "Material Cost: -₹40" would be a worse outcome than slightly
    // under-crediting the reclassification in that edge case.
    const materialCost = round2(Math.max(0, materialCostSplit.decidedCost - materialWaste.fromRejection));
    // materialWasteCost's own two constituents, exposed separately — see
    // getDashboardSummary's materialWasteBreakdown, which sums these two
    // across every ongoing project so the Dashboard's "Material Wastage
    // Loss" card can say what it's actually made of (physical waste logged
    // in Site Inventory vs. rejected-work material reclassified out of
    // Material Cost above) instead of one opaque total.
    const materialWasteFromStock = materialWaste.fromStock;
    const materialWasteFromRejection = materialWaste.fromRejection;
    const materialWasteCost = materialWaste.total;
    // Material tied to work still awaiting review — see
    // computeProjectMaterialCostSplit's own comment. Feeds unapprovedProfit
    // below, the same way unapprovedContractorCost/unapprovedLabourCost/
    // unapprovedCommissionCost already do for their own categories.
    const unapprovedMaterialCost = materialCostSplit.pendingCost;
    // Profit is built off Approved (reviewed) cost — Total cost (every
    // logged sqft, unconditional) is exposed alongside for context, split
    // out as its own unapproved figure below, but never subtracted here.
    const contractorCost = contractorCostInfo.approvedAmount;
    const labourCost = labourCostInfo.approvedAmount;
    const commissionCost = commissionCostInfo.approvedAmount;
    const profit = revenue - materialCost - materialWasteCost - contractorCost - commissionCost - otherExpenses - labourCost;

    // "Pending review" — logged work whose cost isn't counted in Profit yet
    // because it hasn't been reviewed. Never negative: review can only ever
    // approve up to what's logged, not more. Rejected amounts are excluded
    // too — a rejection is a FINAL, already-reviewed decision, not "still
    // pending review," so it must never sit in Unapproved forever just
    // because it was never re-labeled Approved (see
    // getCategoryApprovedAreaByWorkId's header comment).
    const unapprovedContractorCost = round2(Math.max(0, contractorCostInfo.totalAmount - contractorCost - contractorCostInfo.rejectedAmount));
    const unapprovedLabourCost = round2(Math.max(0, labourCostInfo.totalAmount - labourCost - labourCostInfo.rejectedAmount));
    const unapprovedCommissionCost = round2(Math.max(0, commissionCostInfo.totalAmount - commissionCost - commissionCostInfo.rejectedAmount));

    const unapprovedProfit = round2(unapprovedRevenue - unapprovedMaterialCost - unapprovedContractorCost - unapprovedLabourCost - unapprovedCommissionCost);

    const directPaymentContractorTotal = round2([...directPaymentContractorByVendor.values()].reduce((s, v) => s + v, 0));
    const directPaymentLabourTotal = round2([...directPaymentLabourByLabourer.values()].reduce((s, v) => s + v, 0));

    return {
        projectId: project._id, projectName: project.name, clientId: project.clientId,
        revenue, materialCost, materialWasteCost, materialWasteFromStock, materialWasteFromRejection,
        contractorCost, commissionCost, otherExpenses, labourCost, profit,
        totalContractorCost: contractorCostInfo.totalAmount, totalLabourCost: labourCostInfo.totalAmount,
        totalCommissionCost: commissionCostInfo.totalAmount,
        // Same "everything ever logged, unconditional" shape as
        // totalContractorCost/totalLabourCost/totalCommissionCost above —
        // decidedCost (approved + rejected, pre-waste-reclassification) +
        // pendingCost covers every 'consume' movement regardless of review
        // status, so a project with real material usage but nothing
        // approved yet reads as "Unapproved: totalMaterialCost logged"
        // instead of a bare, misleading "Material Cost: ₹0".
        totalMaterialCost: round2(materialCostSplit.decidedCost + materialCostSplit.pendingCost),
        // Approved sqft behind contractorCost/labourCost above — the "why"
        // behind those ₹ figures, same reasoning as the Dashboard's own
        // Contractor/Labour Teams - Approved sqft sub-line.
        approvedContractorAreaSqft: contractorCostInfo.approvedAreaSqft, approvedLabourAreaSqft: labourCostInfo.approvedAreaSqft,
        // ₹ value of each category's rejected (not pending) pool — lets a
        // "Total logged > Approved" gap be labeled correctly once nothing
        // is actually still pending review: "already rejected", not a
        // vague "Total logged" that reads like an open item.
        rejectedContractorCost: contractorCostInfo.rejectedAmount, rejectedLabourCost: labourCostInfo.rejectedAmount,
        rejectedCommissionCost: commissionCostInfo.rejectedAmount,
        unapprovedMaterialCost, unapprovedContractorCost, unapprovedLabourCost, unapprovedCommissionCost,
        directPaymentContractorTotal, directPaymentLabourTotal,
        // What this same still-unreviewed work is worth: revenue it'll bill
        // once approved, minus the unapproved cost lines above — the
        // "Unapproved" section's own mini profit picture, same shape as the
        // approved figures above it.
        unapprovedRevenue, unapprovedAreaSqft, unapprovedProfit,
        // What Profit becomes once everything currently logged and still
        // pending review actually clears review — Approved + Unapproved,
        // computed once here so every view showing both never has to add
        // them together itself.
        totalProjectedProfit: round2(profit + unapprovedProfit),
        marginPercent: revenue > 0 ? (profit / revenue) * 100 : 0,
    };
};

// Cumulative completedAreaSqft over time isn't stored anywhere (only the
// current total lives on the work doc) — approximated by bucketing each
// dated measurement into weeks since the project's startDate (or its first
// measurement, if startDate isn't set) and running a cumulative sum. Same
// "measurement dates as the only dated proxy for progress" approximation
// used by the month-scoped company-wide helpers below.
//
// Pulls from BOTH FinanceMeasurement (contractor vendor) and
// FinanceLabourMeasurement (individual labourer) — a work can be measured
// by either attribution type (or both, on different days), and progress is
// about total physical area completed regardless of who did it. Querying
// only the contractor collection meant a project worked entirely by an
// in-house labour team (no contractor vendor involved at all) showed this
// chart as empty no matter how much had actually been measured.
const computeProgressOverTime = async (projectId, startDate) => {
    const [contractorMeasurements, labourMeasurements] = await Promise.all([
        FinanceMeasurement.find({ projectId, deleted: { $ne: true } }, 'date areaCoveredSqft'),
        FinanceLabourMeasurement.find({ projectId, deleted: { $ne: true } }, 'date areaCoveredSqft'),
    ]);
    const measurements = [...contractorMeasurements, ...labourMeasurements].sort((a, b) => new Date(a.date) - new Date(b.date));
    if (!measurements.length) return [];
    const start = startDate ? new Date(startDate) : new Date(measurements[0].date);

    const byWeek = new Map();
    for (const m of measurements) {
        const diffDays = Math.floor((new Date(m.date) - start) / 86400000);
        const week = Math.max(0, Math.floor(diffDays / 7));
        byWeek.set(week, (byWeek.get(week) || 0) + m.areaCoveredSqft);
    }
    const maxWeek = Math.max(...byWeek.keys());
    let cumulative = 0;
    const series = [];
    for (let w = 0; w <= maxWeek; w++) {
        cumulative += byWeek.get(w) || 0;
        const weekStart = new Date(start.getTime() + w * 7 * 86400000);
        series.push({ week: w, weekStart: weekStart.toISOString().slice(0, 10), completedAreaSqft: cumulative });
    }
    return series;
};

const getProjectProfit = async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId) return res.status(400).json({ success: false, message: 'projectId is required' });
        const data = await computeProjectProfit(projectId);
        if (!data) return res.status(404).json({ success: false, message: 'Project not found' });
        const project = await FinanceProject.findById(projectId, 'startDate');
        data.progressOverTime = await computeProgressOverTime(projectId, project?.startDate);
        res.json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing project profit' });
    }
};

/*
 * Same `profit` figure getProjectProfit returns per project (minus the
 * progressOverTime series, which nothing batch-scoped needs), but for
 * every active project in one request instead of the Dashboard firing
 * one /project-profit call per active project (the N+1 fan-out this
 * replaces — see FinanceHome.jsx's fetchDashboard). Reuses
 * computeProjectProfit unchanged, same Promise.all-over-projects pattern
 * getClientProfit already uses.
 */
const getProjectProfitsBatch = async (req, res) => {
    try {
        const projects = await FinanceProject.find({ deleted: { $ne: true }, status: 'active' }, '_id name');
        const data = (await Promise.all(projects.map(p => computeProjectProfit(p._id)
            .then(d => (d ? { projectId: p._id, projectName: p.name, profit: d.profit } : null))
            .catch(() => null)))).filter(Boolean);
        res.json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing project profits' });
    }
};

const getClientProfit = async (req, res) => {
    try {
        const { clientId } = req.query;
        if (!clientId) return res.status(400).json({ success: false, message: 'clientId is required' });
        const client = await FinanceClient.findOne({ _id: clientId, deleted: { $ne: true } });
        if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

        const projects = await FinanceProject.find({ clientId, deleted: { $ne: true } });
        const perProject = (await Promise.all(projects.map(p => computeProjectProfit(p._id)))).filter(Boolean);

        const totals = perProject.reduce((acc, p) => ({
            revenue: acc.revenue + p.revenue,
            materialCost: acc.materialCost + p.materialCost,
            materialWasteCost: acc.materialWasteCost + p.materialWasteCost,
            contractorCost: acc.contractorCost + p.contractorCost,
            commissionCost: acc.commissionCost + p.commissionCost,
            otherExpenses: acc.otherExpenses + p.otherExpenses,
            labourCost: acc.labourCost + p.labourCost,
            totalContractorCost: acc.totalContractorCost + p.totalContractorCost,
            totalLabourCost: acc.totalLabourCost + p.totalLabourCost,
            totalCommissionCost: acc.totalCommissionCost + p.totalCommissionCost,
            unapprovedContractorCost: acc.unapprovedContractorCost + p.unapprovedContractorCost,
            unapprovedLabourCost: acc.unapprovedLabourCost + p.unapprovedLabourCost,
            unapprovedCommissionCost: acc.unapprovedCommissionCost + p.unapprovedCommissionCost,
            unapprovedRevenue: acc.unapprovedRevenue + p.unapprovedRevenue,
            unapprovedProfit: acc.unapprovedProfit + p.unapprovedProfit,
            unapprovedAreaSqft: acc.unapprovedAreaSqft + p.unapprovedAreaSqft,
            profit: acc.profit + p.profit,
            // Client direct payments — computeProjectProfit already carries
            // these per project (flat, informational — see
            // getWorkerPayoutTotal's comment), just never summed across a
            // client's whole portfolio before now.
            directPaymentContractorTotal: acc.directPaymentContractorTotal + p.directPaymentContractorTotal,
            directPaymentLabourTotal: acc.directPaymentLabourTotal + p.directPaymentLabourTotal,
        }), {
            revenue: 0, materialCost: 0, materialWasteCost: 0, contractorCost: 0, commissionCost: 0, otherExpenses: 0, labourCost: 0,
            totalContractorCost: 0, totalLabourCost: 0, totalCommissionCost: 0,
            unapprovedContractorCost: 0, unapprovedLabourCost: 0, unapprovedCommissionCost: 0,
            unapprovedRevenue: 0, unapprovedProfit: 0, unapprovedAreaSqft: 0, profit: 0,
            directPaymentContractorTotal: 0, directPaymentLabourTotal: 0,
        });
        totals.marginPercent = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;

        res.json({ success: true, data: { clientId: client._id, clientName: client.name, projects: perProject, totals } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing client profit' });
    }
};

// The sqft of a Work that's actually been REVIEWED — confirmed via the
// WorkReviewPanel (Payables/Receivables → "Deductions"/review tab), not
// merely logged. This is what "Approved" means everywhere in Finance as
// of the review-gate build: reviewing a worker's logged sqft on a Work
// (rejecting bad portions permanently, or marking the rest clean) is what
// actually approves it — being included in an issued client bill is no
// longer the approval act itself (Generate Bill's own ceiling is now
// capped BY this reviewed figure, see computeBillLineItems). Deliberately
// reads financeWorkReview only — never writes to it — so nothing here can
// itself trigger or block a review.
const computeWorkApprovedBilling = async (work) => {
    // Thin single-work wrapper over getApprovedBillingByWorkId (declared
    // below) — one implementation for both, nothing to drift.
    const result = (await getApprovedBillingByWorkId([work._id])).get(work._id.toString()) || { areaSqft: 0, date: null, rejectedAreaSqft: 0, heldForAttribution: false };
    return {
        approvedAreaSqft: result.areaSqft, approvedDate: result.date,
        rejectedAreaSqft: result.rejectedAreaSqft, heldForAttribution: result.heldForAttribution,
    };
};

// Bulk sibling of computeWorkApprovedBilling — one query for many works at
// once (a work only ever belongs to one project, so this is safe to call
// across works from different projects too, e.g. one contractor's entire
// portfolio company-wide). Returns Map<workId, { areaSqft, date }> — sums
// every worker's own reviewed ceiling (financeWorkReview.approvedAreaSqft)
// for that Work; date is the most recent lastReviewedAt among them.
//
// GATE (added per explicit business rule): a Work's rejected pool isn't
// blame-free just because it's rejected — WorkDeductionAllocationPanel is
// where the admin manually decides whose fault it was (contractor/labour
// get a sqft cut, financeContractorDeduction/financeLabourDeduction with a
// matching workId; supervisors get a plain ₹ deduction instead, tracked
// separately and NOT part of this gate). Until that attribution is
// complete for a Work (attributedAreaSqft === rejectedAreaSqft, i.e.
// nothing left "unattributed" — same definition financeWorkReview.js's
// listReviewsForProject already uses), NOBODY's approved earnings on that
// Work are payable yet — this returns areaSqft: 0 for it, holding every
// contractor/labour cost/earnings site (all of which are built on this
// function or its getCategoryApprovedAreaByWorkId sibling) at "Unapproved"
// until the rejection is fully sorted out. A Work with nothing rejected
// (rejectedAreaSqft === 0) is never held — there's nothing to attribute.
const getApprovedBillingByWorkId = async (workIds) => {
    if (!workIds.length) return new Map();
    const [reviews, contractorDeductions, labourDeductions] = await Promise.all([
        FinanceWorkReview.find(
            { workId: { $in: workIds } },
            'workId approvedAreaSqft rejectedAreaSqft reviewCycle lastReviewedAt'
        ),
        FinanceContractorDeduction.find({ workId: { $in: workIds }, deleted: { $ne: true } }, 'workId areaSqft workReviewCycle'),
        FinanceLabourDeduction.find({ workId: { $in: workIds }, deleted: { $ne: true } }, 'workId areaSqft workReviewCycle'),
    ]);
    const reviewCycleByWorkId = new Map(reviews.map(r => [r.workId.toString(), r.reviewCycle]));
    const attributedByWorkId = new Map();
    for (const row of [...contractorDeductions, ...labourDeductions]) {
        const key = row.workId.toString();
        // Only a deduction stamped with THIS Work's CURRENT review cycle
        // counts as attribution — one left over from an earlier, already-
        // superseded rejection on the same Work must never silently cover a
        // brand new one just because the sqft happens to add up. See
        // financeWorkReview.js's reviewCycle field comment for the bug this
        // fixes (and reviewWork, which is now the only path that creates a
        // cycle-tagged deduction in the first place).
        if (row.workReviewCycle == null || row.workReviewCycle !== reviewCycleByWorkId.get(key)) continue;
        attributedByWorkId.set(key, (attributedByWorkId.get(key) || 0) + (row.areaSqft || 0));
    }
    const approvedByWorkId = new Map();
    for (const r of reviews) {
        const key = r.workId.toString();
        const attributed = attributedByWorkId.get(key) || 0;
        const unattributed = round2(Math.max(0, (r.rejectedAreaSqft || 0) - attributed));
        // heldForAttribution distinguishes "this Work's Unapproved figure is
        // big because nothing's been reviewed yet" from "this Work WAS
        // reviewed, but its rejected sqft isn't fully attributed yet, so the
        // gate above is holding even the genuinely-approved portion back" —
        // same distinction you flagged (a rejection isn't the same thing as
        // "still pending review"). Frontend uses this to show a clear held
        // notice instead of a plain, unexplained Unapproved number.
        const cur = approvedByWorkId.get(key) || { areaSqft: 0, date: null, rejectedAreaSqft: 0, heldForAttribution: false };
        if (unattributed <= 0) cur.areaSqft = round2(cur.areaSqft + r.approvedAreaSqft);
        else cur.heldForAttribution = true;
        cur.rejectedAreaSqft = round2(cur.rejectedAreaSqft + (r.rejectedAreaSqft || 0));
        if (r.lastReviewedAt && (!cur.date || r.lastReviewedAt > cur.date)) cur.date = r.lastReviewedAt;
        approvedByWorkId.set(key, cur);
    }
    return approvedByWorkId;
};

// How much of a Work's sqft has actually made it into an ISSUED client
// bill's lineItems — kept as its own concept, separate from "Approved"
// (now = reviewed, see getApprovedBillingByWorkId above). These two used
// to be the same thing (issuing the bill WAS the approval act); now that
// review happens first and independently, a work can have reviewed sqft
// that hasn't been billed yet — that gap (reviewed − billed) is what
// Generate Bill's own ceiling actually needs, NOT (logged − reviewed),
// which instead means "still pending review" (see computeWorkExpectedPay's
// availableToBillAreaSqft vs unapprovedAreaSqft).
const getBilledAreaByWorkId = async (workIds) => {
    if (!workIds.length) return new Map();
    const bills = await FinanceRunningBill.find(
        { status: 'issued', deleted: { $ne: true }, 'lineItems.workId': { $in: workIds } },
        'billDate lineItems'
    );
    const workIdSet = new Set(workIds.map(id => id.toString()));
    const billedByWorkId = new Map();
    for (const bill of bills) {
        for (const li of bill.lineItems) {
            const key = li.workId.toString();
            if (!workIdSet.has(key)) continue;
            const cur = billedByWorkId.get(key) || { areaSqft: 0, date: null };
            cur.areaSqft += li.areaBilledSqft;
            if (!cur.date || bill.billDate > cur.date) cur.date = bill.billDate;
            billedByWorkId.set(key, cur);
        }
    }
    return billedByWorkId;
};

const computeWorkBilledArea = async (work) => {
    const result = (await getBilledAreaByWorkId([work._id])).get(work._id.toString()) || { areaSqft: 0, date: null };
    return { billedAreaSqft: result.areaSqft, billedDate: result.date };
};

// A running bill's lineItems only record a work-level billed total, never a
// per-contractor/per-labourer split — so when more than one party
// contributes to the same Work, this splits that work's approved sqft
// proportionally to each party's own share of the logged (measured) area.
// Exact for the overwhelmingly common case of one party per Work; the same
// accepted simplification documented on computeWorkExpectedPay/
// computeWorkProfit, now centralized so every earnings site applies it
// identically instead of drifting.
const splitApprovedAreaByShare = (approvedAreaSqft, partyArea, totalAreaAllParties) =>
    totalAreaAllParties > 0 ? round2(approvedAreaSqft * (partyArea / totalAreaAllParties)) : 0;

// Work-scoped analog of computeProjectMaterialCostSplit — traces each
// 'consume' movement on this one Work back to its source measurement, then
// splits its cost by that measurement's own approved/rejected/pending
// share of this Work's already-computed contractor/labour ceilings
// (computeWorkProfit passes those straight in, so this doesn't re-query
// getCategoryApprovedAreaByWorkId a second time).
//
// BUG FIX: computeWorkProfit used to subtract computeWorkMaterialCost's
// flat, unconditional total straight into `profit` regardless of review
// status, while contractorCost/labourCost/commissionCost for that exact
// same still-unreviewed work correctly stayed in Unapproved. A Work with
// real material spend but nothing approved yet showed a deeply negative
// "Approved" Profit driven entirely by material — see
// computeProjectMaterialCostSplit's identical header comment for the
// project-level version of this same bug, fixed there first.
const computeWorkMaterialCostSplit = async (
    projectId, workId,
    contractorApprovedAreaSqft, contractorRejectedAreaSqft,
    labourApprovedAreaSqft, labourRejectedAreaSqft,
) => {
    const avgRate = await computeMaterialAvgRates(projectId);
    const [contractorMeasurements, labourMeasurements] = await Promise.all([
        FinanceMeasurement.find({ workId, deleted: { $ne: true } }, 'areaCoveredSqft'),
        FinanceLabourMeasurement.find({ workId, deleted: { $ne: true } }, 'areaCoveredSqft'),
    ]);
    const measurementIds = contractorMeasurements.map(m => m._id);
    const labourMeasurementIds = labourMeasurements.map(m => m._id);
    if (!measurementIds.length && !labourMeasurementIds.length) return { decidedCost: 0, pendingCost: 0 };

    const consumeMovements = await FinanceStockMovement.find({
        movementType: 'consume', deleted: { $ne: true },
        $or: [
            { relatedMeasurementId: { $in: measurementIds } },
            { relatedLabourMeasurementId: { $in: labourMeasurementIds } },
        ],
    }, 'materialId quantity relatedMeasurementId relatedLabourMeasurementId');
    if (!consumeMovements.length) return { decidedCost: 0, pendingCost: 0 };

    const contractorMeasurementById = new Map(contractorMeasurements.map(m => [m._id.toString(), m]));
    const labourMeasurementById = new Map(labourMeasurements.map(m => [m._id.toString(), m]));
    const contractorTotalArea = contractorMeasurements.reduce((s, m) => s + m.areaCoveredSqft, 0);
    const labourTotalArea = labourMeasurements.reduce((s, m) => s + m.areaCoveredSqft, 0);

    let decidedCost = 0, pendingCost = 0;
    for (const mv of consumeMovements) {
        const rate = avgRate.get(mv.materialId.toString()) || 0;
        const cost = mv.quantity * rate;
        if (!cost) continue;

        const isContractor = !!mv.relatedMeasurementId;
        const measurement = isContractor
            ? contractorMeasurementById.get(mv.relatedMeasurementId.toString())
            : mv.relatedLabourMeasurementId ? labourMeasurementById.get(mv.relatedLabourMeasurementId.toString()) : null;
        // No traceable source measurement — treated as pending rather than
        // silently assumed decided, same principle
        // computeProjectMaterialCostSplit's identical case applies.
        if (!measurement) { pendingCost += cost; continue; }

        const approvedArea = isContractor ? contractorApprovedAreaSqft : labourApprovedAreaSqft;
        const rejectedArea = isContractor ? contractorRejectedAreaSqft : labourRejectedAreaSqft;
        const totalArea = isContractor ? contractorTotalArea : labourTotalArea;

        const approvedShare = splitApprovedAreaByShare(approvedArea, measurement.areaCoveredSqft, totalArea);
        const rejectedShare = splitApprovedAreaByShare(rejectedArea, measurement.areaCoveredSqft, totalArea);
        const decidedFraction = measurement.areaCoveredSqft > 0 ? Math.min(1, (approvedShare + rejectedShare) / measurement.areaCoveredSqft) : 0;

        decidedCost += cost * decidedFraction;
        pendingCost += cost * (1 - decidedFraction);
    }
    return { decidedCost: round2(decidedCost), pendingCost: round2(pendingCost) };
};

// BUG FIX (found while investigating wrong Dashboard/Project Overview/
// Profitability numbers right after reviewing a Work that has BOTH
// contractor and labour measurements): a Work's review sets ONE combined
// approvedAreaSqft ceiling covering everything logged on it — contractor
// measurements AND labour measurements together (see financeWorkReview.js's
// reviewWork, which reviews against computeWorkLoggedSqft's combined sum).
// Every earnings site below used to hand that SAME combined ceiling to
// BOTH the contractor-side split (against the contractor-only measured
// total) AND, independently, the labour-side split (against the
// labour-only measured total) — each side treating the full ceiling as if
// it belonged entirely to them. That double-counts approved earnings
// (contractor approved + labour approved could sum to up to 2x the real
// approved ceiling) whenever a Work has both.
//
// This splits the combined ceiling ONCE, up front, between the contractor
// and labour categories proportional to each category's own share of the
// Work's combined logged area — so contractorApprovedAreaSqft +
// labourApprovedAreaSqft always sums back to exactly the Work's real
// approved ceiling, never more. Every caller that used to pass
// getApprovedBillingByWorkId's raw areaSqft into splitApprovedAreaByShare
// for a contractor or labour party now passes this function's
// category-specific figure instead — the within-category split (by each
// vendor's/labourer's own share of their category's total) is unchanged.
//
// Also splits the Work's rejectedAreaSqft the same way (contractor/labour
// RejectedAreaSqft) — a rejection is a FINAL decision (reviewed, then
// marked bad), not "still pending review." Every caller computing its own
// "Unapproved" figure as totalArea − approvedArea must also subtract its
// own share of this so a settled rejection doesn't sit in Unapproved
// forever just because it was never re-labeled Approved (see
// getApprovedBillingByWorkId's own header comment on heldForAttribution
// for the one case where this still legitimately shows 100% Unapproved:
// while a rejection's blame is unattributed, the gate holds
// approvedAreaSqft at 0 for the whole Work, and that hold is intentional —
// only the rejected slice itself should never double up on top of it).
const getCategoryApprovedAreaByWorkId = async (workIds) => {
    if (!workIds.length) return new Map();
    const [approvedByWorkId, contractorAgg, labourAgg, reviews, contractorDeductions, labourDeductions] = await Promise.all([
        getApprovedBillingByWorkId(workIds),
        FinanceMeasurement.aggregate([
            { $match: { workId: { $in: workIds }, deleted: { $ne: true } } },
            { $group: { _id: '$workId', total: { $sum: '$areaCoveredSqft' } } },
        ]),
        FinanceLabourMeasurement.aggregate([
            { $match: { workId: { $in: workIds }, deleted: { $ne: true } } },
            { $group: { _id: '$workId', total: { $sum: '$areaCoveredSqft' } } },
        ]),
        FinanceWorkReview.find({ workId: { $in: workIds } }, 'workId reviewCycle'),
        // Exact, deliberate per-vendor blame for a rejection — see below.
        FinanceContractorDeduction.find({ workId: { $in: workIds }, deleted: { $ne: true } }, 'workId vendorId areaSqft workReviewCycle'),
        FinanceLabourDeduction.find({ workId: { $in: workIds }, deleted: { $ne: true } }, 'workId labourerId areaSqft workReviewCycle'),
    ]);
    const contractorTotalByWorkId = new Map(contractorAgg.map(r => [r._id.toString(), r.total]));
    const labourTotalByWorkId = new Map(labourAgg.map(r => [r._id.toString(), r.total]));
    const cycleByWorkId = new Map(reviews.map(r => [r.workId.toString(), r.reviewCycle]));

    // BUG FIX: every caller below used to split a Work's rejected sqft
    // across its contributing vendors/labourers by PROPORTION OF LOGGED
    // AREA (splitApprovedAreaByShare) — a guess. But since the atomic
    // review-and-distribute flow (reviewWork in financeWorkReview.js) now
    // *requires* the reviewer to say exactly whose sqft was rejected
    // (FinanceContractorDeduction/FinanceLabourDeduction, each stamped with
    // workReviewCycle), that exact answer already exists — the proportional
    // guess was silently overriding it, then callers that also apply the
    // deduction row's ₹ amount against a vendor's Balance Payable were
    // effectively docking that vendor twice for the same rejection (once
    // via the wrong guessed share, again via the real deduction), while any
    // OTHER vendor on the same Work absorbed a share of the rejection they
    // were never actually blamed for.
    //
    // A row only counts as this exact answer when its workReviewCycle
    // matches the Work's CURRENT review cycle — a row from a superseded
    // cycle (the review was redone) or a genuinely standalone manual
    // deduction (workReviewCycle: null, added directly from the Contractor/
    // Labour Ledger, unrelated to any review) is not "the current
    // rejection's attribution" and must not feed this. Below, "complete"
    // additionally requires the exact rows for a Work to sum to exactly
    // that Work's own category-level rejected sqft — anything less (a
    // legacy review from before this mechanism existed) falls back to the
    // proportional guess exactly as before, rather than under-attributing.
    const exactContractorRejectedByWork = new Map(); // workId -> Map(vendorId -> area)
    const exactContractorSumByWork = new Map();
    for (const d of contractorDeductions) {
        const workKey = d.workId.toString();
        if (d.workReviewCycle == null || d.workReviewCycle !== cycleByWorkId.get(workKey)) continue;
        if (!exactContractorRejectedByWork.has(workKey)) exactContractorRejectedByWork.set(workKey, new Map());
        const m = exactContractorRejectedByWork.get(workKey);
        const vKey = d.vendorId.toString();
        m.set(vKey, (m.get(vKey) || 0) + (d.areaSqft || 0));
        exactContractorSumByWork.set(workKey, (exactContractorSumByWork.get(workKey) || 0) + (d.areaSqft || 0));
    }
    const exactLabourRejectedByWork = new Map();
    const exactLabourSumByWork = new Map();
    for (const d of labourDeductions) {
        const workKey = d.workId.toString();
        if (d.workReviewCycle == null || d.workReviewCycle !== cycleByWorkId.get(workKey)) continue;
        if (!exactLabourRejectedByWork.has(workKey)) exactLabourRejectedByWork.set(workKey, new Map());
        const m = exactLabourRejectedByWork.get(workKey);
        const lKey = d.labourerId.toString();
        m.set(lKey, (m.get(lKey) || 0) + (d.areaSqft || 0));
        exactLabourSumByWork.set(workKey, (exactLabourSumByWork.get(workKey) || 0) + (d.areaSqft || 0));
    }

    const result = new Map();
    for (const workId of workIds) {
        const key = workId.toString();
        const billing = approvedByWorkId.get(key);
        const workApprovedAreaSqft = billing?.areaSqft || 0;
        const workRejectedAreaSqft = billing?.rejectedAreaSqft || 0;
        const contractorTotal = contractorTotalByWorkId.get(key) || 0;
        const labourTotal = labourTotalByWorkId.get(key) || 0;
        const combinedTotal = contractorTotal + labourTotal;

        // The exact per-vendor/per-labourer rows just gathered also settle
        // how much of the rejection belongs to the contractor category vs.
        // the labour category in the first place — checked against the
        // review's own real rejectedAreaSqft (authoritative), not against a
        // proportional guess (a work with, say, one contractor and one
        // labourer sharing a rejection almost never splits it exactly by
        // logged-area share, so comparing the exact sum against that guess
        // would nearly always — wrongly — read as "incomplete").
        const exactContractorMap = exactContractorRejectedByWork.get(key) || null;
        const exactLabourMap = exactLabourRejectedByWork.get(key) || null;
        const exactContractorSum = exactContractorSumByWork.get(key) || 0;
        const exactLabourSum = exactLabourSumByWork.get(key) || 0;
        const exactWorkComplete = (exactContractorMap || exactLabourMap)
            && Math.abs((exactContractorSum + exactLabourSum) - workRejectedAreaSqft) < 0.01;

        const contractorRejectedAreaSqft = exactWorkComplete
            ? exactContractorSum
            : splitApprovedAreaByShare(workRejectedAreaSqft, contractorTotal, combinedTotal);
        const labourRejectedAreaSqft = exactWorkComplete
            ? exactLabourSum
            : splitApprovedAreaByShare(workRejectedAreaSqft, labourTotal, combinedTotal);

        result.set(key, {
            contractorApprovedAreaSqft: exactWorkComplete
                ? round2(contractorTotal - contractorRejectedAreaSqft)
                : splitApprovedAreaByShare(workApprovedAreaSqft, contractorTotal, combinedTotal),
            labourApprovedAreaSqft: exactWorkComplete
                ? round2(labourTotal - labourRejectedAreaSqft)
                : splitApprovedAreaByShare(workApprovedAreaSqft, labourTotal, combinedTotal),
            contractorRejectedAreaSqft, labourRejectedAreaSqft,
            heldForAttribution: billing?.heldForAttribution || false,
            date: billing?.date || null,
            // Exact per-vendor/per-labourer rejected sqft when the atomic
            // review's own distribution fully accounts for this Work's
            // rejection this cycle — null means "no exact answer, fall back
            // to the proportional guess" (splitApprovedAreaByShare), same
            // as every caller already did before this existed.
            contractorExactRejectedByVendor: exactWorkComplete ? (exactContractorMap || new Map()) : null,
            labourExactRejectedByLabourer: exactWorkComplete ? (exactLabourMap || new Map()) : null,
        });
    }
    return result;
};

// "Expected Total Pay" for a Work — a forward-looking figure, deliberately
// separate from computeWorkProfit's contractorCost/labourCost (which are
// backward-looking: actual measured/approved area to date). This instead
// asks "what will this work actually pay out once finished, after
// penalties": rate × estimatedAreaSqft (the full contract target), minus
// every deduction manually entered against this specific work
// (financeContractorDeduction/financeLabourDeduction with a matching
// workId — see those controllers). Reuses the exact same
// rate-lookup-by-(project, party, workType) shape as computeWorkProfit so
// nothing drifts between the two.
//
// No one is assigned a personal target sqft here — everyone just works,
// and gets paid for what they actually measured (that part is already
// correctly per-party, see computeWorkProfit's contractorBreakdown/
// labourBreakdown). estimatedAreaSqft is a single, whole-Work target, so
// when more than one contractor (or labourer) contributes, this uses ONE
// blended rate per category — weighted by each party's own share of area
// measured on this Work so far, falling back to a plain average of the
// assigned rates before anything's been measured yet — instead of
// treating the full target as if every assigned party would complete it
// on their own (which used to sum each one's rate × the *full* area,
// inflating the total by however many people are assigned).
const weightedAvgRate = (rates, idField, measuredAreaByParty) => {
    if (!rates.length) return 0;
    const totalMeasured = rates.reduce((s, r) => s + (measuredAreaByParty.get(r[idField].toString()) || 0), 0);
    if (totalMeasured > 0) {
        return rates.reduce((s, r) => s + (measuredAreaByParty.get(r[idField].toString()) || 0) / totalMeasured * r.ratePerSqft, 0);
    }
    return rates.reduce((s, r) => s + r.ratePerSqft, 0) / rates.length;
};
const computeWorkExpectedPay = async (work) => {
    const [contractorAssignments, labourAssignments, contractorMeasurements, labourMeasurements] = await Promise.all([
        FinanceWorkContractorAssignment.find({ workId: work._id, deleted: { $ne: true } }, 'contractorVendorId'),
        FinanceWorkLabourAssignment.find({ workId: work._id, deleted: { $ne: true } }, 'labourerId'),
        FinanceMeasurement.find({ workId: work._id, deleted: { $ne: true } }, 'contractorVendorId areaCoveredSqft'),
        FinanceLabourMeasurement.find({ workId: work._id, deleted: { $ne: true } }, 'labourerId areaCoveredSqft'),
    ]);
    const vendorIds = new Set([
        ...contractorAssignments.map(a => a.contractorVendorId.toString()),
        ...contractorMeasurements.filter(m => m.contractorVendorId).map(m => m.contractorVendorId.toString()),
    ]);
    const labourerIds = new Set([
        ...labourAssignments.map(a => a.labourerId.toString()),
        ...labourMeasurements.map(m => m.labourerId.toString()),
    ]);
    const contractorAreaByVendor = new Map();
    for (const m of contractorMeasurements) {
        if (!m.contractorVendorId) continue;
        const key = m.contractorVendorId.toString();
        contractorAreaByVendor.set(key, (contractorAreaByVendor.get(key) || 0) + m.areaCoveredSqft);
    }
    const labourAreaByLabourer = new Map();
    for (const m of labourMeasurements) {
        const key = m.labourerId.toString();
        labourAreaByLabourer.set(key, (labourAreaByLabourer.get(key) || 0) + m.areaCoveredSqft);
    }

    const [contractorRates, labourRates, contractorDeductionAgg, labourDeductionAgg, supervisorDeductionAgg] = await Promise.all([
        vendorIds.size ? FinanceContractorRate.find({ projectId: work.projectId, contractorVendorId: { $in: [...vendorIds] }, workType: work.workType, deleted: { $ne: true } }) : [],
        labourerIds.size ? FinanceLabourRate.find({ projectId: work.projectId, labourerId: { $in: [...labourerIds] }, workType: work.workType, deleted: { $ne: true } }) : [],
        FinanceContractorDeduction.aggregate([
            { $match: { workId: work._id, deleted: { $ne: true } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        FinanceLabourDeduction.aggregate([
            { $match: { workId: work._id, deleted: { $ne: true } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        // Supervisor deductions don't reduce this Work's own contractor/
        // labour pay (a supervisor is paid salary, not an area rate) — but
        // still count toward this work's overall "money withheld due to
        // negligence" total, since that's the figure this function reports.
        FinanceSupervisorDeduction.aggregate([
            { $match: { workId: work._id, deleted: { $ne: true } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
    ]);

    // One blended rate per category — see this function's own header
    // comment. Every area figure below (total/approved/rejected/
    // unapproved/available-to-bill/expected) now multiplies by these two
    // instead of summing every individual rate found, so the fix applies
    // consistently everywhere in this function, not just expectedPay.
    const contractorRate = weightedAvgRate(contractorRates, 'contractorVendorId', contractorAreaByVendor);
    const labourRate = weightedAvgRate(labourRates, 'labourerId', labourAreaByLabourer);

    const expectedPay = round2(work.estimatedAreaSqft * (contractorRate + labourRate));
    const deductedTotal = round2((contractorDeductionAgg[0]?.total || 0) + (labourDeductionAgg[0]?.total || 0) + (supervisorDeductionAgg[0]?.total || 0));

    // Total = every logged sqft so far (work.completedAreaSqft, unconditional
    // — same figure the dashboard's "show it even before approval" boxes
    // use) × rate. Approved = only the sqft actually reviewed and confirmed
    // (computeWorkApprovedBilling, sourced from financeWorkReview) × the
    // same rate — this, not Total, is what's actually owed to whoever did
    // the work. Unapproved is simply the gap; never a separately entered
    // figure.
    const totalAreaSqft = work.completedAreaSqft;
    const totalAmount = round2(totalAreaSqft * (contractorRate + labourRate));
    const { approvedAreaSqft, approvedDate, rejectedAreaSqft, heldForAttribution } = await computeWorkApprovedBilling(work);
    const approvedAmount = round2(approvedAreaSqft * (contractorRate + labourRate));

    // Available to bill = Reviewed − already Billed — deliberately NOT the
    // same gap as unapprovedAreaSqft (Total − Reviewed, "still pending
    // review"). Generate Bill's own ceiling needs this one: sqft that's
    // already been reviewed and confirmed, but hasn't made it into an
    // issued bill yet. Reviewed sqft never disappears once billed (it
    // still counts as this worker's Approved earnings either way) — this
    // figure just tracks how much of it is still available for a *new*
    // bill to draw on.
    const { billedAreaSqft } = await computeWorkBilledArea(work);
    const availableToBillAreaSqft = round2(Math.max(0, approvedAreaSqft - billedAreaSqft));
    const availableToBillAmount = round2(availableToBillAreaSqft * (contractorRate + labourRate));

    // A rejection is a FINAL, already-reviewed decision, not "still pending
    // review" — it must never sit in Unapproved forever just because it was
    // never re-labeled Approved. Subtracted out here, at the source, so
    // every caller of this function inherits the fix instead of each
    // needing its own patch.
    const rejectedAmount = round2(rejectedAreaSqft * (contractorRate + labourRate));
    const unapprovedAreaSqft = round2(Math.max(0, totalAreaSqft - approvedAreaSqft - rejectedAreaSqft));
    const unapprovedAmount = round2(Math.max(0, totalAmount - approvedAmount - rejectedAmount));

    return {
        expectedPay, deductedTotal, expectedPayNetOfDeductions: round2(expectedPay - deductedTotal),
        totalAreaSqft, totalAmount, approvedAreaSqft, approvedAmount, approvedDate,
        unapprovedAreaSqft, unapprovedAmount,
        billedAreaSqft, availableToBillAreaSqft, availableToBillAmount,
        // See getApprovedBillingByWorkId's comment — heldForAttribution true
        // still means EVERY genuinely-approved sqft on this Work reads as
        // Unapproved (payable withheld pending attribution) — that hold is
        // deliberate. Only the rejected slice itself is now excluded, never
        // inflating Unapproved on top of that hold.
        rejectedAreaSqft, heldForAttribution,
    };
};

// Shared by getWorkProfit and getWorkDetail (Tier-2 work drill-down) so the
// contractor-cost/revenue/profit numbers can never drift between the two.
//
// INTERPRETATION FLAG: the spec's revenue formula for Work Profit doesn't
// explicitly say to filter by bill status the way Project Profit does. To
// keep "Revenue" meaning the same thing everywhere in this module (money
// actually billed to the client, not a draft that could still change),
// this filters to status: 'issued' too — flip this filter here only if
// that turns out to be the wrong call.
const computeWorkProfit = async (work) => {
    const revenueAgg = await FinanceRunningBill.aggregate([
        { $match: { status: 'issued', deleted: { $ne: true } } },
        { $unwind: '$lineItems' },
        { $match: { 'lineItems.workId': work._id } },
        { $group: { _id: null, amount: { $sum: '$lineItems.amount' }, areaBilledSqft: { $sum: '$lineItems.areaBilledSqft' } } },
    ]);
    const revenue = revenueAgg[0]?.amount || 0;
    const areaBilledSqft = revenueAgg[0]?.areaBilledSqft || 0;

    // Contractor Cost is measurement-level: each day's area attributes to
    // whichever contractor vendor actually did it, so a Work with more than
    // one contributing contractor gets a per-contractor breakdown, not one
    // blended rate. `contractorCost` stays the summed total so nothing
    // reading only that field breaks.
    //
    // Total (areaSqft) is every logged sqft, unconditional — engineerApproved
    // no longer gates anything here (see computeWorkApprovedBilling's header
    // comment: reviewing via WorkReviewPanel is the real gate now). Approved
    // (approvedAreaSqft) is this work's reviewed sqft
    // (computeWorkApprovedBilling), distributed across contributing vendors
    // proportional to each one's share of Total — lineItems only record a
    // work-level billed figure, not a per-vendor split, so this is the best
    // available attribution when more than one vendor's on a work (exact
    // for the common single-vendor case).
    const { approvedAreaSqft: workApprovedAreaSqft, approvedDate: workApprovedDate, rejectedAreaSqft: workRejectedAreaSqft } = await computeWorkApprovedBilling(work);
    // Splits this Work's single combined approved ceiling between the
    // contractor and labour categories once, up front — see
    // getCategoryApprovedAreaByWorkId's own comment for why this can't just
    // hand workApprovedAreaSqft to both sides independently.
    const {
        contractorApprovedAreaSqft, labourApprovedAreaSqft,
        contractorRejectedAreaSqft, labourRejectedAreaSqft,
        contractorExactRejectedByVendor, labourExactRejectedByLabourer,
    } = (await getCategoryApprovedAreaByWorkId([work._id])).get(work._id.toString())
        || { contractorApprovedAreaSqft: 0, labourApprovedAreaSqft: 0, contractorRejectedAreaSqft: 0, labourRejectedAreaSqft: 0, contractorExactRejectedByVendor: null, labourExactRejectedByLabourer: null };
    const directPaymentsForWork = await getWorkerPayoutDeductionsForWork(work._id);
    const measurements = await FinanceMeasurement.find({ workId: work._id, deleted: { $ne: true } });
    const areaByVendor = new Map(); // contractorVendorId -> totalArea
    for (const m of measurements) {
        if (!m.contractorVendorId) continue;
        const key = m.contractorVendorId.toString();
        areaByVendor.set(key, (areaByVendor.get(key) || 0) + m.areaCoveredSqft);
    }
    // Seed assigned contractors with zero area too, so a brand-new Work
    // with a contractor assigned but no measurements yet still shows a
    // (zero) breakdown row.
    const assignments = await FinanceWorkContractorAssignment.find({ workId: work._id, deleted: { $ne: true } });
    for (const a of assignments) {
        const key = a.contractorVendorId.toString();
        if (!areaByVendor.has(key)) areaByVendor.set(key, 0);
    }

    let contractorCost = 0;
    const contractorBreakdown = [];
    const totalVendorArea = [...areaByVendor.values()].reduce((s, a) => s + a, 0);
    if (areaByVendor.size) {
        const vendorIds = [...areaByVendor.keys()];
        const [rates, vendors] = await Promise.all([
            FinanceContractorRate.find({ projectId: work.projectId, contractorVendorId: { $in: vendorIds }, workType: work.workType, deleted: { $ne: true } }),
            FinanceVendor.find({ _id: { $in: vendorIds }, deleted: { $ne: true } }),
        ]);
        const rateByVendor = new Map(rates.map(r => [r.contractorVendorId.toString(), r]));
        const vendorById = new Map(vendors.map(v => [v._id.toString(), v]));
        for (const [vendorId, totalArea] of areaByVendor) {
            const rate = rateByVendor.get(vendorId);
            const perUnit = rate ? (rate.ratePerSqft) : 0;
            // A rejection is final, already-reviewed — this vendor's own
            // share of it must not sit in Unapproved forever. See
            // getCategoryApprovedAreaByWorkId's header comment. Prefer the
            // exact, deliberate per-vendor attribution from the atomic
            // review's own distribution over the proportional guess
            // whenever it's available.
            const rejectedArea = contractorExactRejectedByVendor
                ? (contractorExactRejectedByVendor.get(vendorId) || 0)
                : splitApprovedAreaByShare(contractorRejectedAreaSqft, totalArea, totalVendorArea);
            const approvedArea = contractorExactRejectedByVendor
                ? round2(totalArea - rejectedArea)
                : splitApprovedAreaByShare(contractorApprovedAreaSqft, totalArea, totalVendorArea);
            const unapprovedArea = round2(Math.max(0, totalArea - approvedArea - rejectedArea));
            const totalAmount = round2(totalArea * perUnit);
            const approvedAmount = round2(approvedArea * perUnit);
            const unapprovedAmount = round2(unapprovedArea * perUnit);
            const rejectedAmount = round2(rejectedArea * perUnit);
            contractorCost += approvedAmount;
            const vendor = vendorById.get(vendorId);

            // Client direct payment (category flagged "cut from worker
            // payout") for THIS vendor recorded against THIS work —
            // informational only now (an advance, not payment for specific
            // measured sqft — see getWorkerPayoutTotal's comment), doesn't
            // touch approvedAmount/unapprovedAmount at all.
            const directPaymentTotal = directPaymentsForWork.get(`contractor_${vendorId}`) || 0;

            contractorBreakdown.push({
                vendorId, vendorName: vendor?.name || '—',
                areaSqft: round2(totalArea), approvedAreaSqft: approvedArea, unapprovedAreaSqft: unapprovedArea,
                rate: perUnit, totalAmount, approvedAmount, unapprovedAmount, rejectedAmount,
                approvedDate: workApprovedDate,
                directPaymentTotal,
            });
        }
    }

    contractorCost = round2(contractorCost);

    // Labour Cost — same per-person breakdown as contractor above. Labour
    // never had an engineerApproved gate (every logged sqft was immediately
    // payable) — this is the one genuine behavior change: labour earnings
    // now also only count reviewed sqft (WorkReviewPanel). Same proportional
    // distribution of this work's Approved sqft across contributing
    // labourers as the contractor side above.
    const labourMeasurements = await FinanceLabourMeasurement.find({ workId: work._id, deleted: { $ne: true } });
    const areaByLabourer = new Map(); // labourerId -> totalArea
    for (const m of labourMeasurements) {
        const key = m.labourerId.toString();
        areaByLabourer.set(key, (areaByLabourer.get(key) || 0) + m.areaCoveredSqft);
    }
    const labourAssignments = await FinanceWorkLabourAssignment.find({ workId: work._id, deleted: { $ne: true } });
    for (const a of labourAssignments) {
        const key = a.labourerId.toString();
        if (!areaByLabourer.has(key)) areaByLabourer.set(key, 0);
    }

    let labourCost = 0;
    const labourBreakdown = [];
    const totalLabourerArea = [...areaByLabourer.values()].reduce((s, a) => s + a, 0);
    if (areaByLabourer.size) {
        const labourerIds = [...areaByLabourer.keys()];
        const [labourRates, labourers] = await Promise.all([
            FinanceLabourRate.find({ projectId: work.projectId, labourerId: { $in: labourerIds }, workType: work.workType, deleted: { $ne: true } }),
            FinanceLabourer.find({ _id: { $in: labourerIds }, deleted: { $ne: true } }),
        ]);
        const rateByLabourer = new Map(labourRates.map(r => [r.labourerId.toString(), r]));
        const labourerById = new Map(labourers.map(l => [l._id.toString(), l]));
        for (const [labourerId, totalArea] of areaByLabourer) {
            const rate = rateByLabourer.get(labourerId);
            const perUnit = rate ? rate.ratePerSqft : 0;
            // A rejection is final, already-reviewed — this labourer's own
            // share of it must not sit in Unapproved forever. See
            // getCategoryApprovedAreaByWorkId's header comment. Prefer the
            // exact, deliberate per-labourer attribution from the atomic
            // review's own distribution over the proportional guess
            // whenever it's available.
            const rejectedArea = labourExactRejectedByLabourer
                ? (labourExactRejectedByLabourer.get(labourerId) || 0)
                : splitApprovedAreaByShare(labourRejectedAreaSqft, totalArea, totalLabourerArea);
            const approvedArea = labourExactRejectedByLabourer
                ? round2(totalArea - rejectedArea)
                : splitApprovedAreaByShare(labourApprovedAreaSqft, totalArea, totalLabourerArea);
            const unapprovedArea = round2(Math.max(0, totalArea - approvedArea - rejectedArea));
            const totalAmount = round2(totalArea * perUnit);
            const approvedAmount = round2(approvedArea * perUnit);
            const unapprovedAmount = round2(unapprovedArea * perUnit);
            const rejectedAmount = round2(rejectedArea * perUnit);
            labourCost += approvedAmount;
            const labourer = labourerById.get(labourerId);

            // See the identical comment on the contractor breakdown above —
            // informational only, doesn't touch approvedAmount/unapprovedAmount.
            const directPaymentTotal = directPaymentsForWork.get(`labour_${labourerId}`) || 0;

            labourBreakdown.push({
                labourerId, labourerName: labourer?.name || '—',
                areaSqft: round2(totalArea), approvedAreaSqft: approvedArea, unapprovedAreaSqft: unapprovedArea,
                rate: perUnit, totalAmount, approvedAmount, unapprovedAmount, rejectedAmount,
                approvedDate: workApprovedDate,
                directPaymentTotal,
            });
        }
    }
    labourCost = round2(labourCost);

    // Commission — same (project, workType) referralRatePerSqft rate
    // computeProjectCommissionCost uses, just attributed to this one Work's
    // own logged/reviewed area instead of summed across a project's whole
    // portfolio of works. Not attempted for 'advance' contract-type
    // projects — their commission is one flat, manually-entered figure for
    // the whole project (financeProject.referralCommissionAmount), with no
    // per-sqft rate to attribute to an individual work at all.
    const project = await FinanceProject.findById(work.projectId, 'referralId contractType');
    let commissionCost = 0, totalCommissionAmount = 0, unapprovedCommissionAmount = 0, rejectedCommissionAmount = 0, clientRatePerSqft = 0;
    if (project?.referralId && project.contractType !== 'advance') {
        const workTypeRate = await FinanceWorkTypeRate.findOne({ projectId: work.projectId, workType: work.workType, deleted: { $ne: true } });
        if (workTypeRate) {
            clientRatePerSqft = workTypeRate.clientRatePerSqft || 0;
            const referralRate = workTypeRate.referralRatePerSqft || 0;
            totalCommissionAmount = round2(work.completedAreaSqft * referralRate);
            commissionCost = round2(workApprovedAreaSqft * referralRate);
            // A rejection is final, already-reviewed — excluded from
            // Unapproved (same reasoning as everywhere else in this file).
            // Exposed on the return object (not just a local) so callers
            // can tell "still pending review" apart from "already rejected,
            // settled" the same way rejectedContractorCost/rejectedLabourCost
            // already let them — see WorkDetail.jsx's Commission Cost card.
            rejectedCommissionAmount = round2(workRejectedAreaSqft * referralRate);
            unapprovedCommissionAmount = round2(Math.max(0, totalCommissionAmount - commissionCost - rejectedCommissionAmount));
        }
    } else if (project?.contractType !== 'advance') {
        // No referral at all — still need the client rate for
        // unapprovedRevenue below, commission stays 0.
        const workTypeRate = await FinanceWorkTypeRate.findOne({ projectId: work.projectId, workType: work.workType, deleted: { $ne: true } });
        clientRatePerSqft = workTypeRate?.clientRatePerSqft || 0;
    }

    const materialCostSplit = await computeWorkMaterialCostSplit(
        work.projectId, work._id,
        contractorApprovedAreaSqft, contractorRejectedAreaSqft,
        labourApprovedAreaSqft, labourRejectedAreaSqft,
    );
    const materialWasteFromRejection = await computeWorkMaterialWasteFromRejection(work._id);
    // Clamped at 0 — same reasoning as computeProjectProfit's identical
    // clamp: the reclassification was priced using the material rate as it
    // stood at review time, which a purchase/return since could have
    // shifted enough that it no longer divides cleanly out of a
    // freshly-recomputed decidedCost.
    const materialCost = round2(Math.max(0, materialCostSplit.decidedCost - materialWasteFromRejection));
    const unapprovedMaterialCost = materialCostSplit.pendingCost;
    const totalMaterialCost = round2(materialCostSplit.decidedCost + materialCostSplit.pendingCost);
    // materialWasteCost's own two constituents — see computeProjectMaterialWaste's
    // identical fromStock/fromRejection split; exposed separately here too
    // so a Work's own Material Waste Cost can show what it's made of
    // instead of one opaque total, same as the Dashboard's card.
    const materialWasteFromStock = await computeWorkMaterialWasteCost(work.projectId, work._id);
    const materialWasteCost = round2(materialWasteFromStock + materialWasteFromRejection);
    const profit = revenue - contractorCost - labourCost - materialCost - materialWasteCost - commissionCost;
    const {
        expectedPay, deductedTotal, expectedPayNetOfDeductions,
        totalAreaSqft, totalAmount, approvedAreaSqft, approvedAmount, approvedDate, unapprovedAreaSqft, unapprovedAmount,
        rejectedAreaSqft, heldForAttribution,
    } = await computeWorkExpectedPay(work);

    // Work-level direct-payment totals, built from the same per-worker
    // breakdown rows above (not re-derived independently) — flat,
    // informational only now (see getWorkerPayoutTotal's comment).
    const contractorDirectPaymentTotal = round2(contractorBreakdown.reduce((s, r) => s + r.directPaymentTotal, 0));
    const labourDirectPaymentTotal = round2(labourBreakdown.reduce((s, r) => s + r.directPaymentTotal, 0));

    // What this Work's still-unreviewed sqft would bill the client once
    // it's approved — same "Unapproved" mini-profit picture ProjectDetail's
    // Unapproved section shows, just for one Work instead of a whole
    // project. Uses computeWorkExpectedPay's unapprovedAreaSqft (total
    // logged minus reviewed), not a separately-derived figure.
    const unapprovedRevenue = round2(unapprovedAreaSqft * clientRatePerSqft);

    // Work-level totals, summed from each breakdown row's own
    // unapprovedAmount — NOT re-derived as totalContractorAmount −
    // contractorCost (that gap also contains the rejected pool once it's
    // been attributed, since contractorCost/labourCost above are
    // approved-only; re-subtracting that way silently relabels an
    // already-settled rejection as "still pending review" again). Each
    // row's own unapprovedAmount already has this fixed (see the
    // contractor/labour loops above), so summing those is the one
    // consistent source of truth — getWorkProfit/getWorkDetail both used
    // to recompute this the wrong way independently.
    const unapprovedContractorCost = round2(contractorBreakdown.reduce((s, b) => s + b.unapprovedAmount, 0));
    const unapprovedLabourCost = round2(labourBreakdown.reduce((s, b) => s + b.unapprovedAmount, 0));
    // ₹ value of each category's rejected (not pending) pool — see
    // computeProjectContractorCost's identical field for why this needs to
    // stay visible even once nothing is genuinely unapproved: a "Total
    // logged > Approved" gap that's entirely rejected should read as
    // "already rejected," not a vague "Total logged" that implies an open
    // item still needs review.
    const rejectedContractorCost = round2(contractorBreakdown.reduce((s, b) => s + b.rejectedAmount, 0));
    const rejectedLabourCost = round2(labourBreakdown.reduce((s, b) => s + b.rejectedAmount, 0));

    return {
        revenue, contractorCost, contractorBreakdown, labourCost, labourBreakdown, materialCost, materialWasteCost,
        materialWasteFromStock, materialWasteFromRejection, profit, areaBilledSqft,
        // Same "everything ever logged, unconditional" shape totalContractorCost
        // etc. use elsewhere — see computeWorkMaterialCostSplit's header comment.
        unapprovedMaterialCost, totalMaterialCost,
        commissionCost, totalCommissionAmount, unapprovedCommissionAmount, rejectedCommissionAmount, unapprovedRevenue,
        unapprovedContractorCost, unapprovedLabourCost, rejectedContractorCost, rejectedLabourCost,
        expectedPay, deductedTotal, expectedPayNetOfDeductions,
        totalAreaSqft, totalAmount, approvedAreaSqft, approvedAmount, approvedDate, unapprovedAreaSqft, unapprovedAmount,
        rejectedAreaSqft, heldForAttribution,
        contractorDirectPaymentTotal, labourDirectPaymentTotal,
    };
};

// Everything about one Work — area, contractor/labour cost + breakdown,
// material used/wasted, and the daily cost/sqft trend — scoped to one
// date window instead of computeWorkProfit's fixed all-time scope.
// `dateStart`/`dateEnd` are both nullable; null on both means all time,
// only `dateEnd` set means "from the work's start through that date",
// both set means a bounded window (a single day, or a month). Always shows
// 100% of logged area/cost for the window, unconditional — approval is a
// whole-Work, billing-derived snapshot (computeWorkApprovedBilling), not
// something attributable to one specific day or month, so this scoped view
// doesn't attempt an approved/unapproved split at all (that only exists in
// computeWorkProfit's all-time figures).
const computeWorkScopedReport = async (work, { dateStart, dateEnd, avgRate }) => {
    const dateFilter = {};
    if (dateStart) dateFilter.$gte = dateStart;
    if (dateEnd) dateFilter.$lte = dateEnd;
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    const [measurements, labourMeasurements, taggedWaste, projectWasteTotal] = await Promise.all([
        FinanceMeasurement.find({ workId: work._id, ...(hasDateFilter ? { date: dateFilter } : {}), deleted: { $ne: true } }).sort({ date: 1 }),
        FinanceLabourMeasurement.find({ workId: work._id, ...(hasDateFilter ? { date: dateFilter } : {}), deleted: { $ne: true } }),
        FinanceStockMovement.aggregate([
            { $match: { workId: work._id, movementType: 'waste', deleted: { $ne: true }, ...(hasDateFilter ? { date: dateFilter } : {}) } },
            { $group: { _id: '$materialId', qty: { $sum: '$quantity' } } },
        ]),
        // Untagged waste at this project — reported separately, honestly,
        // rather than silently folded into or excluded from this work's number.
        FinanceStockMovement.aggregate([
            { $match: { projectId: work.projectId, movementType: 'waste', workId: null, deleted: { $ne: true }, ...(hasDateFilter ? { date: dateFilter } : {}) } },
            { $group: { _id: '$materialId', qty: { $sum: '$quantity' } } },
        ]),
    ]);

    // Per-worker Material Cost/Sqft — only this worker's own materialUsed
    // entries (within the scoped date window, same as everything else
    // here) ÷ only the area covered on days THEY logged material, so it
    // isn't diluted by a co-worker's usage or by any of their own area
    // logged without material. Pooled total÷total, same convention as
    // Project Overview's material table and the top Average Material
    // Cost/Sqft KPI — a ratio like this should be weighted by how much
    // area each day actually represents, not averaged day-by-day.
    const materialCostByVendor = new Map();
    const materialAreaByVendor = new Map();
    const materialCostByLabourer = new Map();
    const materialAreaByLabourer = new Map();

    const areaByVendor = new Map();
    for (const m of measurements) {
        if (!m.contractorVendorId) continue;
        const key = m.contractorVendorId.toString();
        areaByVendor.set(key, (areaByVendor.get(key) || 0) + m.areaCoveredSqft);
        if (m.materialUsed?.length) {
            const cost = m.materialUsed.reduce((s, u) => s + u.quantity * (avgRate.get(u.materialId.toString()) || 0), 0);
            materialCostByVendor.set(key, (materialCostByVendor.get(key) || 0) + cost);
            materialAreaByVendor.set(key, (materialAreaByVendor.get(key) || 0) + m.areaCoveredSqft);
        }
    }
    let contractorCost = 0;
    const contractorBreakdown = [];
    if (areaByVendor.size) {
        const vendorIds = [...areaByVendor.keys()];
        const [rates, vendors] = await Promise.all([
            FinanceContractorRate.find({ projectId: work.projectId, contractorVendorId: { $in: vendorIds }, workType: work.workType, deleted: { $ne: true } }),
            FinanceVendor.find({ _id: { $in: vendorIds }, deleted: { $ne: true } }),
        ]);
        const rateByVendor = new Map(rates.map(r => [r.contractorVendorId.toString(), r]));
        const vendorById = new Map(vendors.map(v => [v._id.toString(), v]));
        for (const [vendorId, totalArea] of areaByVendor) {
            const perUnit = rateByVendor.get(vendorId)?.ratePerSqft || 0;
            const earnings = round2(totalArea * perUnit);
            contractorCost += earnings;
            const vendorMaterialArea = materialAreaByVendor.get(vendorId) || 0;
            const vendorMaterialCost = materialCostByVendor.get(vendorId) || 0;
            contractorBreakdown.push({
                vendorId, vendorName: vendorById.get(vendorId)?.name || '—',
                areaSqft: round2(totalArea), rate: perUnit, earnings,
                materialCostPerSqft: vendorMaterialArea > 0 ? vendorMaterialCost / vendorMaterialArea : null,
                // Real, unscaled material cost — kept alongside the blended
                // ratio above so getWorkDetail can divide it by approved/
                // unapproved area instead (see that function's own
                // comment); only meaningful once approval context is
                // merged in, i.e. All Time scope.
                materialCost: vendorMaterialCost,
            });
        }
    }
    contractorCost = round2(contractorCost);

    const areaByLabourer = new Map();
    for (const m of labourMeasurements) {
        const key = m.labourerId.toString();
        areaByLabourer.set(key, (areaByLabourer.get(key) || 0) + m.areaCoveredSqft);
        if (m.materialUsed?.length) {
            const cost = m.materialUsed.reduce((s, u) => s + u.quantity * (avgRate.get(u.materialId.toString()) || 0), 0);
            materialCostByLabourer.set(key, (materialCostByLabourer.get(key) || 0) + cost);
            materialAreaByLabourer.set(key, (materialAreaByLabourer.get(key) || 0) + m.areaCoveredSqft);
        }
    }
    let labourCost = 0;
    const labourBreakdown = [];
    if (areaByLabourer.size) {
        const labourerIds = [...areaByLabourer.keys()];
        const [labourRates, labourers] = await Promise.all([
            FinanceLabourRate.find({ projectId: work.projectId, labourerId: { $in: labourerIds }, workType: work.workType, deleted: { $ne: true } }),
            FinanceLabourer.find({ _id: { $in: labourerIds }, deleted: { $ne: true } }),
        ]);
        const rateByLabourer = new Map(labourRates.map(r => [r.labourerId.toString(), r]));
        const labourerById = new Map(labourers.map(l => [l._id.toString(), l]));
        for (const [labourerId, totalArea] of areaByLabourer) {
            const perUnit = rateByLabourer.get(labourerId)?.ratePerSqft || 0;
            const earnings = round2(totalArea * perUnit);
            labourCost += earnings;
            const labourerMaterialArea = materialAreaByLabourer.get(labourerId) || 0;
            const labourerMaterialCost = materialCostByLabourer.get(labourerId) || 0;
            labourBreakdown.push({
                labourerId, labourerName: labourerById.get(labourerId)?.name || '—',
                areaSqft: round2(totalArea), rate: perUnit, earnings,
                materialCostPerSqft: labourerMaterialArea > 0 ? labourerMaterialCost / labourerMaterialArea : null,
                // See contractorBreakdown's identical field above.
                materialCost: labourerMaterialCost,
            });
        }
    }
    labourCost = round2(labourCost);

    const areaCoveredSqft = round2(
        [...areaByVendor.values()].reduce((sum, a) => sum + a, 0)
        + [...areaByLabourer.values()].reduce((sum, a) => sum + a, 0)
    );

    // Material Used — traced via each measurement's own materialUsed[],
    // not re-derived from stock movements (measurements already store it).
    // Labour measurements carry the exact same materialUsed[] shape, and
    // count here too — material consumed doesn't care whether a contractor
    // or an individual labourer logged the work that used it.
    const materialIds = new Set();
    const usedByMaterial = new Map();
    for (const m of [...measurements, ...labourMeasurements]) {
        for (const u of m.materialUsed) {
            const key = u.materialId.toString();
            materialIds.add(key);
            usedByMaterial.set(key, (usedByMaterial.get(key) || 0) + u.quantity);
        }
    }
    for (const r of taggedWaste) materialIds.add(r._id.toString());
    for (const r of projectWasteTotal) materialIds.add(r._id.toString());
    const materials = materialIds.size ? await FinanceMaterial.find({ _id: { $in: [...materialIds] } }, 'name unit') : [];
    const materialById = new Map(materials.map(m => [m._id.toString(), m]));
    const nameUnit = (id) => ({ materialName: materialById.get(id.toString())?.name || 'Unknown', unit: materialById.get(id.toString())?.unit || '' });

    const materialUsed = [...usedByMaterial.entries()].map(([id, qty]) => ({ materialId: id, quantity: qty, ...nameUnit(id) }));
    const materialWasted = taggedWaste.map(r => ({ materialId: r._id, quantity: r.qty, ...nameUnit(r._id) }));
    const projectLevelWaste = projectWasteTotal.map(r => ({ materialId: r._id, quantity: r.qty, ...nameUnit(r._id) }));

    // Daily breakdown feeds the "Daily Cost/Sqft" chart, one point per day.
    // Average Cost/Sqft itself is pooled total material cost ÷ total area
    // across the whole scope, NOT a mean of each day's own ratio — a ratio
    // like this should be weighted by how much area each day actually
    // represents, so a 10 sqft day doesn't swing the average as much as a
    // 10,000 sqft one.
    const byDate = new Map();
    for (const m of [...measurements, ...labourMeasurements]) {
        const dateKey = new Date(m.date).toISOString().slice(0, 10);
        if (!byDate.has(dateKey)) byDate.set(dateKey, { areaCoveredSqft: 0, materialCost: 0 });
        const entry = byDate.get(dateKey);
        entry.areaCoveredSqft += m.areaCoveredSqft;
        for (const u of m.materialUsed) entry.materialCost += u.quantity * (avgRate.get(u.materialId.toString()) || 0);
    }
    const dailyBreakdown = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, e]) => ({
        date, areaCoveredSqft: e.areaCoveredSqft, materialCost: e.materialCost,
        costPerSqft: e.areaCoveredSqft > 0 ? e.materialCost / e.areaCoveredSqft : 0,
    }));
    const totalMaterialCostInScope = dailyBreakdown.reduce((s, d) => s + d.materialCost, 0);
    const totalAreaInScope = dailyBreakdown.reduce((s, d) => s + d.areaCoveredSqft, 0);
    const averageCostPerSqft = totalAreaInScope > 0 ? totalMaterialCostInScope / totalAreaInScope : 0;

    return {
        areaCoveredSqft,
        contractorCost, contractorBreakdown,
        labourCost, labourBreakdown,
        totalCost: round2(contractorCost + labourCost),
        materialUsed, materialWasted, projectLevelWaste,
        dailyBreakdown, averageCostPerSqft,
    };
};

const getWorkProfit = async (req, res) => {
    try {
        const { workId } = req.query;
        if (!workId) return res.status(400).json({ success: false, message: 'workId is required' });
        const work = await FinanceWork.findOne({ _id: workId, deleted: { $ne: true } });
        if (!work) return res.status(404).json({ success: false, message: 'Work not found' });

        const wp = await computeWorkProfit(work);
        const unapprovedProfit = round2(wp.unapprovedRevenue
            - wp.unapprovedMaterialCost
            - wp.unapprovedContractorCost
            - wp.unapprovedLabourCost
            - wp.unapprovedCommissionAmount);
        res.json({
            success: true,
            data: {
                workId: work._id, projectId: work.projectId, workType: work.workType,
                estimatedAreaSqft: work.estimatedAreaSqft, completedAreaSqft: work.completedAreaSqft,
                areaBilledSqft: wp.areaBilledSqft, revenue: wp.revenue, contractorCost: wp.contractorCost,
                contractorBreakdown: wp.contractorBreakdown,
                labourCost: wp.labourCost, labourBreakdown: wp.labourBreakdown,
                unapprovedContractorCost: wp.unapprovedContractorCost, unapprovedLabourCost: wp.unapprovedLabourCost,
                rejectedContractorCost: wp.rejectedContractorCost, rejectedLabourCost: wp.rejectedLabourCost,
                commissionCost: wp.commissionCost, totalCommissionAmount: wp.totalCommissionAmount,
                unapprovedCommissionAmount: wp.unapprovedCommissionAmount,
                materialCost: wp.materialCost, unapprovedMaterialCost: wp.unapprovedMaterialCost, totalMaterialCost: wp.totalMaterialCost,
                materialWasteCost: wp.materialWasteCost, profit: wp.profit,
                totalAreaSqft: wp.totalAreaSqft, totalAmount: wp.totalAmount,
                approvedAreaSqft: wp.approvedAreaSqft, approvedAmount: wp.approvedAmount, approvedDate: wp.approvedDate,
                unapprovedAreaSqft: wp.unapprovedAreaSqft, unapprovedAmount: wp.unapprovedAmount,
                rejectedAreaSqft: wp.rejectedAreaSqft, heldForAttribution: wp.heldForAttribution,
                expectedPay: wp.expectedPay, deductedTotal: wp.deductedTotal, expectedPayNetOfDeductions: wp.expectedPayNetOfDeductions,
                // The Unapproved section's own mini profit picture, same shape
                // as ProjectDetail's / getWorkDetail's — this endpoint had
                // never exposed it, so Reports' Work Profit tab could only
                // ever show Approved figures.
                unapprovedRevenue: wp.unapprovedRevenue,
                unapprovedProfit,
                totalProjectedProfit: round2(wp.profit + unapprovedProfit),
                contractorDirectPaymentTotal: wp.contractorDirectPaymentTotal,
                labourDirectPaymentTotal: wp.labourDirectPaymentTotal,
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing work profit' });
    }
};

// Tier-2 endpoint — everything about one work, scoped to exactly one of
// Day / Month / All Time at a time (never several simultaneous sections
// on the page — that got confusing fast). Revenue and Profit are the one
// exception left unscoped: they come from issued running bills, which
// aren't measurement-dated, so a "daily profit" isn't a coherent number
// to invent — they're always all-time, computeWorkProfit's own scope.
const getWorkDetail = async (req, res) => {
    try {
        const { workId, scope: rawScope, month, date, upto } = req.query;
        if (!workId) return res.status(400).json({ success: false, message: 'workId is required' });
        const work = await FinanceWork.findOne({ _id: workId, deleted: { $ne: true } });
        if (!work) return res.status(404).json({ success: false, message: 'Work not found' });
        // Kept separate from `work` on purpose — work.projectId stays a raw
        // ObjectId below since it feeds several other queries as a filter
        // value (computeWorkProfit, material avg rates, stock movements).
        const workProject = await FinanceProject.findById(work.projectId, 'name');
        const progressPercent = work.estimatedAreaSqft > 0 ? Math.min(100, Math.round((work.completedAreaSqft / work.estimatedAreaSqft) * 100)) : 0;

        const scope = ['day', 'month', 'alltime'].includes(rawScope) ? rawScope : 'alltime';
        let dateStart = null, dateEnd = null, scopeLabel = 'All Time';
        let monthKey = null, dateKey = null, cumulative = false;

        if (scope === 'day') {
            dateKey = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
            cumulative = upto === 'true' || upto === '1';
            dateEnd = new Date(`${dateKey}T23:59:59.999Z`);
            if (!cumulative) dateStart = new Date(`${dateKey}T00:00:00.000Z`);
            scopeLabel = cumulative ? `Up to ${dateKey}` : `On ${dateKey}`;
        } else if (scope === 'month') {
            monthKey = month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);
            const bounds = monthBounds(monthKey);
            dateStart = bounds.start; dateEnd = bounds.end;
            scopeLabel = monthKey;
        }

        const [avgRate, workProfit, materialStock] = await Promise.all([
            computeMaterialAvgRates(work.projectId),
            computeWorkProfit(work),
            computeCurrentStock(work.projectId),
        ]);
        const report = await computeWorkScopedReport(work, { dateStart, dateEnd, avgRate });
        // Approval is a whole-Work, all-time decision — it has no coherent
        // meaning scoped to one Day/Month, so this is only attached when the
        // picker is All Time. Merged in-memory from workProfit's own
        // contractorBreakdown/labourBreakdown (already computed above, same
        // vendorId/labourerId keys) rather than re-queried.
        //
        // materialCostPerSqftApproved/Unapproved divide this party's real,
        // unscaled material cost (report.*Breakdown's own `materialCost` —
        // never reduced) by ONLY their approved (or unapproved) area — NOT
        // a proportional split of the cost itself. If some of this party's
        // logged area was rejected, the same real spend is now divided
        // across fewer confirmed sqft, so this genuinely reads higher than
        // the blended materialCostPerSqft above; that's the point, not a
        // rounding artifact.
        if (scope === 'alltime') {
            const approvedAreaByVendor = new Map(workProfit.contractorBreakdown.map(b => [b.vendorId.toString(), b.approvedAreaSqft]));
            const unapprovedAreaByVendor = new Map(workProfit.contractorBreakdown.map(b => [b.vendorId.toString(), b.unapprovedAreaSqft]));
            report.contractorBreakdown = report.contractorBreakdown.map(b => {
                const approvedAreaSqft = approvedAreaByVendor.get(b.vendorId.toString()) ?? null;
                const unapprovedAreaSqft = unapprovedAreaByVendor.get(b.vendorId.toString()) ?? null;
                return {
                    ...b, approvedAreaSqft, unapprovedAreaSqft,
                    materialCostPerSqftApproved: approvedAreaSqft > 0 ? b.materialCost / approvedAreaSqft : null,
                    materialCostPerSqftUnapproved: unapprovedAreaSqft > 0 ? b.materialCost / unapprovedAreaSqft : null,
                };
            });
            const approvedAreaByLabourer = new Map(workProfit.labourBreakdown.map(b => [b.labourerId.toString(), b.approvedAreaSqft]));
            const unapprovedAreaByLabourer = new Map(workProfit.labourBreakdown.map(b => [b.labourerId.toString(), b.unapprovedAreaSqft]));
            report.labourBreakdown = report.labourBreakdown.map(b => {
                const approvedAreaSqft = approvedAreaByLabourer.get(b.labourerId.toString()) ?? null;
                const unapprovedAreaSqft = unapprovedAreaByLabourer.get(b.labourerId.toString()) ?? null;
                return {
                    ...b, approvedAreaSqft, unapprovedAreaSqft,
                    materialCostPerSqftApproved: approvedAreaSqft > 0 ? b.materialCost / approvedAreaSqft : null,
                    materialCostPerSqftUnapproved: unapprovedAreaSqft > 0 ? b.materialCost / unapprovedAreaSqft : null,
                };
            });
        }
        // totalContractorAmount/totalLabourAmount still used just below for
        // each KPI card's own "Total logged" sub-line — kept for that, but
        // no longer used to derive "unapproved" (see workProfit's own
        // unapprovedContractorCost/unapprovedLabourCost comment for why
        // totalAmount − approvedCost stopped being the right formula once
        // rejected sqft got excluded from approvedCost: that gap also
        // contains the rejected pool once it's attributed, silently
        // relabeling an already-settled rejection as "still pending").
        const totalContractorAmount = round2(workProfit.contractorBreakdown.reduce((s, b) => s + b.totalAmount, 0));
        const totalLabourAmount = round2(workProfit.labourBreakdown.reduce((s, b) => s + b.totalAmount, 0));
        const unapprovedProfit = round2(workProfit.unapprovedRevenue
            - workProfit.unapprovedMaterialCost
            - workProfit.unapprovedContractorCost
            - workProfit.unapprovedLabourCost
            - workProfit.unapprovedCommissionAmount);

        res.json({
            success: true,
            data: {
                workId: work._id, projectId: work.projectId, projectName: workProject?.name || '—', workType: work.workType,
                estimatedAreaSqft: work.estimatedAreaSqft, completedAreaSqft: work.completedAreaSqft, progressPercent,
                scope, scopeLabel, month: monthKey, date: dateKey, cumulative,
                ...report,
                // All-time, billing-approval-based — overrides the scoped
                // (raw logged, ungated) contractorCost/labourCost `report`
                // spread in above, same "always all-time" treatment
                // revenue/profit already get: approval is a whole-Work
                // billing snapshot, not attributable to one specific
                // day/month. The scoped figures are kept under their own
                // key in case the Day/Month view still wants to show raw
                // logged cost for that window.
                scopedContractorCost: report.contractorCost, scopedLabourCost: report.labourCost,
                contractorCost: workProfit.contractorCost, labourCost: workProfit.labourCost,
                // Per-type all-time totals (workProfit.contractorBreakdown/
                // labourBreakdown already carry these per vendor/labourer —
                // summed here so the Contractor Cost/Labour Cost KPI cards
                // can each show their own "Total logged" figure next to
                // their Approved one, distinct from computeWorkExpectedPay's
                // blended totalAmount below).
                totalContractorAmount, totalLabourAmount,
                // The correct "still genuinely pending review" ₹ figures for
                // the Unapproved table below — see workProfit's own
                // unapprovedContractorCost/unapprovedLabourCost comment.
                // Never derive these as totalContractorAmount − contractorCost
                // (or the labour equivalent) client-side; that gap also
                // contains the rejected pool once it's attributed.
                unapprovedContractorCost: workProfit.unapprovedContractorCost, unapprovedLabourCost: workProfit.unapprovedLabourCost,
                rejectedContractorCost: workProfit.rejectedContractorCost, rejectedLabourCost: workProfit.rejectedLabourCost,
                totalAreaSqft: workProfit.totalAreaSqft, totalAmount: workProfit.totalAmount,
                approvedAreaSqft: workProfit.approvedAreaSqft, approvedAmount: workProfit.approvedAmount, approvedDate: workProfit.approvedDate,
                unapprovedAreaSqft: workProfit.unapprovedAreaSqft, unapprovedAmount: workProfit.unapprovedAmount,
                rejectedAreaSqft: workProfit.rejectedAreaSqft, heldForAttribution: workProfit.heldForAttribution,
                revenue: workProfit.revenue, profit: workProfit.profit,
                // All-time, unconditional — the `report` spread above only
                // has the Day/Month/All-Time *scoped* material figures
                // (dailyBreakdown etc.); Profit always uses these two
                // regardless of scope, same "always all-time" treatment as
                // revenue/contractorCost/labourCost above, so they need
                // their own explicit key rather than relying on the spread.
                materialCost: workProfit.materialCost, materialWasteCost: workProfit.materialWasteCost,
                materialWasteFromStock: workProfit.materialWasteFromStock, materialWasteFromRejection: workProfit.materialWasteFromRejection,
                unapprovedMaterialCost: workProfit.unapprovedMaterialCost, totalMaterialCost: workProfit.totalMaterialCost,
                // The Work's own real, unscaled material cost (every bit
                // ever consumed, all-time, review status aside) divided by
                // ONLY its approved (or, as a fallback, unapproved) area —
                // not a proportional split of the cost, so this genuinely
                // differs from the scoped/blended averageCostPerSqft in
                // `report` above whenever any of this Work's area is
                // rejected. Always all-time (approval has no day/month
                // meaning), unconditional on the scope picker.
                averageCostPerSqftApproved: workProfit.approvedAreaSqft > 0 ? workProfit.totalMaterialCost / workProfit.approvedAreaSqft : null,
                averageCostPerSqftUnapproved: workProfit.unapprovedAreaSqft > 0 ? workProfit.totalMaterialCost / workProfit.unapprovedAreaSqft : null,
                // All-time, unconditional, per-party — distinct from the
                // `contractorBreakdown`/`labourBreakdown` in the `report`
                // spread above (that one's the Day/Month/AllTime *scoped*
                // earnings table, keyed by `.earnings`). This one carries
                // `.totalAmount` (this Work's own share of that party's
                // total earnings, all-time, regardless of review status) —
                // needed to work out this Work's proportional share of what
                // was actually paid to each party project-wide, since a
                // payment itself is never recorded against one specific Work.
                allTimeContractorBreakdown: workProfit.contractorBreakdown,
                allTimeLabourBreakdown: workProfit.labourBreakdown,
                // Commission (Approved) — same review-gated shape as
                // Contractor/Labour Cost above, attributed to just this
                // Work's own workType rate. Zero for projects with no
                // referral, or 'advance' contract-type projects (their
                // commission is one flat project-level figure, not
                // per-work). See computeWorkProfit's own comment.
                commissionCost: workProfit.commissionCost, totalCommissionAmount: workProfit.totalCommissionAmount,
                unapprovedCommissionAmount: workProfit.unapprovedCommissionAmount, rejectedCommissionAmount: workProfit.rejectedCommissionAmount,
                // The Unapproved section's own mini profit picture — what
                // this Work's still-unreviewed sqft would add to Revenue/
                // Profit once reviewed and billed, mirroring
                // ProjectDetail.jsx's Unapproved table exactly.
                unapprovedRevenue: workProfit.unapprovedRevenue,
                unapprovedProfit,
                // Approved + Unapproved — what Profit becomes once this
                // Work's still-pending sqft actually clears review.
                totalProjectedProfit: round2(workProfit.profit + unapprovedProfit),
                // Client direct payments (category flagged "cut from worker
                // payout") tied to this Work — flat, informational only,
                // no longer split by Unapproved/Approved (see
                // getWorkerPayoutTotal's comment).
                contractorDirectPaymentTotal: workProfit.contractorDirectPaymentTotal,
                labourDirectPaymentTotal: workProfit.labourDirectPaymentTotal,
                // Forward-looking, all-time only like revenue/profit above —
                // there's one estimatedAreaSqft per Work, not one per
                // Day/Month, so "expected pay for just this month" isn't a
                // coherent number either.
                expectedPay: workProfit.expectedPay, deductedTotal: workProfit.deductedTotal,
                expectedPayNetOfDeductions: workProfit.expectedPayNetOfDeductions,
                // Project-wide, always current — dump/return movements
                // aren't tied to one Work, so "material left" can't be
                // scoped to this Work's Day/Month/All Time selector.
                materialStock,
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing work detail' });
    }
};

// THE canonical Contractor Balance Payable formula — the one place this
// concept is computed, full stop. financeContractorLedger.js's
// getContractorLedger (single-vendor ledger page) calls this for its
// `totals` block instead of keeping its own parallel copy; computeContractorAnalysisRows
// below (company-wide rows) is now just this looped over every contractor.
// Both used to independently re-derive the same formula, and — worse — the
// single-vendor version filtered advances/deductions/payments DIRECTLY by
// projectId when scoped, silently dropping every general/untagged money
// movement instead of proportionally allocating it the way this version
// always has (see the allocate() comment below) — a real bug, just never
// reachable because no page currently renders a contractor ledger with a
// projectId. Fixed by standardizing on this version everywhere.
const computeContractorBalance = async (vendorId, projectId) => {
    const assignments = await FinanceWorkContractorAssignment.find({ contractorVendorId: vendorId, deleted: { $ne: true } });
    const workIds = assignments.map(a => a.workId);

    // Always every work this vendor is assigned to, company-wide, even
    // when scoped to one project — computing that project's fair share
    // of this vendor's general (untagged) advances/deductions/payments
    // below needs their earnings across every project, not just this
    // one (see the allocate() comment further down).
    const works = workIds.length ? await FinanceWork.find({ _id: { $in: workIds }, deleted: { $ne: true } }) : [];

    const projectIds = [...new Set(works.map(w => w.projectId.toString()))];
    const [rates, vendorMeasurements, allMeasurementsOnTheseWorks, categoryApprovedByWorkId, directPaymentTotal] = await Promise.all([
        projectIds.length
            ? FinanceContractorRate.find({ projectId: { $in: projectIds }, contractorVendorId: vendorId, deleted: { $ne: true } })
            : [],
        works.length
            ? FinanceMeasurement.find({ workId: { $in: works.map(w => w._id) }, contractorVendorId: vendorId, deleted: { $ne: true } }, 'workId areaCoveredSqft')
            : [],
        // Every contractor's measurements on these same works (any
        // vendor) — needed to proportionally split each work's billed
        // area when more than one vendor contributes to it.
        works.length
            ? FinanceMeasurement.find({ workId: { $in: works.map(w => w._id) }, deleted: { $ne: true } }, 'workId areaCoveredSqft')
            : [],
        // Contractor's own share of each work's combined approved
        // ceiling — see getCategoryApprovedAreaByWorkId's comment for
        // why this can't just be the raw work-level ceiling (that would
        // double-count against labour's own share on the same work).
        works.length ? getCategoryApprovedAreaByWorkId(works.map(w => w._id)) : new Map(),
        // Flat, not sqft-based — see getWorkerPayoutTotal's comment
        // (this is an advance, not payment for specific measured work).
        getWorkerPayoutTotal('contractor', vendorId, projectId || undefined),
    ]);
    const rateByKey = new Map(rates.map(r => [`${r.projectId}_${r.workType}`, r]));

    const totalAreaByWork = new Map(); // all vendors combined, per work
    for (const m of allMeasurementsOnTheseWorks) {
        const key = m.workId.toString();
        totalAreaByWork.set(key, (totalAreaByWork.get(key) || 0) + m.areaCoveredSqft);
    }
    const vendorAreaByWork = new Map(); // this vendor only, per work
    for (const m of vendorMeasurements) {
        const key = m.workId.toString();
        vendorAreaByWork.set(key, (vendorAreaByWork.get(key) || 0) + m.areaCoveredSqft);
    }

    let totalEarnings = 0;
    let earnings = 0; // "Approved" — this is what actually feeds Balance Payable
    let unapprovedAmountTotal = 0;
    // Gross earnings across every project this vendor works on — the
    // allocation basis for general advances/deductions/payments below,
    // so it has to keep accumulating even for works outside the current
    // project scope (unlike every other accumulator here, which stays
    // scoped to just this project).
    let totalEarningsAllProjects = 0;
    for (const work of works) {
        const workKey = work._id.toString();
        const vendorArea = vendorAreaByWork.get(workKey) || 0;
        if (!vendorArea) continue;
        const rate = rateByKey.get(`${work.projectId}_${work.workType}`);
        if (!rate) continue;
        const workEarningsGross = vendorArea * rate.ratePerSqft;
        totalEarningsAllProjects += workEarningsGross;
        if (projectId && work.projectId.toString() !== projectId) continue;

        const categoryEntry = categoryApprovedByWorkId.get(workKey);
        const workApprovedArea = categoryEntry?.contractorApprovedAreaSqft || 0;
        // A rejection is final, already-reviewed — this vendor's own
        // share of it must not sit in Unapproved forever. See
        // getCategoryApprovedAreaByWorkId's header comment. Prefer the
        // exact, deliberate per-vendor attribution from the atomic
        // review's own distribution over the proportional guess
        // whenever it's available (see that function's own comment on
        // why the guess used to silently double-count against it).
        const workRejectedArea = categoryEntry?.contractorRejectedAreaSqft || 0;
        const vendorRejectedArea = categoryEntry?.contractorExactRejectedByVendor
            ? (categoryEntry.contractorExactRejectedByVendor.get(vendorId.toString()) || 0)
            : splitApprovedAreaByShare(workRejectedArea, vendorArea, totalAreaByWork.get(workKey) || 0);
        const vendorApprovedArea = categoryEntry?.contractorExactRejectedByVendor
            ? round2(vendorArea - vendorRejectedArea)
            : splitApprovedAreaByShare(workApprovedArea, vendorArea, totalAreaByWork.get(workKey) || 0);
        const vendorUnapprovedArea = Math.max(0, vendorArea - vendorApprovedArea - vendorRejectedArea);
        totalEarnings += workEarningsGross;
        earnings += vendorApprovedArea * rate.ratePerSqft;
        unapprovedAmountTotal += vendorUnapprovedArea * rate.ratePerSqft;
    }
    totalEarnings = round2(totalEarnings);
    earnings = round2(earnings);
    unapprovedAmountTotal = round2(unapprovedAmountTotal);
    totalEarningsAllProjects = round2(totalEarningsAllProjects);

    // Always company-wide — financeContractorAdvance/Deduction/Payment's
    // projectId is optional ("not every advance is tied to one
    // project"), so a naive projectId-filtered query silently excluded
    // every general/untagged money movement once scoped to a project,
    // making a vendor read as still owed the full amount right after
    // being paid. A general row is allocated across every project this
    // vendor works on in proportion to that project's own share of
    // their gross earnings — deterministic, and the sum of every
    // project's own balancePayable (if added up) always equals this
    // vendor's true company-wide balance, same as the unscoped call.
    const [advances, allDeductions, payments] = await Promise.all([
        FinanceContractorAdvance.find({ vendorId, deleted: { $ne: true } }),
        FinanceContractorDeduction.find({ vendorId, deleted: { $ne: true } }),
        FinanceContractorPayment.find({ vendorId, deleted: { $ne: true } }),
    ]);
    // A row with a workReviewCycle set is the atomic review's own exact
    // rejection attribution (see getCategoryApprovedAreaByWorkId) — its
    // ₹ impact is already reflected above via vendorApprovedArea, so
    // counting it again here would deduct it twice. A row from a
    // superseded cycle (the review was redone) shouldn't count at all —
    // only a genuinely standalone manual deduction (workReviewCycle:
    // null, added directly from the Contractor Ledger) belongs here.
    const deductions = allDeductions.filter(d => d.workReviewCycle == null);
    // `field` defaults to 'amount'; also reused for 'tdsAmount' below —
    // an untagged payment's TDS gets the same proportional share as the
    // payment amount itself, for the same reasoning.
    const allocate = (rows, field = 'amount') => {
        if (!projectId) return rows.reduce((s, r) => s + (r[field] || 0), 0);
        const tagged = rows.filter(r => r.projectId?.toString() === projectId).reduce((s, r) => s + (r[field] || 0), 0);
        const general = rows.filter(r => !r.projectId).reduce((s, r) => s + (r[field] || 0), 0);
        const share = totalEarningsAllProjects > 0 ? totalEarnings / totalEarningsAllProjects : 0;
        return tagged + general * share;
    };
    const advancesTotal = round2(allocate(advances));
    // materialWasteAmount is a genuinely new deduction (unlike `amount`
    // on a workReviewCycle-tagged row) — nothing else already accounts
    // for it, so it's summed across every deduction regardless of
    // cycle. KNOWN LIMITATION: a Work re-reviewed more than once could
    // in principle leave a stale, superseded cycle's materialWasteAmount
    // still counted here (the same staleness `amount` is filtered
    // against above) — accepted because cleaning that up needs the
    // same per-work "current cycle" lookup getCategoryApprovedAreaByWorkId
    // already does internally, not cheaply available at this scope.
    const materialWasteTotal = round2(allocate(allDeductions, 'materialWasteAmount'));
    const deductionsTotal = round2(allocate(deductions));
    const paymentsTotal = round2(allocate(payments));
    // Informational only — already inside paymentsTotal (the gross
    // figure); surfaces how much of it was withheld as TDS. See
    // financeContractorLedger.js's identical comment — TDS still
    // discharges what's owed, unlike holdingTotal below.
    const tdsTotal = round2(allocate(payments, 'tdsAmount'));
    // Holding (retention) — unlike TDS, never discharges what's owed
    // (the money stays with the company until the project completes),
    // so it's subtracted back out of paymentsTotal before balancePayable
    // nets against it. See financeContractorLedger.js's identical
    // comment. Every holding-bearing payment requires a projectId (see
    // addContractorPayment's own guard), so allocate() never has to
    // proportionally guess this one across a vendor's several projects.
    const holdingTotal = round2(allocate(payments, 'holdingAmount'));
    const paymentsNetOfHolding = round2(paymentsTotal - holdingTotal);
    // Flat — see getWorkerPayoutTotal's comment; a separate term from
    // deductionsTotal so a real rejection-deduction and an advance the
    // client already paid this vendor directly never blend into one
    // ambiguous "Deductions" figure. materialWasteTotal is kept
    // separate too, for the same reason — see this file's own comment
    // a few lines up.
    const balancePayable = round2(earnings - advancesTotal - deductionsTotal - materialWasteTotal - paymentsNetOfHolding - directPaymentTotal);

    return {
        // Field names match financeContractorLedger.js's getContractorLedger
        // totals shape (totalAmount/earnings/unapprovedAmount) so both
        // feeds render identically on the frontend.
        earnings, totalAmount: totalEarnings, unapprovedAmount: unapprovedAmountTotal,
        advances: advancesTotal, deductions: deductionsTotal, materialWasteTotal, payments: paymentsTotal, tdsTotal, holdingTotal, directPaymentTotal, balancePayable,
    };
};

// Shared by getContractorAnalysis, dashboard summary, and the Contractors
// Tier-1 mini-dashboard — one earnings/advances/deductions/payments/balance
// row per labour contractor, optionally scoped to one project.
const computeContractorAnalysisRows = async (projectId) => {
    const contractors = await FinanceVendor.find({ vendorType: 'labour_contractor', deleted: { $ne: true } });
    return Promise.all(contractors.map(async (v) => ({
        vendorId: v._id, vendorName: v.name,
        ...(await computeContractorBalance(v._id, projectId)),
    })));
};

const getContractorAnalysis = async (req, res) => {
    try {
        const { projectId } = req.query;
        const rows = await computeContractorAnalysisRows(projectId);
        res.json({ success: true, data: rows.sort((a, b) => b.balancePayable - a.balancePayable) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing contractor analysis' });
    }
};

// THE canonical Labour Balance Payable formula — direct labour-side mirror
// of computeContractorBalance (see its own comment for the full reasoning,
// including the project-scoped general-payment bug this fixes).
// financeLabourLedger.js's getLabourLedger calls this for its `totals`
// block; computeLabourAnalysisRows below is just this looped over every
// labourer.
const computeLabourBalance = async (labourerId, projectId) => {
    const assignments = await FinanceWorkLabourAssignment.find({ labourerId, deleted: { $ne: true } });
    const workIds = assignments.map(a => a.workId);

    // Always every work this labourer is assigned to, company-wide — see
    // computeContractorBalance's identical comment.
    const works = workIds.length ? await FinanceWork.find({ _id: { $in: workIds }, deleted: { $ne: true } }) : [];

    const projectIds = [...new Set(works.map(w => w.projectId.toString()))];
    const [rates, labourerMeasurements, allMeasurementsOnTheseWorks, categoryApprovedByWorkId, directPaymentTotal] = await Promise.all([
        projectIds.length
            ? FinanceLabourRate.find({ projectId: { $in: projectIds }, labourerId, deleted: { $ne: true } })
            : [],
        works.length
            ? FinanceLabourMeasurement.find({ workId: { $in: works.map(w => w._id) }, labourerId, deleted: { $ne: true } }, 'workId areaCoveredSqft')
            : [],
        // Every labourer's measurements on these same works — needed to
        // proportionally split each work's billed area when more than
        // one labourer contributes to it.
        works.length
            ? FinanceLabourMeasurement.find({ workId: { $in: works.map(w => w._id) }, deleted: { $ne: true } }, 'workId areaCoveredSqft')
            : [],
        // Labour's own share of each work's combined approved ceiling —
        // see getCategoryApprovedAreaByWorkId's comment.
        works.length ? getCategoryApprovedAreaByWorkId(works.map(w => w._id)) : new Map(),
        // Flat, not sqft-based — see getWorkerPayoutTotal's comment.
        getWorkerPayoutTotal('labour', labourerId, projectId || undefined),
    ]);
    const rateByKey = new Map(rates.map(r => [`${r.projectId}_${r.workType}`, r]));

    const totalAreaByWork = new Map(); // all labourers combined, per work
    for (const m of allMeasurementsOnTheseWorks) {
        const key = m.workId.toString();
        totalAreaByWork.set(key, (totalAreaByWork.get(key) || 0) + m.areaCoveredSqft);
    }
    const labourerAreaByWork = new Map(); // this labourer only, per work
    for (const m of labourerMeasurements) {
        const key = m.workId.toString();
        labourerAreaByWork.set(key, (labourerAreaByWork.get(key) || 0) + m.areaCoveredSqft);
    }

    let totalEarnings = 0;
    let earnings = 0; // "Approved" — this is what actually feeds Balance Payable
    let unapprovedAmountTotal = 0;
    // See computeContractorBalance's identical comment — allocation
    // basis for general advances/deductions/payments below.
    let totalEarningsAllProjects = 0;
    for (const work of works) {
        const workKey = work._id.toString();
        const labourerArea = labourerAreaByWork.get(workKey) || 0;
        if (!labourerArea) continue;
        const rate = rateByKey.get(`${work.projectId}_${work.workType}`);
        if (!rate) continue;
        const workEarningsGross = labourerArea * rate.ratePerSqft;
        totalEarningsAllProjects += workEarningsGross;
        if (projectId && work.projectId.toString() !== projectId) continue;

        const categoryEntry = categoryApprovedByWorkId.get(workKey);
        const workApprovedArea = categoryEntry?.labourApprovedAreaSqft || 0;
        // A rejection is final, already-reviewed — this labourer's own
        // share of it must not sit in Unapproved forever. See
        // getCategoryApprovedAreaByWorkId's header comment. Prefer the
        // exact, deliberate per-labourer attribution from the atomic
        // review's own distribution over the proportional guess
        // whenever it's available.
        const workRejectedArea = categoryEntry?.labourRejectedAreaSqft || 0;
        const labourerRejectedArea = categoryEntry?.labourExactRejectedByLabourer
            ? (categoryEntry.labourExactRejectedByLabourer.get(labourerId.toString()) || 0)
            : splitApprovedAreaByShare(workRejectedArea, labourerArea, totalAreaByWork.get(workKey) || 0);
        const labourerApprovedArea = categoryEntry?.labourExactRejectedByLabourer
            ? round2(labourerArea - labourerRejectedArea)
            : splitApprovedAreaByShare(workApprovedArea, labourerArea, totalAreaByWork.get(workKey) || 0);
        const labourerUnapprovedArea = Math.max(0, labourerArea - labourerApprovedArea - labourerRejectedArea);
        totalEarnings += workEarningsGross;
        earnings += labourerApprovedArea * rate.ratePerSqft;
        unapprovedAmountTotal += labourerUnapprovedArea * rate.ratePerSqft;
    }
    totalEarnings = round2(totalEarnings);
    earnings = round2(earnings);
    unapprovedAmountTotal = round2(unapprovedAmountTotal);
    totalEarningsAllProjects = round2(totalEarningsAllProjects);

    // Always company-wide — see computeContractorBalance's identical
    // comment (financeLabourAdvance/Deduction/Payment.projectId is just
    // as optional).
    const [advances, allDeductions, payments] = await Promise.all([
        FinanceLabourAdvance.find({ labourerId, deleted: { $ne: true } }),
        FinanceLabourDeduction.find({ labourerId, deleted: { $ne: true } }),
        FinanceLabourPayment.find({ labourerId, deleted: { $ne: true } }),
    ]);
    // See computeContractorBalance's identical comment — a
    // workReviewCycle-tagged row is already reflected in earnings above.
    const deductions = allDeductions.filter(d => d.workReviewCycle == null);
    // See computeContractorBalance's identical comment.
    const allocate = (rows, field = 'amount') => {
        if (!projectId) return rows.reduce((s, r) => s + (r[field] || 0), 0);
        const tagged = rows.filter(r => r.projectId?.toString() === projectId).reduce((s, r) => s + (r[field] || 0), 0);
        const general = rows.filter(r => !r.projectId).reduce((s, r) => s + (r[field] || 0), 0);
        const share = totalEarningsAllProjects > 0 ? totalEarnings / totalEarningsAllProjects : 0;
        return tagged + general * share;
    };
    const advancesTotal = round2(allocate(advances));
    // See computeContractorBalance's identical comment/KNOWN LIMITATION.
    const materialWasteTotal = round2(allocate(allDeductions, 'materialWasteAmount'));
    const deductionsTotal = round2(allocate(deductions));
    const paymentsTotal = round2(allocate(payments));
    const tdsTotal = round2(allocate(payments, 'tdsAmount'));
    // Holding (retention) — see computeContractorBalance's identical
    // comment; doesn't discharge what's owed, unlike TDS.
    const holdingTotal = round2(allocate(payments, 'holdingAmount'));
    const paymentsNetOfHolding = round2(paymentsTotal - holdingTotal);
    // Flat — see getWorkerPayoutTotal's comment; kept separate from
    // deductionsTotal so a real rejection-deduction and an advance the
    // client already paid this labourer directly never blend together.
    // materialWasteTotal is kept separate too, for the same reason.
    const balancePayable = round2(earnings - advancesTotal - deductionsTotal - materialWasteTotal - paymentsNetOfHolding - directPaymentTotal);

    return {
        // Field names match financeLabourLedger.js's getLabourLedger
        // totals shape so both feeds render identically on the frontend.
        earnings, totalAmount: totalEarnings, unapprovedAmount: unapprovedAmountTotal,
        advances: advancesTotal, deductions: deductionsTotal, materialWasteTotal, payments: paymentsTotal, tdsTotal, holdingTotal, directPaymentTotal, balancePayable,
    };
};

// Direct labour-side mirror of computeContractorAnalysisRows — one
// earnings/advances/deductions/payments/balance row per labourer,
// optionally scoped to one project. No bulk company-wide labour ledger
// existed before this (only the per-labourer getLabourLedger); this fills
// that gap for Project Profitability's earnings table, same formula
// financeLabourLedger.js's getLabourLedger already uses.
const computeLabourAnalysisRows = async (projectId) => {
    const labourers = await FinanceLabourer.find({ deleted: { $ne: true } });
    return Promise.all(labourers.map(async (l) => ({
        labourerId: l._id, labourerName: l.name,
        ...(await computeLabourBalance(l._id, projectId)),
    })));
};

const getLabourAnalysis = async (req, res) => {
    try {
        const { projectId } = req.query;
        const rows = await computeLabourAnalysisRows(projectId);
        res.json({ success: true, data: rows.sort((a, b) => b.balancePayable - a.balancePayable) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing labour analysis' });
    }
};

// Supervisors are financeEmployee rows with role: 'supervisor' — no
// per-sqft earnings concept like Contractor/Labour Analysis (a supervisor
// is paid salary, not an area rate), so there's no "Balance Payable" here,
// just what's actually been paid out: salary + discretionary incentives,
// less deductions. Optionally scoped to one project — an incentive/
// deduction record optionally carries a projectId (financeSalaryPayment
// never does, so salary itself always stays company-wide even when a
// project is picked, same "can't split a monthly salary across projects"
// reasoning used everywhere else salary shows up).
const computeSupervisorAnalysisRows = async (projectId) => {
    const supervisors = await FinanceEmployee.find({ role: 'supervisor', deleted: { $ne: true } });

    const incentiveFilter = { deleted: { $ne: true } };
    const deductionFilter = { deleted: { $ne: true } };
    if (projectId) { incentiveFilter.projectId = projectId; deductionFilter.projectId = projectId; }

    return Promise.all(supervisors.map(async (e) => {
        const [salaryPayments, incentives, deductions] = await Promise.all([
            FinanceSalaryPayment.find({ employeeId: e._id, deleted: { $ne: true } }),
            FinanceSupervisorIncentive.find({ ...incentiveFilter, employeeId: e._id }),
            FinanceSupervisorDeduction.find({ ...deductionFilter, employeeId: e._id }),
        ]);
        const salaryPaid = round2(salaryPayments.reduce((s, p) => s + p.amount, 0));
        const incentiveTotal = round2(incentives.reduce((s, i) => s + i.amount, 0));
        const deductionTotal = round2(deductions.reduce((s, d) => s + d.amount, 0));
        const netPaid = round2(salaryPaid + incentiveTotal - deductionTotal);
        return { employeeId: e._id, employeeName: e.name, salaryPaid, incentiveTotal, deductionTotal, netPaid };
    }));
};

const getSupervisorAnalysis = async (req, res) => {
    try {
        const { projectId } = req.query;
        const rows = await computeSupervisorAnalysisRows(projectId);
        res.json({ success: true, data: rows.sort((a, b) => b.netPaid - a.netPaid) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing supervisor analysis' });
    }
};

// New Tier-1 endpoint for Contractors — wraps computeContractorAnalysisRows
// for the table, plus cost-per-sqft grouped by work type (never blended
// across types — a Putty rate isn't comparable to a Paint rate).
const getContractorsSummary = async (req, res) => {
    try {
        const { projectId } = req.query;
        const contractors = await FinanceVendor.find({ vendorType: 'labour_contractor', deleted: { $ne: true } });
        const [rows, costPerSqft] = await Promise.all([
            computeContractorAnalysisRows(projectId),
            Promise.all(contractors.map(async (v) => {
                const assignments = await FinanceWorkContractorAssignment.find({ contractorVendorId: v._id, deleted: { $ne: true } });
                const workIds = assignments.map(a => a.workId);
                if (!workIds.length) return { vendorId: v._id, vendorName: v.name, byWorkType: [] };

                const workFilter = { _id: { $in: workIds }, deleted: { $ne: true } };
                if (projectId) workFilter.projectId = projectId;
                const works = await FinanceWork.find(workFilter);
                if (!works.length) return { vendorId: v._id, vendorName: v.name, byWorkType: [] };
                const workById = new Map(works.map(w => [w._id.toString(), w]));

                const [rates, measurements] = await Promise.all([
                    FinanceContractorRate.find({ projectId: { $in: [...new Set(works.map(w => w.projectId.toString()))] }, contractorVendorId: v._id, deleted: { $ne: true } }),
                    FinanceMeasurement.find({ workId: { $in: works.map(w => w._id) }, contractorVendorId: v._id, deleted: { $ne: true } }),
                ]);
                const rateByKey = new Map(rates.map(r => [`${r.projectId}_${r.workType}`, r]));

                // cost/sqft is just the configured rate either way (earnings
                // ÷ area always cancels back to it) — not gated by billing
                // approval, unlike `earnings` in computeContractorAnalysisRows
                // above. Measurement-level, restricted to this contractor's
                // own work.
                const byType = new Map();
                for (const m of measurements) {
                    const work = workById.get(m.workId.toString());
                    if (!work) continue;
                    const rate = rateByKey.get(`${work.projectId}_${work.workType}`);
                    const earnings = rate ? m.areaCoveredSqft * (rate.ratePerSqft) : 0;
                    if (!byType.has(work.workType)) byType.set(work.workType, { area: 0, earnings: 0 });
                    const t = byType.get(work.workType);
                    t.area += m.areaCoveredSqft;
                    t.earnings += earnings;
                }
                const byWorkType = [...byType.entries()].map(([workType, t]) => ({
                    workType, completedAreaSqft: t.area, earnings: t.earnings,
                    costPerSqft: t.area > 0 ? t.earnings / t.area : 0,
                }));
                return { vendorId: v._id, vendorName: v.name, byWorkType };
            })),
        ]);

        res.json({ success: true, data: { contractors: rows.sort((a, b) => b.balancePayable - a.balancePayable), costPerSqft } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing contractors summary' });
    }
};

// New Tier-1 endpoint for Labourers — direct mirror of
// getContractorsSummary (see its own comment): wraps
// computeLabourAnalysisRows for the table, plus cost-per-sqft grouped by
// work type.
const getLabourersSummary = async (req, res) => {
    try {
        const { projectId } = req.query;
        const labourers = await FinanceLabourer.find({ deleted: { $ne: true } });
        const [rows, costPerSqft] = await Promise.all([
            computeLabourAnalysisRows(projectId),
            Promise.all(labourers.map(async (l) => {
                const assignments = await FinanceWorkLabourAssignment.find({ labourerId: l._id, deleted: { $ne: true } });
                const workIds = assignments.map(a => a.workId);
                if (!workIds.length) return { labourerId: l._id, labourerName: l.name, byWorkType: [] };

                const workFilter = { _id: { $in: workIds }, deleted: { $ne: true } };
                if (projectId) workFilter.projectId = projectId;
                const works = await FinanceWork.find(workFilter);
                if (!works.length) return { labourerId: l._id, labourerName: l.name, byWorkType: [] };
                const workById = new Map(works.map(w => [w._id.toString(), w]));

                const [rates, measurements] = await Promise.all([
                    FinanceLabourRate.find({ projectId: { $in: [...new Set(works.map(w => w.projectId.toString()))] }, labourerId: l._id, deleted: { $ne: true } }),
                    FinanceLabourMeasurement.find({ workId: { $in: works.map(w => w._id) }, labourerId: l._id, deleted: { $ne: true } }),
                ]);
                const rateByKey = new Map(rates.map(r => [`${r.projectId}_${r.workType}`, r]));

                // See getContractorsSummary's identical comment — cost/sqft
                // is just the configured rate either way, not gated by
                // billing approval.
                const byType = new Map();
                for (const m of measurements) {
                    const work = workById.get(m.workId.toString());
                    if (!work) continue;
                    const rate = rateByKey.get(`${work.projectId}_${work.workType}`);
                    const earnings = rate ? m.areaCoveredSqft * (rate.ratePerSqft) : 0;
                    if (!byType.has(work.workType)) byType.set(work.workType, { area: 0, earnings: 0 });
                    const t = byType.get(work.workType);
                    t.area += m.areaCoveredSqft;
                    t.earnings += earnings;
                }
                const byWorkType = [...byType.entries()].map(([workType, t]) => ({
                    workType, completedAreaSqft: t.area, earnings: t.earnings,
                    costPerSqft: t.area > 0 ? t.earnings / t.area : 0,
                }));
                return { labourerId: l._id, labourerName: l.name, byWorkType };
            })),
        ]);

        res.json({ success: true, data: { labourers: rows.sort((a, b) => b.balancePayable - a.balancePayable), costPerSqft } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing labourers summary' });
    }
};

// THE canonical Vendor Amount Owed formula. financeVendorLedger.js's
// getVendorLedger calls this for its `totals` block instead of keeping its
// own simpler (and, when project-scoped, wrong) copy — that version
// filtered payments DIRECTLY by projectId, silently excluding every
// general/untagged vendor payment once scoped to a project and making a
// vendor read as still owed their full purchase total right after being
// paid. This version proportionally allocates a general payment across
// projects by each project's own share of this vendor's total purchases,
// same principle as computeContractorBalance/computeLabourBalance's
// allocate(). computeVendorAnalysisRows below is just this looped over
// every vendor.
const computeVendorBalance = async (vendorId, projectId) => {
    // Always fetched company-wide, not projectId-filtered at the query
    // level — financeVendorPayment.projectId is optional ("a payment
    // settles the vendor's overall running balance, not necessarily one
    // project's purchases specifically"). Purchases stay reliable to filter
    // directly since financePurchase.projectId is required.
    const [purchases, payments] = await Promise.all([
        FinancePurchase.find({ vendorId, deleted: { $ne: true } }),
        FinanceVendorPayment.find({ vendorId, deleted: { $ne: true } }),
    ]);

    const scopedPurchases = projectId ? purchases.filter(p => p.projectId?.toString() === projectId) : purchases;
    const purchaseTotal = scopedPurchases.filter(p => p.transactionType === 'purchase').reduce((s, p) => s + p.totalAmount, 0);
    const returnTotal = scopedPurchases.filter(p => p.transactionType === 'return').reduce((s, p) => s + p.totalAmount, 0);

    // A refund (isRefund: true) is the vendor paying the company back,
    // not the other way round — allocated across projects the same way
    // a normal payment is, then netted against it below instead of
    // piling onto it, so Amount Owed correctly moves back toward 0 as a
    // credit gets settled instead of going more negative.
    const allocateMoney = (rows) => {
        if (!rows.length) return 0;
        if (!projectId) return rows.reduce((s, p) => s + p.amount, 0);
        const taggedForProject = rows.filter(p => p.projectId?.toString() === projectId).reduce((s, p) => s + p.amount, 0);
        const generalRows = rows.filter(p => !p.projectId).reduce((s, p) => s + p.amount, 0);
        const totalPurchaseAllProjects = purchases.filter(p => p.transactionType === 'purchase').reduce((s, p) => s + p.totalAmount, 0);
        const share = totalPurchaseAllProjects > 0 ? purchaseTotal / totalPurchaseAllProjects : 0;
        return round2(taggedForProject + generalRows * share);
    };
    const paymentsTotal = allocateMoney(payments.filter(p => !p.isRefund));
    const refundsTotal = allocateMoney(payments.filter(p => p.isRefund));
    const amountOwed = round2(purchaseTotal - returnTotal - paymentsTotal + refundsTotal);

    return { purchases: purchaseTotal, returns: returnTotal, payments: paymentsTotal, refunds: refundsTotal, amountOwed };
};

// INTERPRETATION FLAG: scoped strictly to vendorType 'material_supplier',
// not the broader "every non-contractor vendor" filter Payables' Vendor
// tab uses — referral vendors already get their own dedicated Commission
// numbers elsewhere in this module, so folding them into Vendor Analysis
// too would double-count the same balance under two report tabs.
const computeVendorAnalysisRows = async (projectId) => {
    const vendors = await FinanceVendor.find({ vendorType: 'material_supplier', deleted: { $ne: true } });
    return Promise.all(vendors.map(async (v) => ({
        vendorId: v._id, vendorName: v.name,
        ...(await computeVendorBalance(v._id, projectId)),
    })));
};

const getVendorAnalysis = async (req, res) => {
    try {
        const { projectId } = req.query;
        const rows = await computeVendorAnalysisRows(projectId);
        res.json({ success: true, data: rows.sort((a, b) => b.amountOwed - a.amountOwed) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing vendor analysis' });
    }
};

// New Tier-1 endpoint for Procurement — wraps computeVendorAnalysisRows for
// the table, plus a monthly average-purchase-rate trend per material (top
// 5-10 by purchase volume by default, or the given materialIds) so rate
// creep is visible.
const getVendorsSummary = async (req, res) => {
    try {
        const { projectId, materialIds } = req.query;
        const rows = await computeVendorAnalysisRows(projectId);

        const purchaseFilter = { transactionType: 'purchase', deleted: { $ne: true } };
        if (projectId) purchaseFilter.projectId = projectId;
        const purchases = await FinancePurchase.find(purchaseFilter);

        const volumeByMaterial = new Map();
        for (const p of purchases) {
            const key = p.materialId.toString();
            volumeByMaterial.set(key, (volumeByMaterial.get(key) || 0) + p.quantity);
        }
        const materialIdList = materialIds
            ? materialIds.split(',')
            : [...volumeByMaterial.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id]) => id);

        const materials = await FinanceMaterial.find({ _id: { $in: materialIdList } }, 'name unit');
        const materialById = new Map(materials.map(m => [m._id.toString(), m]));

        const trendMap = new Map();
        for (const p of purchases) {
            const key = p.materialId.toString();
            if (!materialIdList.includes(key)) continue;
            const month = new Date(p.date).toISOString().slice(0, 7);
            if (!trendMap.has(key)) trendMap.set(key, new Map());
            const monthMap = trendMap.get(key);
            if (!monthMap.has(month)) monthMap.set(month, { qty: 0, amt: 0 });
            const m = monthMap.get(month);
            m.qty += p.quantity;
            m.amt += p.totalAmount;
        }
        const materialCostTrend = materialIdList.map(id => {
            const material = materialById.get(id);
            const monthMap = trendMap.get(id) || new Map();
            const points = [...monthMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))
                .map(([month, m]) => ({ month, avgRate: m.qty > 0 ? m.amt / m.qty : 0 }));
            return { materialId: id, materialName: material?.name || 'Unknown', unit: material?.unit || '', points };
        });

        res.json({ success: true, data: { vendors: rows.sort((a, b) => b.amountOwed - a.amountOwed), materialCostTrend } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing vendors summary' });
    }
};

// INTERPRETATION FLAG: "total purchased"/"total returned" here read from
// financePurchase (the procurement-side record, and the same figures the
// weighted-average cost is derived from) — not from the `dump`/`return`
// stock movements a purchase/return auto-creates, which also include
// manual site-side entries (opening stock, ad-hoc returns) that never
// touched a vendor. "Total consumed"/"total wasted"/"current stock" stay
// on the stock-movement side, same as the existing Site Inventory current
// stock endpoint.
const getMaterialAnalysis = async (req, res) => {
    try {
        const { projectId } = req.query;
        const materials = await FinanceMaterial.find({ deleted: { $ne: true } });

        const purchaseFilter = { deleted: { $ne: true } };
        if (projectId) purchaseFilter.projectId = projectId;
        const purchases = await FinancePurchase.find(purchaseFilter);

        const stockMatch = { deleted: { $ne: true } };
        if (projectId) stockMatch.projectId = new mongoose.Types.ObjectId(projectId);
        const stockRows = await FinanceStockMovement.aggregate([
            { $match: stockMatch },
            {
                $group: {
                    _id: '$materialId',
                    dump:     { $sum: { $cond: [{ $eq: ['$movementType', 'dump'] }, '$quantity', 0] } },
                    consume:  { $sum: { $cond: [{ $eq: ['$movementType', 'consume'] }, '$quantity', 0] } },
                    returned: { $sum: { $cond: [{ $eq: ['$movementType', 'return'] }, '$quantity', 0] } },
                    waste:    { $sum: { $cond: [{ $eq: ['$movementType', 'waste'] }, '$quantity', 0] } },
                },
            },
        ]);
        const stockByMaterial = new Map(stockRows.map(r => [r._id.toString(), r]));

        const purchaseByMaterial = new Map();
        for (const p of purchases) {
            const key = p.materialId.toString();
            if (!purchaseByMaterial.has(key)) purchaseByMaterial.set(key, { purchasedQty: 0, purchasedAmt: 0, returnedQty: 0, returnedAmt: 0 });
            const m = purchaseByMaterial.get(key);
            if (p.transactionType === 'purchase') { m.purchasedQty += p.quantity; m.purchasedAmt += p.totalAmount; }
            else { m.returnedQty += p.quantity; m.returnedAmt += p.totalAmount; }
        }

        // Cost/sqft per material — only meaningful scoped to one project
        // (mixing sqft across different projects/rates would be
        // meaningless). Pooled total÷total (every logged sqft using this
        // material, all-time, against its total consumed cost), not a mean
        // of per-day ratios — a ratio like this should be weighted by how
        // much area each day actually represents, not treat a 10 sqft day
        // the same as a 10,000 sqft one. "Area covered using this material"
        // sums every measurement's own areaCoveredSqft where this material
        // appears in that measurement's materialUsed[] — a day where a
        // material was used across less area than the project's total
        // progress correctly gets a narrower denominator, not the whole
        // project's area.
        const areaByMaterial = new Map();
        if (projectId) {
            const [contractorMeasurements, labourMeasurements] = await Promise.all([
                FinanceMeasurement.find({ projectId, deleted: { $ne: true } }, 'areaCoveredSqft materialUsed'),
                FinanceLabourMeasurement.find({ projectId, deleted: { $ne: true } }, 'areaCoveredSqft materialUsed'),
            ]);
            for (const m of [...contractorMeasurements, ...labourMeasurements]) {
                for (const u of (m.materialUsed || [])) {
                    const key = u.materialId.toString();
                    areaByMaterial.set(key, (areaByMaterial.get(key) || 0) + m.areaCoveredSqft);
                }
            }
        }

        const rows = materials.map(mat => {
            const key = mat._id.toString();
            const p = purchaseByMaterial.get(key) || { purchasedQty: 0, purchasedAmt: 0, returnedQty: 0, returnedAmt: 0 };
            const s = stockByMaterial.get(key) || { dump: 0, consume: 0, returned: 0, waste: 0 };
            const netQty = p.purchasedQty - p.returnedQty;
            const netAmt = p.purchasedAmt - p.returnedAmt;
            const weightedAverageCost = netQty > 0 ? netAmt / netQty : 0;
            const areaCoveredSqft = areaByMaterial.get(key) || 0;
            const consumedCost = s.consume * weightedAverageCost;
            const costPerSqft = areaCoveredSqft > 0 ? consumedCost / areaCoveredSqft : 0;
            return {
                materialId: mat._id, materialName: mat.name, unit: mat.unit,
                // totalDumped (raw stock-movement total) is the true source
                // currentStock is itself built from — every Purchase auto-
                // creates a matching dump today, but older dump rows from
                // before dump/return became Procurement-only (see
                // financeStockMovement.js's MANUAL_TYPES) can still exist
                // with no purchase behind them, so this can exceed
                // totalPurchased on projects with that older data.
                totalDumped: s.dump,
                totalPurchased: p.purchasedQty, totalReturned: p.returnedQty,
                totalConsumed: s.consume, totalWasted: s.waste,
                // Wasted material at the same weighted-average rate it was
                // bought at — a real loss, not just a quantity to note (see
                // computeProjectMaterialWaste's identical reasoning).
                wasteCost: s.waste * weightedAverageCost,
                currentStock: s.dump - s.consume - s.returned - s.waste,
                weightedAverageCost,
                // Only populated when scoped to one project (projectId set).
                areaCoveredSqft,
                costPerSqft,
            };
        }).filter(r => r.totalDumped || r.totalPurchased || r.totalReturned || r.totalConsumed || r.totalWasted || r.currentStock);

        res.json({ success: true, data: rows.sort((a, b) => a.materialName.localeCompare(b.materialName)) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing material analysis' });
    }
};

// New Tier-1 endpoint for Site Inventory — current stock per material (with
// a below-minimum flag), a monthly consumption trend, and the wastage rate
// (wasted ÷ (wasted + consumed)) per material, sorted highest-first.
//
// Low-stock definition is per-(project, material), matching the Dashboard's
// materialLowAlerts KPI exactly (see computeLowStockMaterialCount below) —
// a material can be below minimum at one project and fine at another, so a
// single project → one boolean is correct, but a company-wide view can't
// blend every project's stock into one total first (that hides a site
// that's actually out while another is overstocked) — it reports how many
// active projects are currently short instead.
const getInventorySummary = async (req, res) => {
    try {
        const { projectId, materialIds } = req.query;
        const materials = await FinanceMaterial.find({ deleted: { $ne: true } });

        const stockMatch = { deleted: { $ne: true } };
        if (projectId) stockMatch.projectId = new mongoose.Types.ObjectId(projectId);
        const stockRows = await FinanceStockMovement.aggregate([
            { $match: stockMatch },
            {
                $group: {
                    _id: { projectId: '$projectId', materialId: '$materialId' },
                    dump:     { $sum: { $cond: [{ $eq: ['$movementType', 'dump'] }, '$quantity', 0] } },
                    consume:  { $sum: { $cond: [{ $eq: ['$movementType', 'consume'] }, '$quantity', 0] } },
                    returned: { $sum: { $cond: [{ $eq: ['$movementType', 'return'] }, '$quantity', 0] } },
                    waste:    { $sum: { $cond: [{ $eq: ['$movementType', 'waste'] }, '$quantity', 0] } },
                },
            },
        ]);

        let stockTable;
        if (projectId) {
            // Single project — one row per material, same shape as before.
            const stockByMaterial = new Map(stockRows.map(r => [r._id.materialId.toString(), r]));
            stockTable = materials.map(mat => {
                const s = stockByMaterial.get(mat._id.toString()) || { dump: 0, consume: 0, returned: 0, waste: 0 };
                const currentStock = s.dump - s.consume - s.returned - s.waste;
                const wastageRate = (s.waste + s.consume) > 0 ? s.waste / (s.waste + s.consume) : 0;
                return {
                    materialId: mat._id, materialName: mat.name, unit: mat.unit,
                    currentStock, minimumStockLevel: mat.minimumStockLevel, belowMinimum: currentStock < mat.minimumStockLevel,
                    totalDumped: s.dump, totalReturned: s.returned, totalConsumed: s.consume, totalWasted: s.waste, wastageRate,
                };
            });
        } else {
            // Company-wide — per material, count how many active projects
            // are below minimum rather than blending stock across every
            // project into one misleading total.
            const activeProjectIds = new Set(
                (await FinanceProject.find({ status: 'active', deleted: { $ne: true } }, '_id')).map(p => p._id.toString())
            );
            const rowsByMaterial = new Map();
            for (const r of stockRows) {
                const key = r._id.materialId.toString();
                if (!rowsByMaterial.has(key)) rowsByMaterial.set(key, []);
                rowsByMaterial.get(key).push(r);
            }
            stockTable = materials.map(mat => {
                const rows = rowsByMaterial.get(mat._id.toString()) || [];
                let currentStock = 0, totalDumped = 0, totalReturned = 0, totalConsumed = 0, totalWasted = 0;
                let activeProjectCount = 0, lowAtProjectCount = 0;
                for (const r of rows) {
                    const projectStock = r.dump - r.consume - r.returned - r.waste;
                    currentStock += projectStock;
                    totalDumped += r.dump;
                    totalReturned += r.returned;
                    totalConsumed += r.consume;
                    totalWasted += r.waste;
                    if (activeProjectIds.has(r._id.projectId.toString())) {
                        activeProjectCount += 1;
                        if (projectStock < mat.minimumStockLevel) lowAtProjectCount += 1;
                    }
                }
                const wastageRate = (totalWasted + totalConsumed) > 0 ? totalWasted / (totalWasted + totalConsumed) : 0;
                return {
                    materialId: mat._id, materialName: mat.name, unit: mat.unit,
                    currentStock, minimumStockLevel: mat.minimumStockLevel,
                    belowMinimum: lowAtProjectCount > 0, lowAtProjectCount, activeProjectCount,
                    totalDumped, totalReturned, totalConsumed, totalWasted, wastageRate,
                };
            });
        }

        const consumeMatch = { movementType: 'consume', deleted: { $ne: true } };
        if (projectId) consumeMatch.projectId = new mongoose.Types.ObjectId(projectId);
        const consumeRows = await FinanceStockMovement.find(consumeMatch, 'materialId quantity date');
        const consumptionByMaterialMonth = new Map();
        for (const r of consumeRows) {
            const key = r.materialId.toString();
            const month = new Date(r.date).toISOString().slice(0, 7);
            if (!consumptionByMaterialMonth.has(key)) consumptionByMaterialMonth.set(key, new Map());
            const monthMap = consumptionByMaterialMonth.get(key);
            monthMap.set(month, (monthMap.get(month) || 0) + r.quantity);
        }

        const materialIdList = materialIds
            ? materialIds.split(',')
            : stockTable.filter(r => r.totalConsumed > 0).sort((a, b) => b.totalConsumed - a.totalConsumed).slice(0, 8).map(r => r.materialId.toString());
        const materialById = new Map(materials.map(m => [m._id.toString(), m]));
        const consumptionTrend = materialIdList.map(id => {
            const material = materialById.get(id);
            const monthMap = consumptionByMaterialMonth.get(id) || new Map();
            const points = [...monthMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, qty]) => ({ month, qty }));
            return { materialId: id, materialName: material?.name || 'Unknown', unit: material?.unit || '', points };
        });

        const wastageRateSorted = stockTable
            .filter(r => r.totalWasted > 0 || r.totalConsumed > 0)
            .sort((a, b) => b.wastageRate - a.wastageRate);

        res.json({ success: true, data: { stockTable, consumptionTrend, wastageRateSorted } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing inventory summary' });
    }
};

const bucketKeyFor = (date, groupBy) => {
    const d = new Date(date);
    if (groupBy === 'month') return d.toISOString().slice(0, 7);
    if (groupBy === 'week') {
        const oneJan = new Date(d.getFullYear(), 0, 1);
        const week = Math.ceil((((d - oneJan) / 86400000) + oneJan.getDay() + 1) / 7);
        return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
    }
    return d.toISOString().slice(0, 10);
};

// Shared by getCashFlow and getDashboardTrends' 30-day series so the two
// can never compute cash flow differently.
const computeCashFlow = async (from, to, groupBy = 'day') => {
    const receiptFilter = { deleted: { $ne: true } };
    const otherFilter = { deleted: { $ne: true } };
    if (from || to) {
        receiptFilter.receiptDate = {};
        otherFilter.date = {};
        if (from) { receiptFilter.receiptDate.$gte = new Date(from); otherFilter.date.$gte = new Date(from); }
        if (to) { receiptFilter.receiptDate.$lte = new Date(to); otherFilter.date.$lte = new Date(to); }
    }

    const [receipts, contractorPayments, vendorPayments, salaryPayments, labourPayments, commissionPayments, labourProviderPayments, expenses, expensePayments, contractorAdvances, labourAdvances, tdsDeposits, manualCashEntries, manualBankEntries, gstFilings] = await Promise.all([
        FinanceReceipt.find(receiptFilter),
        FinanceContractorPayment.find(otherFilter),
        FinanceVendorPayment.find(otherFilter),
        FinanceSalaryPayment.find(otherFilter),
        FinanceLabourPayment.find(otherFilter),
        FinanceCommissionPayment.find(otherFilter),
        FinanceLabourProviderPayment.find(otherFilter),
        FinanceExpense.find(otherFilter),
        // Settlements against an accrual expense — see the paidAtEntry
        // split below for why these, not the expense rows themselves, are
        // the actual cash-out event for that half of FinanceExpense.
        // Populated with the parent expense's own category so the
        // category breakdown below can attribute a settlement correctly —
        // an ExpensePayment has no category field of its own.
        FinanceExpensePayment.find(otherFilter).populate('expenseId', 'expenseCategory'),
        // Real cash out today, same as a Payment — see
        // financeBankAccount.js's getAccountActivity, identical reasoning.
        FinanceContractorAdvance.find(otherFilter),
        FinanceLabourAdvance.find(otherFilter),
        FinanceTdsDeposit.find(otherFilter),
        // Manual entries with no other originating record — petty cash/
        // owner draws (financeCashEntry.js) and capital injected/loan
        // disbursed/interest credited/corrections (financeBankEntry.js).
        // BUG FIX: cash flow used to only ever see money moving through a
        // tracked business event (a receipt, a payment, an advance...) —
        // real cash genuinely entering or leaving the company through one
        // of these manual entries was invisible here even though it's
        // exactly as real as a receipt or a payment.
        //
        // BUG FIX 2: FinanceCashEntry also holds AUTO-generated mirror
        // rows — every cash-mode receipt/payment/advance/expense already
        // creates one of these alongside the real record (see
        // financeReceipt.js's addReceipt, same pattern on every other
        // payment controller), tagged with a relatedXId back to it. Fetching
        // every FinanceCashEntry unconditionally double-counted every one
        // of those: once as the receipt/payment itself above, again here
        // as its own mirror — confirmed live (a single ₹50,000 cash
        // receipt inflated totals.in by ₹100,000). Only entries with NO
        // relatedXId set are genuinely manual and belong here.
        FinanceCashEntry.find({
            ...otherFilter,
            relatedReceiptId: null, relatedContractorPaymentId: null, relatedVendorPaymentId: null,
            relatedSalaryPaymentId: null, relatedCommissionPaymentId: null, relatedExpenseId: null,
            relatedSupervisorIncentiveId: null, relatedLabourPaymentId: null, relatedExpensePaymentId: null,
            relatedLabourProviderPaymentId: null, relatedContractorAdvanceId: null, relatedLabourAdvanceId: null,
            relatedTdsDepositId: null,
        }),
        FinanceBankEntry.find(otherFilter),
        // GST payable + Income/Advance Tax paid, as filed (financeGstFiling
        // — see computeGstItcPosition's own comment). Real cash leaving the
        // company once a month is filed, same as a TDS deposit above — not
        // date-range-filtered in the query itself (a filing has no `date`
        // field, only a `month` + optional `filedDate`), scoped in JS below
        // instead using filedDate if set, else that month's own end.
        FinanceGstFiling.find({ deleted: { $ne: true } }),
    ]);

    // FinanceExpense has two shapes (see financeExpense.js's withBalances):
    // paid at entry (paymentMode/bankAccountId set when recorded — cash
    // left that same day) vs accrual (neither — nothing's left the
    // company yet, "pending" until settled later via one or more
    // FinanceExpensePayment rows). Counting every expense's full amount as
    // cash-out on its own `date`, as this used to, showed an unpaid
    // reimbursement (or any other accrual expense) as cash already gone
    // before it actually was, while never counting its real, later
    // settlement at all. Only the paid-at-entry half counts on its own
    // date now; the accrual half counts via its actual settlements below,
    // each on the date that payment actually happened.
    const paidAtEntryExpenses = expenses.filter(e => e.paymentMode || e.bankAccountId);

    // Category breakdown of cash-paid expenses only — same two shapes as
    // paidAtEntryExpenses above, just grouped by expenseCategory instead
    // of summed into one lump "expense" figure, so the Dashboard can show
    // exactly what an outflow was for (Travel, Fuel, Rent, ...) instead of
    // a single opaque number. Deliberately excludes the unpaid half of an
    // accrual expense, same reasoning as everywhere else in this function
    // — nothing here that hasn't actually left the company yet.
    const expenseCategoryTotals = new Map();
    const bumpCategory = (category, amount) => {
        const key = category || 'Uncategorized';
        expenseCategoryTotals.set(key, (expenseCategoryTotals.get(key) || 0) + amount);
    };
    paidAtEntryExpenses.forEach(e => bumpCategory(e.expenseCategory, e.amount));
    expensePayments.forEach(p => bumpCategory(p.expenseId?.expenseCategory, p.amount));
    const expenseByCategory = [...expenseCategoryTotals.entries()]
        .map(([category, amount]) => ({ category, amount: round2(amount) }))
        .sort((a, b) => b.amount - a.amount);

    // Cash actually leaving the company for any of these six payment types
    // is net of any TDS withheld (see financeBankAccount.js's
    // getAccountActivity, same reasoning/same six types — Vendor and
    // Commission payments now have a working TDS input too, so treating
    // them as always-gross was undercounting cash out whenever either
    // actually carried a withholding) — and, for Contractor/Labour
    // specifically, net of any Holding too: that money doesn't leave the
    // company either, it just stays put until the project completes.
    // holdingAmount is undefined on the other four payment types, so `|| 0`
    // makes this a no-op for them.
    const netOut = (p) => p.amount - (p.tdsAmount || 0) - (p.holdingAmount || 0);

    // A vendor payment with isRefund: true is cash coming IN (the vendor
    // paying the company back), not out — split out before it's treated
    // as an outflow like every other vendor payment. See
    // financeBankAccount.js's getAccountActivity, same distinction.
    const vendorRefunds = vendorPayments.filter(p => p.isRefund);
    const vendorOutPayments = vendorPayments.filter(p => !p.isRefund);
    const vendorRefundsTotal = vendorRefunds.reduce((s, p) => s + netOut(p), 0);

    const manualCashIn = manualCashEntries.filter(e => e.type === 'in');
    const manualCashOut = manualCashEntries.filter(e => e.type === 'out');
    const manualBankIn = manualBankEntries.filter(e => e.type === 'in');
    const manualBankOut = manualBankEntries.filter(e => e.type === 'out');
    const manualCashInTotal = manualCashIn.reduce((s, e) => s + e.amount, 0);
    const manualBankInTotal = manualBankIn.reduce((s, e) => s + e.amount, 0);

    // A filing has no `date` field of its own — only a `month` + optional
    // `filedDate` — so it's scoped to this call's range here rather than
    // in the query above. filedDate wins when set (the CA told you the
    // real date money moved); falls back to that month's own end when not
    // (still real money owed, just no exact date recorded for it yet).
    const filingEffectiveDate = (f) => f.filedDate || monthBounds(f.month).end;
    const filingsInRange = gstFilings.filter((f) => {
        const d = filingEffectiveDate(f);
        if (from && d < new Date(from)) return false;
        if (to && d > new Date(to)) return false;
        return true;
    });
    const govtDuesTotal = filingsInRange.reduce((s, f) => s + (f.gstPayable || 0) + (f.taxPaid || 0), 0);

    const totalIn = receipts.reduce((s, r) => s + r.amount, 0) + vendorRefundsTotal + manualCashInTotal + manualBankInTotal;
    const outByCategory = {
        contractor: contractorPayments.reduce((s, p) => s + netOut(p), 0) + contractorAdvances.reduce((s, a) => s + a.amount, 0),
        vendor: vendorOutPayments.reduce((s, p) => s + netOut(p), 0),
        salary: salaryPayments.reduce((s, p) => s + netOut(p), 0),
        labour: labourPayments.reduce((s, p) => s + netOut(p), 0) + labourAdvances.reduce((s, a) => s + a.amount, 0),
        commission: commissionPayments.reduce((s, p) => s + netOut(p), 0),
        labourProvider: labourProviderPayments.reduce((s, p) => s + netOut(p), 0),
        expense: paidAtEntryExpenses.reduce((s, e) => s + e.amount, 0) + expensePayments.reduce((s, p) => s + p.amount, 0),
        tdsDeposit: tdsDeposits.reduce((s, d) => s + d.amount, 0),
        manualCash: manualCashOut.reduce((s, e) => s + e.amount, 0),
        manualBank: manualBankOut.reduce((s, e) => s + e.amount, 0),
        // GST payable + Income/Advance Tax paid, as filed — see
        // financeGstFiling's own comment. Only counts once a month is
        // actually filed; a computed-estimate month contributes nothing
        // here (nothing's actually been paid yet against an estimate).
        govtDues: govtDuesTotal,
    };
    const totalOut = Object.values(outByCategory).reduce((a, b) => a + b, 0);

    const series = new Map();
    const bump = (date, field, amount) => {
        const key = bucketKeyFor(date, groupBy);
        if (!series.has(key)) series.set(key, { bucket: key, in: 0, out: 0 });
        series.get(key)[field] += amount;
    };
    receipts.forEach(r => bump(r.receiptDate, 'in', r.amount));
    vendorRefunds.forEach(p => bump(p.date, 'in', netOut(p)));
    [...contractorPayments, ...vendorOutPayments, ...salaryPayments, ...labourPayments, ...commissionPayments, ...labourProviderPayments].forEach(p => bump(p.date, 'out', netOut(p)));
    [...contractorAdvances, ...labourAdvances].forEach(a => bump(a.date, 'out', a.amount));
    tdsDeposits.forEach(d => bump(d.date, 'out', d.amount));
    paidAtEntryExpenses.forEach(e => bump(e.date, 'out', e.amount));
    expensePayments.forEach(p => bump(p.date, 'out', p.amount));
    manualCashIn.forEach(e => bump(e.date, 'in', e.amount));
    manualBankIn.forEach(e => bump(e.date, 'in', e.amount));
    manualCashOut.forEach(e => bump(e.date, 'out', e.amount));
    manualBankOut.forEach(e => bump(e.date, 'out', e.amount));
    filingsInRange.forEach(f => bump(filingEffectiveDate(f), 'out', (f.gstPayable || 0) + (f.taxPaid || 0)));

    const seriesArr = [...series.values()]
        .sort((a, b) => a.bucket.localeCompare(b.bucket))
        .map(s => ({ ...s, net: s.in - s.out }));

    return {
        totals: { in: totalIn, out: totalOut, net: totalIn - totalOut },
        byCategory: [
            { category: 'receipt', direction: 'in', amount: receipts.reduce((s, r) => s + r.amount, 0) },
            ...(vendorRefundsTotal > 0 ? [{ category: 'vendorRefund', direction: 'in', amount: vendorRefundsTotal }] : []),
            ...(manualCashInTotal > 0 ? [{ category: 'manualCashIn', direction: 'in', amount: manualCashInTotal }] : []),
            ...(manualBankInTotal > 0 ? [{ category: 'manualBankIn', direction: 'in', amount: manualBankInTotal }] : []),
            ...Object.entries(outByCategory).map(([category, amount]) => ({ category, direction: 'out', amount })),
        ],
        // The "expense" line in outByCategory/byCategory above is one
        // lump sum — this is that same cash-paid-expense total broken out
        // by expenseCategory (Travel, Fuel, Rent, ...) instead, project-
        // related or not (see this function's own header — no project
        // filter anywhere here).
        expenseByCategory,
        series: seriesArr,
    };
};

const getCashFlow = async (req, res) => {
    try {
        const { from, to, groupBy = 'day' } = req.query;
        const data = await computeCashFlow(from, to, groupBy);
        res.json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing cash flow' });
    }
};

const getExpenseAnalysis = async (req, res) => {
    try {
        const { projectId, category, relatedToId, from, to } = req.query;
        const filter = { deleted: { $ne: true } };
        if (projectId) filter.projectId = projectId;
        if (category) filter.expenseCategory = category;
        if (relatedToId) filter.relatedToId = relatedToId;
        if (from || to) {
            filter.date = {};
            if (from) filter.date.$gte = new Date(from);
            if (to) filter.date.$lte = new Date(to);
        }
        const expenses = await FinanceExpense.find(filter)
            .populate('projectId', 'name').populate('workId', 'workType').populate('relatedToId', 'name vendorType companyName')
            .sort({ date: -1 });
        const total = expenses.reduce((s, e) => s + e.amount, 0);

        const byCategoryMap = new Map();
        const byProjectMap = new Map();
        const byWorkMap = new Map();
        const byRelatedToMap = new Map();
        for (const e of expenses) {
            const cat = e.expenseCategory || 'Uncategorized';
            byCategoryMap.set(cat, (byCategoryMap.get(cat) || 0) + e.amount);

            const projKey = e.projectId ? e.projectId._id.toString() : 'general';
            const projName = e.projectId ? e.projectId.name : 'General / overhead';
            if (!byProjectMap.has(projKey)) byProjectMap.set(projKey, { projectId: e.projectId?._id || null, projectName: projName, amount: 0 });
            byProjectMap.get(projKey).amount += e.amount;

            if (e.workId) {
                const workKey = e.workId._id.toString();
                if (!byWorkMap.has(workKey)) byWorkMap.set(workKey, { workId: e.workId._id, workType: e.workId.workType, amount: 0 });
                byWorkMap.get(workKey).amount += e.amount;
            }

            if (e.relatedToId) {
                const relKey = e.relatedToId._id.toString();
                const relLabel = e.relatedToType === 'financeEmployee' ? 'Employee'
                    : e.relatedToType === 'financeLabourer' ? 'Labourer'
                    : e.relatedToType === 'financeCompanySettings' ? 'Company'
                    : e.relatedToId.vendorType === 'labour_contractor' ? 'Contractor' : 'Vendor';
                const relName = e.relatedToId.name || e.relatedToId.companyName;
                if (!byRelatedToMap.has(relKey)) byRelatedToMap.set(relKey, { relatedToId: e.relatedToId._id, relatedToType: relLabel, name: relName, amount: 0 });
                byRelatedToMap.get(relKey).amount += e.amount;
            }
        }

        res.json({
            success: true,
            data: {
                total,
                byCategory: [...byCategoryMap.entries()].map(([cat, amount]) => ({ category: cat, amount })).sort((a, b) => b.amount - a.amount),
                byProject: [...byProjectMap.values()].sort((a, b) => b.amount - a.amount),
                byWork: [...byWorkMap.values()].sort((a, b) => b.amount - a.amount),
                byRelatedTo: [...byRelatedToMap.values()].sort((a, b) => b.amount - a.amount),
                expenses,
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing expense analysis' });
    }
};

const monthBounds = (month) => {
    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
};

const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

// Company-wide, date-scoped material cost — same weighted-average-rate
// formula as computeProjectMaterialCostSplit, but computed once across every
// project's purchases/consumption instead of looping per project (used by
// the dashboard's "This Month Profit" and the Revenue-vs-Cost trend, both
// of which need this for every project or a handful of months at once).
// Optional projectIds narrows to a specific set (e.g. active projects only).
// movementType defaults to 'consume' (the real Material Cost figure);
// pass 'waste' for the equivalent company-wide Material Waste Cost — same
// avgRate, same everything else, just which stock movements it sums.
const computeCompanyWideMaterialCostInRange = async (start, end, projectIds = null, movementType = 'consume') => {
    const purchaseFilter = { deleted: { $ne: true } };
    if (projectIds) purchaseFilter.projectId = { $in: projectIds };
    const purchases = await FinancePurchase.find(purchaseFilter);
    const rateByKey = new Map();
    for (const p of purchases) {
        const key = `${p.projectId}_${p.materialId}`;
        if (!rateByKey.has(key)) rateByKey.set(key, { qty: 0, amt: 0 });
        const m = rateByKey.get(key);
        const sign = p.transactionType === 'return' ? -1 : 1;
        m.qty += sign * p.quantity;
        m.amt += sign * p.totalAmount;
    }
    const avgRate = new Map();
    for (const [key, m] of rateByKey) avgRate.set(key, m.qty > 0 ? m.amt / m.qty : 0);

    const consumeMatch = { movementType, date: { $gte: start, $lte: end }, deleted: { $ne: true } };
    if (projectIds) consumeMatch.projectId = { $in: projectIds };
    const consumed = await FinanceStockMovement.aggregate([
        { $match: consumeMatch },
        { $group: { _id: { projectId: '$projectId', materialId: '$materialId' }, qty: { $sum: '$quantity' } } },
    ]);
    let total = 0;
    for (const row of consumed) total += row.qty * (avgRate.get(`${row._id.projectId}_${row._id.materialId}`) || 0);
    return total;
};

// Counts a material once if it's short at ANY active project — same
// per-(project, material) definition as Site Inventory's company-wide view
// (getInventorySummary above), so the two never disagree on the same
// underlying data. Scoped to active projects, same as this endpoint's other
// "this month" figures — a draft or completed project's stock isn't
// actionable the way an active site's is.
const computeLowStockMaterialCount = async (activeProjectIds) => {
    const materials = await FinanceMaterial.find({ deleted: { $ne: true } });
    if (!materials.length) return 0;
    const rows = await FinanceStockMovement.aggregate([
        { $match: { projectId: { $in: activeProjectIds }, deleted: { $ne: true } } },
        {
            $group: {
                _id: { projectId: '$projectId', materialId: '$materialId' },
                dump:     { $sum: { $cond: [{ $eq: ['$movementType', 'dump'] }, '$quantity', 0] } },
                consume:  { $sum: { $cond: [{ $eq: ['$movementType', 'consume'] }, '$quantity', 0] } },
                returned: { $sum: { $cond: [{ $eq: ['$movementType', 'return'] }, '$quantity', 0] } },
                waste:    { $sum: { $cond: [{ $eq: ['$movementType', 'waste'] }, '$quantity', 0] } },
            },
        },
    ]);
    const materialById = new Map(materials.map(m => [m._id.toString(), m]));
    const lowMaterialIds = new Set();
    for (const row of rows) {
        const material = materialById.get(row._id.materialId.toString());
        if (!material) continue;
        const currentStock = row.dump - row.consume - row.returned - row.waste;
        if (currentStock < material.minimumStockLevel) lowMaterialIds.add(row._id.materialId.toString());
    }
    return lowMaterialIds.size;
};

const AGE_BUCKET_KEYS = ['0-30', '30-60', '60-90', '90+'];
const bucketForAgeDays = (days) => (days <= 30 ? '0-30' : days <= 60 ? '30-60' : days <= 90 ? '60-90' : '90+');

// Per-bill remaining balance: receipts tied to a specific runningBillId
// reduce that bill directly; receipts with no runningBillId (a lump-sum
// payment not tied to one bill) reduce the oldest still-open bill first —
// `bills` must already be sorted oldest-first by billDate. directPaymentCredits
// (see summarizeProject's identical term — money the client paid straight to
// a contractor/labourer, never a FinanceReceipt) settles a bill exactly like
// an unlinked receipt does: it isn't tied to one specific bill either, so it
// joins the same oldest-bill-first pool instead of a separate allocation
// rule. Without this, a bill fully settled via a direct payment (no receipt
// at all) sat at its full balance forever, overstating both this bill's own
// balance and the aging bucket it fell into.
const computeBillBalances = (bills, receipts, directPaymentCredits = 0) => {
    const balances = new Map(bills.map(b => [b._id.toString(), b.totalAmount + (b.gstAmount || 0)]));
    for (const r of receipts) {
        if (r.runningBillId && balances.has(r.runningBillId.toString())) {
            const key = r.runningBillId.toString();
            balances.set(key, balances.get(key) - r.amount);
        }
    }
    let pool = receipts.filter(r => !r.runningBillId).reduce((s, r) => s + r.amount, 0) + directPaymentCredits;
    for (const b of bills) {
        if (pool <= 0) break;
        const key = b._id.toString();
        const bal = balances.get(key);
        if (bal <= 0) continue;
        const applied = Math.min(bal, pool);
        balances.set(key, bal - applied);
        pool -= applied;
    }
    return balances;
};

// Receivables aging — 0-30/30-60/60-90/90+ days since each bill's billDate,
// today as the reference point. `bills` must be sorted oldest-first.
const computeAging = (bills, receipts, directPaymentCredits = 0) => {
    const balances = computeBillBalances(bills, receipts, directPaymentCredits);
    const today = new Date();
    const buckets = { '0-30': 0, '30-60': 0, '60-90': 0, '90+': 0 };
    for (const b of bills) {
        const bal = Math.max(0, balances.get(b._id.toString()) || 0);
        if (bal <= 0) continue;
        const days = Math.floor((today - new Date(b.billDate)) / 86400000);
        buckets[bucketForAgeDays(days)] += bal;
    }
    return buckets;
};

// Dashboard "Approved" section — every Work that's been billed to the
// client via ANY issued running bill, company-wide, grouped by work type
// (Putty/Paint/...) plus a Contractor-total/Labour-total split. Unlike the
// Site Activity boxes above it (which show raw logged "today" activity,
// deliberately unconditional), this is cumulative and billing-derived —
// there's no "today" version of Approved, since a bill's approval doesn't
// expire.
//
// Unlike computeWorkExpectedPay's old bug (fixed — see that function's own
// header comment), this loop already keys per (work, vendor) / (work,
// labourer) pair below and splits each one's own approved/rejected share
// via splitApprovedAreaByShare before multiplying by THEIR OWN rate — a
// work with several contributing contractors/labourers is never summed
// against one shared full-area figure here.
// "Approved" here means the same thing it means everywhere else in the
// app now (financeWorkReview — reviewed, not billed): per (work,
// contractor-or-labourer) actual measured area, split into what's been
// reviewed (approvedAreaSqft) vs not yet (the remainder) — same shape
// Contractor/Labour Ledger already surface per vendor, just company-wide
// and grouped by work type here. Used to read straight off issued running
// bills' lineItems (the pre-review "billed" meaning of Approved),
// silently drifting out of step with every other Approved figure in the
// app once review was introduced as its own confirmation step.
const computeDashboardApprovedBreakdown = async () => {
    // No status filter — a Work can be marked 'completed' (financeWork.js's
    // updateWork, or the completeFinanceProject cascade) with zero check
    // against FinanceWorkReview, so real unreviewed sqft can sit on a
    // "completed" Work indefinitely. Excluding status:'completed' here used
    // to silently drop that cost/revenue from both Approved and Unapproved
    // company-wide totals forever (it never becomes reviewed just because
    // the Work was marked done) — contradicting this section's own
    // "cumulative, a review doesn't expire" intent below, and drifting out
    // of step with computeProjectProfit (project-scoped, always unfiltered
    // by status). "What's happening today" widgets (Site Activity,
    // computeReadyProjectIds) still exclude completed Works on purpose —
    // only this cumulative rollup needed the fix.
    const works = await FinanceWork.find({ deleted: { $ne: true } }, 'workType projectId completedAreaSqft');
    if (!works.length) return { byWorkType: [], contractorTotal: 0, labourTotal: 0, approvedContractorAreaSqft: 0, approvedLabourAreaSqft: 0, unapprovedByWorkType: [], unapprovedContractorTotal: 0, unapprovedLabourTotal: 0, unapprovedRevenueTotal: 0, unapprovedMaterialTotal: 0 };
    const workIds = works.map(w => w._id);
    const workById = new Map(works.map(w => [w._id.toString(), w]));

    const [contractorMeasurements, labourMeasurements, categoryApprovedByWorkId, approvedBillingByWorkId, directPaymentContractorByVendor, directPaymentLabourByLabourer] = await Promise.all([
        FinanceMeasurement.find({ workId: { $in: workIds }, deleted: { $ne: true } }, 'workId contractorVendorId areaCoveredSqft'),
        FinanceLabourMeasurement.find({ workId: { $in: workIds }, deleted: { $ne: true } }, 'workId labourerId areaCoveredSqft'),
        // BUG FIX: this used to query FinanceWorkReview directly for
        // partyType/partyId fields that don't exist on that model at all
        // (it's purely work-level — see its own schema comment) — every
        // review's partyType/partyId read as undefined, so
        // approvedAreaByWorkContractor was always empty and
        // approvedAreaByWorkLabourer's keys never matched real lookups
        // either. Contractor/Labour "Approved" on the Dashboard has always
        // read ₹0 regardless of actual review status. Fixed by reusing
        // getCategoryApprovedAreaByWorkId — same category-level split
        // computeContractorAnalysisRows/computeLabourAnalysisRows use —
        // then splitting within category by each party's own measured
        // share below, same as those two functions do.
        getCategoryApprovedAreaByWorkId(workIds),
        getApprovedBillingByWorkId(workIds),
        // Flat, company-wide — see getWorkerPayoutTotal's comment (an
        // advance, not payment for specific measured sqft, so it's no
        // longer netted against any one Work's unapproved/approved split).
        getWorkerPayoutTotalsBulk('contractor'),
        getWorkerPayoutTotalsBulk('labour'),
    ]);

    const totalAreaByWorkContractor = new Map(); // `${workId}_${vendorId}` -> area
    const workContractorTotalArea = new Map(); // workId -> area, every vendor combined
    for (const m of contractorMeasurements) {
        if (!m.contractorVendorId) continue;
        const key = `${m.workId}_${m.contractorVendorId}`;
        totalAreaByWorkContractor.set(key, (totalAreaByWorkContractor.get(key) || 0) + m.areaCoveredSqft);
        const wKey = m.workId.toString();
        workContractorTotalArea.set(wKey, (workContractorTotalArea.get(wKey) || 0) + m.areaCoveredSqft);
    }
    const totalAreaByWorkLabourer = new Map();
    const workLabourTotalArea = new Map(); // workId -> area, every labourer combined
    for (const m of labourMeasurements) {
        const key = `${m.workId}_${m.labourerId}`;
        totalAreaByWorkLabourer.set(key, (totalAreaByWorkLabourer.get(key) || 0) + m.areaCoveredSqft);
        const wKey = m.workId.toString();
        workLabourTotalArea.set(wKey, (workLabourTotalArea.get(wKey) || 0) + m.areaCoveredSqft);
    }

    const projectIds = [...new Set(works.map(w => w.projectId.toString()))];
    const allVendorIds = [...new Set([...totalAreaByWorkContractor.keys()].map(k => k.split('_')[1]))];
    const allLabourerIds = [...new Set([...totalAreaByWorkLabourer.keys()].map(k => k.split('_')[1]))];
    const [contractorRates, labourRates, workTypeRates] = await Promise.all([
        allVendorIds.length ? FinanceContractorRate.find({ projectId: { $in: projectIds }, contractorVendorId: { $in: allVendorIds }, deleted: { $ne: true } }) : [],
        allLabourerIds.length ? FinanceLabourRate.find({ projectId: { $in: projectIds }, labourerId: { $in: allLabourerIds }, deleted: { $ne: true } }) : [],
        FinanceWorkTypeRate.find({ projectId: { $in: projectIds }, deleted: { $ne: true } }),
    ]);
    const contractorRateByKey = new Map(contractorRates.map(r => [`${r.projectId}_${r.contractorVendorId}_${r.workType}`, r.ratePerSqft]));
    const labourRateByKey = new Map(labourRates.map(r => [`${r.projectId}_${r.labourerId}_${r.workType}`, r.ratePerSqft]));
    const workTypeRateByKey = new Map(workTypeRates.map(r => [`${r.projectId}_${r.workType}`, r]));

    const bump = (map, workType, sqft, amount) => {
        const cur = map.get(workType) || { sqft: 0, amount: 0 };
        cur.sqft += sqft; cur.amount += amount;
        map.set(workType, cur);
    };
    const byWorkType = new Map(), unapprovedByWorkType = new Map();
    let contractorTotal = 0, labourTotal = 0, unapprovedContractorTotal = 0, unapprovedLabourTotal = 0;
    // Area-sqft siblings of contractorTotal/labourTotal (₹) — the Dashboard's
    // "Contractor/Labour Teams - Approved" cards show a ₹ headline but no
    // sense of how much sqft actually produced it, unlike the per-work-type
    // Approved cards just below which already pair sqft with ₹.
    let approvedContractorAreaSqft = 0, approvedLabourAreaSqft = 0;

    for (const [key, totalArea] of totalAreaByWorkContractor) {
        const [workId, vendorId] = key.split('_');
        const w = workById.get(workId);
        const rate = contractorRateByKey.get(`${w.projectId}_${vendorId}_${w.workType}`);
        if (!rate) continue;
        const categoryEntry = categoryApprovedByWorkId.get(workId);
        const workContractorApproved = categoryEntry?.contractorApprovedAreaSqft || 0;
        const approvedArea = splitApprovedAreaByShare(workContractorApproved, totalArea, workContractorTotalArea.get(workId) || 0);
        // A rejection is final, already-reviewed — exclude this vendor's
        // own share of it from Unapproved. See getCategoryApprovedAreaByWorkId's
        // header comment.
        const workContractorRejected = categoryEntry?.contractorRejectedAreaSqft || 0;
        const rejectedArea = splitApprovedAreaByShare(workContractorRejected, totalArea, workContractorTotalArea.get(workId) || 0);
        const unapprovedArea = Math.max(0, totalArea - approvedArea - rejectedArea);
        contractorTotal += approvedArea * rate;
        approvedContractorAreaSqft += approvedArea;
        unapprovedContractorTotal += unapprovedArea * rate;
        bump(byWorkType, w.workType, approvedArea, approvedArea * rate);
    }
    for (const [key, totalArea] of totalAreaByWorkLabourer) {
        const [workId, labourerId] = key.split('_');
        const w = workById.get(workId);
        const rate = labourRateByKey.get(`${w.projectId}_${labourerId}_${w.workType}`);
        if (!rate) continue;
        const categoryEntry = categoryApprovedByWorkId.get(workId);
        const workLabourApproved = categoryEntry?.labourApprovedAreaSqft || 0;
        const approvedArea = splitApprovedAreaByShare(workLabourApproved, totalArea, workLabourTotalArea.get(workId) || 0);
        const workLabourRejected = categoryEntry?.labourRejectedAreaSqft || 0;
        const rejectedArea = splitApprovedAreaByShare(workLabourRejected, totalArea, workLabourTotalArea.get(workId) || 0);
        const unapprovedArea = Math.max(0, totalArea - approvedArea - rejectedArea);
        labourTotal += approvedArea * rate;
        approvedLabourAreaSqft += approvedArea;
        unapprovedLabourTotal += unapprovedArea * rate;
        bump(byWorkType, w.workType, approvedArea, approvedArea * rate);
    }
    const directPaymentContractorTotal = round2([...directPaymentContractorByVendor.values()].reduce((s, v) => s + v, 0));
    const directPaymentLabourTotal = round2([...directPaymentLabourByLabourer.values()].reduce((s, v) => s + v, 0));

    // Unapproved-by-work-type's "amount" is deliberately NOT contractor/
    // labour cost (unlike byWorkType/contractorTotal/labourTotal above) —
    // it's what this still-unreviewed sqft is worth to the company once it
    // clears review and gets billed: gross client rate × sqft (NOT net of
    // referral commission — commission is its own already-visible
    // Unapproved line item, so subtracting it here too would double-count
    // it), at the Work level (getApprovedBillingByWorkId's single reviewed
    // ceiling per work), not summed per contributing contractor/labourer —
    // a work's unapproved sqft is one number regardless of how many
    // parties logged it, so this avoids the double-counting the per-party
    // loops above would introduce.
    let unapprovedRevenueTotal = 0;
    for (const w of works) {
        const workBilling = approvedBillingByWorkId.get(w._id.toString());
        const workApprovedArea = workBilling?.areaSqft || 0;
        // A rejection is final, already-reviewed — exclude it from
        // Unapproved (same reasoning as the contractor/labour loops above).
        const workRejectedArea = workBilling?.rejectedAreaSqft || 0;
        const unapprovedArea = Math.max(0, w.completedAreaSqft - workApprovedArea - workRejectedArea);
        if (!unapprovedArea) continue;
        const rate = workTypeRateByKey.get(`${w.projectId}_${w.workType}`);
        const clientRatePerSqft = rate ? rate.clientRatePerSqft : 0;
        const revenueAmount = unapprovedArea * clientRatePerSqft;
        unapprovedRevenueTotal += revenueAmount;
        bump(unapprovedByWorkType, w.workType, unapprovedArea, revenueAmount);
    }

    // Same material-cost-by-approval-status split as
    // computeProjectMaterialCostSplit's own header comment explains in
    // detail, applied company-wide instead of to one project — reuses the
    // works/measurements/categoryApprovedByWorkId/workContractorTotalArea/
    // workLabourTotalArea already built above rather than re-fetching them.
    // Only the pending (unapproved) share is needed here: the decided
    // share already flows into totalApprovedProfitToDate for free, since
    // that figure is a straight sum of computeProjectProfit's own `profit`
    // per ongoing project, not computed independently here.
    const [purchases, consumeMovements] = await Promise.all([
        FinancePurchase.find({ deleted: { $ne: true } }, 'projectId materialId quantity totalAmount transactionType'),
        FinanceStockMovement.find(
            { movementType: 'consume', deleted: { $ne: true } },
            'materialId quantity projectId relatedMeasurementId relatedLabourMeasurementId'
        ),
    ]);
    const materialRateAgg = new Map();
    for (const p of purchases) {
        const key = `${p.projectId}_${p.materialId}`;
        if (!materialRateAgg.has(key)) materialRateAgg.set(key, { qty: 0, amt: 0 });
        const m = materialRateAgg.get(key);
        const sign = p.transactionType === 'return' ? -1 : 1;
        m.qty += sign * p.quantity;
        m.amt += sign * p.totalAmount;
    }
    const materialRateByKey = new Map();
    for (const [key, m] of materialRateAgg) materialRateByKey.set(key, m.qty > 0 ? m.amt / m.qty : 0);

    const contractorMeasurementById = new Map(contractorMeasurements.map(m => [m._id.toString(), m]));
    const labourMeasurementById = new Map(labourMeasurements.map(m => [m._id.toString(), m]));
    let unapprovedMaterialTotal = 0;
    for (const mv of consumeMovements) {
        const rate = materialRateByKey.get(`${mv.projectId}_${mv.materialId}`) || 0;
        const cost = mv.quantity * rate;
        if (!cost) continue;

        const isContractor = !!mv.relatedMeasurementId;
        const measurement = isContractor
            ? contractorMeasurementById.get(mv.relatedMeasurementId.toString())
            : mv.relatedLabourMeasurementId ? labourMeasurementById.get(mv.relatedLabourMeasurementId.toString()) : null;
        // No traceable source measurement — same "don't force a guess"
        // treatment as computeProjectMaterialCostSplit's identical case.
        if (!measurement) { unapprovedMaterialTotal += cost; continue; }

        const workKey = measurement.workId.toString();
        const categoryEntry = categoryApprovedByWorkId.get(workKey);
        const workApprovedArea = isContractor ? (categoryEntry?.contractorApprovedAreaSqft || 0) : (categoryEntry?.labourApprovedAreaSqft || 0);
        const workRejectedArea = isContractor ? (categoryEntry?.contractorRejectedAreaSqft || 0) : (categoryEntry?.labourRejectedAreaSqft || 0);
        const workTotalArea = (isContractor ? workContractorTotalArea : workLabourTotalArea).get(workKey) || 0;

        const approvedShare = splitApprovedAreaByShare(workApprovedArea, measurement.areaCoveredSqft, workTotalArea);
        const rejectedShare = splitApprovedAreaByShare(workRejectedArea, measurement.areaCoveredSqft, workTotalArea);
        const decidedFraction = measurement.areaCoveredSqft > 0 ? Math.min(1, (approvedShare + rejectedShare) / measurement.areaCoveredSqft) : 0;

        unapprovedMaterialTotal += cost * (1 - decidedFraction);
    }

    const toArray = (map) => [...map.entries()].map(([workType, v]) => ({ workType, sqft: round2(v.sqft), amount: round2(v.amount) })).sort((a, b) => b.sqft - a.sqft);
    return {
        byWorkType: toArray(byWorkType), contractorTotal: round2(contractorTotal), labourTotal: round2(labourTotal),
        approvedContractorAreaSqft: round2(approvedContractorAreaSqft), approvedLabourAreaSqft: round2(approvedLabourAreaSqft),
        unapprovedByWorkType: toArray(unapprovedByWorkType), unapprovedContractorTotal: round2(unapprovedContractorTotal), unapprovedLabourTotal: round2(unapprovedLabourTotal),
        unapprovedRevenueTotal: round2(unapprovedRevenueTotal), unapprovedMaterialTotal: round2(unapprovedMaterialTotal),
        // Flat, informational totals — no longer split by Unapproved/Approved
        // (see getWorkerPayoutTotal's comment).
        directPaymentContractorTotal, directPaymentLabourTotal,
    };
};

// "Ready to Bill" — projects with at least one Work whose REVIEWED area
// (getApprovedBillingByWorkId — "Approved" now means reviewed, not billed)
// exceeds what's already in an issued bill (getBilledAreaByWorkId).
// Deliberately NOT completedAreaSqft vs reviewed — that gap is "pending
// review" (a project needing attention in the review panel, not one
// that's actually ready for Generate Bill). A lighter-weight sibling of
// computeWorkExpectedPay: skips the deduction/expected-pay machinery
// entirely since this KPI only needs the Reviewed-vs-Billed gap.
const computeReadyProjectIds = async (billableProjectIds) => {
    const works = await FinanceWork.find(
        // status: {$ne:'completed'} — a completed Work is done accruing
        // billable area either way (its project's completion pre-flight
        // check already surfaced any leftover unbilled sqft, and the user
        // either cleared it or explicitly overrode), so it shouldn't keep
        // nudging "ready to bill" on the dashboard forever after.
        { projectId: { $in: billableProjectIds }, deleted: { $ne: true }, completedAreaSqft: { $gt: 0 }, status: { $ne: 'completed' } },
        'projectId completedAreaSqft'
    );
    if (!works.length) return [];
    const workIds = works.map(w => w._id);
    const [approvedByWorkId, billedByWorkId] = await Promise.all([
        getApprovedBillingByWorkId(workIds),
        getBilledAreaByWorkId(workIds),
    ]);
    const readyProjectIds = new Set();
    for (const w of works) {
        const approved = approvedByWorkId.get(w._id.toString())?.areaSqft || 0;
        const billed = billedByWorkId.get(w._id.toString())?.areaSqft || 0;
        if (approved - billed > 0.001) readyProjectIds.add(w.projectId.toString());
    }
    return [...readyProjectIds];
};

// Pre-flight check for "Mark Project Completed" (financeProject.js's
// completeFinanceProject) — everything that could still be financially
// outstanding on this project, gathered from the same computations already
// used elsewhere (nothing new invented) so this can never drift from what
// the Ledgers/Payables/Receivables pages themselves would show. Warn-only
// by design (the caller decides whether blockers actually stop completion)
// — this just reports what's there.
const getProjectCompletionReadiness = async (projectId) => {
    const project = await FinanceProject.findById(projectId);
    if (!project) throw new Error('Project not found');

    const works = await FinanceWork.find({ projectId, deleted: { $ne: true } });
    const workIds = works.map(w => w._id);
    const blockers = [];

    if (workIds.length) {
        // Unreviewed work — every work's own Total-vs-Approved(reviewed) gap,
        // same figure the review panel and Ledgers already surface. A
        // project shouldn't be markable complete with work nobody's ever
        // actually reviewed.
        const expectedPays = await Promise.all(works.map(w => computeWorkExpectedPay(w)));
        const unapprovedAreaSqft = round2(expectedPays.reduce((s, wp) => s + wp.unapprovedAreaSqft, 0));
        const unapprovedAmount = round2(expectedPays.reduce((s, wp) => s + wp.unapprovedAmount, 0));
        if (unapprovedAreaSqft > 0.01) {
            blockers.push({ category: 'unbilled_work', label: `${unapprovedAreaSqft} sqft logged but never reviewed`, amount: unapprovedAmount });
        }

        // Contractor/labour balances still owed on THIS project specifically
        // — same formula as the Ledgers (earnings − advances − deductions −
        // payments), narrowed to this project's Works via the assignment
        // rows still on them.
        const [contractorAssignments, labourAssignments] = await Promise.all([
            FinanceWorkContractorAssignment.find({ workId: { $in: workIds }, deleted: { $ne: true } }),
            FinanceWorkLabourAssignment.find({ workId: { $in: workIds }, deleted: { $ne: true } }),
        ]);

        if (contractorAssignments.length) {
            const vendorIds = new Set(contractorAssignments.map(a => a.contractorVendorId.toString()));
            const rows = await computeContractorAnalysisRows(projectId);
            for (const r of rows) {
                if (vendorIds.has(r.vendorId.toString()) && Math.abs(r.balancePayable) > 0.5) {
                    blockers.push({ category: 'contractor_balance', label: `${r.vendorName} — contractor balance`, amount: round2(r.balancePayable) });
                }
            }
        }

        if (labourAssignments.length) {
            const labourBalances = await computeLabourBalancesForProject(projectId, works);
            for (const r of labourBalances) {
                if (Math.abs(r.balancePayable) > 0.5) {
                    blockers.push({ category: 'labour_balance', label: `${r.labourerName} — labour balance`, amount: r.balancePayable });
                }
            }
        }
    }

    // Draft bills — money already earned that hasn't even been sent to the
    // client yet, let alone paid.
    const draftBills = await FinanceRunningBill.find({ projectId, status: 'draft', deleted: { $ne: true } });
    if (draftBills.length) {
        const draftTotal = round2(draftBills.reduce((s, b) => s + b.totalAmount + (b.gstAmount || 0), 0));
        blockers.push({ category: 'draft_bills', label: `${draftBills.length} draft bill${draftBills.length === 1 ? '' : 's'} never issued to the client`, amount: draftTotal });
    }

    // Vendor (material supplier) balances on this project.
    const vendorRows = await computeVendorAnalysisRows(projectId);
    for (const r of vendorRows.filter(r => Math.abs(r.amountOwed) > 0.5)) {
        blockers.push({ category: 'vendor_balance', label: `${r.vendorName} — material supplier balance`, amount: round2(r.amountOwed) });
    }

    // Client receivables — issued bills the client hasn't fully paid yet.
    const receivable = await summarizeProject(project);
    if (receivable.balance > 0.5) {
        blockers.push({ category: 'receivable', label: 'Outstanding balance owed by the client', amount: round2(receivable.balance) });
    }

    // Advance credit not yet drawn down against a bill (advance-contract
    // projects only) — same query generateRunningBill's applyAdvanceCredit
    // uses to find drawable advance receipts.
    if (project.contractType === 'advance') {
        if (!project.advanceReceived) {
            blockers.push({ category: 'advance_not_received', label: 'Advance payment was never recorded as received', amount: project.advanceAmount || 0 });
        } else {
            const undrawn = await FinanceReceipt.find({ projectId, isAdvance: true, runningBillId: null, deleted: { $ne: true } });
            const undrawnTotal = round2(undrawn.reduce((s, r) => s + r.amount, 0));
            if (undrawnTotal > 0.5) {
                blockers.push({ category: 'advance_undrawn', label: 'Advance credit not yet drawn against any bill', amount: undrawnTotal });
            }
        }
    }

    return { blockers, hasBlockers: blockers.length > 0 };
};

// Bulk labour-balance helper for getProjectCompletionReadiness — no
// company-wide bulk equivalent of getContractorLedger exists for labour
// (unlike computeContractorAnalysisRows on the contractor side), so this
// mirrors that same formula, narrowed to one project's Works directly
// rather than scanning every labourer in the company.
const computeLabourBalancesForProject = async (projectId, works) => {
    const workIds = works.map(w => w._id);
    const [assignments, allMeasurements, approvedBillingByWorkId] = await Promise.all([
        FinanceWorkLabourAssignment.find({ workId: { $in: workIds }, deleted: { $ne: true } }),
        FinanceLabourMeasurement.find({ workId: { $in: workIds }, deleted: { $ne: true } }, 'workId labourerId areaCoveredSqft'),
        getApprovedBillingByWorkId(workIds),
    ]);
    const labourerIds = [...new Set(assignments.map(a => a.labourerId.toString()))];
    if (!labourerIds.length) return [];

    const [labourers, rates] = await Promise.all([
        FinanceLabourer.find({ _id: { $in: labourerIds } }),
        FinanceLabourRate.find({ projectId, labourerId: { $in: labourerIds }, deleted: { $ne: true } }),
    ]);
    const labourerById = new Map(labourers.map(l => [l._id.toString(), l]));
    const rateByKey = new Map(rates.map(r => [`${r.labourerId}_${r.workType}`, r.ratePerSqft]));

    const totalAreaByWork = new Map();
    const areaByLabourerWork = new Map();
    for (const m of allMeasurements) {
        const wk = m.workId.toString();
        totalAreaByWork.set(wk, (totalAreaByWork.get(wk) || 0) + m.areaCoveredSqft);
        const key = `${m.labourerId}_${wk}`;
        areaByLabourerWork.set(key, (areaByLabourerWork.get(key) || 0) + m.areaCoveredSqft);
    }

    const earningsByLabourer = new Map();
    for (const w of works) {
        const wk = w._id.toString();
        const totalArea = totalAreaByWork.get(wk) || 0;
        if (!totalArea) continue;
        const workApprovedArea = approvedBillingByWorkId.get(wk)?.areaSqft || 0;
        for (const labourerId of labourerIds) {
            const labourerArea = areaByLabourerWork.get(`${labourerId}_${wk}`) || 0;
            if (!labourerArea) continue;
            const rate = rateByKey.get(`${labourerId}_${w.workType}`);
            if (!rate) continue;
            const approvedArea = splitApprovedAreaByShare(workApprovedArea, labourerArea, totalArea);
            earningsByLabourer.set(labourerId, (earningsByLabourer.get(labourerId) || 0) + approvedArea * rate);
        }
    }

    const moneyFilter = { projectId, deleted: { $ne: true } };
    return Promise.all(labourerIds.map(async (labourerId) => {
        const [advances, allDeductions, payments] = await Promise.all([
            FinanceLabourAdvance.find({ ...moneyFilter, labourerId }),
            FinanceLabourDeduction.find({ ...moneyFilter, labourerId }),
            FinanceLabourPayment.find({ ...moneyFilter, labourerId }),
        ]);
        const earnings = round2(earningsByLabourer.get(labourerId) || 0);
        const advancesTotal = advances.reduce((s, a) => s + a.amount, 0);
        // See computeContractorAnalysisRows' identical comment — a
        // workReviewCycle-tagged row's `amount` is already reflected in
        // earnings above (would double-count it), but materialWasteAmount
        // is a genuinely new deduction nothing else accounts for.
        const deductionsTotal = allDeductions.reduce((s, d) => s + (d.workReviewCycle == null ? (d.amount || 0) : 0) + (d.materialWasteAmount || 0), 0);
        const paymentsTotal = payments.reduce((s, p) => s + p.amount, 0);
        return {
            labourerId, labourerName: labourerById.get(labourerId)?.name || '—',
            balancePayable: round2(earnings - advancesTotal - deductionsTotal - paymentsTotal),
        };
    }));
};

// BUG FIX: This Month Profit (and the Revenue-vs-Cost trend chart, which
// deliberately mirrors it) used to gate contractor/labour/commission/
// material cost to "reviewed" via computeCompanyWideContractorCostInRange's
// approvedOnly=true mode — but that mode still filtered the underlying
// FinanceMeasurement rows by *measurement date*, then applied the Work's
// CURRENT approved share to only that month's slice of area. A Work
// measured in an earlier month but only reviewed (and billed) this month
// showed 100% of its Revenue this month with ~0% of its cost — the
// measurement date the cost was keyed off had already passed, so almost no
// area fell inside this month's window to even apply the approved-share
// gate to. Confirmed live: a bill issued today against a Work measured back
// in July showed "This Month Profit" exactly equal to Revenue.
//
// Cost only becomes a confirmed, billable-matched liability at the moment
// of review (the same gate Generate Bill itself requires before a Work's
// sqft can be billed at all) — so review date, not measurement date, is
// the basis that actually lines up with Revenue's own billing-date
// recognition. Reuses computeWorkProfit (already the single source of
// truth for one Work's approved cost, including the material decided/
// pending split) rather than re-deriving the same proportional-share math
// a third time.
//
// Material Waste is deliberately NOT included here — it's a real physical
// loss with no approval gate of its own (see computeProjectMaterialWaste's
// own comment), genuinely tied to when the waste stock movement happened,
// not to review timing — so it stays on the old, correctly date-scoped
// computeCompanyWideMaterialCostInRange(..., 'waste') call at both sites
// below.
//
// KNOWN LIMITATION: financeWorkReview is a running total, not an
// append-only ledger (see that model's own comment) — only the LATEST
// review's timestamp and ceiling are ever available. A Work reviewed more
// than once folds its entire CURRENT approved cost into whichever month
// the most recent review landed in, even if part of that ceiling was
// already approved in an earlier review/month. Accepted as a rare edge
// case against a straightforward, provably-correct fix for the far more
// common single-review case.
const computeReviewedCostsInRange = async (start, end) => {
    const reviews = await FinanceWorkReview.find({ lastReviewedAt: { $gte: start, $lte: end } }, 'workId');
    if (!reviews.length) return { materialCost: 0, contractorCost: 0, labourCost: 0, commissionCost: 0 };
    const works = await FinanceWork.find({ _id: { $in: reviews.map(r => r.workId) }, deleted: { $ne: true } });
    const profiles = await Promise.all(works.map(w => computeWorkProfit(w)));
    return {
        materialCost: round2(profiles.reduce((s, p) => s + p.materialCost, 0)),
        contractorCost: round2(profiles.reduce((s, p) => s + p.contractorCost, 0)),
        labourCost: round2(profiles.reduce((s, p) => s + p.labourCost, 0)),
        commissionCost: round2(profiles.reduce((s, p) => s + p.commissionCost, 0)),
    };
};

// Tier-0 Company Dashboard KPIs — every number here is meant to be a
// doorway into a Tier-1/Tier-2 page, not a granular breakdown of its own.
const getDashboardSummary = async (req, res) => {
    try {
        const today = new Date();
        const todayStart = startOfDay(today);
        const todayEnd = endOfDay(today);
        const monthKey = today.toISOString().slice(0, 7);
        const { start: monthStart, end: monthEnd } = monthBounds(monthKey);

        const billableProjects = await FinanceProject.find({ deleted: { $ne: true }, contractType: { $in: BILLABLE_CONTRACT_TYPES } }, '_id');
        const billableProjectIds = billableProjects.map(p => p._id);
        const activeProjects = await FinanceProject.find({ status: 'active', deleted: { $ne: true } }, '_id');
        const activeProjectIds = activeProjects.map(p => p._id);
        // Ongoing projects only — same "not completed" scope
        // computeCompanyWideExpenseToDate already uses, for the same reason:
        // a completed project's all-time numbers are already settled and
        // visible on its own Project Overview; this card is meant to answer
        // "how are the projects still running actually doing," not a
        // permanent lifetime total that only ever grows.
        const ongoingProjects = await FinanceProject.find({ deleted: { $ne: true }, status: { $ne: 'completed' } }, '_id');
        // Completed Works are done accruing "today's site activity" — a
        // finished project's historical revenue/cost still counts toward
        // Total Profit below, it just stops nudging the operational
        // "what's happening today" cards.
        const completedWorkIds = await FinanceWork.distinct('_id', { status: 'completed', deleted: { $ne: true } });

        const [
            bankAccounts, cashEntriesToDate, receivableSummaries, contractorRows, vendorRows,
            readyProjectIds, activeProjectsCount, activeWorksCount, labourersWorkingTodayIds, lowStockCount,
            todayContractorMeasurements, todayLabourMeasurements, monthRevenueAgg, recentActivities,
            ongoingProjectProfits, tdsPayableInfo,
        ] = await Promise.all([
            FinanceBankAccount.find({ deleted: { $ne: true } }),
            FinanceCashEntry.find({ deleted: { $ne: true }, date: { $lte: todayEnd } }),
            // Per-project (via the same summarizeProject Receivables uses),
            // not one flat company-wide aggregate — each project's own
            // balance/clientCreditBalance is clamped at 0 individually
            // before being summed below, so one project's direct-payment
            // credit can never quietly offset a different project's
            // genuinely-owed balance in this combined total.
            Promise.all(billableProjects.map(summarizeProject)),
            computeContractorAnalysisRows(),
            computeVendorAnalysisRows(),
            computeReadyProjectIds(billableProjectIds),
            FinanceProject.countDocuments({ status: 'active', deleted: { $ne: true } }),
            FinanceWork.countDocuments({ status: 'active', deleted: { $ne: true } }),
            FinanceLabourMeasurement.distinct('labourerId', { date: { $gte: todayStart, $lte: todayEnd }, deleted: { $ne: true }, workId: { $nin: completedWorkIds } }),
            computeLowStockMaterialCount(activeProjectIds),
            // Today's Measurement / Site Activity deliberately reads both
            // contractor and labour measurements with no engineerApproved
            // filter — completedAreaSqft itself updates unapproved (see
            // financeMeasurement.js/financeLabourMeasurement.js add
            // handlers), so the dashboard should show what was actually
            // logged on site today, not what's cleared for billing yet.
            // Excludes completed Works — see completedWorkIds above.
            FinanceMeasurement.find({ date: { $gte: todayStart, $lte: todayEnd }, deleted: { $ne: true }, workId: { $nin: completedWorkIds } }, 'workId areaCoveredSqft'),
            FinanceLabourMeasurement.find({ date: { $gte: todayStart, $lte: todayEnd }, deleted: { $ne: true }, workId: { $nin: completedWorkIds } }, 'workId areaCoveredSqft'),
            FinanceRunningBill.aggregate([
                { $match: { status: 'issued', billDate: { $gte: monthStart, $lte: monthEnd }, deleted: { $ne: true } } },
                { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
            ]),
            FinanceActivityLog.find().sort({ timestamp: -1 }).limit(15),
            // All-time Approved Profit + Material Waste Cost, ongoing
            // projects only (see ongoingProjects' own comment) — one pass
            // over computeProjectProfit gives both, so there's no separate
            // waste-only query needed.
            Promise.all(ongoingProjects.map(p => computeProjectProfit(p._id))),
            computeTdsPayable(),
        ]);

        const bankBalances = await Promise.all(bankAccounts.map(async (a) => {
            const activity = await getAccountActivity(a._id);
            const net = activity.reduce((sum, t) => sum + (t.direction === 'credit' ? t.amount : -t.amount), 0);
            return a.openingBalance + net;
        }));
        const cashInBank = bankBalances.reduce((a, b) => a + b, 0);
        const cashInHand = cashEntriesToDate.reduce((sum, e) => sum + (e.type === 'in' ? e.amount : -e.amount), 0);

        // Site Activity — today's measurements spliced by Work (not the flat,
        // mixed-with-every-event-type recentActivities feed), so every work
        // that had area logged today shows up as its own line, contractor and
        // labour entries combined into one sqft figure per work.
        const todaysContractorMeasurementSqft = todayContractorMeasurements.reduce((s, m) => s + m.areaCoveredSqft, 0);
        const todaysLabourMeasurementSqft = todayLabourMeasurements.reduce((s, m) => s + m.areaCoveredSqft, 0);
        const todaysMeasurementSqft = todaysContractorMeasurementSqft + todaysLabourMeasurementSqft;
        const sqftByWorkId = new Map();
        for (const m of [...todayContractorMeasurements, ...todayLabourMeasurements]) {
            const key = m.workId.toString();
            sqftByWorkId.set(key, (sqftByWorkId.get(key) || 0) + m.areaCoveredSqft);
        }
        const todaysWorkIds = [...sqftByWorkId.keys()];
        const [todaysWorksById, workDeductions, workLabourDeductions, workSupervisorDeductions] = await Promise.all([
            FinanceWork.find({ _id: { $in: todaysWorkIds } }, 'workType projectId estimatedAreaSqft completedAreaSqft')
                .populate('projectId', 'name'),
            // "Expectations vs reality" per work: estimatedAreaSqft (target)
            // vs completedAreaSqft (logged so far, unapproved-inclusive —
            // same "show it even before approval" rule as the KPI above).
            // Deducted total is a manually-entered figure (engineer/
            // supervisor typed in an amount against this specific work, see
            // financeContractorDeduction.js/financeLabourDeduction.js/
            // financeSupervisorDeduction.js workId field) — never
            // auto-computed from the approval gate.
            FinanceContractorDeduction.aggregate([
                { $match: { workId: { $in: todaysWorkIds.map(id => new mongoose.Types.ObjectId(id)) }, deleted: { $ne: true } } },
                { $group: { _id: '$workId', total: { $sum: '$amount' } } },
            ]),
            FinanceLabourDeduction.aggregate([
                { $match: { workId: { $in: todaysWorkIds.map(id => new mongoose.Types.ObjectId(id)) }, deleted: { $ne: true } } },
                { $group: { _id: '$workId', total: { $sum: '$amount' } } },
            ]),
            FinanceSupervisorDeduction.aggregate([
                { $match: { workId: { $in: todaysWorkIds.map(id => new mongoose.Types.ObjectId(id)) }, deleted: { $ne: true } } },
                { $group: { _id: '$workId', total: { $sum: '$amount' } } },
            ]),
        ]);
        const deductedByWorkId = new Map();
        for (const r of [...workDeductions, ...workLabourDeductions, ...workSupervisorDeductions]) {
            const key = r._id.toString();
            deductedByWorkId.set(key, (deductedByWorkId.get(key) || 0) + r.total);
        }
        // expectedPay reuses computeWorkExpectedPay (only its expectedPay
        // figure — deductedByWorkId above is already the same total, no
        // need to make it re-derive that part).
        const expectedPayByWorkId = new Map(
            (await Promise.all(todaysWorksById.map(async w => [w._id.toString(), (await computeWorkExpectedPay(w)).expectedPay])))
        );
        const todaysWorkActivity = todaysWorksById
            .map(w => {
                const deductedAmount = deductedByWorkId.get(w._id.toString()) || 0;
                const expectedPay = expectedPayByWorkId.get(w._id.toString()) || 0;
                return {
                    workId: w._id, workType: w.workType,
                    projectId: w.projectId?._id, projectName: w.projectId?.name || '—',
                    sqft: sqftByWorkId.get(w._id.toString()) || 0,
                    estimatedAreaSqft: w.estimatedAreaSqft, completedAreaSqft: w.completedAreaSqft,
                    deductedAmount, expectedPay, expectedPayNetOfDeductions: round2(expectedPay - deductedAmount),
                };
            })
            .sort((a, b) => b.sqft - a.sqft);

        // Unscoped by project status (company-wide, matching getDashboardTrends'
        // already-correct 6-month chart and thisMonthRevenue below) — a
        // completed project's costs this month are still real costs; scoping
        // this to activeProjectIds only (as it used to) silently dropped a
        // just-completed project's cost from the same month its revenue
        // still counted, overstating This Month Profit.
        //
        // Contractor/labour/commission/material cost here is keyed off
        // review date, not measurement date — see computeReviewedCostsInRange's
        // header comment for the full reasoning (the bug it fixes, and why
        // Material Waste stays on the old date-scoped call below). Expense
        // is unconditional (accrual — real cost incurred regardless of
        // payment timing). Salary is cash-basis — see
        // computeSalaryPaidInRange's own comment for why it's different
        // from expense here.
        const [monthMaterialWasteCost, reviewedCosts, monthExpenseAgg, approvedBreakdown, labourRows, commissionBreakdown, salaryPayableBreakdown, salaryPaidThisMonth, salaryExpectedThisMonth, expensePayableBreakdown, totalExpenseToDate, reimbursementRows, companyWidePaidExpenses, gstItcPosition, cashFlowThisMonth, cashFlowAllTime, totalRevenueAgg] = await Promise.all([
            computeCompanyWideMaterialCostInRange(monthStart, monthEnd, null, 'waste'),
            computeReviewedCostsInRange(monthStart, monthEnd),
            FinanceExpense.aggregate([
                { $match: { date: { $gte: monthStart, $lte: monthEnd }, deleted: { $ne: true } } },
                { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
            ]),
            computeDashboardApprovedBreakdown(),
            computeLabourAnalysisRows(),
            computeCompanyWideCommissionBreakdown(),
            computeCompanyWideSalaryPayable(monthKey),
            computeSalaryPaidInRange(monthStart, monthEnd),
            computeCompanyWideSalaryExpectedThisMonth(monthKey),
            computeCompanyWideExpensePayable(),
            computeCompanyWideExpenseToDate(),
            computeReimbursementRows(),
            computeCompanyWidePaidExpenses(),
            computeGstItcPosition(monthKey),
            // Real cash in vs real cash out — see computeCashFlow's own
            // comment for exactly what counts (every receipt/payment/
            // expense/manual entry, net of TDS/holding). This is a
            // genuinely different number from This Month Profit below
            // (accrual: revenue billed − costs incurred this month,
            // regardless of whether either side has actually been paid) —
            // both are kept, not one replacing the other, since they
            // answer different questions ("is the business fundamentally
            // profitable" vs "did money actually move that way this
            // month").
            computeCashFlow(monthStart, monthEnd),
            computeCashFlow(null, null),
            // All-time revenue, every project including completed (same
            // scope as the two cash-flow figures above, for a consistent
            // trio) — GST-exclusive, same convention as thisMonthRevenue
            // below (totalAmount is the subtotal; gstAmount is tracked
            // separately and never counted as revenue).
            FinanceRunningBill.aggregate([
                { $match: { status: 'issued', deleted: { $ne: true } } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } },
            ]),
        ]);
        const { materialCost: monthMaterialCost, contractorCost: monthContractorCost, labourCost: monthLabourCost, commissionCost: monthCommissionCost } = reviewedCosts;
        const thisMonthRevenue = monthRevenueAgg[0]?.total || 0;
        const thisMonthRevenueBillCount = monthRevenueAgg[0]?.count || 0;
        const thisMonthExpense = monthExpenseAgg[0]?.total || 0;
        const thisMonthExpenseCount = monthExpenseAgg[0]?.count || 0;
        // Every term This Month Profit actually subtracts — the Dashboard's
        // "why" sub-line for that card, same reasoning as the Payables
        // breakdowns below (a bare total with no visible factors is exactly
        // what prompted those).
        const thisMonthTotalCost = round2(monthMaterialCost + monthMaterialWasteCost + monthContractorCost + monthCommissionCost
            + thisMonthExpense + monthLabourCost + salaryPaidThisMonth);
        const thisMonthProfit = thisMonthRevenue - monthMaterialCost - monthMaterialWasteCost - monthContractorCost - monthCommissionCost
            - thisMonthExpense - monthLabourCost - salaryPaidThisMonth;
        // All-time Approved Profit and Material Waste Cost, ongoing projects
        // only — pairs with Profit - Unapproved below, which is already
        // all-time/cumulative rather than month-scoped, so these two read as
        // the two halves of the same picture instead of mismatched time
        // scopes (This Month Profit is monthly; this one is a running total).
        const totalApprovedProfitToDate = round2(ongoingProjectProfits.reduce((s, p) => s + p.profit, 0));
        const materialWasteCostToDate = round2(ongoingProjectProfits.reduce((s, p) => s + p.materialWasteCost, 0));
        // materialWasteCostToDate's own two constituents — see
        // computeProjectProfit's identical fields for what each one is.
        const materialWasteFromStockToDate = round2(ongoingProjectProfits.reduce((s, p) => s + p.materialWasteFromStock, 0));
        const materialWasteFromRejectionToDate = round2(ongoingProjectProfits.reduce((s, p) => s + p.materialWasteFromRejection, 0));
        // Company-wide Unapproved Profit, computed here (not just inline in
        // the response below) so totalProjectedProfit can reuse the exact
        // same number instead of a second, easy-to-drift copy of the formula.
        const unapprovedProfitTotal = round2(approvedBreakdown.unapprovedRevenueTotal
            - approvedBreakdown.unapprovedMaterialTotal
            - approvedBreakdown.unapprovedContractorTotal
            - approvedBreakdown.unapprovedLabourTotal
            - commissionBreakdown.unapprovedCommissionTotal);

        // BUG FIX: vendorPayables/contractorPayables/labourPayables used to
        // be a naive sum of every row's own balance/amountOwed — a vendor
        // (or contractor/labourer) who's been overpaid or over-returned-on
        // goes negative (they owe the company back, not the other way
        // round), and a naive sum lets that credit silently cancel out a
        // DIFFERENT party's real, separate debt in the same company-wide
        // total. Same reasoning already applied to Client Credit Balance,
        // ProjectDetail.jsx's own Payables row, and computeClientsSummaryRows
        // — clamp each row at 0 before summing the payable side, and surface
        // the credit side as its own total instead of netting it away.
        const sumPositive = (rows, key) => round2(rows.reduce((s, r) => s + Math.max(0, r[key]), 0));
        const sumNegative = (rows, key) => round2(rows.reduce((s, r) => s + Math.max(0, -r[key]), 0));

        res.json({
            success: true,
            data: {
                cashInBank, cashInHand,
                bankAccountsCount: bankAccounts.length,
                clientReceivables: round2(receivableSummaries.reduce((s, r) => s + r.balance, 0)),
                // Running credit clients have built up via direct payments
                // that outran what's been billed so far on their project —
                // not part of Receivables, just surfaced so it's not a
                // silent reason a project's Outstanding reads lower than
                // expected. See summarizeProject's own comment.
                clientCreditBalanceTotal: round2(receivableSummaries.reduce((s, r) => s + r.clientCreditBalance, 0)),
                vendorPayables: sumPositive(vendorRows, 'amountOwed'),
                // A vendor who's been overpaid or over-returned-on owes the
                // company back — never blended into vendorPayables above
                // (see this function's own comment on why).
                vendorCreditTotal: sumNegative(vendorRows, 'amountOwed'),
                // Every Payables KPI below pairs its headline balance with
                // the actual terms that produce it — a bare total gives no
                // sense of whether it's driven by fresh purchases/earnings or
                // by payments simply not having caught up yet.
                vendorPayablesBreakdown: {
                    purchases: round2(vendorRows.reduce((s, r) => s + r.purchases, 0)),
                    returns: round2(vendorRows.reduce((s, r) => s + r.returns, 0)),
                    payments: round2(vendorRows.reduce((s, r) => s + r.payments, 0)),
                },
                contractorPayables: sumPositive(contractorRows, 'balancePayable'),
                contractorCreditTotal: sumNegative(contractorRows, 'balancePayable'),
                contractorPayablesBreakdown: {
                    earnings: round2(contractorRows.reduce((s, r) => s + r.earnings, 0)),
                    advances: round2(contractorRows.reduce((s, r) => s + r.advances, 0)),
                    deductions: round2(contractorRows.reduce((s, r) => s + r.deductions, 0)),
                    directPaymentTotal: round2(contractorRows.reduce((s, r) => s + (r.directPaymentTotal || 0), 0)),
                    payments: round2(contractorRows.reduce((s, r) => s + r.payments, 0)),
                    tdsTotal: round2(contractorRows.reduce((s, r) => s + (r.tdsTotal || 0), 0)),
                    holdingTotal: round2(contractorRows.reduce((s, r) => s + (r.holdingTotal || 0), 0)),
                },
                labourPayables: sumPositive(labourRows, 'balancePayable'),
                labourCreditTotal: sumNegative(labourRows, 'balancePayable'),
                labourPayablesBreakdown: {
                    earnings: round2(labourRows.reduce((s, r) => s + r.earnings, 0)),
                    advances: round2(labourRows.reduce((s, r) => s + r.advances, 0)),
                    deductions: round2(labourRows.reduce((s, r) => s + r.deductions, 0)),
                    directPaymentTotal: round2(labourRows.reduce((s, r) => s + (r.directPaymentTotal || 0), 0)),
                    payments: round2(labourRows.reduce((s, r) => s + r.payments, 0)),
                    tdsTotal: round2(labourRows.reduce((s, r) => s + (r.tdsTotal || 0), 0)),
                    holdingTotal: round2(labourRows.reduce((s, r) => s + (r.holdingTotal || 0), 0)),
                },
                commissionPayables: commissionBreakdown.commissionPayable,
                commissionPayablesBreakdown: {
                    earnings: commissionBreakdown.earningsTotal,
                    payments: commissionBreakdown.paymentsTotal,
                },
                // "Payable" means the same thing everywhere on the
                // Dashboard: money actually overdue right now (closed
                // months, unpaid) — not the current, still-in-progress
                // month's accrual, which isn't due yet. This was briefly
                // changed to backlog + this-month combined (to stop Total
                // Payables and the Salaries Payable card showing two
                // different numbers), but that broke the OTHER, more
                // important consistency: every other Payables category
                // here (vendor/contractor/labour/commission) already means
                // "currently, actually owed," with no "not due yet"
                // component of its own — salary is the only one with a
                // calendar-month accrual concept at all. Folding that in
                // made Total Payables inconsistent with itself instead.
                // salaryExpectedThisMonth stays separate, clearly labeled
                // context ("what's accruing this month, not yet due"), not
                // blended into "payable" anywhere.
                salaryPayables: salaryPayableBreakdown.overduePayable,
                salaryExpectedThisMonth,
                salaryOverdue: salaryPayableBreakdown.overduePayable > 0.5,
                // Every expense recorded pending (or only partially settled)
                // at entry, across every project and every Payables/Payments
                // tab that can create one — see computeCompanyWideExpensePayable.
                expensePayables: expensePayableBreakdown.payable,
                expensePayablesCount: expensePayableBreakdown.count,
                oldestPendingExpenseDate: expensePayableBreakdown.oldestPendingDate,
                // Employee/labourer reimbursement claims still owed — the
                // subset of expensePayables above that's specifically "someone
                // paid this out of pocket and is waiting to be paid back."
                // See computeReimbursementRows' own comment.
                reimbursementPayables: sumPositive(reimbursementRows, 'balancePayable'),
                reimbursementCreditTotal: sumNegative(reimbursementRows, 'balancePayable'),
                reimbursementPayablesBreakdown: {
                    owed: round2(reimbursementRows.reduce((s, r) => s + r.owed, 0)),
                    paid: round2(reimbursementRows.reduce((s, r) => s + r.paid, 0)),
                },
                reimbursementPayablesCount: reimbursementRows.filter(r => r.balancePayable > 0.5).length,
                // TDS withheld from every contractor/vendor/salary/labour/
                // commission/labour-provider payment ever made, minus what's
                // actually been deposited with the tax department — a real
                // liability the company owes, same shape as every other
                // Payables figure here. See computeTdsPayable's own comment.
                tdsPayable: tdsPayableInfo.payable,
                tdsWithheldToDate: tdsPayableInfo.totalWithheld,
                tdsDepositedToDate: tdsPayableInfo.totalDeposited,
                // Input Tax Credit available to claim as of this month —
                // the CA's actual filed figure (financeGstFiling) once
                // entered, the system's own computed estimate until then.
                // See computeGstItcPosition's own comment.
                gstClaimable: gstItcPosition.itcCarriedForward,
                gstPayable: gstItcPosition.netGstPayable,
                gstIsFiled: gstItcPosition.isFiled,
                // All-time FinanceExpense total, ongoing projects + general
                // overhead only (completed projects excluded) — see
                // computeCompanyWideExpenseToDate's own comment.
                totalExpenseToDate,
                // Literally every expense — everything the company has
                // actually spent, company-wide, ongoing projects + untagged
                // only (completed projects excluded — same reasoning/scoping
                // as totalExpenseToDate above and totalApprovedProfitToDate
                // below: a completed project's spend is already settled
                // history, not part of "what's currently going out the
                // door"). Material counts in full regardless of review (see
                // computeProjectMaterialCostSplit's header comment — used
                // material can't be un-used); every payment category counts
                // actual cash disbursed, not merely earned (see
                // computeCompanyWidePaidExpenses' own comment for the full
                // breakdown and why Vendor Payments/manual entries are
                // handled the way they are).
                totalExpensesAllTime: round2(
                    ongoingProjectProfits.reduce((s, p) => s + p.totalMaterialCost, 0)
                    + materialWasteCostToDate
                    + companyWidePaidExpenses.contractorPaid
                    + companyWidePaidExpenses.labourPaid
                    + companyWidePaidExpenses.commissionPaid
                    + companyWidePaidExpenses.salaryPaid
                    + companyWidePaidExpenses.labourProviderPaid
                    + companyWidePaidExpenses.supervisorIncentivesPaid
                    + companyWidePaidExpenses.vendorPaidNonMaterial
                    + companyWidePaidExpenses.manualOut
                    + totalExpenseToDate
                ),
                runningBillsReady: readyProjectIds.length,
                activeProjects: activeProjectsCount,
                activeWorks: activeWorksCount,
                labourWorkingToday: labourersWorkingTodayIds.length,
                materialLowAlerts: lowStockCount,
                todaysMeasurementSqft, todaysContractorMeasurementSqft, todaysLabourMeasurementSqft, todaysWorkActivity,
                approvedByWorkType: approvedBreakdown.byWorkType,
                approvedContractorTotal: approvedBreakdown.contractorTotal, approvedLabourTotal: approvedBreakdown.labourTotal,
                approvedContractorAreaSqft: approvedBreakdown.approvedContractorAreaSqft, approvedLabourAreaSqft: approvedBreakdown.approvedLabourAreaSqft,
                unapprovedByWorkType: approvedBreakdown.unapprovedByWorkType,
                unapprovedContractorTotal: approvedBreakdown.unapprovedContractorTotal, unapprovedLabourTotal: approvedBreakdown.unapprovedLabourTotal,
                // Flat, informational totals — a direct payment (advance,
                // not tied to specific sqft) no longer splits by Unapproved/
                // Approved — see getWorkerPayoutTotal's comment.
                directPaymentContractorTotal: approvedBreakdown.directPaymentContractorTotal,
                directPaymentLabourTotal: approvedBreakdown.directPaymentLabourTotal,
                unapprovedCommissionTotal: commissionBreakdown.unapprovedCommissionTotal,
                unapprovedRevenueTotal: approvedBreakdown.unapprovedRevenueTotal,
                unapprovedMaterialTotal: approvedBreakdown.unapprovedMaterialTotal,
                unapprovedProfitTotal,
                thisMonthRevenue, thisMonthProfit, thisMonthExpense,
                thisMonthRevenueBillCount, thisMonthExpenseCount, thisMonthTotalCost,
                // Cash actually in vs actually out — see computeCashFlow's
                // own comment. Deliberately alongside thisMonthProfit
                // above, not replacing it: that figure is accrual (revenue
                // billed − costs incurred this month, paid or not), this
                // one is real money movement, regardless of which month
                // the work/purchase it settles actually happened in.
                cashFlowThisMonth: round2(cashFlowThisMonth.totals.net),
                cashInThisMonth: round2(cashFlowThisMonth.totals.in),
                cashOutThisMonth: round2(cashFlowThisMonth.totals.out),
                // GST payable + Tax paid's own slice of cashOutThisMonth
                // above — broken out so the card can say exactly how much
                // of "out" was tax/GST rather than leaving it buried in one
                // lump sum.
                govtDuesThisMonth: round2(cashFlowThisMonth.byCategory.find(c => c.category === 'govtDues')?.amount || 0),
                // Cash-paid expenses this month, broken out by category
                // (Travel, Fuel, Rent, ...) instead of one lump sum —
                // project-related or not, see computeCashFlow's own
                // header comment (no project filter anywhere in it).
                expenseByCategoryThisMonth: cashFlowThisMonth.expenseByCategory,
                // Same cash-basis concept, all-time — "how much real profit
                // has actually landed in the company's hands to date,"
                // distinct from totalApprovedProfitToDate below (accrual,
                // ongoing projects only).
                totalProfitCollectedTillDate: round2(cashFlowAllTime.totals.net),
                totalCashInTillDate: round2(cashFlowAllTime.totals.in),
                totalCashOutTillDate: round2(cashFlowAllTime.totals.out),
                govtDuesTillDate: round2(cashFlowAllTime.byCategory.find(c => c.category === 'govtDues')?.amount || 0),
                expenseByCategoryTillDate: cashFlowAllTime.expenseByCategory,
                // All-time revenue, every project including completed —
                // same scope as the two cash-flow figures above.
                totalRevenueToDate: round2(totalRevenueAgg[0]?.total || 0),
                // Ongoing projects only (see ongoingProjects' own comment) —
                // pairs with unapprovedProfitTotal above (also all-time, not
                // month-scoped) rather than mismatching against This Month
                // Profit's monthly window.
                totalApprovedProfitToDate, materialWasteCostToDate,
                // The "why" behind materialWasteCostToDate — see
                // FinanceHome.jsx's Material Wastage Loss card.
                materialWasteBreakdown: { fromStock: materialWasteFromStockToDate, fromRejection: materialWasteFromRejectionToDate },
                // Company-wide Holding (retention) still sitting with the
                // company, across every Contractor/Labour payment ever
                // made — not scoped to ongoing projects only, since a
                // holding on a completed-but-not-yet-released project is
                // still a real, current liability. See
                // computeContractorBalance/computeLabourBalance's own
                // holdingTotal comment for what this is and isn't (unlike
                // TDS, it never discharges what's owed).
                totalHeld: round2(
                    contractorRows.reduce((s, r) => s + (r.holdingTotal || 0), 0)
                    + labourRows.reduce((s, r) => s + (r.holdingTotal || 0), 0)
                ),
                holdingBreakdown: {
                    contractor: round2(contractorRows.reduce((s, r) => s + (r.holdingTotal || 0), 0)),
                    labour: round2(labourRows.reduce((s, r) => s + (r.holdingTotal || 0), 0)),
                },
                // What Profit becomes once everything currently logged and
                // still-unreviewed actually clears review — not a separate
                // number to reconcile by hand, so it's computed once here
                // rather than asking the frontend to add two cards together.
                totalProjectedProfit: round2(totalApprovedProfitToDate + unapprovedProfitTotal),
                recentActivities,
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing dashboard summary' });
    }
};

// Tier-0 charts: Revenue-vs-Cost by month (company-wide, last N months) and
// a 30-day daily cash flow series (reuses computeCashFlow directly).
const getDashboardTrends = async (req, res) => {
    try {
        const months = Math.min(24, Math.max(1, parseInt(req.query.months, 10) || 6));
        const now = new Date();
        const monthKeys = [];
        // Build "YYYY-MM" from the local calendar fields directly — piping a
        // local-midnight Date through .toISOString() would subtract this
        // server's UTC offset (IST, +5:30) and roll the 1st back into the
        // previous month's last day in UTC, silently shifting every month
        // key here one month early (this dropped the current month off the
        // end of the chart entirely).
        for (let i = months - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }

        // Same cost terms and same review-date basis on contractor/labour/
        // commission/material that This Month Profit uses
        // (computeReviewedCostsInRange, see its own header comment) — both
        // are the exact same formula, just repeated per month instead of
        // once for the current month, so a bar means what the KPI cards mean.
        const revenueVsCost = await Promise.all(monthKeys.map(async (monthKey) => {
            const { start, end } = monthBounds(monthKey);
            const [revenueAgg, materialWasteCost, reviewedCosts, expenseAgg, salaryCost] = await Promise.all([
                FinanceRunningBill.aggregate([
                    { $match: { status: 'issued', billDate: { $gte: start, $lte: end }, deleted: { $ne: true } } },
                    { $group: { _id: null, total: { $sum: '$totalAmount' } } },
                ]),
                computeCompanyWideMaterialCostInRange(start, end, null, 'waste'),
                computeReviewedCostsInRange(start, end),
                FinanceExpense.aggregate([
                    { $match: { date: { $gte: start, $lte: end }, deleted: { $ne: true } } },
                    { $group: { _id: null, total: { $sum: '$amount' } } },
                ]),
                computeSalaryPaidInRange(start, end),
            ]);
            const revenue = revenueAgg[0]?.total || 0;
            const cost = reviewedCosts.materialCost + materialWasteCost + reviewedCosts.contractorCost + reviewedCosts.commissionCost
                + (expenseAgg[0]?.total || 0) + reviewedCosts.labourCost + salaryCost;
            return { month: monthKey, revenue, cost };
        }));

        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - 29);
        const cashFlow = await computeCashFlow(from.toISOString().slice(0, 10), to.toISOString().slice(0, 10), 'day');

        res.json({ success: true, data: { revenueVsCost, cashFlowSeries: cashFlow.series } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing dashboard trends' });
    }
};

// Shared by getClientsSummary and Reconciliation's "chase receivables"
// checklist row — per-client billed/received/outstanding (grouped version
// of financeReceivable's logic) plus receivables aging, company-wide.
const computeClientsSummaryRows = async () => {
    const clients = await FinanceClient.find({ deleted: { $ne: true } });
    // Every client shows up here, zeros and all — a client with no
    // billable projects yet has legitimately zero billed/received, same
    // as how getContractorsSummary/getVendorAnalysis/getInventorySummary
    // show every record regardless of activity rather than hiding it.
    const rows = await Promise.all(clients.map(async (c) => {
        const projects = await FinanceProject.find({ clientId: c._id, deleted: { $ne: true }, contractType: { $in: BILLABLE_CONTRACT_TYPES } }, '_id');
        const projectIds = projects.map(p => p._id);
        const [bills, receipts, summaries] = projectIds.length ? await Promise.all([
            FinanceRunningBill.find({ projectId: { $in: projectIds }, status: 'issued', deleted: { $ne: true } }).sort({ billDate: 1 }),
            FinanceReceipt.find({ projectId: { $in: projectIds }, deleted: { $ne: true } }),
            Promise.all(projects.map(summarizeProject)),
        ]) : [[], [], []];
        const totalBilled = bills.reduce((s, b) => s + b.totalAmount + (b.gstAmount || 0), 0);
        // Revenue, unlike totalBilled above, excludes GST — GST is
        // collected on the client's behalf and passed through to the tax
        // authority, never company income, so it's excluded here the same
        // way computeProjectProfit's own `revenue` (FinanceRunningBill's
        // totalAmount alone, no gstAmount) already is everywhere else in
        // Finance. ClientsPage.jsx's "Top Clients by Revenue" chart reads
        // this, not totalBilled — see that component's own comment for the
        // bug this fixes (GST inflating what was labelled Revenue).
        const revenue = bills.reduce((s, b) => s + b.totalAmount, 0);
        const totalReceived = receipts.reduce((s, r) => s + r.amount, 0);
        // outstanding/clientCreditBalance come from summarizeProject
        // (per-project, each already clamped at 0) summed here — not
        // totalBilled - totalReceived directly, which ignores client
        // direct payment credits entirely and can't reflect a running
        // credit balance either. totalBilled/totalReceived themselves stay
        // raw (pre-direct-payment) for the aging breakdown below — aging
        // applies the same directPaymentCredits total itself, via
        // computeAging's own directPaymentCredits param.
        const outstanding = round2(summaries.reduce((s, r) => s + r.balance, 0));
        const clientCreditBalance = round2(summaries.reduce((s, r) => s + r.clientCreditBalance, 0));
        const directPaymentCreditsTotal = round2(summaries.reduce((s, r) => s + r.directPaymentCredits, 0));
        return {
            clientId: c._id, clientName: c.name, totalBilled, revenue, totalReceived,
            outstanding, clientCreditBalance, aging: computeAging(bills, receipts, directPaymentCreditsTotal),
        };
    }));

    const data = rows.sort((a, b) => b.totalBilled - a.totalBilled);
    const aging = data.reduce((acc, r) => {
        for (const k of AGE_BUCKET_KEYS) acc[k] += r.aging[k];
        return acc;
    }, { '0-30': 0, '30-60': 0, '60-90': 0, '90+': 0 });

    return { clients: data, aging };
};

// New Tier-1 endpoint for Clients — per-client billed/received/outstanding
// plus receivables aging.
const getClientsSummary = async (req, res) => {
    try {
        const data = await computeClientsSummaryRows();
        res.json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing clients summary' });
    }
};

// New Tier-2 endpoint for one client — profit rollup, per-project
// billed/received/outstanding, full receipt history, and this client's own
// aging breakdown.
const getClientDetail = async (req, res) => {
    try {
        const { clientId } = req.query;
        if (!clientId) return res.status(400).json({ success: false, message: 'clientId is required' });
        const client = await FinanceClient.findOne({ _id: clientId, deleted: { $ne: true } });
        if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

        const projects = await FinanceProject.find({ clientId, deleted: { $ne: true } });
        const perProject = (await Promise.all(projects.map(p => computeProjectProfit(p._id)))).filter(Boolean);
        const totals = perProject.reduce((acc, p) => ({
            revenue: acc.revenue + p.revenue, profit: acc.profit + p.profit,
        }), { revenue: 0, profit: 0 });
        const marginPercent = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;

        const billableProjects = projects.filter(p => BILLABLE_CONTRACT_TYPES.includes(p.contractType));
        const projectIds = billableProjects.map(p => p._id);
        const [bills, receipts, summaries] = await Promise.all([
            FinanceRunningBill.find({ projectId: { $in: projectIds }, status: 'issued', deleted: { $ne: true } }).sort({ billDate: 1 }),
            FinanceReceipt.find({ projectId: { $in: projectIds }, deleted: { $ne: true } }).sort({ receiptDate: -1 }),
            Promise.all(billableProjects.map(summarizeProject)),
        ]);
        const totalBilled = bills.reduce((s, b) => s + b.totalAmount + (b.gstAmount || 0), 0);
        const totalReceived = receipts.reduce((s, r) => s + r.amount, 0);
        const summaryByProjectId = new Map(summaries.map(s => [s.projectId.toString(), s]));
        // Client-wide outstanding/credit summed from each project's own
        // already-clamped balance/clientCreditBalance — same reasoning as
        // getClientsSummary and the Dashboard's clientReceivables above.
        const outstanding = round2(summaries.reduce((s, r) => s + r.balance, 0));
        const clientCreditBalance = round2(summaries.reduce((s, r) => s + r.clientCreditBalance, 0));
        const directPaymentCreditsTotal = round2(summaries.reduce((s, r) => s + r.directPaymentCredits, 0));

        const projectsSummary = billableProjects.map(p => {
            const pBills = bills.filter(b => b.projectId.toString() === p._id.toString());
            const pReceipts = receipts.filter(r => r.projectId.toString() === p._id.toString());
            const billed = pBills.reduce((s, b) => s + b.totalAmount + (b.gstAmount || 0), 0);
            const received = pReceipts.reduce((s, r) => s + r.amount, 0);
            const summary = summaryByProjectId.get(p._id.toString());
            return {
                projectId: p._id, projectName: p.name, billed, received,
                outstanding: summary?.balance ?? Math.max(0, billed - received),
                clientCreditBalance: summary?.clientCreditBalance ?? 0,
            };
        });

        res.json({
            success: true,
            data: {
                clientId: client._id, clientName: client.name,
                totalBilled, totalReceived, outstanding, clientCreditBalance, marginPercent,
                // The "why" behind the KPI cards above — Total Billed's own
                // bill count, and the revenue/profit pair Margin % is
                // actually computed from (same breakdown-sub-line reasoning
                // as the Dashboard's Payables cards).
                billCount: bills.length,
                totalProfit: round2(totals.profit),
                projects: projectsSummary, receipts, aging: computeAging(bills, receipts, directPaymentCreditsTotal),
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing client detail' });
    }
};

// One entry per calendar month with any GST-relevant activity, from the
// earliest such month through `throughMonth` inclusive. Grouped aggregates,
// not a query per month, so this stays cheap even years into the business.
const computeMonthlyGstTotals = async (throughMonth) => {
    const { end: throughEnd } = monthBounds(throughMonth);
    const byMonth = (dateField) => ({ $group: { _id: { $dateToString: { format: '%Y-%m', date: `$${dateField}` } }, gst: { $sum: { $ifNull: ['$gstAmount', 0] } } } });
    const [billTotals, purchaseTotals, returnTotals, expenseTotals] = await Promise.all([
        FinanceRunningBill.aggregate([{ $match: { billDate: { $lte: throughEnd }, status: 'issued', deleted: { $ne: true } } }, byMonth('billDate')]),
        FinancePurchase.aggregate([{ $match: { date: { $lte: throughEnd }, transactionType: 'purchase', deleted: { $ne: true } } }, byMonth('date')]),
        FinancePurchase.aggregate([{ $match: { date: { $lte: throughEnd }, transactionType: 'return', deleted: { $ne: true } } }, byMonth('date')]),
        FinanceExpense.aggregate([{ $match: { date: { $lte: throughEnd }, deleted: { $ne: true } } }, byMonth('date')]),
    ]);
    const monthMap = new Map();
    const addTo = (key, field, amount) => {
        if (!monthMap.has(key)) monthMap.set(key, { monthKey: key, outputGst: 0, inputGst: 0 });
        monthMap.get(key)[field] += amount;
    };
    billTotals.forEach(r => addTo(r._id, 'outputGst', r.gst));
    purchaseTotals.forEach(r => addTo(r._id, 'inputGst', r.gst));
    returnTotals.forEach(r => addTo(r._id, 'inputGst', -r.gst));
    expenseTotals.forEach(r => addTo(r._id, 'inputGst', r.gst));
    return [...monthMap.values()].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
};

// Walks every month through `month`, clamping credit at zero exactly like
// GSTN's own Electronic Credit Ledger: a payable month drains the balance
// to zero and settles (paid in cash), it does not carry forward as debt —
// which is why this has to be a sequential walk rather than one lifetime
// sum of (input - output).
//
// Any month with a real FinanceGstFiling (the CA's actual filed numbers,
// entered by hand once known) uses THAT month's gstPayable/gstClaimable
// directly instead of the computed estimate, and the walk carries the
// filed gstClaimable forward as the next month's opening credit — so once
// a month is filed, every later month's own "brought forward" reflects
// the real number, not what purchases/sales/expenses alone would derive
// (which has no way to know about blocked credit, reversals, or rounding
// a real GSTR-3B applies).
const computeGstItcPosition = async (month) => {
    const monthlyTotals = await computeMonthlyGstTotals(month);
    const filings = await FinanceGstFiling.find({ deleted: { $ne: true }, month: { $lte: month } });
    const filingByMonth = new Map(filings.map(f => [f.month, f]));

    // Union of every month with computed activity AND every filed month —
    // a NIL/adjustment-only month can be filed with no purchase/sale/
    // expense activity of its own, so it wouldn't otherwise appear in
    // monthlyTotals at all and its filing would be silently skipped.
    const totalsByMonth = new Map(monthlyTotals.map(m => [m.monthKey, m]));
    const monthKeys = [...new Set([...totalsByMonth.keys(), ...filingByMonth.keys()])].sort();

    let openingCredit = 0, result = null;
    for (const monthKey of monthKeys) {
        const filing = filingByMonth.get(monthKey);
        const totals = totalsByMonth.get(monthKey) || { outputGst: 0, inputGst: 0 };
        const available = openingCredit + totals.inputGst;
        const payable = filing ? filing.gstPayable : Math.max(0, totals.outputGst - available);
        const closingCredit = filing ? filing.gstClaimable : Math.max(0, available - totals.outputGst);
        if (monthKey === month) {
            result = {
                itcBroughtForward: round2(openingCredit), availableCredit: round2(available),
                netGstPayable: round2(payable), itcCarriedForward: round2(closingCredit),
                isFiled: !!filing, filedDate: filing?.filedDate || null, taxPaid: filing?.taxPaid || 0,
                filingId: filing?._id || null,
            };
        }
        openingCredit = closingCredit;
    }
    if (!result) {
        result = {
            itcBroughtForward: round2(openingCredit), availableCredit: round2(openingCredit),
            netGstPayable: 0, itcCarriedForward: round2(openingCredit),
            isFiled: false, filedDate: null, taxPaid: 0, filingId: null,
        };
    }
    return result;
};

/*
 * Shared by getCaMonthlyPackage (JSON) and downloadCaMonthlyPackage (PDF)
 * so the numbers on screen and in the PDF can never drift apart.
 *
 * INTERPRETATION FLAG: Output GST is scoped to status: 'issued' bills only
 * (not drafts) — consistent with every other "Revenue" figure in this
 * Reports module (Project/Client/Work Profit, Sales Summary below), all
 * of which treat an issued bill as the point money is actually owed.
 * Input GST has no such filter since the spec is explicit
 * (transactionType: 'purchase' only) and purchases have no draft state.
 */
// Fetches this month's bank accounts' opening/credits/debits/closing +
// running-balance transaction list — split out of computeCaMonthlyPackage
// only so it can be handed to Promise.all as one unit alongside every
// other independent fetch below (it has its own internal two-step
// dependency: bankPositions needs bankAccounts resolved first, so it can't
// sit directly inside that same top-level array).
const fetchBankPositions = async (start, end) => {
    const bankAccounts = await FinanceBankAccount.find({ deleted: { $ne: true } });
    return Promise.all(bankAccounts.map(async (a) => {
        const activity = await getAccountActivity(a._id);
        const netBefore = activity.filter(t => new Date(t.date) < start).reduce((sum, t) => sum + (t.direction === 'credit' ? t.amount : -t.amount), 0);
        const duringMonth = activity.filter(t => new Date(t.date) >= start && new Date(t.date) <= end)
            .sort((x, y) => new Date(x.date) - new Date(y.date));
        const creditTotal = duringMonth.filter(t => t.direction === 'credit').reduce((sum, t) => sum + t.amount, 0);
        const debitTotal = duringMonth.filter(t => t.direction === 'debit').reduce((sum, t) => sum + t.amount, 0);
        const openingBalance = a.openingBalance + netBefore;
        let running = openingBalance;
        const transactions = duringMonth.map(t => {
            running += t.direction === 'credit' ? t.amount : -t.amount;
            return { date: t.date, description: t.description, direction: t.direction, amount: t.amount, runningBalance: round2(running) };
        });
        const closingBalance = openingBalance + creditTotal - debitTotal;
        return {
            accountId: a._id, accountName: a.accountName,
            bankName: a.bankName, accountNumber: a.accountNumber || '—',
            openingBalance, creditTotal, debitTotal, closingBalance, transactions,
        };
    }));
};

const computeCaMonthlyPackage = async (month) => {
    const { start, end } = monthBounds(month);

    // Every fetch below is independent of every other — none needs
    // another's result, they only get combined once all of them have
    // arrived. This used to be ~10 sequential awaits, one full network
    // round trip to MongoDB Atlas after another, none of which actually
    // depended on the one before it — the dominant cost in generating
    // this package. Now they all run concurrently instead, bounding the
    // total wait to roughly the single slowest one instead of the sum of
    // all of them.
    const [
        issuedBills,
        purchases,
        [contractorPayments, vendorPayments, salaryPayments, labourPayments, commissionPayments, labourProviderPayments],
        tdsDepositsRaw,
        expenses,
        bankPositions,
        cashBefore,
        cashDuring,
        itcPosition,
        company,
        hsnAgg,
        ownerInvestmentEntries,
        vendorAnalysisRows,
        contractorAnalysisRows,
        labourAnalysisRows,
    ] = await Promise.all([
        // Line items alongside every total below — a CA reconciling this
        // against the real bank statement, GSTR filings, and a 26Q TDS
        // return can't do it from one summary number; they need the actual
        // bills, purchases, expenses, and transactions that number is made
        // of. Client isn't a direct ref on FinanceRunningBill — reached
        // through projectId.clientId instead, so the CA can match a bill's
        // GSTIN against the actual GSTR-1 filing without a separate lookup.
        FinanceRunningBill.find({ billDate: { $gte: start, $lte: end }, status: 'issued', deleted: { $ne: true } })
            .populate({ path: 'projectId', select: 'name clientId', populate: { path: 'clientId', select: 'name gstNumber' } })
            .sort({ billDate: 1 }),
        // bankName/accountNumber so a purchase row can show whose account
        // this vendor eventually gets paid into (same reasoning as the
        // TDS Withheld table's Bank Details column) — a purchase itself
        // never moves money (see Purchase Summary's own accrual-basis
        // note above it), but the CA still needs to identify which vendor
        // account to expect a matching payment against later.
        FinancePurchase.find({ date: { $gte: start, $lte: end }, deleted: { $ne: true } })
            .populate('vendorId', 'name gstNumber bankName accountNumber').populate('materialId', 'name').sort({ date: 1 }),
        // All six payment types that carry a tdsAmount/tdsSectionId pair —
        // this used to only include Contractor/Vendor/Commission, silently
        // missing any TDS withheld on Labour/Salary/LabourProvider payments
        // from this package's Total TDS (the figure meant for actual
        // CA/tax filing). Each populated with its own party field so
        // tds.payments below can name the actual deductee, not just a
        // section total — a 26Q filing is deductee-wise, not just
        // section-wise.
        Promise.all([
            // Party populate now also carries that party's own receiving
            // bank details (bankName/accountNumber — required fields on
            // every one of these party models, "who actually gets paid")
            // so the TDS Withheld table below can show whose account the
            // money actually landed in, not just which of our own accounts
            // it left from (obvious — there's only ever a handful of
            // those, already covered by the Bank & Cash Movement section).
            FinanceContractorPayment.find({ date: { $gte: start, $lte: end }, deleted: { $ne: true } }).populate('vendorId', 'name bankName accountNumber').populate('tdsSectionId', 'name code'),
            FinanceVendorPayment.find({ date: { $gte: start, $lte: end }, deleted: { $ne: true } }).populate('vendorId', 'name bankName accountNumber').populate('tdsSectionId', 'name code'),
            FinanceSalaryPayment.find({ date: { $gte: start, $lte: end }, deleted: { $ne: true } }).populate('employeeId', 'name bankName accountNumber').populate('tdsSectionId', 'name code'),
            FinanceLabourPayment.find({ date: { $gte: start, $lte: end }, deleted: { $ne: true } }).populate('labourerId', 'name bankName accountNumber').populate('tdsSectionId', 'name code'),
            FinanceCommissionPayment.find({ date: { $gte: start, $lte: end }, deleted: { $ne: true } }).populate('referralId', 'name bankName accountNumber').populate('tdsSectionId', 'name code'),
            FinanceLabourProviderPayment.find({ date: { $gte: start, $lte: end }, deleted: { $ne: true } }).populate('labourProviderId', 'name bankName accountNumber').populate('tdsSectionId', 'name code'),
        ]),
        // The other half of TDS reconciliation — what's actually been
        // deposited with the tax department this month, not just withheld.
        FinanceTdsDeposit.find({ date: { $gte: start, $lte: end }, deleted: { $ne: true } })
            .populate('tdsSectionId', 'name code').populate('bankAccountId', 'accountName').sort({ date: 1 }),
        FinanceExpense.find({ date: { $gte: start, $lte: end }, deleted: { $ne: true } }).populate('bankAccountId', 'accountName bankName accountNumber').sort({ date: 1 }),
        // Opening/credits/debits/closing per account, plus the actual
        // transaction list with a running balance — a CA reconciling
        // against the real bank statement needs to match it line by line,
        // not just confirm a single ending number with no way to verify
        // it. Same running-balance walk getBankStatement already does for
        // the unscoped, all-time statement, just windowed to this month
        // and starting from this month's own opening balance instead of
        // the account's lifetime opening balance.
        fetchBankPositions(start, end),
        FinanceCashEntry.find({ deleted: { $ne: true }, date: { $lt: start } }),
        FinanceCashEntry.find({ deleted: { $ne: true }, date: { $gte: start, $lte: end } }).sort({ date: 1 }),
        computeGstItcPosition(month),
        getCompanyForPdf(),
        // Purchases: a real per-material grouping, since hsnCode does
        // exist on financeMaterial — existing/un-backfilled materials
        // group under '—' rather than a fabricated code. Scoped to
        // transactionType: 'purchase' only — matches "purchase line
        // items" specifically; returns already net out of the top-level
        // purchaseGst/totalReturned figures computed below.
        FinancePurchase.aggregate([
            { $match: { date: { $gte: start, $lte: end }, transactionType: 'purchase', deleted: { $ne: true } } },
            { $lookup: { from: 'financematerials', localField: 'materialId', foreignField: '_id', as: 'material' } },
            { $unwind: { path: '$material', preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: { $ifNull: ['$material.hsnCode', ''] },
                    quantity: { $sum: '$quantity' },
                    taxableValue: { $sum: '$totalAmount' },
                    gstAmount: { $sum: { $ifNull: ['$gstAmount', 0] } },
                },
            },
            { $sort: { _id: 1 } },
        ]),
        // Owner capital put into the business — a CA needs this called out
        // separately from revenue since it isn't income. Fetched through
        // end of this month (not just within it) so allTime below can
        // report the cumulative figure without a second query; the
        // this-month slice is filtered out of the same result client-side.
        FinanceBankEntry.find({ source: 'ownerInvestment', type: 'in', deleted: { $ne: true }, date: { $lte: end } })
            .populate('bankAccountId', 'accountName').sort({ date: 1 }),
        // Company-wide, all-time — Net Purchases above (and, for
        // Contractor/Labour, TDS Withheld) is accrual: an invoice/measured
        // work counts the moment it's dated, whether or not it's actually
        // been paid yet. These give the CA the other half of that picture
        // — what's still genuinely owed, right now — using the exact same
        // balance formula the Payables dashboard and single-party ledgers
        // already use (see that formula's own "one canonical version, not
        // duplicated" comment on computeVendorBalance/computeContractorBalance/
        // computeLabourBalance) rather than a second, divergent one here.
        // Not month-scoped — these functions have no date parameter at
        // all, so this is a live snapshot as of whenever the PDF is
        // generated, same convention as Cumulative TDS Payable below.
        computeVendorAnalysisRows(),
        computeContractorAnalysisRows(),
        computeLabourAnalysisRows(),
    ]);

    const outputGst = issuedBills.reduce((sum, b) => sum + (b.gstAmount || 0), 0);
    const salesTotal = issuedBills.reduce((sum, b) => sum + b.totalAmount, 0);
    const billRows = issuedBills.map(b => ({
        billNumber: b.billNumber, billDate: b.billDate, projectName: b.projectId?.name || '—',
        clientName: b.projectId?.clientId?.name || '—', clientGstin: b.projectId?.clientId?.gstNumber || '—',
        subtotal: b.totalAmount, gstAmount: b.gstAmount || 0, total: b.totalAmount + (b.gstAmount || 0),
    }));

    const purchaseRows = purchases.filter(p => p.transactionType === 'purchase');
    const returnRows = purchases.filter(p => p.transactionType === 'return');
    // Net of returns — a return carries its own gstAmount (the GST on the
    // material being sent back), and that credit is no longer claimable
    // once the material's returned, same as totalPurchased/totalReturned
    // already net against each other for the non-GST amount. Missing this
    // silently over-claimed Input GST on every returned purchase.
    const purchaseGst = purchaseRows.reduce((sum, p) => sum + (p.gstAmount || 0), 0)
        - returnRows.reduce((sum, p) => sum + (p.gstAmount || 0), 0);
    const totalPurchased = purchaseRows.reduce((sum, p) => sum + p.totalAmount, 0);
    const totalReturned = returnRows.reduce((sum, p) => sum + p.totalAmount, 0);
    const purchaseLineItems = purchases.map(p => ({
        date: p.date, vendorName: p.vendorId?.name || '—', vendorGstin: p.vendorId?.gstNumber || '—', materialName: p.materialId?.name || '—',
        vendorBankDetails: p.vendorId?.bankName ? `${p.vendorId.bankName}\nA/C ${p.vendorId.accountNumber}` : '—',
        transactionType: p.transactionType, quantity: p.quantity, ratePerUnit: p.ratePerUnit,
        totalAmount: p.totalAmount, gstAmount: p.gstAmount || 0, referenceNumber: p.referenceNumber || '',
    }));

    // A CA reconciling any of these tables against the real bank statement
    // needs to know which account (or Cash) the money actually moved
    // through — same account name + number shown on the Bank & Cash
    // Movement section below, so a row here can be matched straight to a
    // line in that account's own transaction list.
    // \n splits into two lines in the PDF table (drawTable's drawRow) —
    // account name and number crammed onto one line left the number
    // clipped in a narrow column; on screen (CaMonthlyPackageView) this
    // same \n is split and rendered as a primary/secondary line pair.
    const paidFromLabel = (bankAccountId) => bankAccountId
        ? `${bankAccountId.accountName}${bankAccountId.accountNumber ? `\nA/C ${bankAccountId.accountNumber}` : ''}`
        : 'Cash';

    // partyType is the plain-English label for the PDF/on-screen table, not
    // a schema/refPath name. `party` carries that party's own bank details
    // (populated above) for the Bank Details column below.
    const taggedPayments = [
        ...contractorPayments.map(p => ({ p, partyType: 'Contractor', partyName: p.vendorId?.name, party: p.vendorId })),
        ...vendorPayments.map(p => ({ p, partyType: 'Vendor', partyName: p.vendorId?.name, party: p.vendorId })),
        ...salaryPayments.map(p => ({ p, partyType: 'Employee', partyName: p.employeeId?.name, party: p.employeeId })),
        ...labourPayments.map(p => ({ p, partyType: 'Labourer', partyName: p.labourerId?.name, party: p.labourerId })),
        ...commissionPayments.map(p => ({ p, partyType: 'Referral', partyName: p.referralId?.name, party: p.referralId })),
        ...labourProviderPayments.map(p => ({ p, partyType: 'Labour Provider', partyName: p.labourProviderId?.name, party: p.labourProviderId })),
    ];
    const tdsBySection = new Map();
    let totalTds = 0;
    const tdsPaymentRows = [];
    for (const { p, partyType, partyName, party } of taggedPayments) {
        if (!p.tdsAmount) continue;
        totalTds += p.tdsAmount;
        const key = p.tdsSectionId ? p.tdsSectionId._id.toString() : 'unspecified';
        if (!tdsBySection.has(key)) {
            tdsBySection.set(key, { tdsSectionId: p.tdsSectionId?._id || null, tdsSectionName: p.tdsSectionId?.name || 'Unspecified', tdsSectionCode: p.tdsSectionId?.code || '', totalTds: 0 });
        }
        tdsBySection.get(key).totalTds += p.tdsAmount;
        tdsPaymentRows.push({
            date: p.date, partyName: partyName || '—', partyType,
            sectionName: p.tdsSectionId?.name || 'Unspecified', sectionCode: p.tdsSectionId?.code || '',
            grossAmount: p.amount, tdsAmount: p.tdsAmount,
            bankDetails: party?.bankName ? `${party.bankName}\nA/C ${party.accountNumber}` : '—',
        });
    }
    tdsPaymentRows.sort((a, b) => new Date(a.date) - new Date(b.date));

    // The other half of TDS reconciliation — what's actually been
    // deposited with the tax department this month, not just withheld.
    // Previously missing from this package entirely despite being exactly
    // what a CA needs alongside `tds.payments` above to file a 26Q return.
    const totalTdsDeposited = round2(tdsDepositsRaw.reduce((s, d) => s + d.amount, 0));
    const tdsDepositRows = tdsDepositsRaw.map(d => ({
        date: d.date, challanNumber: d.challanNumber || '—',
        sectionName: d.tdsSectionId?.name || 'Unspecified', sectionCode: d.tdsSectionId?.code || '',
        accountName: d.bankAccountId?.accountName || 'Cash',
        amount: d.amount,
    }));

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    // Claimable Input GST on GST-invoiced expenses (office rent, equipment,
    // professional fees, etc.) — same claim as a material purchase's own
    // gstAmount, just on the Expenses side instead of Purchases.
    const expenseGst = expenses.reduce((sum, e) => sum + (e.gstAmount || 0), 0);
    const expenseRows = expenses.map(e => ({
        date: e.date, category: e.expenseCategory || 'Uncategorized', amount: e.amount, gstAmount: e.gstAmount || 0,
        paidFrom: paidFromLabel(e.bankAccountId),
    }));

    const totalBankBalance = bankPositions.reduce((sum, b) => sum + b.closingBalance, 0);

    const cashOpeningBalance = cashBefore.reduce((sum, e) => sum + (e.type === 'in' ? e.amount : -e.amount), 0);
    const cashInTotal = cashDuring.filter(e => e.type === 'in').reduce((sum, e) => sum + e.amount, 0);
    const cashOutTotal = cashDuring.filter(e => e.type === 'out').reduce((sum, e) => sum + e.amount, 0);
    const cashClosingBalance = cashOpeningBalance + cashInTotal - cashOutTotal;
    let runningCash = cashOpeningBalance;
    const cashTransactions = cashDuring.map(e => {
        runningCash += e.type === 'in' ? e.amount : -e.amount;
        return { date: e.date, description: e.reason || (e.type === 'in' ? 'Cash In' : 'Cash Out'), direction: e.type === 'in' ? 'credit' : 'debit', amount: e.amount, runningBalance: round2(runningCash) };
    });

    // Input GST is claimable from both Purchases (material) and Expenses
    // (GST-invoiced overhead) — purchaseGst/expenseGst broken out
    // separately below so the CA package shows exactly where each rupee of
    // the claim came from, not just one blended figure.
    const inputGst = purchaseGst + expenseGst;

    // HSN/SAC Summary — GSTR-1/GSTR-2-style grouping for the CA.
    // Sales: financeWorkTypeRate has no sacCode field of its own (checked
    // before writing this), so there's no per-work-type code to group
    // by — every issued bill this month collapses into one row under the
    // single company-wide defaultSacCode (see financeCompanySettings'
    // own comment: a sqft-rate service business, one code is deliberate,
    // same code the Bill Statement PDF already prints). Reuses the
    // already-computed salesTotal/outputGst rather than re-querying.
    // If a per-work-type sacCode is ever added, this becomes a real
    // $group over lineItems.sacCode instead of one static row.
    const sacSummary = issuedBills.length
        ? [{ sacCode: company?.defaultSacCode || '—', taxableValue: salesTotal, gstAmount: outputGst, total: salesTotal + outputGst }]
        : [];

    const hsnSummary = hsnAgg.map(r => ({
        hsnCode: r._id || '—', quantity: round2(r.quantity), taxableValue: round2(r.taxableValue), gstAmount: round2(r.gstAmount),
    }));

    const ownerInvestmentThisMonthEntries = ownerInvestmentEntries.filter(e => new Date(e.date) >= start);
    const ownerInvestmentThisMonth = round2(ownerInvestmentThisMonthEntries.reduce((s, e) => s + e.amount, 0));
    const ownerInvestmentAllTime = round2(ownerInvestmentEntries.reduce((s, e) => s + e.amount, 0));
    const ownerInvestmentRows = ownerInvestmentThisMonthEntries.map(e => ({
        date: e.date, bankAccountName: e.bankAccountId?.accountName || '—', reason: e.reason, amount: e.amount,
    }));

    // Clamp each party at 0 before summing — an overpaid/over-returned-on
    // party owes the company back, not the other way round, and a naive
    // sum would let that credit silently cancel out a different party's
    // real, separate debt (identical reasoning to the Payables dashboard's
    // own sumPositive helper, reimplemented locally here rather than
    // reaching across into that request-scoped closure).
    const sumPositive = (rows, key) => round2(rows.reduce((s, r) => s + Math.max(0, r[key]), 0));
    const payables = {
        vendors: sumPositive(vendorAnalysisRows, 'amountOwed'),
        contractors: sumPositive(contractorAnalysisRows, 'balancePayable'),
        labour: sumPositive(labourAnalysisRows, 'balancePayable'),
    };

    return {
        month,
        gst: {
            outputGst, inputGst, purchaseGst, expenseGst,
            itcBroughtForward: itcPosition.itcBroughtForward,
            availableCredit: itcPosition.availableCredit,
            netGstPayable: itcPosition.netGstPayable,
            itcCarriedForward: itcPosition.itcCarriedForward,
            // isFiled: this month's payable/claimable above are the CA's
            // actual filed figures (financeGstFiling), not computed
            // estimates — see computeGstItcPosition's own comment.
            isFiled: itcPosition.isFiled,
            filedDate: itcPosition.filedDate,
            taxPaid: itcPosition.taxPaid,
            filingId: itcPosition.filingId,
        },
        tds: {
            totalTds, bySection: [...tdsBySection.values()].sort((a, b) => b.totalTds - a.totalTds),
            payments: tdsPaymentRows, deposits: tdsDepositRows, totalDeposited: totalTdsDeposited,
        },
        sales: { totalBilled: salesTotal, billCount: issuedBills.length, bills: billRows, sacSummary },
        purchases: { totalPurchased, totalReturned, netPurchases: totalPurchased - totalReturned, purchaseCount: purchaseRows.length, rows: purchaseLineItems, hsnSummary },
        expenses: { totalExpenses, expenseCount: expenses.length, expenseGst, rows: expenseRows },
        payables,
        bankAndCash: {
            bankAccounts: bankPositions, totalBankBalance,
            cashOpeningBalance, cashInTotal, cashOutTotal, cashClosingBalance, cashTransactions,
            totalPosition: totalBankBalance + cashClosingBalance,
            ownerInvestment: { thisMonth: ownerInvestmentThisMonth, allTime: ownerInvestmentAllTime, rows: ownerInvestmentRows },
        },
    };
};

// Company-wide, all-time TDS Payable — the running liability owed to the
// tax department, not a month-scoped snapshot like the CA Monthly
// Package's own `tds` block above. Total TDS ever withheld across every
// payment type that carries one (Contractor/Vendor/Salary/Labour/
// Commission/Labour Provider Payments), minus every deposit actually made
// (financeTdsDeposit) — computed fresh, same rule as every other Payables
// figure in this file. Broken down by section so a deposit tagged to one
// section only reconciles against that section's own liability; an
// untagged deposit reduces the unspecified-section pool first.
const computeTdsPayable = async () => {
    const filter = { deleted: { $ne: true }, tdsAmount: { $gt: 0 } };
    const [contractorP, vendorP, salaryP, labourP, commissionP, labourProviderP, deposits] = await Promise.all([
        FinanceContractorPayment.find(filter, 'tdsAmount tdsSectionId'),
        FinanceVendorPayment.find(filter, 'tdsAmount tdsSectionId'),
        FinanceSalaryPayment.find(filter, 'tdsAmount tdsSectionId'),
        FinanceLabourPayment.find(filter, 'tdsAmount tdsSectionId'),
        FinanceCommissionPayment.find(filter, 'tdsAmount tdsSectionId'),
        FinanceLabourProviderPayment.find(filter, 'tdsAmount tdsSectionId'),
        FinanceTdsDeposit.find({ deleted: { $ne: true } }, 'amount tdsSectionId'),
    ]);
    const allWithheld = [...contractorP, ...vendorP, ...salaryP, ...labourP, ...commissionP, ...labourProviderP];

    const withheldBySection = new Map();
    let totalWithheld = 0;
    for (const p of allWithheld) {
        const amt = p.tdsAmount || 0;
        totalWithheld += amt;
        const key = p.tdsSectionId ? p.tdsSectionId.toString() : 'unspecified';
        withheldBySection.set(key, (withheldBySection.get(key) || 0) + amt);
    }

    const depositedBySection = new Map();
    let totalDeposited = 0;
    for (const d of deposits) {
        totalDeposited += d.amount;
        const key = d.tdsSectionId ? d.tdsSectionId.toString() : 'unspecified';
        depositedBySection.set(key, (depositedBySection.get(key) || 0) + d.amount);
    }

    const sectionIds = [...new Set([...withheldBySection.keys(), ...depositedBySection.keys()])].filter(k => k !== 'unspecified');
    const sections = sectionIds.length ? await FinanceSetting.find({ _id: { $in: sectionIds } }) : [];
    const sectionById = new Map(sections.map(s => [s._id.toString(), s]));

    const allKeys = new Set([...withheldBySection.keys(), ...depositedBySection.keys()]);
    const bySection = [...allKeys].map(key => {
        const withheld = round2(withheldBySection.get(key) || 0);
        const deposited = round2(depositedBySection.get(key) || 0);
        const section = key === 'unspecified' ? null : sectionById.get(key);
        return {
            tdsSectionId: key === 'unspecified' ? null : key,
            tdsSectionName: section?.name || 'Unspecified section',
            tdsSectionCode: section?.code || '',
            withheld, deposited, payable: round2(withheld - deposited),
        };
    }).sort((a, b) => b.payable - a.payable);

    return {
        totalWithheld: round2(totalWithheld),
        totalDeposited: round2(totalDeposited),
        payable: round2(totalWithheld - totalDeposited),
        bySection,
    };
};

const getTdsPayable = async (req, res) => {
    try {
        const data = await computeTdsPayable();
        res.json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing TDS payable' });
    }
};

const getCaMonthlyPackage = async (req, res) => {
    try {
        const { month } = req.query;
        if (!month || !/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ success: false, message: 'month is required in YYYY-MM format' });
        const data = await computeCaMonthlyPackage(month);
        res.json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing CA monthly package' });
    }
};

const downloadCaMonthlyPackage = async (req, res) => {
    try {
        const { month } = req.query;
        if (!month || !/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ success: false, message: 'month is required in YYYY-MM format' });
        const [data, tdsPayableAllTime, company] = await Promise.all([
            computeCaMonthlyPackage(month),
            computeTdsPayable(),
            getCompanyForPdf(),
        ]);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="CA-Monthly-Package-${month}.pdf"`);

        const doc = new PDFDocument({ margin: 50, bufferPages: true });
        doc.pipe(res);
        doc.on('pageAdded', () => paintPageBackground(doc));
        paintPageBackground(doc);

        await writeLetterhead(doc, `CA Monthly Package — ${month}`, company);

        // Every transaction description below already follows a "Type —
        // Counterparty" shape (getAccountActivity builds them that way) —
        // splitting on the first " — " into two lines (see drawTable's \n
        // handling) instead of one long line keeps a long party name from
        // bleeding into the Direction column next to it.
        const splitDescription = (desc) => {
            const idx = desc.indexOf(' — ');
            return idx === -1 ? desc : `${desc.slice(0, idx)}\n${desc.slice(idx + 3)}`;
        };

        writeSectionHeading(doc, 'GST Summary');
        {
            const gstRows = [
                { label: 'ITC Brought Forward', value: formatCurrency(data.gst.itcBroughtForward) },
                { label: 'Output GST (from issued bills, this month)', value: formatCurrency(data.gst.outputGst) },
                { label: 'Input GST — Purchases (material, this month)', value: formatCurrency(data.gst.purchaseGst) },
                { label: 'Input GST — Expenses (this month)', value: formatCurrency(data.gst.expenseGst) },
                { label: 'Total Credit Available (brought forward + this month)', value: formatCurrency(data.gst.availableCredit) },
                {
                    label: 'Net GST Payable', value: formatCurrency(data.gst.netGstPayable), bold: true, divider: true,
                    tone: data.gst.netGstPayable > 0 ? 'accent' : undefined,
                },
            ];
            if (data.gst.netGstPayable === 0 && data.gst.itcCarriedForward > 0) {
                gstRows.push({ label: 'ITC Carried Forward', value: formatCurrency(data.gst.itcCarriedForward), bold: true, tone: 'accent' });
            }
            drawStatBlock(doc, { rows: gstRows });
        }

        writeSectionHeading(doc, 'TDS Summary');
        if (data.tds.bySection.length === 0) {
            doc.text('No TDS recorded this month.');
        } else {
            drawStatBlock(doc, {
                rows: [
                    ...data.tds.bySection.map(s => ({ label: `${s.tdsSectionName}${s.tdsSectionCode ? ` (${s.tdsSectionCode})` : ''}`, value: formatCurrency(s.totalTds) })),
                    { label: 'Total TDS Withheld', value: formatCurrency(data.tds.totalTds), bold: true },
                    { label: 'Total TDS Deposited', value: formatCurrency(data.tds.totalDeposited) },
                    {
                        label: "TDS Payable (this month's withholding, net of deposits)",
                        value: formatCurrency(round2(data.tds.totalTds - data.tds.totalDeposited)), bold: true, tone: 'accent', divider: true,
                    },
                    { label: 'Cumulative TDS Payable (all-time, all sections)', value: formatCurrency(tdsPayableAllTime.payable), bold: true, tone: 'accent' },
                ],
            });
        }

        if (data.tds.payments.length > 0) {
            writeSubLabel(doc, 'TDS Withheld — Deductee-wise');
            drawTable(doc, {
                company,
                rowHeight: 30, // see the Purchases table's identical comment — long party names
                // Every width below is sized from doc.widthOfString at
                // this table's actual font/size against realistic
                // worst-case content (an 11-char date, a 9-digit rupee
                // amount, "Labour Provider", a 15-char GSTIN, a bank name
                // + full account number) — not guessed. Date/Section/Gross
                // Amount/TDS never truncate for real content; Party/Bank
                // Details keep fitOneLine's ellipsis as a rare-case
                // fallback only (an unusually long name), not a routine
                // occurrence.
                columns: [
                    { label: 'Date', width: 55, align: 'left' },
                    { label: 'Party', width: 104, align: 'left' },
                    { label: 'Type', width: 70, align: 'left' },
                    // A section CODE (194H, 194C, …) is what a 26Q return
                    // is actually filed against — shorter than the full
                    // descriptive name too, so this prefers it (falling
                    // back to the name only when no code is set) rather
                    // than printing both and overflowing the column.
                    { label: 'Section', width: 56, align: 'left' },
                    { label: 'Gross Amount', width: 69, align: 'right' },
                    { label: 'TDS', width: 58, align: 'right' },
                    // The deductee's own receiving bank account — which of
                    // OUR accounts paid from is obvious (there's only ever
                    // a handful, already covered by Bank & Cash Movement
                    // below); what a CA actually needs here to match this
                    // row against a real NEFT/RTGS line on the bank
                    // statement is whose account the money landed in. Bank
                    // name on its own line, account number on the next
                    // (see drawTable's \n handling).
                    { label: 'Bank Details', width: 100, align: 'left' },
                ],
                rows: data.tds.payments.map(p => [
                    formatDate(p.date), p.partyName, p.partyType,
                    p.sectionCode || p.sectionName,
                    formatCurrency(p.grossAmount), formatCurrency(p.tdsAmount), p.bankDetails,
                ]),
            });
        }
        if (data.tds.deposits.length > 0) {
            writeSubLabel(doc, 'TDS Deposits Made (Challans)');
            drawTable(doc, {
                company,
                columns: [
                    { label: 'Date', width: 60, align: 'left' },
                    { label: 'Challan No.', width: 110, align: 'left' },
                    // Code preferred over the full descriptive name (same
                    // reasoning as TDS Withheld above) — "194H —
                    // Commission/Brokerage" alone needs over 100pt at this
                    // font, which starved every other column.
                    { label: 'Section', width: 95, align: 'left' },
                    { label: 'Paid From', width: 140, align: 'left' },
                    { label: 'Amount', width: 107, align: 'right' },
                ],
                rows: data.tds.deposits.map(d => [
                    formatDate(d.date), d.challanNumber, d.sectionCode || d.sectionName, d.accountName, formatCurrency(d.amount),
                ]),
            });
        }

        writeSectionHeading(doc, 'Contractor & Labour Payables');
        // Payments actually made this month already appear above (TDS
        // Withheld) and in Bank & Cash Movement below — cash-basis by
        // construction, since a payment record only exists once money has
        // genuinely moved. This is the other half: what's still owed for
        // work already done but not yet paid for. All-time, not scoped to
        // this month — same convention as Cumulative TDS Payable above.
        doc.font('Helvetica').fontSize(9).fillColor('#888888')
            .text('All-time running balance still owed for work already done — not scoped to this month. Payments actually made this month are in TDS Withheld above and Bank & Cash Movement below.', { width: contentBox(doc).width })
            .fillColor('#000000').fontSize(10);
        doc.moveDown(0.3);
        drawStatBlock(doc, {
            rows: [
                { label: 'Outstanding Payable — Contractors (all-time, as of today)', value: formatCurrency(data.payables.contractors), bold: true },
                { label: 'Outstanding Payable — Labour (all-time, as of today)', value: formatCurrency(data.payables.labour), bold: true },
            ],
        });

        writeSectionHeading(doc, 'Sales Summary');
        drawStatBlock(doc, {
            rows: [
                { label: 'Total Billed (issued bills)', value: formatCurrency(data.sales.totalBilled), bold: true },
                { label: 'Bill Count', value: String(data.sales.billCount) },
            ],
        });
        if (data.sales.bills.length > 0) {
            writeSubLabel(doc, 'Bills Issued');
            drawTable(doc, {
                company,
                rowHeight: 30, // see the Purchases table's identical comment — long project/client names
                columns: [
                    { label: 'Bill #', width: 65, align: 'left' },
                    { label: 'Date', width: 55, align: 'left' },
                    { label: 'Project', width: 76, align: 'left' },
                    // Name on its own line, GSTIN on the next (see
                    // drawTable's \n handling) — same reasoning as the
                    // Purchases table's Vendor column.
                    { label: 'Client', width: 115, align: 'left' },
                    { label: 'Subtotal', width: 69, align: 'right' },
                    { label: 'GST', width: 60, align: 'right' },
                    { label: 'Total', width: 72, align: 'right' },
                ],
                rows: data.sales.bills.map(b => [
                    b.billNumber, formatDate(b.billDate), b.projectName,
                    `${b.clientName}${b.clientGstin && b.clientGstin !== '—' ? `\n${b.clientGstin}` : ''}`,
                    formatCurrency(b.subtotal), formatCurrency(b.gstAmount), formatCurrency(b.total),
                ]),
            });
        }
        if (data.sales.sacSummary.length > 0) {
            writeSubLabel(doc, 'HSN/SAC Summary');
            drawTable(doc, {
                company,
                columns: [
                    { label: 'SAC Code', width: 150, align: 'left' },
                    { label: 'Taxable Value', width: 130, align: 'right' },
                    { label: 'GST Amount', width: 116, align: 'right' },
                    { label: 'Total', width: 116, align: 'right' },
                ],
                rows: data.sales.sacSummary.map(s => [
                    s.sacCode, formatCurrency(s.taxableValue), formatCurrency(s.gstAmount), formatCurrency(s.total),
                ]),
            });
        }

        writeSectionHeading(doc, 'Purchase Summary');
        // Net Purchases is accrual — every purchase invoice dated this
        // month, whether or not the vendor's actually been paid yet (GST
        // Input Tax Credit is claimable from the invoice date, not the
        // payment date, so this can't wait for cash to move). It will not
        // match the vendor-payment debits on the real bank statement for
        // this month — Outstanding Payable below is the gap: the running
        // balance still owed to vendors, all-time, not just this month.
        doc.font('Helvetica').fontSize(9).fillColor('#888888')
            .text('Accrual basis — includes purchases not yet paid to the vendor. Will not match vendor-payment debits on the bank statement 1:1; see Outstanding Payable below for what remains unpaid.', { width: contentBox(doc).width })
            .fillColor('#000000').fontSize(10);
        doc.moveDown(0.3);
        drawStatBlock(doc, {
            rows: [
                { label: 'Total Purchased', value: formatCurrency(data.purchases.totalPurchased) },
                { label: 'Total Returned', value: formatCurrency(data.purchases.totalReturned) },
                { label: 'Net Purchases', value: formatCurrency(data.purchases.netPurchases), bold: true },
                { label: 'Purchase Count', value: String(data.purchases.purchaseCount) },
                {
                    label: 'Outstanding Payable — Vendors (all-time, as of today)',
                    value: formatCurrency(data.payables.vendors), bold: true, tone: 'accent', divider: true,
                },
            ],
        });
        if (data.purchases.rows.length > 0) {
            writeSubLabel(doc, 'Purchases');
            drawTable(doc, {
                company,
                // Taller rows than the default — every multi-line (\n) cell
                // below needs the room (see drawTable's own
                // MULTILINE_MIN_HEIGHT, which enforces this even if a
                // caller forgets to set it explicitly).
                rowHeight: 30,
                // Date/Qty/Rate/Amount/GST widths are sized from real
                // doc.widthOfString measurements against worst-case values
                // (an 11-char date, a 6-figure rupee amount) so they never
                // truncate. Vendor/Bank Details/Material keep fitOneLine's
                // ellipsis as a rare-case fallback for an unusually long
                // name, not a routine occurrence.
                columns: [
                    { label: 'Date', width: 55, align: 'left' },
                    // Name on its own line, GSTIN on the next (see
                    // drawTable's \n handling) — was two separate narrow
                    // columns, which clipped/bled into each other on any
                    // real vendor name.
                    { label: 'Vendor', width: 80, align: 'left' },
                    // Bank name / account number, same \n pairing — who
                    // this vendor eventually gets paid into, so the CA can
                    // pre-identify the account before a matching payment
                    // even shows up on the bank statement.
                    { label: 'Bank Details', width: 75, align: 'left' },
                    { label: 'Material', width: 55, align: 'left' },
                    { label: 'Type', width: 48, align: 'left' },
                    { label: 'Qty', width: 38, align: 'right' },
                    { label: 'Rate', width: 42, align: 'right' },
                    { label: 'Amount', width: 62, align: 'right' },
                    { label: 'GST', width: 57, align: 'right' },
                ],
                rows: data.purchases.rows.map(p => [
                    formatDate(p.date),
                    `${p.vendorName}${p.vendorGstin && p.vendorGstin !== '—' ? `\n${p.vendorGstin}` : ''}`,
                    p.vendorBankDetails,
                    p.materialName, p.transactionType === 'return' ? 'Return' : 'Purchase',
                    String(p.quantity), formatCurrency(p.ratePerUnit), formatCurrency(p.totalAmount), formatCurrency(p.gstAmount),
                ]),
            });
        }
        if (data.purchases.hsnSummary.length > 0) {
            writeSubLabel(doc, 'HSN/SAC Summary');
            drawTable(doc, {
                company,
                columns: [
                    { label: 'HSN Code', width: 150, align: 'left' },
                    { label: 'Quantity', width: 130, align: 'right' },
                    { label: 'Taxable Value', width: 116, align: 'right' },
                    { label: 'GST Amount', width: 116, align: 'right' },
                ],
                rows: data.purchases.hsnSummary.map(h => [
                    h.hsnCode, String(h.quantity), formatCurrency(h.taxableValue), formatCurrency(h.gstAmount),
                ]),
            });
        }

        writeSectionHeading(doc, 'Expense Summary');
        drawStatBlock(doc, {
            rows: [
                { label: 'Total Expenses', value: formatCurrency(data.expenses.totalExpenses), bold: true },
                { label: 'Expense Count', value: String(data.expenses.expenseCount) },
            ],
        });
        if (data.expenses.rows.length > 0) {
            drawTable(doc, {
                company,
                rowHeight: 30, // Paid From is a 2-line cell (drawTable's \n handling) — the self-healing minimum in drawRow covers this too, but set explicitly for clarity same as every other multi-line table.
                columns: [
                    { label: 'Date', width: 55, align: 'left' },
                    { label: 'Category', width: 175, align: 'left' },
                    { label: 'Amount', width: 70, align: 'right' },
                    { label: 'GST', width: 62, align: 'right' },
                    // So this row can be matched straight to a line in the
                    // matching account's own Transactions table below.
                    { label: 'Paid From', width: 150, align: 'left' },
                ],
                rows: data.expenses.rows.map(e => [formatDate(e.date), e.category, formatCurrency(e.amount), formatCurrency(e.gstAmount), e.paidFrom]),
            });
        }

        writeSectionHeading(doc, 'Bank & Cash Movement');
        data.bankAndCash.bankAccounts.forEach(a => {
            writeSubLabel(doc, `${a.accountName} — ${a.bankName} — A/C ${a.accountNumber}`);
            drawStatBlock(doc, {
                rows: [
                    { label: 'Opening Balance', value: formatCurrency(a.openingBalance) },
                    { label: 'Credits (In)', value: formatCurrency(a.creditTotal) },
                    { label: 'Debits (Out)', value: formatCurrency(a.debitTotal) },
                    { label: 'Closing Balance', value: formatCurrency(a.closingBalance), bold: true, divider: true },
                ],
            });
            if (a.transactions.length > 0) {
                drawTable(doc, {
                    company,
                    rowHeight: 30, // see the Purchases table's identical comment
                    columns: [
                        { label: 'Date', width: 55, align: 'left' },
                        { label: 'Description', width: 220, align: 'left' },
                        { label: 'In/Out', width: 40, align: 'left' },
                        { label: 'Amount', width: 69, align: 'right' },
                        { label: 'Running Balance', width: 128, align: 'right' },
                    ],
                    rows: a.transactions.map(t => [
                        formatDate(t.date), splitDescription(t.description), t.direction === 'credit' ? 'In' : 'Out',
                        formatCurrency(t.amount), formatCurrency(t.runningBalance),
                    ]),
                });
            } else {
                doc.font('Helvetica').fontSize(9).fillColor('#888888').text('No transactions this month.').fillColor('#000000').fontSize(10);
                doc.moveDown(0.4);
            }
        });
        writeSubLabel(doc, 'Cash');
        drawStatBlock(doc, {
            rows: [
                { label: 'Opening Balance', value: formatCurrency(data.bankAndCash.cashOpeningBalance) },
                { label: 'Cash In', value: formatCurrency(data.bankAndCash.cashInTotal) },
                { label: 'Cash Out', value: formatCurrency(data.bankAndCash.cashOutTotal) },
                { label: 'Closing Balance', value: formatCurrency(data.bankAndCash.cashClosingBalance), bold: true, divider: true },
            ],
        });
        if (data.bankAndCash.cashTransactions.length > 0) {
            drawTable(doc, {
                company,
                rowHeight: 30, // see the Purchases table's identical comment — cash entries carry a free-text reason
                columns: [
                    { label: 'Date', width: 55, align: 'left' },
                    { label: 'Description', width: 220, align: 'left' },
                    { label: 'In/Out', width: 40, align: 'left' },
                    { label: 'Amount', width: 69, align: 'right' },
                    { label: 'Running Balance', width: 128, align: 'right' },
                ],
                rows: data.bankAndCash.cashTransactions.map(t => [
                    formatDate(t.date), splitDescription(t.description), t.direction === 'credit' ? 'In' : 'Out',
                    formatCurrency(t.amount), formatCurrency(t.runningBalance),
                ]),
            });
        } else {
            doc.font('Helvetica').fontSize(9).fillColor('#888888').text('No cash transactions this month.').fillColor('#000000').fontSize(10);
            doc.moveDown(0.4);
        }

        // Called out separately from the bank/cash movement above — this is
        // capital the owner put in, not revenue, and a CA needs it flagged
        // as such rather than folded silently into "Credits (In)".
        if (data.bankAndCash.ownerInvestment.allTime > 0) {
            writeSubLabel(doc, 'Owner Investment');
            drawStatBlock(doc, {
                rows: [
                    { label: 'This Month', value: formatCurrency(data.bankAndCash.ownerInvestment.thisMonth) },
                    { label: 'Cumulative (All-Time, Through This Month)', value: formatCurrency(data.bankAndCash.ownerInvestment.allTime), bold: true, divider: true },
                ],
            });
            if (data.bankAndCash.ownerInvestment.rows.length > 0) {
                drawTable(doc, {
                    company,
                    rowHeight: 30,
                    columns: [
                        { label: 'Date', width: 80, align: 'left' },
                        { label: 'Account', width: 160, align: 'left' },
                        { label: 'Reason', width: 172, align: 'left' },
                        { label: 'Amount', width: 100, align: 'right' },
                    ],
                    rows: data.bankAndCash.ownerInvestment.rows.map(r => [formatDate(r.date), r.bankAccountName, r.reason, formatCurrency(r.amount)]),
                });
            }
        }

        drawStatBlock(doc, {
            rows: [
                { label: 'Total Position (bank + cash, month end)', value: formatCurrency(data.bankAndCash.totalPosition), bold: true, tone: 'accent' },
            ],
        });

        writeFooter(doc, company);

        // BUG FIX: writing at page.height - margins.bottom + 18 still sits
        // BELOW PDFKit's own overflow line (it checks against margins.bottom,
        // not the physical page height), so each .text() call here silently
        // triggered doc.addPage() before drawing — doubling the page count
        // with blank pages instead of numbering the real ones. Temporarily
        // zeroing margins.bottom for the duration of this write is the
        // standard PDFKit workaround: it makes the "writable area" extend
        // all the way to the physical bottom edge, so a position in the
        // footer gutter no longer reads as an overflow.
        const pageRange = doc.bufferedPageRange();
        const bottomMargin = doc.page.margins.bottom;
        for (let i = 0; i < pageRange.count; i++) {
            doc.switchToPage(i);
            const { left, right } = contentBox(doc);
            doc.page.margins.bottom = 0;
            doc.fontSize(7.5).fillColor('#999999')
                .text(`Page ${i + 1} of ${pageRange.count}`, left, doc.page.height - bottomMargin + 18, { width: right - left, align: 'center' });
            doc.page.margins.bottom = bottomMargin;
            doc.fillColor('#000000');
        }
        doc.end();
    } catch (err) {
        console.error(err);
        if (!res.headersSent) res.status(500).json({ success: false, message: 'Error generating CA monthly package PDF' });
    }
};

// Reconciliation — a guided month-end checklist, not a data-entry tool.
// Every row reuses a compute function that already exists elsewhere in
// this file (company-wide, not project-scoped — same "always company-
// wide" reasoning Contractor/Labour/Vendor Analysis already use) rather
// than inventing new business logic; "Approve entries" is the one
// genuinely new query, since no company-wide "pending review" count
// existed before (financeWorkReview.js's listReviewsForProject is always
// scoped to one project).
const computeReconciliationChecklist = async (month) => {
    const { start, end } = monthBounds(month);

    // Approve entries — every active Work's logged sqft (contractor +
    // labour measurements) minus whatever a FinanceWorkReview record
    // already marked approved/rejected; same formula as
    // financeWorkReview.js's computeWorkLoggedSqft, done once here across
    // every Work instead of one at a time.
    const works = await FinanceWork.find({ deleted: { $ne: true } }, '_id');
    const workIds = works.map(w => w._id);
    const [contractorMeasurementAgg, labourMeasurementAgg, reviews] = await Promise.all([
        FinanceMeasurement.aggregate([
            { $match: { workId: { $in: workIds }, deleted: { $ne: true } } },
            { $group: { _id: '$workId', total: { $sum: '$areaCoveredSqft' } } },
        ]),
        FinanceLabourMeasurement.aggregate([
            { $match: { workId: { $in: workIds }, deleted: { $ne: true } } },
            { $group: { _id: '$workId', total: { $sum: '$areaCoveredSqft' } } },
        ]),
        FinanceWorkReview.find({ workId: { $in: workIds } }),
    ]);
    const loggedByWork = new Map();
    for (const r of [...contractorMeasurementAgg, ...labourMeasurementAgg]) {
        const key = r._id.toString();
        loggedByWork.set(key, (loggedByWork.get(key) || 0) + r.total);
    }
    const reviewByWork = new Map(reviews.map(r => [r.workId.toString(), r]));
    let pendingReviewCount = 0;
    for (const workId of workIds) {
        const key = workId.toString();
        const logged = loggedByWork.get(key) || 0;
        const review = reviewByWork.get(key);
        const pending = round2(logged - (review?.approvedAreaSqft || 0) - (review?.rejectedAreaSqft || 0));
        if (pending > 0) pendingReviewCount++;
    }

    // Settle labour / Pay vendors — reuse the same company-wide Analysis
    // rows Reports' own Labour/Vendor Analysis tabs show.
    const [labourRows, vendorRows] = await Promise.all([
        computeLabourAnalysisRows(''),
        computeVendorAnalysisRows(''),
    ]);
    const labourOutstandingCount = labourRows.filter(r => r.balancePayable > 0).length;
    const labourOutstandingAmount = round2(labourRows.reduce((s, r) => s + Math.max(0, r.balancePayable), 0));
    const vendorOutstandingCount = vendorRows.filter(r => r.amountOwed > 0).length;
    const vendorOutstandingAmount = round2(vendorRows.reduce((s, r) => s + Math.max(0, r.amountOwed), 0));

    // Verify stock — company-wide current stock per material vs. its own
    // minimumStockLevel, same threshold getInventorySummary already uses.
    const materials = await FinanceMaterial.find({ deleted: { $ne: true } });
    const stockRows = await FinanceStockMovement.aggregate([
        { $match: { deleted: { $ne: true } } },
        {
            $group: {
                _id: '$materialId',
                dump:     { $sum: { $cond: [{ $eq: ['$movementType', 'dump'] }, '$quantity', 0] } },
                consume:  { $sum: { $cond: [{ $eq: ['$movementType', 'consume'] }, '$quantity', 0] } },
                returned: { $sum: { $cond: [{ $eq: ['$movementType', 'return'] }, '$quantity', 0] } },
                waste:    { $sum: { $cond: [{ $eq: ['$movementType', 'waste'] }, '$quantity', 0] } },
            },
        },
    ]);
    const stockByMaterial = new Map(stockRows.map(r => [r._id.toString(), r]));
    const belowMinimumCount = materials.filter((mat) => {
        const s = stockByMaterial.get(mat._id.toString()) || { dump: 0, consume: 0, returned: 0, waste: 0 };
        const currentStock = s.dump - s.consume - s.returned - s.waste;
        return currentStock < mat.minimumStockLevel;
    }).length;

    // Invoice — draft Running Bills dated in this month.
    const draftBillsCount = await FinanceRunningBill.countDocuments({
        status: 'draft', deleted: { $ne: true }, billDate: { $gte: start, $lte: end },
    });

    // Chase receivables — reuse the same company-wide aging Reports'
    // Clients tab already computes.
    const { aging } = await computeClientsSummaryRows();
    const receivablesOverdue = round2(aging['60-90'] + aging['90+']);

    // GST / TDS — reuse the exact CA Monthly Package figures for this
    // same month, not a separate computation (see this session's earlier
    // Reports/Reconciliation investigation: this checklist row is the
    // right home for that number, not a standalone GST page).
    const { gst, tds } = await computeCaMonthlyPackage(month);
    // BUG FIX: this row used to show tds.totalTds — gross TDS withheld
    // this month — and considered itself "clear" only once that hit 0,
    // which never happens in any normal month (withholding is expected,
    // not a problem to fix). What actually needs chasing is TDS Payable:
    // what's still owed to the tax authority after this month's deposits
    // are netted out — same formula the CA Monthly Package's own PDF
    // already computes and labels "TDS Payable (this month's withholding,
    // net of this month's deposits)". Confirmed live: depositing the full
    // withheld amount left this row reading "not clear" under the old
    // formula, unchanged.
    const tdsPayable = round2(tds.totalTds - tds.totalDeposited);

    // linkTab is null for the two items whose real workspace lives outside
    // Reports (Work Review and Running Bills both live under Receivables)
    // — the frontend shows a plain hint for those instead of a jump button,
    // since Reports' own tab switcher can't cross-navigate to another page.
    const items = [
        { key: 'approve-entries', label: 'Approve entries', count: pendingReviewCount, amount: null, clear: pendingReviewCount === 0, linkTab: null, hint: 'Receivables → Work Review' },
        { key: 'settle-labour', label: 'Settle labour', count: labourOutstandingCount, amount: labourOutstandingAmount, clear: labourOutstandingCount === 0, linkTab: 'labour-analysis' },
        { key: 'verify-stock', label: 'Verify stock', count: belowMinimumCount, amount: null, clear: belowMinimumCount === 0, linkTab: 'material-analysis' },
        { key: 'invoice', label: 'Invoice', count: draftBillsCount, amount: null, clear: draftBillsCount === 0, linkTab: null, hint: 'Receivables → Bills' },
        { key: 'chase-receivables', label: 'Chase receivables', count: null, amount: receivablesOverdue, clear: receivablesOverdue === 0, linkTab: 'client-profit' },
        { key: 'pay-vendors', label: 'Pay vendors', count: vendorOutstandingCount, amount: vendorOutstandingAmount, clear: vendorOutstandingCount === 0, linkTab: 'vendor-analysis' },
        { key: 'gst', label: 'GST', count: null, amount: gst.netGstPayable, clear: gst.netGstPayable === 0, linkTab: 'ca-monthly-package' },
        { key: 'tds', label: 'TDS', count: null, amount: tdsPayable, clear: tdsPayable === 0, linkTab: 'ca-monthly-package' },
    ];
    const outstandingCount = items.filter(i => !i.clear).length;

    return { month, items, outstandingCount, allClear: outstandingCount === 0 };
};

const getReconciliation = async (req, res) => {
    try {
        const { month } = req.query;
        if (!month || !/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ success: false, message: 'month is required in YYYY-MM format' });
        const data = await computeReconciliationChecklist(month);
        res.json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing reconciliation checklist' });
    }
};

export {
    getProjectProfit, getProjectProfitsBatch, getClientProfit, getWorkProfit, getWorkDetail,
    getContractorAnalysis, getContractorsSummary, getLabourAnalysis, getLabourersSummary, getSupervisorAnalysis,
    getVendorAnalysis, getVendorsSummary,
    getMaterialAnalysis, getInventorySummary,
    getCashFlow, getExpenseAnalysis,
    getCaMonthlyPackage, downloadCaMonthlyPackage,
    getTdsPayable,
    getReconciliation,
    getDashboardSummary, getDashboardTrends,
    getClientsSummary, getClientDetail,
    // Shared with financeContractorLedger.js/financeLabourLedger.js so the
    // "approved = billed to client via an issued running bill" figure and
    // its multi-party proportional split never drift between this module
    // and those (same cross-controller import pattern already used
    // elsewhere in this codebase, e.g. financeMeasurement.js importing
    // computeCurrentStock from financeStockMovement.js).
    getApprovedBillingByWorkId, getCategoryApprovedAreaByWorkId, splitApprovedAreaByShare, computeWorkExpectedPay,
    // Shared with financeProject.js's completion-readiness endpoint + the
    // "Mark Completed" action itself — same reasoning as the export above.
    getProjectCompletionReadiness,
    // Shared with financeContractorLedger.js/financeLabourLedger.js for the
    // per-worker Material Cost/Sqft column — same weighted-average material
    // rate lookup used by getMaterialAnalysis/computeWorkScopedReport.
    computeMaterialAvgRates,
    // Shared with financeWorkReview.js's reviewWork — prices the material a
    // rejected allocation wasted, same rate the Ledger's own "Material
    // Cost/Sqft" column already shows for that party.
    computePartyMaterialCostPerSqft,
    // THE canonical Balance Payable / Amount Owed formulas — shared with
    // financeContractorLedger.js/financeLabourLedger.js/financeVendorLedger.js
    // so their single-party ledger pages and this module's own company-wide
    // Analysis Rows can never drift apart again (see each function's own
    // comment for the bug this fixes). Also re-exported, alongside
    // summarizeProject and computeProjectMaterialWaste, from
    // utils/financeFacts.js as one discoverable place to import any of
    // Finance's canonical money-fact functions from.
    computeContractorBalance, computeLabourBalance, computeVendorBalance,
    computeProjectMaterialWaste,
};
