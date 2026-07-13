import FinanceCashEntry from '../models/financeCashEntry.js';

/*
 * Computed on the fly, no separate "opening cash balance" field exists
 * anywhere — opening balance for a range is just the running total of
 * every cash entry before dateFrom, same computed-on-read approach used
 * everywhere else in this codebase.
 */
const getCashBookSummary = async (req, res) => {
    try {
        const { dateFrom, dateTo } = req.query;
        if (!dateFrom || !dateTo) return res.status(400).json({ success: false, message: 'dateFrom and dateTo are required' });

        const before = await FinanceCashEntry.find({ deleted: { $ne: true }, date: { $lt: new Date(dateFrom) } });
        const openingBalance = before.reduce((sum, e) => sum + (e.type === 'in' ? e.amount : -e.amount), 0);

        const inRange = await FinanceCashEntry.find({
            deleted: { $ne: true }, date: { $gte: new Date(dateFrom), $lte: new Date(dateTo) },
        });
        const inTotal = inRange.filter(e => e.type === 'in').reduce((sum, e) => sum + e.amount, 0);
        const outTotal = inRange.filter(e => e.type === 'out').reduce((sum, e) => sum + e.amount, 0);
        const closingBalance = openingBalance + inTotal - outTotal;

        res.json({ success: true, data: { dateFrom, dateTo, openingBalance, inTotal, outTotal, closingBalance } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing cash book summary' });
    }
};

export { getCashBookSummary };
