import FinanceWorkTeamAssignment from '../models/financeWorkTeamAssignment.js';
import FinanceWork from '../models/financeWork.js';

/*
 * Correctness here never depends on the one-time migration having run —
 * every helper falls back to a Work's legacy `teamId` live if no real
 * financeWorkTeamAssignment rows exist for it yet. This is the one place
 * that fallback lives; every earnings call site imports from here instead
 * of re-deriving it.
 */

// One query, `Map<workId, [{teamId, notes}]>`.
export const getAssignmentsByWork = async (workIds) => {
    const map = new Map();
    if (!workIds.length) return map;
    const rows = await FinanceWorkTeamAssignment.find({ workId: { $in: workIds }, deleted: { $ne: true } });
    for (const r of rows) {
        const key = r.workId.toString();
        if (!map.has(key)) map.set(key, []);
        map.get(key).push({ teamId: r.teamId, notes: r.notes });
    }
    return map;
};

// Real assignment rows for this Work if any exist, else its legacy single
// teamId if set, else nothing.
export const getTeamIdsForWork = (work, assignmentsByWorkId) => {
    const real = assignmentsByWorkId.get(work._id.toString());
    if (real && real.length) return real.map(a => a.teamId);
    if (work.teamId) return [work.teamId];
    return [];
};

// Replaces every `FinanceWork.find({ teamId: { $in: teamIds } })` call used
// to find "works belonging to this contractor's teams" — unions workIds
// found via real assignments with workIds only reachable via the legacy field.
export const findWorkIdsForTeams = async (teamIds) => {
    const [assignments, legacyWorks] = await Promise.all([
        FinanceWorkTeamAssignment.find({ teamId: { $in: teamIds }, deleted: { $ne: true } }, 'workId'),
        FinanceWork.find({ teamId: { $in: teamIds }, deleted: { $ne: true } }, '_id'),
    ]);
    const ids = new Set([
        ...assignments.map(a => a.workId.toString()),
        ...legacyWorks.map(w => w._id.toString()),
    ]);
    return [...ids];
};

// A single measurement's team, resolved: its own teamId if present, else
// the Work's legacy teamId, flagged so the UI can distinguish the two.
export const resolveMeasurementTeamId = (measurement, work) => {
    if (measurement.teamId) return { teamId: measurement.teamId, isLegacyAttribution: false };
    if (work?.teamId) return { teamId: work.teamId, isLegacyAttribution: true };
    return { teamId: null, isLegacyAttribution: false };
};
