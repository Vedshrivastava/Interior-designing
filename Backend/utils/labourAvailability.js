import FinanceWorkLabourAssignment from '../models/financeWorkLabourAssignment.js';

// A labourer can only be on one Work at a time, full stop — a physical
// person can't be on two sites simultaneously, and unlike a contractor
// (who brings a whole crew), one labourer is one person. "Currently on a
// Work" just means a non-deleted assignment row exists for them anywhere
// — reassigning them requires explicitly removing that row first (see
// removeWorkLabourAssignment), not waiting for the old Work to complete.
//
// excludeWorkId lets a caller add more labourers to a Work they're
// already partly staffed on without tripping over their own existing rows.
export const assertLabourersAvailable = async (labourerIds, excludeWorkId = null) => {
    const filter = { labourerId: { $in: labourerIds }, deleted: { $ne: true } };
    if (excludeWorkId) filter.workId = { $ne: excludeWorkId };
    const conflict = await FinanceWorkLabourAssignment.findOne(filter)
        .populate('labourerId', 'name')
        .populate({ path: 'workId', select: 'workType projectId', populate: { path: 'projectId', select: 'name' } });
    if (conflict) {
        const labourerName = conflict.labourerId?.name || 'A labourer';
        const workType = conflict.workId?.workType || 'a work';
        const projectName = conflict.workId?.projectId?.name || 'another project';
        throw new Error(`${labourerName} is already assigned to ${workType} at ${projectName} — remove them from there first`);
    }
};
