import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import MasterCrudTable from '../../components/finance/MasterCrudTable';
import QuickAddPicker from '../../components/finance/QuickAddPicker';
import PurchaseOrReturnManager from '../../components/finance/PurchaseOrReturnManager';
import MaterialDumpView from '../../components/finance/MaterialDumpView';
import VendorLedgerView from '../../components/finance/VendorLedgerView';
import CommissionLedgerView from '../../components/finance/CommissionLedgerView';
import { ChartCard, ChartGrid, EmptyChart, CHART_COLORS, formatINR } from '../../components/finance/DashboardWidgets';
import '../../styles/dashboard.css';

const TABS = [
    { key: 'vendors',       label: 'Vendors' },
    { key: 'purchases',     label: 'Purchases' },
    { key: 'materialDump',  label: 'Material Dump' },
    { key: 'returns',       label: 'Returns' },
    { key: 'ledger',        label: 'Ledger' },
    { key: 'referrals',        label: 'Referrals' },
    { key: 'commissionLedger', label: 'Commission Ledger' },
];

const NON_CONTRACTOR = (v) => v.vendorType !== 'labour_contractor';

// Same dashboardCache pattern as FinanceHome.jsx — the Vendors overview
// tab always shows the same company-wide aggregate (no picker scoping it),
// so a single module-level cache is enough.
let vendorsOverviewCache = null;

/* Shared by the Ledger tab — there's no separate routed vendor detail page
   (mirrors how Contractors' Ledger tab works: a picker on this same page,
   not a new :vendorId route), so picking a vendor happens right here.
   `filter` narrows which vendors show up in the dropdown — Ledger uses
   every non-contractor vendor. */
const VendorPicker = ({ url, selectedVendorId, onChange, filter, presetValues }) => (
    <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '480px' }}>
        <p>Vendor</p>
        <QuickAddPicker url={url} resourceKey="vendors" value={selectedVendorId} onChange={onChange}
            filter={filter} presetValues={presetValues} placeholder="Select vendor…" />
    </div>
);

/* Referral is its own collection (financeReferral), not a vendor — its
   own plain picker, no vendorType filter needed. */
const ReferralPicker = ({ url, selectedReferralId, onChange }) => (
    <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '480px' }}>
        <p>Referral</p>
        <QuickAddPicker url={url} resourceKey="referrals" value={selectedReferralId} onChange={onChange} placeholder="Select referral…" />
    </div>
);

/* Tier-1 mini-dashboard for the Vendors tab — top vendors by purchase
   volume (₹) and a monthly average-purchase-rate trend per material (so
   rate creep is visible), on top of the existing vendor-filtered CRUD
   table. Scoped to material_supplier vendors only, same as Vendor
   Analysis in Reports — referrals have their own Commission Ledger tab
   instead. */
