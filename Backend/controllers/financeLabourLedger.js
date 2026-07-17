import FinanceWork from '../models/financeWork.js';
import FinanceLabourMeasurement from '../models/financeLabourMeasurement.js';
import FinanceLabourRate from '../models/financeLabourRate.js';
import FinanceWorkLabourAssignment from '../models/financeWorkLabourAssignment.js';
import FinanceProject from '../models/financeProject.js';
import FinanceLabourer from '../models/financeLabourer.js';
import FinanceLabourAdvance from '../models/financeLabourAdvance.js';
import FinanceLabourDeduction from '../models/financeLabourDeduction.js';
import FinanceLabourPayment from '../models/financeLabourPayment.js';
import { getApprovedBillingByWorkId, splitApprovedAreaByShare } from './financeReports.js';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/*
 * Mirrors getContractorLedger. Labour never had a per-measurement approval
 * flag (every logged sqft was immediately payable) — this is the one
 * genuine behavior change: Earnings (the figure that feeds Balance
 * Payable) now only counts "Approved" area, same billing-derived source as
 * the contractor side (see financeReports.js's computeWorkApprovedBilling
 * header comment — issuing a running bill to the client is the engineer's
 * approval act). Total (every logged sqft, unconditional) is tracked
 * alongside it per work; the gap is unapprovedAreaSqft/unapprovedAmount,
 * never a separately entered figure. The engineer's periodic review and a
 * supervisor's on-the-spot catch still show up only as financeLabourDeduction
 * rows, exactly like Advances/Payments — nothing computed, just summed —
 * and now subtract from Approved rather than Total.
 *
 * Balance Payable = Approved Earnings − Advances − Deductions − Payments.
 */
const getLabourLedger = async (req, res) => {
    try {
        const { labourerId } = req.params;
        const { projectId } = req.query;

        const labourer = await FinanceLabourer.findOne({ _id: labourerId, deleted: { $ne: true } });
        if (!labourer) throw new Error('Labourer not found');

        const assignments = await FinanceWorkLabourAssignment.find({ labourerId, deleted: { $ne: true } });
        const workIds = assignments.map(a => a.workId);

        const workFilter = { _id: { $in: workIds }, deleted: { $ne: true } };
        if (projectId) workFilter.projectId = projectId;
        const works = await FinanceWork.find(workFilter).sort({ createdAt: -1 });

        const projectIds = [...new Set(works.map(w => w.projectId.toString()))];
        const projects = await FinanceProject.find({ _id: { $in: projectIds } });
        const projectNameById = new Map(projects.map(p => [p._id.toString(), p.name]));

        const rates = await FinanceLabourRate.find({
            projectId: { $in: projectIds }, labourerId, deleted: { $ne: true },
        });
        const rateByKey = new Map(rates.map(r => [`${r.projectId}_${r.workType}`, r]));

        const areaByWork = new Map(); // workId -> { totalArea, allLabourersArea }
        for (const w of works) areaByWork.set(w._id.toString(), { totalArea: 0, allLabourersArea: 0 });

        const [measurements, allLabourerMeasurements, approvedBillingByWorkId] = await Promise.all([
            works.length
                ? FinanceLabourMeasurement.find({ workId: { $in: works.map(w => w._id) }, labourerId, deleted: { $ne: true } })
                    .populate('workId', 'workType')
                    .sort({ date: -1 })
                : [],
            // Every labourer's measurements on these works — needed to
            // proportionally split a work's billed area when more than one
            // labourer contributes to it (see splitApprovedAreaByShare).
            works.length
                ? FinanceLabourMeasurement.find({ workId: { $in: works.map(w => w._id) }, deleted: { $ne: true } }, 'workId areaCoveredSqft')
                : [],
            works.length ? getApprovedBillingByWorkId(works.map(w => w._id)) : new Map(),
        ]);
        for (const m of allLabourerMeasurements) {
            const key = m.workId.toString();
            const cur = areaByWork.get(key) || { totalArea: 0, allLabourersArea: 0 };
            cur.allLabourersArea += m.areaCoveredSqft;
            areaByWork.set(key, cur);
        }
        for (const m of measurements) {
            const workKey = m.workId._id.toString();
            const cur = areaByWork.get(workKey) || { totalArea: 0, allLabourersArea: 0 };
            cur.totalArea += m.areaCoveredSqft;
            areaByWork.set(workKey, cur);
        }

        let earningsTotal = 0;
        let totalAmountTotal = 0;
        let unapprovedAmountTotal = 0;
        const worksOut = [];
        for (const w of works) {
            const workKey = w._id.toString();
            const { totalArea, allLabourersArea } = areaByWork.get(workKey);
            const rate = rateByKey.get(`${w.projectId}_${w.workType}`);
            const rateValue = rate ? rate.ratePerSqft : 0;
            const workApprovedBilling = approvedBillingByWorkId.get(workKey) || { areaSqft: 0, date: null };
            const approvedArea = splitApprovedAreaByShare(workApprovedBilling.areaSqft, totalArea, allLabourersArea);
            const unapprovedArea = round2(totalArea - approvedArea);
            const totalAmount = round2(rate ? totalArea * rateValue : 0);
            const earnings = round2(rate ? approvedArea * rateValue : 0);
            const unapprovedAmount = round2(rate ? unapprovedArea * rateValue : 0);
            earningsTotal += earnings;
            totalAmountTotal += totalAmount;
            unapprovedAmountTotal += unapprovedAmount;
            worksOut.push({
                _id: w._id,
                projectId: w.projectId, projectName: projectNameById.get(w.projectId.toString()) || '—',
                workType: w.workType,
                estimatedAreaSqft: w.estimatedAreaSqft, completedAreaSqft: round2(totalArea),
                approvedAreaSqft: approvedArea, unapprovedAreaSqft: unapprovedArea,
                approvedDate: approvedArea > 0 ? workApprovedBilling.date : null,
                status: w.status,
                rate: rate ? rate.ratePerSqft : null,
                totalAmount, earnings, unapprovedAmount,
            });
        }

        const moneyFilter = { labourerId, deleted: { $ne: true } };
        if (projectId) moneyFilter.projectId = projectId;
        const [advances, deductions, payments] = await Promise.all([
            FinanceLabourAdvance.find(moneyFilter).sort({ date: -1 }),
            FinanceLabourDeduction.find(moneyFilter).sort({ date: -1 }),
            FinanceLabourPayment.find(moneyFilter).populate('bankAccountId', 'accountName').sort({ date: -1 }),
        ]);

        const advancesTotal = advances.reduce((sum, a) => sum + a.amount, 0);
        const deductionsTotal = deductions.reduce((sum, d) => sum + d.amount, 0);
        const paymentsTotal = payments.reduce((sum, p) => sum + p.amount, 0);
        earningsTotal = round2(earningsTotal);
        totalAmountTotal = round2(totalAmountTotal);
        unapprovedAmountTotal = round2(unapprovedAmountTotal);
        const balancePayable = round2(earningsTotal - advancesTotal - deductionsTotal - paymentsTotal);

        res.json({
            success: true,
            data: {
                labourerId: labourer._id, labourerName: labourer.name,
                works: worksOut, measurements, advances, deductions, payments,
                totals: {
                    earnings: earningsTotal, totalAmount: totalAmountTotal, unapprovedAmount: unapprovedAmountTotal,
                    advances: advancesTotal, deductions: deductionsTotal, payments: paymentsTotal, balancePayable,
                },
            },
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message || 'Error computing labour ledger' });
    }
};

export { getLabourLedger };
