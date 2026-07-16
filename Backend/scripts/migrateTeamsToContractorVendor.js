// One-time migration: collapses financeTeam into financeVendor directly.
// A contractor's crews never actually diverge in rate or reporting once
// you look past headcount (the Contractor Ledger already aggregates every
// team under one vendor into a single balance) — so `teamId` becomes
// `contractorVendorId` everywhere, and the intermediate Team record goes
// away.
//
// Purely additive: reads the old financeTeam / financeTeamRate /
// financeWorkTeamAssignment collections (left untouched, as a rollback
// safety net) and writes into the new financeContractorRate /
// financeWorkContractorAssignment collections, plus backfills
// financeMeasurement.contractorVendorId on existing documents. Idempotent
// — re-running it just re-upserts the same rows.
//
// Run manually: node scripts/migrateTeamsToContractorVendor.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import FinanceTeam from '../models/financeTeam.js';
import FinanceWorkTeamAssignment from '../models/financeWorkTeamAssignment.js';
import FinanceTeamRate from '../models/financeTeamRate.js';
import FinanceWorkContractorAssignment from '../models/financeWorkContractorAssignment.js';
import FinanceContractorRate from '../models/financeContractorRate.js';
import FinanceMeasurement from '../models/financeMeasurement.js';
import FinanceWork from '../models/financeWork.js';

dotenv.config();

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI, { dbName: 'Interior' });
    console.log('Connected.');

    // 1. Build teamId -> contractorVendorId map (includes soft-deleted
    // teams too — old records may reference a since-deleted team, and we
    // still want to resolve their vendor correctly).
    const teams = await FinanceTeam.find({});
    const vendorIdByTeamId = new Map();
    for (const t of teams) {
        if (t.contractorVendorId) vendorIdByTeamId.set(t._id.toString(), t.contractorVendorId.toString());
    }
    console.log(`Loaded ${teams.length} teams (${vendorIdByTeamId.size} with a contractor vendor set).`);

    // 2. financeWorkTeamAssignment -> financeWorkContractorAssignment
    const oldAssignments = await FinanceWorkTeamAssignment.find({});
    let assignmentsCreated = 0, assignmentsSkippedNoVendor = 0;
    for (const a of oldAssignments) {
        const vendorId = vendorIdByTeamId.get(a.teamId.toString());
        if (!vendorId) { assignmentsSkippedNoVendor++; continue; }
        const res = await FinanceWorkContractorAssignment.updateOne(
            { workId: a.workId, contractorVendorId: vendorId },
            {
                $setOnInsert: {
                    workId: a.workId, contractorVendorId: vendorId,
                    notes: a.notes || '', deleted: a.deleted || false,
                    deletedAt: a.deletedAt, deletedBy: a.deletedBy,
                },
            },
            { upsert: true }
        );
        if (res.upsertedCount) assignmentsCreated++;
    }
    console.log(`Work-contractor assignments: ${assignmentsCreated} created, ${assignmentsSkippedNoVendor} skipped (team had no vendor).`);

    // 2b. Legacy financeWork.teamId — the field is no longer in the current
    // schema, so read it via .lean() straight off the raw stored document.
    const worksRaw = await FinanceWork.find({}).lean();
    let legacyAssignmentsCreated = 0;
    for (const w of worksRaw) {
        if (!w.teamId) continue;
        const vendorId = vendorIdByTeamId.get(w.teamId.toString());
        if (!vendorId) continue;
        const res = await FinanceWorkContractorAssignment.updateOne(
            { workId: w._id, contractorVendorId: vendorId },
            { $setOnInsert: { workId: w._id, contractorVendorId: vendorId, notes: '', deleted: false } },
            { upsert: true }
        );
        if (res.upsertedCount) legacyAssignmentsCreated++;
    }
    console.log(`Legacy Work.teamId backfill: ${legacyAssignmentsCreated} additional assignments created.`);

    // 3. financeTeamRate -> financeContractorRate. Two teams under the same
    // vendor with a rate for the same (project, workType) is a genuine
    // conflict — there's no principled way to auto-merge two different
    // rates, so the first one wins and the rest are logged for review.
    const oldRates = await FinanceTeamRate.find({});
    let ratesCreated = 0, ratesSkippedNoVendor = 0;
    const rateConflicts = [];
    for (const r of oldRates) {
        const vendorId = vendorIdByTeamId.get(r.teamId.toString());
        if (!vendorId) { ratesSkippedNoVendor++; continue; }
        const existing = await FinanceContractorRate.findOne({ projectId: r.projectId, contractorVendorId: vendorId, workType: r.workType });
        if (existing) {
            const sameValue = existing.paymentBasis === r.paymentBasis
                && existing.ratePerSqft === r.ratePerSqft && existing.ratePerDay === r.ratePerDay;
            if (!sameValue) {
                rateConflicts.push({ projectId: r.projectId.toString(), vendorId, workType: r.workType, kept: existing._id.toString(), skipped: r._id.toString() });
            }
            continue;
        }
        await FinanceContractorRate.create({
            projectId: r.projectId, contractorVendorId: vendorId, workType: r.workType,
            paymentBasis: r.paymentBasis, ratePerSqft: r.ratePerSqft, ratePerDay: r.ratePerDay,
            deleted: r.deleted || false, deletedAt: r.deletedAt, deletedBy: r.deletedBy,
        });
        ratesCreated++;
    }
    console.log(`Contractor rates: ${ratesCreated} created, ${ratesSkippedNoVendor} skipped (team had no vendor), ${rateConflicts.length} conflicts (kept first, see below).`);
    if (rateConflicts.length) console.log('Rate conflicts (manual review recommended):', JSON.stringify(rateConflicts, null, 2));

    // 4. financeMeasurement.teamId (+ Work's legacy teamId fallback) ->
    // financeMeasurement.contractorVendorId, written directly since the
    // current schema does declare this field.
    const measurementsRaw = await FinanceMeasurement.find({}).lean();
    const workTeamById = new Map(worksRaw.map(w => [w._id.toString(), w.teamId ? w.teamId.toString() : null]));
    let measurementsUpdated = 0, measurementsUnresolved = 0;
    const bulkOps = [];
    for (const m of measurementsRaw) {
        if (m.contractorVendorId) continue; // already migrated (idempotent re-run)
        const rawTeamId = m.teamId ? m.teamId.toString() : (workTeamById.get(m.workId.toString()) || null);
        if (!rawTeamId) { measurementsUnresolved++; continue; }
        const vendorId = vendorIdByTeamId.get(rawTeamId);
        if (!vendorId) { measurementsUnresolved++; continue; }
        bulkOps.push({ updateOne: { filter: { _id: m._id }, update: { $set: { contractorVendorId: vendorId } } } });
    }
    if (bulkOps.length) {
        const result = await FinanceMeasurement.bulkWrite(bulkOps);
        measurementsUpdated = result.modifiedCount;
    }
    console.log(`Measurements: ${measurementsUpdated} updated with contractorVendorId, ${measurementsUnresolved} unresolved (no teamId anywhere, or team had no vendor).`);

    console.log('\nMigration complete. Old financeTeam/financeTeamRate/financeWorkTeamAssignment collections left untouched as a rollback safety net.');
    process.exit(0);
};

run().catch(err => { console.error('Migration failed:', err); process.exit(1); });