const ProcurementVendorsOverviewTab = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [summary, setSummary] = useState(vendorsOverviewCache);
    const [loading, setLoading] = useState(!vendorsOverviewCache);

    const fetchSummary = () => {
        axios.get(`${url}/api/finance/reports/vendors-summary`, authHeader)
            .then(res => { if (res.data.success) { setSummary(res.data.data); vendorsOverviewCache = res.data.data; } })
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (!vendorsOverviewCache) setLoading(true);
        fetchSummary();
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    useFinanceWsRefresh(['financeVendorsChanged', 'financePurchasesChanged', 'financeVendorLedgerChanged', 'financeMaterialsChanged'], fetchSummary);

    const vendors = summary?.vendors || [];
    const topVendors = [...vendors].sort((a, b) => b.purchases - a.purchases).slice(0, 8).map(v => ({ name: v.vendorName, purchases: v.purchases }));

    const trend = summary?.materialCostTrend || [];
    const monthSet = new Set(trend.flatMap(m => m.points.map(p => p.month)));
    const trendData = [...monthSet].sort().map(month => {
        const row = { month };
        for (const m of trend) {
            const point = m.points.find(p => p.month === month);
            if (point) row[m.materialName] = point.avgRate;
        }
        return row;
    });

    return (
        <div>
            {!loading && vendors.length > 0 && (
                <>
                    <ChartGrid>
                        <ChartCard title="Top Vendors by Purchase Volume">
                            {topVendors.some(v => v.purchases > 0) ? (
                                <ResponsiveContainer width="100%" height={240}>
                                    <BarChart data={topVendors} layout="vertical" margin={{ left: 24 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                        <XAxis type="number" tick={{ fontSize: 11 }} />
                                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                                        <Tooltip formatter={(v) => formatINR(v)} />
                                        <Bar dataKey="purchases" name="Purchases" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : <EmptyChart text="No purchases recorded yet." />}
                        </ChartCard>
                        <ChartCard title="Material Cost Trend (avg rate/month, top materials)">
                            {trendData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={240}>
                                    <LineChart data={trendData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                                        <YAxis tick={{ fontSize: 11 }} />
                                        <Tooltip formatter={(v) => formatINR(v)} />
                                        <Legend wrapperStyle={{ fontSize: 10 }} />
                                        {trend.map((m, i) => (
                                            <Line key={m.materialId} type="monotone" dataKey={m.materialName} stroke={CHART_COLORS[i % CHART_COLORS.length]} dot={{ r: 2 }} />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : <EmptyChart text="No purchase history yet." />}
                        </ChartCard>
                    </ChartGrid>

                    <div className="list-table" style={{ marginBottom: '24px' }}>
                        <div className="list-table-format title" style={{ gridTemplateColumns: '1.6fr 1fr 1fr 1fr 1fr' }}>
                            <b>Vendor</b><b>Purchases</b><b>Returns</b><b>Payments</b><b>Amount Owed</b>
                        </div>
                        {vendors.map(v => (
                            <div key={v.vendorId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.6fr 1fr 1fr 1fr 1fr' }}>
                                <p>{v.vendorName}</p>
                                <p>{formatINR(v.purchases)}</p>
                                <p>{formatINR(v.returns)}</p>
                                <p>{formatINR(v.payments)}</p>
                                <p style={{ color: v.amountOwed > 0 ? '#c0392b' : 'var(--moss)' }}>{formatINR(v.amountOwed)}</p>
                            </div>
                        ))}
                    </div>
                </>
            )}
            <MasterCrudTable url={url} resourceKey="vendors" filter={NON_CONTRACTOR} presetValues={{ vendorType: 'material_supplier' }} />
        </div>
    );
};

/* Vendors here is the same financeVendor data as everywhere else, just
   client-side filtered to exclude labour_contractor vendors — those show
   up under Contractors instead. No backend change; same MasterCrudTable
   used by Contractors. New vendors added from this tab are preset to
   vendorType 'material_supplier' (this page's own stated purpose, per
   its subtitle) rather than offering Other as if it belonged here — an
   existing "other" vendor that shows up in this same list still shows
   and can still change its real type when edited, presetValues only
   ever applies to a fresh Add.

   Purchases/Returns auto-generate the matching Site Inventory stock
   movement server-side (dump for a purchase, return for a return) —
   Material Dump here is the inventory-side read of exactly those
   purchase-generated movements, distinct from Site Inventory's own
   manual waste entry. Ledger = purchases − returns − payments, same
   computed-on-read shape as the Contractor Ledger. Commission Ledger is
   a referral's equivalent — earnings come from financeWork ×
   referralRatePerSqft across the projects they referred; a referral is
   its own collection (financeReferral), not a vendor. */
const ProcurementPage = ({ url }) => {
    const [searchParams] = useSearchParams();
    // Arriving via `?projectId=&material=` — e.g. a measurement's
    // insufficient-stock toast's "Record a Purchase" link — lands
    // straight on Purchases with both prefilled, instead of the default
    // Vendors tab the user then has to navigate away from.
    const deepLinkProjectId = searchParams.get('projectId') || '';
    const deepLinkMaterialId = searchParams.get('material') || '';
    const [activeTab, setActiveTab] = useState(deepLinkMaterialId ? 'purchases' : TABS[0].key);
    const [selectedVendorId, setSelectedVendorId] = useState('');
    const [selectedReferralId, setSelectedReferralId] = useState('');

    return (
        <FinanceTabShell
            label="Procurement"
            subtitle="Material vendors and purchasing; labour contractors live under Contractors instead."
            tabs={TABS}
            activeKey={activeTab}
            onTabChange={setActiveTab}
        >
            {activeTab === 'vendors' && <ProcurementVendorsOverviewTab url={url} />}
            {activeTab === 'purchases' && (
                <PurchaseOrReturnManager url={url} transactionType="purchase" defaultProjectId={deepLinkProjectId} defaultMaterialId={deepLinkMaterialId} />
            )}
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
            {activeTab === 'referrals' && <MasterCrudTable url={url} resourceKey="referrals" />}
            {activeTab === 'commissionLedger' && (
                <>
                    <ReferralPicker url={url} selectedReferralId={selectedReferralId} onChange={setSelectedReferralId} />
                    {selectedReferralId
                        ? <CommissionLedgerView url={url} referralId={selectedReferralId} />
                        : <div className="admin-empty-state"><p>Select a referral to view their commission ledger.</p></div>}
                </>
            )}
        </FinanceTabShell>
    );
};

export default ProcurementPage;
