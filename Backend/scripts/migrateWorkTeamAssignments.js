import mongoose from 'mongoose';
import dotenv from 'dotenv';
import FinanceWork from '../models/financeWork.js';
import FinanceWorkTeamAssignment from '../models/financeWorkTeamAssignment.js';
dotenv.config();

// One-time backfill: gives every pre-existing Work with a legacy teamId a
// real financeWorkTeamAssignment row, so the "manage teams" UI has
// something to display/edit for it. Safe to re-run — upserts on
// (workId, teamId), so already-migrated rows are just skipped.
async function migrate() {
    await mongoose.connect(process.env.MONGO_URI, { dbName: 'Interior' });
    console.log('Connected to MongoDB');

    const works = await FinanceWork.find({ teamId: { $ne: null }, deleted: { $ne: true } });
    let created = 0, skipped = 0;
    for (const w of works) {
        const res = await FinanceWorkTeamAssignment.findOneAndUpdate(
            { workId: w._id, teamId: w.teamId },
            { $setOnInsert: { workId: w._id, teamId: w.teamId, notes: 'Migrated from legacy financeWork.teamId' } },
            { upsert: true, includeResultMetadata: true, setDefaultsOnInsert: true }
        );
        if (res.lastErrorObject?.upserted) created++; else skipped++;
    }

    console.log(`\nDone — ${created} assignment rows created, ${skipped} already existed.`);
    await mongoose.disconnect();
}

migrate().catch(err => { console.error(err); process.exit(1); });
