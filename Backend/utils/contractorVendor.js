import FinanceVendor from '../models/financeVendor.js';

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

// Same idea, for commission — commission payments and the commission
// ledger only ever apply to a financeVendor with vendorType 'referral'.
export const assertReferralVendor = async (vendorId) => {
    const vendor = await FinanceVendor.findById(vendorId);
    if (!vendor) throw new Error('Vendor not found');
    if (vendor.vendorType !== 'referral') throw new Error('This vendor is not a referral vendor');
    return vendor;
};

// Same idea, for a labourer's supply-side middleman — labour provider
// payments and the labour provider ledger only ever apply to a
// financeVendor with vendorType 'labour_provider'.
export const assertLabourProviderVendor = async (vendorId) => {
    const vendor = await FinanceVendor.findById(vendorId);
    if (!vendor) throw new Error('Vendor not found');
    if (vendor.vendorType !== 'labour_provider') throw new Error('This vendor is not a labour provider');
    return vendor;
};
