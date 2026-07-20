import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import moment from 'moment';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';
import '../../styles/add.css';

const TABS = [
    { key: 'client',          label: 'Clients' },
    { key: 'vendor',          label: 'Vendors' },
    { key: 'employee',        label: 'Employees' },
    { key: 'labourer',        label: 'Labourers' },
    { key: 'material',        label: 'Materials' },
    { key: 'bankAccount',     label: 'Bank Accounts' },
    { key: 'project',         label: 'Projects' },
    { key: 'work',            label: 'Works' },
    { key: 'runningBill',     label: 'Running Bills' },
    { key: 'purchase',        label: 'Purchases' },
    { key: 'clientDocument',  label: 'Client Documents' },
    { key: 'projectDocument', label: 'Project Documents' },
];

// What to show in the "Context" column per type — everything else falls
// back to '—'. Keeps this one generic table from needing 12 bespoke ones.
const contextOf = (item) => {
    switch (item._type) {
        case 'project':         return item.clientId?.name || '—';
        case 'work':            return item.projectId?.name || '—';
        case 'runningBill':     return item.projectId?.name || '—';
        case 'clientDocument':  return item.clientId?.name || '—';
        case 'projectDocument': return item.projectId?.name || '—';
        case 'purchase':        return [item.projectId?.name, item.vendorId?.name, item.materialId?.name].filter(Boolean).join(' · ') || '—';
        case 'vendor':          return item.vendorType || '—';
        default:                return '—';
    }
};

/*
 * Finance's own Recovery Bin — deliberately separate from the main
 * dashboard's (/recovery-bin, pages/RecoveryBin.jsx), which only ever
 * covers public-site content (designs/products/projects/categories/etc.)
 * and never touches any financeXxx model. This one is the mirror image:
 * only the 12 Finance entities whose own list pages actually promise
 * "Moved to Recovery Bin" on delete (Clients, Vendors, Employees,
 * Labourers, Materials, Bank Accounts, Projects, Works, Running Bills,
 * Purchases, Client/Project Documents) — nothing from the public site.
 */
const FinanceRecoveryBin = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [bin, setBin] = useState({});
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(TABS[0].key);
    const [query, setQuery] = useState('');
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
    const items = (bin[activeTab] || []).filter(item => !query || item._displayName.toLowerCase().includes(query.toLowerCase()));

    return (
        <FinanceTabShell
            label="Recovery Bin"
            subtitle="Restore deleted Finance records or remove them for good. Only you (Master) can see this — public-site content (designs, products, projects) has its own separate bin under the main Dashboard."
            tabs={tabs}
            activeKey={activeTab}
            onTabChange={setActiveTab}
            badge={`${total} item${total !== 1 ? 's' : ''}`}
            headerAction={
                <div className="admin-search-wrap">
                    <input type="text" placeholder="Search by name…" value={query} onChange={e => setQuery(e.target.value)} />
                    {query && <button className="admin-search-clear" onClick={() => setQuery('')}>×</button>}
                </div>
            }
        >
            <div className="list-table">
                <div className="list-table-format title" style={{ gridTemplateColumns: '1.4fr 1.2fr 1fr 1fr 190px' }}>
                    <b>Name</b><b>Context</b><b>Deleted By</b><b>When</b><b>Actions</b>
                </div>

                {loading ? (
                    <div className="admin-empty-state"><p>Loading…</p></div>
                ) : items.length === 0 ? (
                    <div className="admin-empty-state"><p>Nothing here — all clear.</p></div>
                ) : items.map(item => (
                    <div key={item._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1.4fr 1.2fr 1fr 1fr 190px' }}>
                        <p style={{ opacity: 0.85 }}>{item._displayName}</p>
                        <span className="item-category">{contextOf(item)}</span>
                        <p>{item.deletedBy || '—'}</p>
                        <p title={item.deletedAt ? moment(item.deletedAt).format('DD MMM YYYY, HH:mm') : ''}>
                            {item.deletedAt ? moment(item.deletedAt).fromNow() : '—'}
                        </p>
                        <div className="action-buttons">
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
