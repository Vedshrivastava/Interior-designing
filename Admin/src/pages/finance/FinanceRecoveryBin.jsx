import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import moment from 'moment';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import StyledSelect from '../../components/finance/StyledSelect';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';
import '../../styles/add.css';

// Grouped only by array order (pill bar is still flat, same as every other
// Finance tab strip) — related types sit next to each other so the "where
// did my X go" scan is quicker than an alphabetical dump would be.
const TABS = [
    // Masters
    { key: 'client',          label: 'Clients' },
    { key: 'clientContact',   label: 'Client Contacts' },
    { key: 'vendor',          label: 'Vendors' },
    { key: 'referral',        label: 'Referrals' },
    { key: 'labourProvider',  label: 'Labour Providers' },
    { key: 'employee',        label: 'Employees' },
    { key: 'labourer',        label: 'Labourers' },
    { key: 'material',        label: 'Materials' },
    { key: 'bankAccount',     label: 'Bank Accounts' },
    // Project & Work structure
    { key: 'project',         label: 'Projects' },
    { key: 'work',            label: 'Works' },
    { key: 'workTypeRate',    label: 'Work Type Rates' },
    { key: 'contractorRate',  label: 'Contractor Rates' },
    { key: 'labourRate',      label: 'Labour Rates' },
    { key: 'workContractorAssignment', label: 'Contractor Assignments' },
    { key: 'workLabourAssignment',     label: 'Labour Assignments' },
    // Measurements, billing, purchase & stock
    { key: 'measurement',        label: 'Contractor Measurements' },
    { key: 'labourMeasurement',  label: 'Labour Measurements' },
    { key: 'runningBill',        label: 'Running Bills' },
    { key: 'purchase',           label: 'Purchases' },
    { key: 'stockMovement',      label: 'Stock Movements' },
    // Client-side money
    { key: 'clientQuotation',     label: 'Quotations' },
    { key: 'receipt',             label: 'Receipts' },
    { key: 'clientDirectPayment', label: 'Client Direct Payments' },
    // Worker payouts
    { key: 'contractorAdvance',    label: 'Contractor Advances' },
    { key: 'contractorDeduction',  label: 'Contractor Deductions' },
    { key: 'contractorPayment',    label: 'Contractor Payments' },
    { key: 'labourAdvance',        label: 'Labour Advances' },
    { key: 'labourDeduction',      label: 'Labour Deductions' },
    { key: 'labourPayment',        label: 'Labour Payments' },
    { key: 'labourProviderPayment', label: 'Labour Provider Payments' },
    { key: 'vendorPayment',        label: 'Vendor Payments' },
    { key: 'commissionPayment',    label: 'Commission Payments' },
    { key: 'salaryPayment',        label: 'Salary Payments' },
    // Expenses & staff
    { key: 'expense',              label: 'Expenses' },
    { key: 'expensePayment',       label: 'Expense Payments' },
    { key: 'supervisorAttendance', label: 'Supervisor Attendance' },
    { key: 'supervisorDeduction',  label: 'Supervisor Deductions' },
    { key: 'supervisorIncentive',  label: 'Supervisor Incentives' },
    // Compliance & misc
    { key: 'gstFiling',       label: 'GST Filings' },
    { key: 'tdsDeposit',      label: 'TDS Deposits' },
    { key: 'setting',         label: 'Settings' },
    { key: 'siteDiary',       label: 'Site Diary' },
    { key: 'manualEntry',     label: 'Manual Entries' },
    { key: 'projectPhoto',    label: 'Project Photos' },
    { key: 'clientDocument',  label: 'Client Documents' },
    { key: 'projectDocument', label: 'Project Documents' },
];

const SORT_OPTIONS = [
    { key: 'deletedAtDesc', label: 'Deleted: Newest first' },
    { key: 'deletedAtAsc',  label: 'Deleted: Oldest first' },
    { key: 'nameAsc',       label: 'Name: A → Z' },
    { key: 'nameDesc',      label: 'Name: Z → A' },
];

const sortItems = (items, sortKey) => {
    const sorted = [...items];
    switch (sortKey) {
        case 'deletedAtAsc':
            return sorted.sort((a, b) => new Date(a.deletedAt || 0) - new Date(b.deletedAt || 0));
        case 'nameAsc':
            return sorted.sort((a, b) => a._displayName.localeCompare(b._displayName));
        case 'nameDesc':
            return sorted.sort((a, b) => b._displayName.localeCompare(a._displayName));
        case 'deletedAtDesc':
        default:
            return sorted.sort((a, b) => new Date(b.deletedAt || 0) - new Date(a.deletedAt || 0));
    }
};

