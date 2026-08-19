// One-time backfill: financeWork.materialTrackingEnabled is a new field
// (default: true) — every Work created before it existed reads as `true`
// via that schema default the moment it's fetched, regardless of what its
// own project's contractType actually says. For a without_material
// project that's a real regression: material tracking on measurement save
// used to be gated by the project's own flag (correctly false), and now
// reads the Work's flag instead (incorrectly true, since the field was
// never actually written).
//
// This sets every existing Work's materialTrackingEnabled to exactly what
// its own project's contractType would have forced (see
// controllers/financeWork.js's resolveWorkMaterialTracking — same rule,
// reimplemented standalone here since this runs outside a request):
// always true for with_material, always false for without_material, and
// the project's own current materialTrackingEnabled for advance (there's
// no way to know retroactively what an advance project's per-Work choice
// *would* have been, so its current project-wide value is the closest
// honest default — same value every advance-project Work effectively used
// before this feature existed).
//
// Idempotent — re-running just re-derives and re-writes the same values.
// Run manually: node scripts/backfillWorkMaterialTracking.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import FinanceWork from '../models/financeWork.js';
import FinanceProject from '../models/financeProject.js';

dotenv.config();

const resolve = (project) => {
    if (project.contractType === 'with_material') return true;
    if (project.contractType === 'without_material') return false;
    return !!project.materialTrackingEnabled;
};

const run = async () => {
    const dbName = process.env.MONGO_DB_NAME || 'InteriorDev';
    await mongoose.connect(process.env.MONGO_URI, { dbName });
    console.log(`Connected to ${dbName}.`);

    const projects = await FinanceProject.find({});
    const projectById = new Map(projects.map(p => [p._id.toString(), p]));
    console.log(`Loaded ${projects.length} projects.`);

    const works = await FinanceWork.find({});
    console.log(`Loaded ${works.length} works.`);

    let updated = 0, skippedNoProject = 0;
    for (const w of works) {
        const project = projectById.get(w.projectId.toString());
        if (!project) { skippedNoProject += 1; continue; }
        const correct = resolve(project);
        if (w.materialTrackingEnabled !== correct) {
            await FinanceWork.updateOne({ _id: w._id }, { $set: { materialTrackingEnabled: correct } });
            updated += 1;
        }
    }
    console.log(`Updated ${updated} works. Skipped ${skippedNoProject} (no matching project, likely orphaned).`);

    await mongoose.disconnect();
    console.log('Done.');
};

run().catch(err => { console.error(err); process.exit(1); });
