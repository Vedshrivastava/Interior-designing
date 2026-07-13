import FinanceEmployee from '../models/financeEmployee.js';
import FinanceSalaryPayment from '../models/financeSalaryPayment.js';

/*
 * Computed fresh on every call — nothing stored. For a given month:
 * Balance Due = employee.salary − SUM(salaryPayment.amount for that
 * employee + month). Without a month, returns the same breakdown per
 * month across every month this employee has a payment in, so the UI can
 * show a running history without needing N separate calls.
 */
const getSalaryLedger = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { month } = req.query;

        const employee = await FinanceEmployee.findOne({ _id: employeeId, deleted: { $ne: true } });
        if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

        if (month) {
            const payments = await FinanceSalaryPayment.find({ employeeId, month, deleted: { $ne: true } }).sort({ date: -1 });
            const paidTotal = payments.reduce((sum, p) => sum + p.amount, 0);
            return res.json({
                success: true,
                data: {
                    employeeId: employee._id, employeeName: employee.name, month,
                    expectedSalary: employee.salary, paid: paidTotal, balanceDue: employee.salary - paidTotal,
                    payments,
                },
            });
        }

        // No month given — one row per month this employee has any payment in,
        // each with its own expected/paid/balance, so the UI can show history
        // without a month picker round-trip per row.
        const allPayments = await FinanceSalaryPayment.find({ employeeId, deleted: { $ne: true } }).sort({ month: -1 });
        const months = [...new Set(allPayments.map(p => p.month))];
        const byMonth = months.map(m => {
            const paidTotal = allPayments.filter(p => p.month === m).reduce((sum, p) => sum + p.amount, 0);
            return { month: m, expectedSalary: employee.salary, paid: paidTotal, balanceDue: employee.salary - paidTotal };
        });

        res.json({
            success: true,
            data: { employeeId: employee._id, employeeName: employee.name, expectedSalary: employee.salary, months: byMonth, payments: allPayments },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing salary ledger' });
    }
};

export { getSalaryLedger };