// What to show in the "Context" column per type — everything else falls
// back to '—'. Keeps this one generic table from needing 40+ bespoke ones.
const contextOf = (item) => {
    const join = (...parts) => parts.filter(Boolean).join(' · ') || '—';
    switch (item._type) {
        case 'clientContact':  return item.clientId?.name || '—';
        case 'bankEntry':      return join(item.bankAccountId?.accountName, item.projectId?.name);
        case 'bankTransfer':   return join(item.fromAccountId?.accountName && `From ${item.fromAccountId.accountName}`, item.toAccountId?.accountName && `To ${item.toAccountId.accountName}`);
        case 'cashEntry':      return item.projectId?.name || '—';
        case 'project':        return item.clientId?.name || '—';
        case 'work':           return item.projectId?.name || '—';
        case 'workTypeRate':   return item.projectId?.name || '—';
        case 'contractorRate': return join(item.projectId?.name, item.contractorVendorId?.name);
        case 'labourRate':     return join(item.projectId?.name, item.labourerId?.name);
        case 'workContractorAssignment': return join(item.workId?.workType, item.contractorVendorId?.name);
        case 'workLabourAssignment':     return join(item.workId?.workType, item.labourerId?.name);
        case 'measurement':          return join(item.projectId?.name, item.workId?.workType, item.contractorVendorId?.name);
        case 'labourMeasurement':    return join(item.projectId?.name, item.workId?.workType, item.labourerId?.name);
        case 'runningBill':    return item.projectId?.name || '—';
        case 'purchase':       return join(item.projectId?.name, item.vendorId?.name, item.materialId?.name);
        case 'stockMovement':  return join(item.projectId?.name, item.materialId?.name);
        case 'receipt':        return join(item.clientId?.name, item.projectId?.name);
        case 'clientQuotation':     return item.projectId?.name || '—';
        case 'clientDirectPayment': return join(item.projectId?.name, item.workId?.workType);
        case 'contractorAdvance':
        case 'contractorDeduction':
        case 'contractorPayment':   return join(item.vendorId?.name, item.projectId?.name);
        case 'labourAdvance':
        case 'labourDeduction':
        case 'labourPayment':       return join(item.labourerId?.name, item.projectId?.name);
        case 'labourProviderPayment': return join(item.labourProviderId?.name, item.projectId?.name);
        case 'vendorPayment':      return join(item.vendorId?.name, item.projectId?.name);
        case 'commissionPayment':  return join(item.referralId?.name, item.projectId?.name);
        case 'salaryPayment':      return item.employeeId?.name || '—';
        case 'expense':             return item.projectId?.name || '—';
        case 'expensePayment':      return item.expenseId ? `${item.expenseId.expenseCategory || 'Expense'} — ₹${(item.expenseId.amount || 0).toLocaleString('en-IN')}` : '—';
        case 'supervisorAttendance': return item.employeeId?.name || '—';
        case 'supervisorDeduction':
        case 'supervisorIncentive':  return join(item.employeeId?.name, item.projectId?.name);
        case 'tdsDeposit':     return item.tdsSectionId?.name || '—';
        case 'siteDiary':      return item.projectId?.name || '—';
        case 'manualEntry':    return item.projectId?.name || '—';
        case 'projectPhoto':   return item.projectId?.name || '—';
        case 'clientDocument':  return item.clientId?.name || '—';
        case 'projectDocument': return item.projectId?.name || '—';
        case 'vendor':          return item.vendorType || '—';
        default:                return '—';
    }
};

/*
 * Finance's own Recovery Bin — deliberately separate from the main
 * dashboard's (/recovery-bin, pages/RecoveryBin.jsx), which only ever
 * covers public-site content (designs/products/projects/categories/etc.)
 * and never touches any financeXxx model. This one covers every finance
 * entity that soft-deletes (see financeRecovery.js's own comment for the
 * short list deliberately left out — a singleton and two superseded
 * models) — nothing from the public site.
 */
