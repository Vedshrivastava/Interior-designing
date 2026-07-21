import FinanceVendor from '../models/financeVendor.js';
import FinanceReferral from '../models/financeReferral.js';
import FinanceLabourProvider from '../models/financeLabourProvider.js';

// Shared by every contractor-money controller (advances, deductions,
// payments, ledger) — money in this ledger always settles with the
// contractor company (a financeVendor with vendorType 'labour_contractor'),
// never with an individual team.
export const assertContractorVendor = async (vendorId) => {
    const vendor = await FinanceVendor.findById(vendorId);
    if (!vendor) throw new Error('Vendor not found');
    if (vendor.vendorType !== 'labour_contractor') throw new Error('This vendor is not a labour contractor');
    return vendor;
};

// Referral is its own collection (financeReferral) — not a financeVendor
// vendorType — since a referral isn't someone the studio purchases
// anything from. Commission payments and the commission ledger only ever
// apply to a real, non-deleted financeReferral record.
export const assertReferralVendor = async (referralId) => {
    const referral = await FinanceReferral.findOne({ _id: referralId, deleted: { $ne: true } });
    if (!referral) throw new Error('Referral not found');
    return referral;
};

// Same idea, for a labourer's supply-side middleman — its own collection
// (financeLabourProvider), not a financeVendor vendorType. Labour provider
// payments and the labour provider ledger only ever apply to a real,
// non-deleted financeLabourProvider record.
export const assertLabourProviderVendor = async (labourProviderId) => {
    const provider = await FinanceLabourProvider.findOne({ _id: labourProviderId, deleted: { $ne: true } });
    if (!provider) throw new Error('Labour provider not found');
    return provider;
};
