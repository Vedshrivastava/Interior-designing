import FinanceRunningBill from '../models/financeRunningBill.js';
import FinanceReceipt from '../models/financeReceipt.js';
import FinanceProject from '../models/financeProject.js';

// Advance-contract projects bill via Running Bills too, once work starts
// (see financeRunningBill.js) — the advance itself just shows up as a
// received-before-billed credit in the balance below.
const BILLABLE_CONTRACT_TYPES = ['with_material', 'without_material', 'advance'];

// Computed on the fly, same rule as Payables and current-stock — never
// stored. issuedTotal only counts `issued` bills (drafts aren't billed
// yet); receivedTotal counts every receipt against the project regardless
// of whether it's tied to a specific bill.
const summarizeProject = async (project) => {
    const issuedBills = await FinanceRunningBill.find({ projectId: project._id, status: 'issued', deleted: { $ne: true } }).sort({ billDate: 1 });
    const issuedTotal = issuedBills.reduce((sum, b) => sum + b.totalAmount, 0);
    const receipts = await FinanceReceipt.find({ projectId: project._id, deleted: { $ne: true } });
    const receivedTotal = receipts.reduce((sum, r) => sum + r.amount, 0);

    return {
        projectId: project._id,
        projectName: project.name,
        clientId: project.clientId?._id || project.clientId,
        clientName: project.clientId?.name,
        issuedTotal, receivedTotal,
        balance: issuedTotal - receivedTotal,
        issuedBillCount: issuedBills.length,
        // No due-date field exists anywhere on a project, so there's no
        // real basis for a true "overdue" flag — this is the closest
        // proxy (oldest issued-but-possibly-unpaid bill), not a due date.
        // Known gap, not a guess dressed up as one.
        oldestIssuedBillDate: issuedBills[0]?.billDate || null,
    };
};

const getReceivablesSummary = async (req, res) => {
    try {
        const { projectId, clientId } = req.query;

        if (projectId) {
            const project = await FinanceProject.findById(projectId).populate('clientId', 'name');
            if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
            return res.json({ success: true, data: await summarizeProject(project) });
        }

        if (clientId) {
            const projects = await FinanceProject.find({
                clientId, deleted: { $ne: true }, contractType: { $in: BILLABLE_CONTRACT_TYPES },
            }).populate('clientId', 'name');
            const summaries = await Promise.all(projects.map(summarizeProject));
            const rollup = summaries.reduce((acc, s) => ({
                issuedTotal: acc.issuedTotal + s.issuedTotal,
                receivedTotal: acc.receivedTotal + s.receivedTotal,
                balance: acc.balance + s.balance,
            }), { issuedTotal: 0, receivedTotal: 0, balance: 0 });
            return res.json({ success: true, data: { clientId, ...rollup, projects: summaries } });
        }

        // No filter — the "Pending Receipts" list: every billable project
        // with at least one issued bill and a positive outstanding balance,
        // oldest issued bill first.
        const projects = await FinanceProject.find({
            deleted: { $ne: true }, contractType: { $in: BILLABLE_CONTRACT_TYPES },
        }).populate('clientId', 'name');
        const summaries = await Promise.all(projects.map(summarizeProject));
        const pending = summaries
            .filter(s => s.issuedBillCount > 0 && s.balance > 0)
            .sort((a, b) => new Date(a.oldestIssuedBillDate) - new Date(b.oldestIssuedBillDate));
        res.json({ success: true, data: pending });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing receivables summary' });
    }
};

export { getReceivablesSummary, summarizeProject };
