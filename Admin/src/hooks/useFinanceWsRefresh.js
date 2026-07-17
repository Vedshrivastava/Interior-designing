import { useRef } from 'react';
import { useWebSocket } from './useWebSocket';

/**
 * Silent, debounced refetch trigger for the module-cache pattern used across
 * Finance's Tier-0/1 pages (see dashboardCache/clientsSummaryCache/etc.):
 * those pages already refetch once on mount and quietly update their cache
 * when the request resolves, but do nothing while the user stays put on the
 * page — a mutation from another tab/admin (or the page's own form) never
 * appears until the next navigation. This fills that gap by calling
 * onRelevant (normally the same fetch function the mount effect already
 * uses) whenever a matching broadcast arrives.
 *
 * eventTypes: array of `msg.type` strings to react to, or ['*'] to react to
 * every finance broadcast (for views that aggregate across most domains).
 * Debounced 400ms since one mutation commonly fires 2-3 related events
 * back to back (e.g. a labour measurement fires both
 * financeLabourMeasurementsChanged and financeWorksChanged).
 */
export const useFinanceWsRefresh = (eventTypes, onRelevant) => {
    const timerRef = useRef(null);
    useWebSocket((msg) => {
        if (!eventTypes.includes('*') && !eventTypes.includes(msg.type)) return;
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => onRelevant(msg), 400);
    });
};
