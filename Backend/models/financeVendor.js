import mongoose from 'mongoose';

const financeVendorSchema = new mongoose.Schema({
    name:       { type: String, required: true },
    vendorType: {
        type: String,
        enum: ['material_supplier', 'labour_contractor', 'referral', 'other'],
        default: 'other',
    },
    phone:      { type: String, default: '' },
    email:      { type: String, default: '' },
    address:    { type: String, default: '' },
    gstNumber:  { type: String, default: '' },
    notes:      { type: String, default: '' },
    deleted:    { type: Boolean, default: false },
    deletedAt:  { type: Date },
    deletedBy:  { type: String },
}, { timestamps: true });

const FinanceVendor = mongoose.models.financeVendor || mongoose.model('financeVendor', financeVendorSchema);
export default FinanceVendor;