const FinanceRecoveryBin = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [bin, setBin] = useState({});
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(TABS[0].key);
    const [query, setQuery] = useState('');
    const [sortKey, setSortKey] = useState('deletedAtDesc');
    const [confirmItem, setConfirmItem] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const fetchBin = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/recovery/bin`, authHeader);
            if (res.data.success) setBin(res.data.data);
            else toast.error('Failed to load recovery bin');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to load recovery bin');
        } finally {
            setLoading(false);
        }
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { fetchBin(); }, [fetchBin]);
    useFinanceWsRefresh(['*'], fetchBin);

    const restore = async (item) => {
        try {
            const res = await axios.post(`${url}/api/finance/recovery/restore`, { _id: item._id, _type: item._type }, authHeader);
            if (res.data.success) { toast.success(res.data.message); fetchBin(); }
            else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to restore');
        }
    };

    const permanentDelete = async () => {
        if (!confirmItem || deleting) return;
        setDeleting(true);
        try {
            const res = await axios.delete(`${url}/api/finance/recovery/permanent`, {
                data: { _id: confirmItem._id, _type: confirmItem._type },
                ...authHeader,
            });
            if (res.data.success) { toast.success(res.data.message); fetchBin(); }
            else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to permanently delete');
        } finally {
            setDeleting(false);
            setConfirmItem(null);
        }
    };

    const tabs = TABS.map(t => ({ ...t, label: `${t.label} (${(bin[t.key] || []).length})` }));
    const total = Object.values(bin).reduce((sum, arr) => sum + (arr?.length || 0), 0);
    const filtered = (bin[activeTab] || []).filter(item => !query || item._displayName.toLowerCase().includes(query.toLowerCase()));
    const items = sortItems(filtered, sortKey);

    return (
        <FinanceTabShell
            label="Recovery Bin"
            subtitle="Restore deleted Finance records or remove them for good. Only you (Master) can see this — public-site content (designs, products, projects) has its own separate bin under the main Dashboard."
            tabs={tabs}
            activeKey={activeTab}
            onTabChange={setActiveTab}
            badge={`${total} item${total !== 1 ? 's' : ''}`}
            headerAction={
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: '190px' }}>
                        <StyledSelect value={sortKey} onChange={v => setSortKey(v || 'deletedAtDesc')} options={SORT_OPTIONS.map(o => ({ value: o.key, label: o.label }))} placeholder="Sort" />
                    </div>
                    <div className="admin-search-wrap">
                        <input type="text" placeholder="Search by name…" value={query} onChange={e => setQuery(e.target.value)} />
                        {query && <button className="admin-search-clear" onClick={() => setQuery('')}>×</button>}
                    </div>
                </div>
            }
        >
            <div className="dash-chart-card rcb-card">
                <div className="rcb-row rcb-header">
                    <b className="rcb-name">Name</b>
                    <b className="rcb-context">Context</b>
                    <b className="rcb-deletedby">Deleted By</b>
                    <b className="rcb-when">When</b>
                    <b className="rcb-action">Actions</b>
                </div>

                {loading ? (
                    <div className="admin-empty-state"><p>Loading…</p></div>
                ) : items.length === 0 ? (
                    <div className="admin-empty-state"><p>Nothing here — all clear.</p></div>
                ) : items.map(item => (
                    <div key={item._id} className="rcb-row">
                        <p className="rcb-name" style={{ opacity: 0.85 }}>{item._displayName}</p>
                        <p className="rcb-context"><span className="pq-group-label">Context</span><span className="item-category">{contextOf(item)}</span></p>
                        <p className="rcb-deletedby"><span className="pq-group-label">Deleted By</span>{item.deletedBy || '—'}</p>
                        <p className="rcb-when" title={item.deletedAt ? moment(item.deletedAt).format('DD MMM YYYY, HH:mm') : ''}>
                            <span className="pq-group-label">When</span>{item.deletedAt ? moment(item.deletedAt).fromNow() : '—'}
                        </p>
                        <div className="rcb-action">
                            <p className="cursor edit-action" style={{ color: '#16a34a', borderColor: 'rgba(34,197,94,0.3)' }} onClick={() => restore(item)}>Restore</p>
                            <p className="cursor delete-action" onClick={() => setConfirmItem(item)} title="This cannot be undone">Delete Forever</p>
                        </div>
                    </div>
                ))}
            </div>

            {confirmItem && ReactDOM.createPortal(
                <div className="bin-confirm-backdrop" onClick={() => !deleting && setConfirmItem(null)}>
                    <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="bin-confirm-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
                        <h3>Delete Forever?</h3>
                        <p className="bin-confirm-name">"{confirmItem._displayName}"</p>
                        <p className="bin-confirm-warning">
                            This permanently removes the record{confirmItem._type === 'clientDocument' || confirmItem._type === 'projectDocument' ? ' and its file' : ''}.<br /><strong>This action cannot be undone.</strong>
                        </p>
                        <div className="bin-confirm-actions">
                            <button className="bin-btn-cancel" onClick={() => setConfirmItem(null)} disabled={deleting}>Cancel</button>
                            <button className="bin-btn-delete" onClick={permanentDelete} disabled={deleting}>
                                {deleting ? 'Deleting…' : 'Yes, Delete Forever'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </FinanceTabShell>
    );
};

export default FinanceRecoveryBin;
