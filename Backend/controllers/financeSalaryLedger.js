import FinanceEmployee from '../models/financeEmployee.js';
import FinanceSalaryPayment from '../models/financeSalaryPayment.js';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// A flat employee.salary is only the right "expected" figure for a month
// the employee was actually on payroll for in full. Joining mid-month
// prorates that one month by days actually employed; joining after the
// month hasn't started yet at all means nothing is expected for it —
// without this, a brand-new hire (or anyone checked partway through their
// joining month) showed a full month's salary as immediately due.
const expectedSalaryForMonth = (employee, month) => {
    // employee.salary is nullable in practice — leaving the Add/Edit
    // Employee form's optional Salary field blank sends '' to a Number
    // field, which Mongoose casts to null (not the schema's `0` default;
    // that only applies when the field is undefined) — so this can't
    // assume a number here.
    const salary = employee.salary || 0;
    if (!employee.joiningDate) return salary;
    const joined = new Date(employee.joiningDate);
    const joinedMonth = joined.toISOString().slice(0, 7);
    if (joinedMonth > month) return 0;
    if (joinedMonth < month) return salary;
    const [y, m] = month.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const daysWorked = daysInMonth - joined.getDate() + 1;
    return round2(salary * daysWorked / daysInMonth);
};

/*
 * Computed fresh on every call — nothing stored. For a given month:
 * Balance Due = expectedSalaryForMonth(employee, month) − SUM(salaryPayment.amount
 * for that employee + month) — see expectedSalaryForMonth for why this
 * isn't always the flat employee.salary. Without a month, returns the
 * same breakdown per month across every month this employee has a
 * payment in, so the UI can show a running history without needing N
 * separate calls.
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
            const expectedSalary = expectedSalaryForMonth(employee, month);
            return res.json({
                success: true,
                data: {
                    employeeId: employee._id, employeeName: employee.name, month,
                    expectedSalary, paid: paidTotal, balanceDue: round2(expectedSalary - paidTotal),
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
            const expectedSalary = expectedSalaryForMonth(employee, m);
            return { month: m, expectedSalary, paid: paidTotal, balanceDue: round2(expectedSalary - paidTotal) };
        });

        res.json({
            success: true,
            data: { employeeId: employee._id, employeeName: employee.name, expectedSalary: employee.salary || 0, months: byMonth, payments: allPayments },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing salary ledger' });
    }
};

export { getSalaryLedger, expectedSalaryForMonth };
