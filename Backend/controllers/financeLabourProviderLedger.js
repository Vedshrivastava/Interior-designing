import FinanceLabourer from '../models/financeLabourer.js';
import FinanceWork from '../models/financeWork.js';
import FinanceProject from '../models/financeProject.js';
import FinanceLabourMeasurement from '../models/financeLabourMeasurement.js';
import FinanceWorkLabourAssignment from '../models/financeWorkLabourAssignment.js';
import FinanceLabourProviderPayment from '../models/financeLabourProviderPayment.js';
import { getApprovedBillingByWorkId, splitApprovedAreaByShare } from './financeReports.js';
import { assertLabourProviderVendor } from '../utils/contractorVendor.js';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/*
 * A labour provider's cut is a separate, additional cost the company pays
 * OUT to them — never subtracted from any labourer's own pay. Computed
 * purely as (that labourer's own reviewed sqft on a Work) ×
 * labourProviderRatePerSqft (fixed once per labourer, see
 * financeLabourer.js), same "Approved = reviewed" gate and same
 * splitApprovedAreaByShare proportional-split logic
 * computeLabourLedger already uses for a labourer's own earnings — just
 * summed across every labourer connected to this one provider instead of
 * one labourer's own ledger, and multiplied by the provider's rate
 * instead of the labourer's own.
 *
 * approvedPay is the only real, payable figure (Balance Payable settles
 * against this alone) — pendingApprovalPay is shown purely so "what would
 * this become once reviewed" is visible before that happens, same
 * transparency already established for Contractor/Labour ledgers'
 * unapprovedAmount.
 */
const computeLabourProviderLedger = async (vendorId, projectId) => {
    const vendor = await assertLabourProviderVendor(vendorId);

    const labourers = await FinanceLabourer.find({ labourProviderVendorId: vendorId, deleted: { $ne: true } });
    const labourerIds = labourers.map(l => l._id);
    const labourerById = new Map(labourers.map(l => [l._id.toString(), l]));

    const assignments = labourerIds.length
        ? await FinanceWorkLabourAssignment.find({ labourerId: { $in: labourerIds }, deleted: { $ne: true } }, 'workId')
        : [];
    const assignedWorkIds = assignments.map(a => a.workId);

    const workFilter = { _id: { $in: assignedWorkIds }, deleted: { $ne: true } };
    if (projectId) workFilter.projectId = projectId;
    const works = assignedWorkIds.length ? await FinanceWork.find(workFilter) : [];
    const workIds = works.map(w => w._id);

    const projectIds = [...new Set(works.map(w => w.projectId.toString()))];
    const projects = projectIds.length ? await FinanceProject.find({ _id: { $in: projectIds } }) : [];
    const projectNameById = new Map(projects.map(p => [p._id.toString(), p.name]));

    const [allMeasurements, approvedBillingByWorkId] = await Promise.all([
        // Every labourer's measurements on these works (not just ours) —
        // needed as the proportional-split denominator, same reason
        // computeLabourLedger fetches allLabourerMeasurements.
        workIds.length ? FinanceLabourMeasurement.find({ workId: { $in: workIds }, deleted: { $ne: true } }, 'workId labourerId areaCoveredSqft') : [],
        workIds.length ? getApprovedBillingByWorkId(workIds) : new Map(),
    ]);

    const totalAreaByWork = new Map(); // workId -> every labourer's combined area
    const areaByWorkAndLabourer = new Map(); // `${workId}_${labourerId}` -> area, our labourers only
    for (const m of allMeasurements) {
        const wKey = m.workId.toString();
        totalAreaByWork.set(wKey, round2((totalAreaByWork.get(wKey) || 0) + m.areaCoveredSqft));
        if (labourerById.has(m.labourerId.toString())) {
            const key = `${wKey}_${m.labourerId}`;
            areaByWorkAndLabourer.set(key, round2((areaByWorkAndLabourer.get(key) || 0) + m.areaCoveredSqft));
        }
    }

    let totalAreaSqft = 0, approvedAreaSqft = 0, unapprovedAreaSqft = 0, approvedPay = 0, pendingApprovalPay = 0;
    const rows = [];
    for (const w of works) {
        const wKey = w._id.toString();
        const allLabourersArea = totalAreaByWork.get(wKey) || 0;
        const workApproved = approvedBillingByWorkId.get(wKey) || { areaSqft: 0, date: null };
        for (const labourer of labourers) {
            const area = areaByWorkAndLabourer.get(`${wKey}_${labourer._id}`);
            if (!area) continue;
            const approvedArea = splitApprovedAreaByShare(workApproved.areaSqft, area, allLabourersArea);
            const unapprovedArea = round2(area - approvedArea);
            const rate = labourer.labourProviderRatePerSqft || 0;
            const rowApprovedPay = round2(approvedArea * rate);
            const rowPendingPay = round2(unapprovedArea * rate);
            totalAreaSqft += area;
            approvedAreaSqft += approvedArea;
            unapprovedAreaSqft += unapprovedArea;
            approvedPay += rowApprovedPay;
            pendingApprovalPay += rowPendingPay;
            rows.push({
                labourerId: labourer._id, labourerName: labourer.name,
                workId: w._id, workType: w.workType,
                projectId: w.projectId, projectName: projectNameById.get(w.projectId.toString()) || '—',
                totalAreaSqft: round2(area), approvedAreaSqft: approvedArea, unapprovedAreaSqft: unapprovedArea,
                rate, approvedPay: rowApprovedPay, pendingPay: rowPendingPay,
                approvedDate: approvedArea > 0 ? workApproved.date : null,
            });
        }
    }

    const paymentFilter = { vendorId, deleted: { $ne: true } };
    if (projectId) paymentFilter.projectId = projectId;
    const payments = await FinanceLabourProviderPayment.find(paymentFilter).populate('bankAccountId', 'accountName').sort({ date: -1 });
    const paymentsTotal = round2(payments.reduce((sum, p) => sum + p.amount, 0));

    approvedPay = round2(approvedPay);
    const balancePayable = round2(approvedPay - paymentsTotal);

    return {
        vendor, vendorId: vendor._id, vendorName: vendor.name,
        rows,
        labourers: labourers.map(l => ({ _id: l._id, name: l.name, rate: l.labourProviderRatePerSqft })),
        payments,
        totals: {
            totalAreaSqft: round2(totalAreaSqft), approvedAreaSqft: round2(approvedAreaSqft), unapprovedAreaSqft: round2(unapprovedAreaSqft),
            approvedPay, pendingApprovalPay: round2(pendingApprovalPay),
            paymentsTotal, balancePayable,
        },
    };
};

const getLabourProviderLedger = async (req, res) => {
    try {
        const { vendorId } = req.params;
        const { projectId } = req.query;
        const { vendor, ...data } = await computeLabourProviderLedger(vendorId, projectId);
        res.json({ success: true, data });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message || 'Error computing labour provider ledger' });
    }
};

export { getLabourProviderLedger, computeLabourProviderLedger };
