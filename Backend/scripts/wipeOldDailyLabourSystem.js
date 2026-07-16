// One-time cleanup: the Daily Labour (attendance-based, half/full/extra
// day) system is replaced outright by the individual sqft-rate Labour
// system (financeLabourRate / financeLabourMeasurement / financeLabourAdvance
// / financeLabourDeduction / financeLabourPayment). The two are built on
// incompatible bases (hours/days vs. measured area) so there's no
// meaningful migration — old data is wiped rather than converted, per
// explicit confirmation this is dev/test data with no production history
// worth keeping.
//
// Run manually: node scripts/wipeOldDailyLabourSystem.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI, { dbName: 'Interior' });
    console.log('Connected.');

    const db = mongoose.connection.db;
    const names = (await db.listCollections().toArray()).map(c => c.name);

    for (const name of ['financedailylabours', 'financesupervisorlabourpayments']) {
        if (names.includes(name)) {
            const result = await db.collection(name).deleteMany({});
            console.log(`Wiped ${result.deletedCount} docs from ${name}`);
        } else {
            console.log(`Collection ${name} does not exist — nothing to wipe`);
        }
    }

    // Also drop the roster's old day-rate field, now that financeLabourRate
    // (per project + work type) is the real rate source.
    const labourerResult = await db.collection('financelabourers').updateMany({}, { $unset: { defaultRate: '' } });
    console.log(`Cleared defaultRate on ${labourerResult.modifiedCount} labourer roster entries`);

    console.log('Done.');
    await mongoose.disconnect();
};

run().catch(err => { console.error(err); process.exit(1); });
