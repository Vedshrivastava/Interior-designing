import FinanceGstFiling from '../models/financeGstFiling.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

const listGstFilings = async (req, res) => {
    try {
        const items = await FinanceGstFiling.find({ deleted: { $ne: true } }).sort({ month: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching GST filings' });
    }
};

// One record per month — the CA's actual filed figures, entered by hand.
// Upsert by month rather than a strict add/edit split: re-saving the same
// month (e.g. after the CA revises a number) should just overwrite it, not
// create a second competing record for the same month.
const saveGstFiling = async (req, res) => {
    try {
        const { month, gstPayable, gstClaimable, taxPaid, filedDate, notes } = req.body;
        if (!/^\d{4}-\d{2}$/.test(month || '')) return res.status(400).json({ success: false, message: 'A valid month (YYYY-MM) is required' });

        const item = await FinanceGstFiling.findOneAndUpdate(
            { month },
            {
                month, gstPayable: Number(gstPayable) || 0, gstClaimable: Number(gstClaimable) || 0,
                taxPaid: Number(taxPaid) || 0, filedDate: filedDate || null, notes: notes || '',
                deleted: false, deletedAt: null, deletedBy: null,
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        broadcast({ type: 'financeGstFilingsChanged' });

        await logActivity({
            eventType: 'gst_filing_saved',
            entityType: 'financeGstFiling',
            entityId: item._id,
            projectId: null,
            summary: `GST filing recorded for ${month} — Payable ${gstPayable || 0}, Claimable ${gstClaimable || 0}`,
            req,
        });

        res.json({ success: true, message: 'GST filing saved', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error saving GST filing' });
    }
};

// Soft delete — reverts that month back to the system's own computed
// estimate everywhere (computeGstItcPosition simply finds no filing for
// it anymore).
const removeGstFiling = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceGstFiling.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeGstFilingsChanged' });

        await logActivity({
            eventType: 'gst_filing_deleted',
            entityType: 'financeGstFiling',
            entityId: item._id,
            projectId: null,
            summary: `GST filing for ${item.month} removed — reverted to computed estimate`,
            req,
        });

        res.json({ success: true, message: 'GST filing removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing GST filing' });
    }
};

export { listGstFilings, saveGstFiling, removeGstFiling };
