import FinanceRunningBill from '../models/financeRunningBill.js';
import FinanceReceipt from '../models/financeReceipt.js';
import FinanceProject from '../models/financeProject.js';
import { getClientBillCreditTotal } from './financeClientDirectPayment.js';

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
    // Client-direct-payments tagged with a deductFromClientBill category —
    // the client already paid this much straight to a contractor/labourer
    // on this project, so it counts against Outstanding same as a receipt,
    // without actually being one (see financeClientDirectPayment.js).
    const directPaymentCredits = await getClientBillCreditTotal(project._id);
    // A direct payment credits against Outstanding the moment it's entered,
    // even if the specific Work it's tied to hasn't been billed yet — so it
    // can outrun issuedTotal - receivedTotal and go negative. That's not
    // wrong (the client really has pre-paid that much), it's just not a
    // debt the company can show as "Outstanding: -₹X" without it reading as
    // the company owing the client cash back. Clamp the balance at 0 and
    // surface the excess separately as a running credit instead — it gets
    // silently absorbed as new bills raise issuedTotal on future calls,
    // same "computed fresh every time" rule as everything else here.
    const rawBalance = issuedTotal - receivedTotal - directPaymentCredits;

    return {
        projectId: project._id,
        projectName: project.name,
        clientId: project.clientId?._id || project.clientId,
        clientName: project.clientId?.name,
        issuedTotal, receivedTotal, directPaymentCredits,
        balance: Math.max(0, rawBalance),
        clientCreditBalance: Math.max(0, -rawBalance),
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
                directPaymentCredits: acc.directPaymentCredits + s.directPaymentCredits,
                // Summed from each project's already-clamped balance/credit —
                // one project's credit must never quietly offset another
                // project's real debt in this client's rollup total.
                balance: acc.balance + s.balance,
                clientCreditBalance: acc.clientCreditBalance + s.clientCreditBalance,
            }), { issuedTotal: 0, receivedTotal: 0, directPaymentCredits: 0, balance: 0, clientCreditBalance: 0 });
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
