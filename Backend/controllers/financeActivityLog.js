import FinanceActivityLog from '../models/financeActivityLog.js';

const listActivity = async (req, res) => {
    try {
        const { projectId, eventType, dateFrom, dateTo, page, limit } = req.query;
        const filter = {};
        if (projectId) filter.projectId = projectId;
        if (eventType) filter.eventType = eventType;
        if (dateFrom || dateTo) {
            filter.timestamp = {};
            if (dateFrom) filter.timestamp.$gte = new Date(dateFrom);
            if (dateTo) filter.timestamp.$lte = new Date(dateTo);
        }

        const pageNum  = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 50);
        const skip     = (pageNum - 1) * limitNum;

        const [items, total] = await Promise.all([
            FinanceActivityLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limitNum),
            FinanceActivityLog.countDocuments(filter),
        ]);

        res.json({
            success: true,
            data: items,
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
            hasMore: pageNum * limitNum < total,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching activity log' });
    }
};

export { listActivity };
