import mongoose from 'mongoose';

// An actual payout to a vendor, settling part of the balance the vendor
// ledger computes (purchases − returns − payments).
const financeVendorPaymentSchema = new mongoose.Schema({
    vendorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'financeVendor', required: true },
    projectId:  { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', default: null },
    purchaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'financePurchase', default: null }, // optional — against one purchase or general

    amount: { type: Number, required: true },
    date:   { type: Date, required: true },

    paymentMode:     { type: String, default: '' },
    bankOrCashLabel: { type: String, default: '' },
    utrNumber:       { type: String, default: '' },
    attachmentUrl:   { type: String, default: '' },
    notes:           { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceVendorPayment = mongoose.models.financeVendorPayment || mongoose.model('financeVendorPayment', financeVendorPaymentSchema);
export default FinanceVendorPayment;
