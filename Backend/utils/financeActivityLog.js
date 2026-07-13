import FinanceActivityLog from '../models/financeActivityLog.js';
import { broadcast } from '../middlewares/webSocket.js';

// Called alongside the broadcast() every finance write endpoint already
// fires — logging failures are swallowed so they can never break the
// actual save that's already succeeded by the time this runs.
export const logActivity = async ({ eventType, entityType, entityId, projectId, summary, amount, req }) => {
    try {
        const entry = await FinanceActivityLog.create({
            eventType, entityType, entityId,
            projectId: projectId || null,
            summary,
            amount: amount ?? null,
            performedBy: req?.userName || 'Admin',
        });
        broadcast({ type: 'financeActivityLogged', data: entry });
    } catch (err) {
        console.error('Error logging activity:', err);
    }
};
