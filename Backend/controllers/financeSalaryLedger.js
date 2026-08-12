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
            const payments = await FinanceSalaryPayment.find({ employeeId, month, deleted: { $ne: true } }).populate('tdsSectionId', 'name code').sort({ date: -1 });
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
        const allPayments = await FinanceSalaryPayment.find({ employeeId, deleted: { $ne: true } }).populate('tdsSectionId', 'name code').sort({ month: -1 });
        const months = [...new Set(allPayments.map(p => p.month))];
        const byMonth = months.map(m => {
            const paidTotal = allPayments.filter(p => p.month === m).reduce((sum, p) => sum + p.amount, 0);
            const expectedSalary = expectedSalaryForMonth(employee, m);
            return { month: m, expectedSalary, paid: paidTotal, balanceDue: round2(expectedSalary - paidTotal) };
        });
        // Informational only — already inside each month's `paid` above
        // (the gross figure Balance Due nets against); surfaces how much
        // was withheld as TDS rather than actually reaching the employee.
        const tdsTotal = round2(allPayments.reduce((sum, p) => sum + (p.tdsAmount || 0), 0));

        // Oldest unpaid month — walked from joining date through the
        // current month, NOT just `months` above (that list only includes
        // months with at least one payment; a month with ZERO payments,
        // the most common way to be behind, would otherwise never surface
        // here at all). Lets the Add Payment form default to this instead
        // of the current month, so a normal payment naturally clears
        // backlog first — same "don't silently skip a fully-unpaid month"
        // reasoning as computeCompanyWideSalaryPayable's own walk.
        const currentMonthKey = new Date().toISOString().slice(0, 7);
        const paidByMonth = new Map(byMonth.map(m => [m.month, m.paid]));
        let oldestUnpaidMonth = null;
        if (employee.joiningDate) {
            const joined = new Date(employee.joiningDate);
            let y = joined.getFullYear(), mo = joined.getMonth() + 1;
            const [curY, curM] = currentMonthKey.split('-').map(Number);
            while (y < curY || (y === curY && mo <= curM)) {
                const key = `${y}-${String(mo).padStart(2, '0')}`;
                const expected = expectedSalaryForMonth(employee, key);
                const paid = paidByMonth.get(key) || 0;
                if (expected - paid > 0.5) { oldestUnpaidMonth = key; break; }
                mo += 1;
                if (mo > 12) { mo = 1; y += 1; }
            }
        } else if (expectedSalaryForMonth(employee, currentMonthKey) - (paidByMonth.get(currentMonthKey) || 0) > 0.5) {
            oldestUnpaidMonth = currentMonthKey;
        }

        res.json({
            success: true,
            data: { employeeId: employee._id, employeeName: employee.name, expectedSalary: employee.salary || 0, months: byMonth, payments: allPayments, tdsTotal, oldestUnpaidMonth },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing salary ledger' });
    }
};

/*
 * Same balanceDue figure getSalaryLedger returns per employee for a given
 * month, but for every employee in one request/two queries instead of the
 * Dashboard firing one /salary-ledger call per employee (the N+1 fan-out
 * this replaces — see FinanceHome.jsx's fetchDashboard).
 */
const getSalaryLedgersBatch = async (req, res) => {
    try {
        const { month } = req.query;
        if (!month) return res.status(400).json({ success: false, message: 'month is required' });

        const employees = await FinanceEmployee.find({ deleted: { $ne: true } });
        const employeeIds = employees.map(e => e._id);
        const payments = employeeIds.length
            ? await FinanceSalaryPayment.find({ employeeId: { $in: employeeIds }, month, deleted: { $ne: true } })
            : [];
        const paidByEmployee = new Map();
        for (const p of payments) {
            const key = p.employeeId.toString();
            paidByEmployee.set(key, (paidByEmployee.get(key) || 0) + p.amount);
        }
        const data = employees.map(e => {
            const expectedSalary = expectedSalaryForMonth(e, month);
            const paid = paidByEmployee.get(e._id.toString()) || 0;
            return { employeeId: e._id, balanceDue: round2(expectedSalary - paid) };
        });
        res.json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing salary ledgers' });
    }
};

export { getSalaryLedger, getSalaryLedgersBatch, expectedSalaryForMonth };
