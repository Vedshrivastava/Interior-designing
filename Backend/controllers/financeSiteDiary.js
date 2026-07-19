import FinanceSiteDiary from '../models/financeSiteDiary.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

const listSiteDiaryEntries = async (req, res) => {
    try {
        const { projectId, status } = req.query;
        const filter = { deleted: { $ne: true } };
        if (projectId) filter.projectId = projectId;
        if (status) filter.status = status;
        const items = await FinanceSiteDiary.find(filter)
            .populate('projectId', 'name')
            .sort({ date: -1, createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching site diary entries' });
    }
};

const addSiteDiaryEntry = async (req, res) => {
    try {
        const { projectId, date, entryType, note, loggedBy } = req.body;
        if (!projectId) return res.status(400).json({ success: false, message: 'Project is required' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });
        if (!note || !note.trim()) return res.status(400).json({ success: false, message: 'Entry text is required' });

        const item = new FinanceSiteDiary({
            projectId, date,
            entryType: entryType === 'issue' ? 'issue' : 'note',
            note: note.trim(),
            loggedBy: loggedBy || '',
        });
        await item.save();

        broadcast({ type: 'financeSiteDiaryChanged', projectId });

        await logActivity({
            eventType: 'site_diary_entry',
            entityType: 'financeSiteDiary',
            entityId: item._id,
            projectId,
            summary: `Site Diary: ${item.entryType === 'issue' ? 'Issue' : 'Note'} logged — ${item.note.slice(0, 80)}`,
            req,
        });

        res.json({ success: true, message: 'Entry logged', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error logging entry' });
    }
};

const resolveSiteDiaryIssue = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceSiteDiary.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        if (item.entryType !== 'issue') return res.status(400).json({ success: false, message: 'Only issues can be resolved' });

        item.status = 'resolved';
        await item.save();

        broadcast({ type: 'financeSiteDiaryChanged', projectId: item.projectId });

        await logActivity({
            eventType: 'site_diary_issue_resolved',
            entityType: 'financeSiteDiary',
            entityId: item._id,
            projectId: item.projectId,
            summary: `Site Diary: Issue resolved — ${item.note.slice(0, 80)}`,
            req,
        });

        res.json({ success: true, message: 'Issue marked resolved' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error resolving issue' });
    }
};

const removeSiteDiaryEntry = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceSiteDiary.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });

        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();

        broadcast({ type: 'financeSiteDiaryChanged', projectId: item.projectId });
        res.json({ success: true, message: 'Entry removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing entry' });
    }
};

export { listSiteDiaryEntries, addSiteDiaryEntry, resolveSiteDiaryIssue, removeSiteDiaryEntry };
