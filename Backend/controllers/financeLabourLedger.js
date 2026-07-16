import FinanceWork from '../models/financeWork.js';
import FinanceLabourMeasurement from '../models/financeLabourMeasurement.js';
import FinanceLabourRate from '../models/financeLabourRate.js';
import FinanceWorkLabourAssignment from '../models/financeWorkLabourAssignment.js';
import FinanceProject from '../models/financeProject.js';
import FinanceLabourer from '../models/financeLabourer.js';
import FinanceLabourAdvance from '../models/financeLabourAdvance.js';
import FinanceLabourDeduction from '../models/financeLabourDeduction.js';
import FinanceLabourPayment from '../models/financeLabourPayment.js';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/*
 * Mirrors getContractorLedger, at individual-labourer granularity — the
 * one difference is earnings aren't gated by a per-measurement approval
 * flag (labour measurements have none). Every logged sqft counts; the
 * engineer's periodic review and a supervisor's on-the-spot catch both
 * show up here only as financeLabourDeduction rows, exactly like
 * Advances/Payments — nothing computed, just summed.
 *
 * Balance Payable = Earnings − Advances − Deductions − Payments.
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

        const areaByWork = new Map(); // workId -> totalArea
        for (const w of works) areaByWork.set(w._id.toString(), 0);

        const measurements = works.length
            ? await FinanceLabourMeasurement.find({ workId: { $in: works.map(w => w._id) }, labourerId, deleted: { $ne: true } })
                .populate('workId', 'workType')
                .sort({ date: -1 })
            : [];
        for (const m of measurements) {
            const workKey = m.workId._id.toString();
            areaByWork.set(workKey, (areaByWork.get(workKey) || 0) + m.areaCoveredSqft);
        }

        let earningsTotal = 0;
        const worksOut = [];
        for (const w of works) {
            const totalArea = areaByWork.get(w._id.toString()) || 0;
            const rate = rateByKey.get(`${w.projectId}_${w.workType}`);
            const earnings = round2(rate ? totalArea * rate.ratePerSqft : 0);
            earningsTotal += earnings;
            worksOut.push({
                _id: w._id,
                projectId: w.projectId, projectName: projectNameById.get(w.projectId.toString()) || '—',
                workType: w.workType,
                estimatedAreaSqft: w.estimatedAreaSqft, completedAreaSqft: round2(totalArea),
                status: w.status,
                rate: rate ? rate.ratePerSqft : null,
                earnings,
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
        const balancePayable = round2(earningsTotal - advancesTotal - deductionsTotal - paymentsTotal);

        res.json({
            success: true,
            data: {
                labourerId: labourer._id, labourerName: labourer.name,
                works: worksOut, measurements, advances, deductions, payments,
                totals: {
                    earnings: earningsTotal,
                    advances: advancesTotal, deductions: deductionsTotal, payments: paymentsTotal, balancePayable,
                },
            },
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message || 'Error computing labour ledger' });
    }
};

export { getLabourLedger };
