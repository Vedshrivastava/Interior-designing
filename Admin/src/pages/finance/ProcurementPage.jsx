import React, { useEffect, useState } from 'react';
import axios from 'axios';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import MasterCrudTable from '../../components/finance/MasterCrudTable';
import PurchaseOrReturnManager from '../../components/finance/PurchaseOrReturnManager';
import MaterialDumpView from '../../components/finance/MaterialDumpView';
import VendorLedgerView from '../../components/finance/VendorLedgerView';
import CommissionLedgerView from '../../components/finance/CommissionLedgerView';

const TABS = [
    { key: 'vendors',       label: 'Vendors' },
    { key: 'purchases',     label: 'Purchases' },
    { key: 'materialDump',  label: 'Material Dump' },
    { key: 'returns',       label: 'Returns' },
    { key: 'ledger',        label: 'Ledger' },
    { key: 'commissionLedger', label: 'Commission Ledger' },
];

const NON_CONTRACTOR = (v) => v.vendorType !== 'labour_contractor';
const IS_REFERRAL = (v) => v.vendorType === 'referral';

/* Shared by the Ledger tab — there's no separate routed vendor detail page
   (mirrors how Contractors' Ledger tab works: a picker on this same page,
   not a new :vendorId route), so picking a vendor happens right here.
   `filter` narrows which vendors show up in the dropdown — Ledger uses
   every non-contractor vendor, Commission Ledger only referral ones,
   since that's the only vendorType a commission ledger means anything for. */
const VendorPicker = ({ url, selectedVendorId, onChange, filter }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [vendors, setVendors] = useState([]);

    useEffect(() => {
        axios.get(`${url}/api/finance/vendors/list`, authHeader)
            .then(res => { if (res.data.success) setVendors(res.data.data.filter(filter)); })
            .catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '360px' }}>
            <p>Vendor</p>
            <select value={selectedVendorId} onChange={e => onChange(e.target.value)}>
                <option value="">Select vendor…</option>
                {vendors.map(v => <option key={v._id} value={v._id}>{v.name}</option>)}
            </select>
        </div>
    );
};

/* Vendors here is the same financeVendor data as everywhere else, just
   client-side filtered to exclude labour_contractor vendors — those show
   up under Contractors instead. No backend change; same MasterCrudTable
   used by Masters and Contractors.

   Purchases/Returns auto-generate the matching Site Inventory stock
   movement server-side (dump for a purchase, return for a return) —
   Material Dump here is the inventory-side read of exactly those
   purchase-generated movements, distinct from Site Inventory's own
   manual dump entry. Ledger = purchases − returns − payments, same
   computed-on-read shape as the Contractor Ledger. Commission Ledger is
   its referral-vendor equivalent — earnings come from financeWork ×
   referralRatePerSqft across the projects this vendor referred, and the
   tab only ever shows referral-type vendors in its picker (there's no
   separate routed vendor detail page to conditionally show/hide it on). */
const ProcurementPage = ({ url }) => {
    const [activeTab, setActiveTab] = useState(TABS[0].key);
    const [selectedVendorId, setSelectedVendorId] = useState('');
    const [selectedCommissionVendorId, setSelectedCommissionVendorId] = useState('');

    return (
        <FinanceTabShell
            label="Procurement"
            subtitle="Material vendors and purchasing — labour contractors live under Contractors instead."
            tabs={TABS}
            activeKey={activeTab}
            onTabChange={setActiveTab}
        >
            {activeTab === 'vendors' && <MasterCrudTable url={url} resourceKey="vendors" filter={NON_CONTRACTOR} />}
            {activeTab === 'purchases' && <PurchaseOrReturnManager url={url} transactionType="purchase" />}
            {activeTab === 'materialDump' && <MaterialDumpView url={url} />}
            {activeTab === 'returns' && <PurchaseOrReturnManager url={url} transactionType="return" />}
            {activeTab === 'ledger' && (
                <>
                    <VendorPicker url={url} selectedVendorId={selectedVendorId} onChange={setSelectedVendorId} filter={NON_CONTRACTOR} />
                    {selectedVendorId
                        ? <VendorLedgerView url={url} vendorId={selectedVendorId} />
                        : <div className="admin-empty-state"><p>Select a vendor to view their ledger.</p></div>}
                </>
            )}
            {activeTab === 'commissionLedger' && (
                <>
                    <VendorPicker url={url} selectedVendorId={selectedCommissionVendorId} onChange={setSelectedCommissionVendorId} filter={IS_REFERRAL} />
                    {selectedCommissionVendorId
                        ? <CommissionLedgerView url={url} vendorId={selectedCommissionVendorId} />
                        : <div className="admin-empty-state"><p>Select a referral vendor to view their commission ledger.</p></div>}
                </>
            )}
        </FinanceTabShell>
    );
};

export default ProcurementPage;
