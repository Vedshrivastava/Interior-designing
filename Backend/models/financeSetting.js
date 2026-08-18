import mongoose from 'mongoose';

// One collection for every admin-editable enum list that used to be a
// Settings & Lists dropdown in Excel — work types, expense categories,
// payment modes, TDS sections, units, cities, commission types, direct
// payment categories — scoped by `settingType` instead of one near-empty
// collection each. unit/city back a UI-level dropdown-with-escape-hatch on
// financeMaterial.unit / financeProject.siteLocation (both stay plain
// Strings — see those controllers); commission_type backs
// financeReferral.commissionTypeLabel, which is descriptive/reporting only
// and never affects commission math.
const financeSettingSchema = new mongoose.Schema({
    settingType: {
        type: String,
        enum: ['work_type', 'expense_category', 'payment_mode', 'tds_section', 'unit', 'city', 'commission_type', 'direct_payment_category'],
        required: true,
    },
    name:      { type: String, required: true },
    code:      { type: String, default: '' },  // e.g. TDS section code "194C-IND"
    rate:      { type: Number, default: null }, // e.g. TDS rate percent
    // work_type only — which TDS Section (a sibling financeSetting row,
    // settingType: 'tds_section') applies to payments for work of this
    // type. null means this work type doesn't attract TDS. Resolved by
    // matching financeWork.workType (a plain string) against this row's
    // own `name` — same string-match convention financeContractorRate/
    // financeLabourRate/financeWorkTypeRate already use for work types,
    // not a new fragility.
    tdsSectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeSetting', default: null },
    // work_type only — what a Work of this type is measured/rated in.
    // Every rate (financeContractorRate/financeLabourRate/
    // financeWorkTypeRate) and measurement (financeMeasurement/
    // financeLabourMeasurement) is already a plain "quantity × rate"
    // number regardless of unit — this doesn't change that math, it only
    // decides which word ("Sqft"/"Nos"/"Running Ft") labels it wherever
    // it's shown, resolved once at Work-creation time and snapshotted onto
    // financeWork.unit (see that model's own comment) rather than
    // re-resolved from here every time, so re-labeling a Work Type later
    // never silently relabels a Work that was already measured under the
    // old unit. Distinct from the unrelated settingType: 'unit' list
    // (financeMaterial.unit — bag/kg/litre, free-form) — this is a fixed,
    // closed set specific to how a Work gets measured.
    measurementUnit: { type: String, enum: ['sqft', 'nos', 'rft'], default: 'sqft' },
    // direct_payment_category only — whether a financeClientDirectPayment
    // tagged with this category reduces the client's outstanding balance
    // (getClientBillCreditTotal) and/or the contractor/labourer's own
    // balance payable (getWorkerPayoutDeductionTotal). See
    // financeClientDirectPayment.js for the actual math.
    deductFromClientBill:   { type: Boolean, default: true },
    deductFromWorkerPayout: { type: Boolean, default: false },
    order:     { type: Number, default: 999 },
    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

financeSettingSchema.index({ settingType: 1, name: 1 }, { unique: true });

const FinanceSetting = mongoose.models.financeSetting || mongoose.model('financeSetting', financeSettingSchema);
export default FinanceSetting;
